import { randomUUID } from 'node:crypto'
import type { Krn11Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { NumberSeries, ResetPolicy, AllocationMode } from '../contracts/number-series.js'
import { NUMBER_SERIES_STATUS_TRANSITIONS } from '../contracts/number-series.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateSeriesInput {
  tenant_id: string
  entity_id: string // KRN-01 legal entity — universal field, see number-series.ts header note
  namespace: 'sys' | 'tnt'
  document_type_id: string
  location_id: string | null
  fiscal_year: string | null
  prefix: string
  suffix: string
  width: number
  separator: string | null
  is_gapless: boolean
  reset_policy: ResetPolicy
  allocation_mode: AllocationMode
}

function now() {
  return new Date().toISOString()
}

function initSequenceState(store: Krn11Store, seriesId: string, tenantId: string, entityId: string, actor: ActorRef) {
  const id = randomUUID()
  const timestamp = now()
  store.sequenceStates.set(seriesId, {
    id,
    tenant_id: tenantId,
    entity_id: entityId,
    namespace: 'tnt',
    ext: {},
    created_at: timestamp,
    created_by: actor,
    updated_at: timestamp,
    updated_by: actor,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    source: 'api',
    trace_id: randomUUID(),
    series_id: seriesId,
    current_value: 0,
    reserved_high_watermark: 0,
    locked_at: null,
    open_reservations: [],
  })
}

export function createSeries(store: Krn11Store, input: CreateSeriesInput, actor: ActorRef, callerPersona: PersonaId): NumberSeries {
  assertPermission(callerPersona, 'series.configure')

  const id = randomUUID()
  const timestamp = now()
  const series: NumberSeries = {
    id,
    tenant_id: input.tenant_id,
    entity_id: input.entity_id,
    namespace: input.namespace,
    ext: {},
    created_at: timestamp,
    created_by: actor,
    updated_at: timestamp,
    updated_by: actor,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    source: 'api',
    trace_id: randomUUID(),
    document_type_id: input.document_type_id,
    location_id: input.location_id,
    fiscal_year: input.fiscal_year,
    prefix: input.prefix,
    suffix: input.suffix,
    width: input.width,
    separator: input.separator,
    is_gapless: input.is_gapless,
    reset_policy: input.reset_policy,
    allocation_mode: input.allocation_mode,
    status: 'active',
  }
  store.series.set(id, series)
  initSequenceState(store, id, input.tenant_id, input.entity_id, actor)

  store.emit({
    tenant_id: series.tenant_id,
    entity_id: series.entity_id,
    event_name: 'numbering.series.created',
    actor,
    subject_type: 'number_series',
    subject_id: id,
    payload: { series_id: id, document_type_id: series.document_type_id },
  })

  return series
}

/**
 * `is_gapless`/`width` are immutable once any number has been allocated
 * against the series — an engine-level integrity rule enforced regardless
 * of caller role (§11 negative case), not merely a permission decision.
 */
export function updateSeries(store: Krn11Store, seriesId: string, patch: Partial<Pick<CreateSeriesInput, 'prefix' | 'suffix' | 'separator' | 'is_gapless' | 'width'>>, actor: ActorRef, callerPersona: PersonaId): NumberSeries {
  assertPermission(callerPersona, 'series.configure')
  const series = store.series.get(seriesId)
  if (!series) throw new KernelError('SERIES_NOT_FOUND', `No number_series with id ${seriesId}`, randomUUID())

  const touchesImmutable = patch.is_gapless !== undefined || patch.width !== undefined
  const sequenceState = store.sequenceStates.get(seriesId)
  if (touchesImmutable && sequenceState && sequenceState.current_value > 0) {
    throw new KernelError('SERIES_IMMUTABLE_FIELD_LOCKED', `is_gapless/width cannot change on series ${seriesId} once a number has been allocated (KRN-11.md §11).`, randomUUID())
  }

  const timestamp = now()
  const updated: NumberSeries = { ...series, ...patch, updated_at: timestamp, updated_by: actor, version: series.version + 1 }
  store.series.set(seriesId, updated)

  store.emit({
    tenant_id: series.tenant_id,
    entity_id: series.entity_id,
    event_name: 'numbering.series.updated',
    actor,
    subject_type: 'number_series',
    subject_id: seriesId,
    payload: { series_id: seriesId },
  })

  return updated
}

