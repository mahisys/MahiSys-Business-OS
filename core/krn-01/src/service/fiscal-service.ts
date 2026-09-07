import { randomUUID } from 'node:crypto'
import type { Krn01Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { FiscalCalendar, FiscalPeriod } from '../contracts/fiscal-period.js'
import { FISCAL_PERIOD_STATUS_TRANSITIONS } from '../contracts/fiscal-period.js'
import { KernelError } from './errors.js'
import { assertPermission, type PersonaId } from './permissions.js'

export type CreateFiscalCalendarInput = Omit<
  FiscalCalendar,
  'id' | 'namespace' | 'ext' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by' | 'version' | 'deleted_at' | 'deleted_by' | 'source' | 'trace_id'
>
export type CreateFiscalPeriodInput = Omit<
  FiscalPeriod,
  'id' | 'namespace' | 'ext' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by' | 'version' | 'deleted_at' | 'deleted_by' | 'source' | 'trace_id'
>

function now() {
  return new Date().toISOString()
}
function universalFieldsFor(actor: ActorRef) {
  const timestamp = now()
  return {
    id: randomUUID(),
    namespace: 'sys' as const,
    ext: {},
    created_at: timestamp,
    created_by: actor,
    updated_at: timestamp,
    updated_by: actor,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    source: 'api' as const,
    trace_id: randomUUID(),
  }
}

export function createFiscalCalendar(store: Krn01Store, input: CreateFiscalCalendarInput, actor: ActorRef): FiscalCalendar {
  const calendar: FiscalCalendar = { ...universalFieldsFor(actor), ...input }
  store.fiscalCalendars.set(calendar.id, calendar)
  return calendar
}

export function createFiscalPeriod(store: Krn01Store, input: CreateFiscalPeriodInput, actor: ActorRef): FiscalPeriod {
  const period: FiscalPeriod = { ...universalFieldsFor(actor), ...input }
  store.fiscalPeriods.set(period.id, period)
  return period
}

/** KRN-01-FR-001: resolves the fiscal period valid for a given entity and date. */
export function resolveFiscalPeriod(store: Krn01Store, entityId: string, date: string): FiscalPeriod | undefined {
  for (const period of store.fiscalPeriods.values()) {
    if (period.entity_id === entityId && period.from <= date && date <= period.to) {
      return period
    }
  }
  return undefined
}

/**
 * KRN-01-FR-003: the guard every transacting module calls before posting.
 * Pure query — never creates a record, never emits an event, whichever
 * way it resolves.
 */
export function checkPostingAllowed(
  store: Krn01Store,
  entityId: string,
  postingDate: string,
): { allowed: boolean; reason?: string } {
  const period = resolveFiscalPeriod(store, entityId, postingDate)
  if (!period) {
    return { allowed: false, reason: `No fiscal period covers ${postingDate} for entity ${entityId}.` }
  }
  if (period.status !== 'open') {
    return { allowed: false, reason: `Fiscal period ${period.id} is ${period.status}; posting is rejected (KRN-01-FR-003).` }
  }
  return { allowed: true }
}

function transitionPeriodStatus(
  store: Krn01Store,
  periodId: string,
  target: FiscalPeriod['status'],
  actor: ActorRef,
  eventName: string,
  callerPersona: PersonaId,
): FiscalPeriod {
  assertPermission(store, callerPersona, 'fiscal_period.close_reopen')

  const period = store.fiscalPeriods.get(periodId)
  if (!period) {
    throw new KernelError('FISCAL_PERIOD_NOT_FOUND', `No fiscal period with id ${periodId}`, randomUUID())
  }
  if (!isValidTransition(FISCAL_PERIOD_STATUS_TRANSITIONS, period.status, target)) {
    throw new KernelError(
      'ILLEGAL_FISCAL_PERIOD_TRANSITION',
      `Cannot transition fiscal period from ${period.status} to ${target} (KRN-01.md §5).`,
      randomUUID(),
      { from: period.status, to: target },
    )
  }

  const timestamp = now()
  const updated: FiscalPeriod = { ...period, status: target, updated_at: timestamp, updated_by: actor, version: period.version + 1 }
  store.fiscalPeriods.set(periodId, updated)

  store.emit({
    event_name: eventName,
    tenant_id: updated.tenant_id,
    entity_id: updated.entity_id,
    subject_type: 'fiscal_period',
    subject_id: periodId,
    payload: { fiscal_period_id: periodId, entity_id: updated.entity_id, status: updated.status },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return updated
}

export function closeFiscalPeriod(store: Krn01Store, periodId: string, actor: ActorRef, callerPersona: PersonaId): FiscalPeriod {
  return transitionPeriodStatus(store, periodId, 'closed', actor, 'core.fiscal_period.closed', callerPersona)
}

export function reopenFiscalPeriod(store: Krn01Store, periodId: string, actor: ActorRef, callerPersona: PersonaId): FiscalPeriod {
  return transitionPeriodStatus(store, periodId, 'open', actor, 'core.fiscal_period.reopened', callerPersona)
}