function transitionToClosed(store: Krn11Store, series: NumberSeries, actor: ActorRef): NumberSeries {
  if (!isValidTransition(NUMBER_SERIES_STATUS_TRANSITIONS, series.status, 'closed')) {
    throw new KernelError('ILLEGAL_SERIES_STATUS_TRANSITION', `Cannot transition number_series from ${series.status} to closed (KRN-11.md §5).`, randomUUID())
  }

  const timestamp = now()
  const updated: NumberSeries = { ...series, status: 'closed', updated_at: timestamp, updated_by: actor, version: series.version + 1 }
  store.series.set(series.id, updated)

  store.emit({
    tenant_id: series.tenant_id,
    entity_id: series.entity_id,
    event_name: 'numbering.series.closed',
    actor,
    subject_type: 'number_series',
    subject_id: series.id,
    payload: { series_id: series.id },
  })

  return updated
}

export function closeSeries(store: Krn11Store, seriesId: string, actor: ActorRef, callerPersona: PersonaId): NumberSeries {
  assertPermission(callerPersona, 'series.close')
  const series = store.series.get(seriesId)
  if (!series) throw new KernelError('SERIES_NOT_FOUND', `No number_series with id ${seriesId}`, randomUUID())
  return transitionToClosed(store, series, actor)
}

/**
 * `KRN-11-FR-004`: fiscal-year rollover. Creates a *new* `number_series`
 * row for the next fiscal year with a fresh `sequence_state` starting at
 * 0, closes the prior fiscal year's series (its history, including
 * `cancelled_number` rows, stays queryable unchanged under its own
 * `series_id` — L12) — the same "supersede via a new row" pattern KRN-03
 * uses for `data_scope_rule`/`field_policy`. Rollover is per-entity, per
 * §14: an entity on a different fiscal calendar rolls independently.
 */
export function rolloverSeries(store: Krn11Store, seriesId: string, newFiscalYear: string, actor: ActorRef, callerPersona: PersonaId): NumberSeries {
  assertPermission(callerPersona, 'rollover')
  const prior = store.series.get(seriesId)
  if (!prior) throw new KernelError('SERIES_NOT_FOUND', `No number_series with id ${seriesId}`, randomUUID())
  if (prior.reset_policy === 'never') {
    throw new KernelError('SERIES_NOT_ROLLOVER_ELIGIBLE', `number_series ${seriesId} has reset_policy: never and cannot be rolled over (KRN-11.md §5).`, randomUUID())
  }

  transitionToClosed(store, prior, actor) // internal consequence of rollover itself — not a second series.close permission check (PR-16 approves rollover but doesn't separately hold series.close)

  const newId = randomUUID()
  const timestamp = now()
  const next: NumberSeries = {
    ...prior,
    id: newId,
    entity_id: prior.entity_id,
    created_at: timestamp,
    created_by: actor,
    updated_at: timestamp,
    updated_by: actor,
    version: 1,
    trace_id: randomUUID(),
    fiscal_year: newFiscalYear,
    status: 'active',
  }
  store.series.set(newId, next)
  initSequenceState(store, newId, prior.tenant_id, prior.entity_id, actor)

  store.emit({
    tenant_id: prior.tenant_id,
    entity_id: prior.entity_id,
    event_name: 'numbering.series.rolled_over',
    actor,
    subject_type: 'number_series',
    subject_id: newId,
    payload: { prior_series_id: seriesId, new_series_id: newId, fiscal_year: newFiscalYear },
  })

  return next
}

export function getSeries(store: Krn11Store, id: string): NumberSeries | undefined {
  return store.series.get(id)
}
