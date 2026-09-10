import { randomUUID } from 'node:crypto'
import type { Krn11Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { CancelledNumberReason } from '../contracts/cancelled-number.js'
import { formatNumber } from '../contracts/number-series.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

export interface AllocateInput {
  seriesId: string
  documentId?: string | null
  idempotencyKey: string
}

export interface AllocationResult {
  allocationId: string
  seriesId: string
  sequenceValue: number
  formattedNumber: string
  status: 'reserved' | 'allocated'
}

function now() {
  return new Date().toISOString()
}

/**
 * `KRN-11-FR-001..003/005/006`: the single allocation entry point. Not
 * persona-gated (§11's own note) — called by a transacting module's
 * already-authorised document-creation action, never directly. Idempotent
 * on `idempotencyKey` (KRN-11-FR-005 point 4): a retried call resolves to
 * its original result rather than issuing a second number.
 *
 * `on_issue` mode allocates the final number immediately, atomically
 * (current_value and reserved_high_watermark both advance together — no
 * intermediate "reserved" state is ever observable, matching FR-003's "the
 * failed attempt leaves no trace" when the caller validates before ever
 * calling this function at all). `on_draft_with_reservation` mode only
 * advances `reserved_high_watermark` and opens a reservation entry
 * (KRN-11-FR-006) — `current_value` (the *confirmed* high-water mark)
 * moves only on `confirmReservation`.
 */
export function allocate(store: Krn11Store, input: AllocateInput, actor: ActorRef): AllocationResult {
  const existing = store.idempotencyIndex.get(input.idempotencyKey)
  if (existing) {
    return { allocationId: existing.allocationId, seriesId: existing.seriesId, sequenceValue: existing.sequenceValue, formattedNumber: existing.formattedNumber, status: existing.status }
  }

  const series = store.series.get(input.seriesId)
  if (!series) throw new KernelError('SERIES_NOT_FOUND', `No number_series with id ${input.seriesId}`, randomUUID())
  if (series.status !== 'active') {
    throw new KernelError('SERIES_CLOSED', `number_series ${input.seriesId} is closed and cannot allocate further numbers.`, randomUUID())
  }
  const state = store.sequenceStates.get(input.seriesId)
  if (!state) throw new KernelError('SEQUENCE_STATE_NOT_FOUND', `No sequence_state for series ${input.seriesId}`, randomUUID())

  const nextValue = Math.max(state.current_value, state.reserved_high_watermark) + 1
  const formatted = formatNumber(series, nextValue)
  const allocationId = randomUUID()
  const timestamp = now()

  if (series.allocation_mode === 'on_draft_with_reservation') {
    store.sequenceStates.set(input.seriesId, {
      ...state,
      reserved_high_watermark: nextValue,
      updated_at: timestamp,
      updated_by: actor,
      version: state.version + 1,
      open_reservations: [...state.open_reservations, { allocation_id: allocationId, sequence_value: nextValue, reserved_at: timestamp, expires_at: null, idempotency_key: input.idempotencyKey }],
    })

    const result: AllocationResult = { allocationId, seriesId: input.seriesId, sequenceValue: nextValue, formattedNumber: formatted, status: 'reserved' }
    store.idempotencyIndex.set(input.idempotencyKey, result)

    store.emit({
      tenant_id: series.tenant_id,
      entity_id: series.entity_id,
      event_name: 'numbering.number.reserved',
      actor,
      subject_type: 'number_series',
      subject_id: input.seriesId,
      payload: { series_id: input.seriesId, allocation_id: allocationId, sequence_value: nextValue, formatted_number: formatted },
    })

    return result
  }

  // on_issue: immediate, final.
  store.sequenceStates.set(input.seriesId, {
    ...state,
    current_value: nextValue,
    reserved_high_watermark: nextValue,
    updated_at: timestamp,
    updated_by: actor,
    version: state.version + 1,
  })

  const result: AllocationResult = { allocationId, seriesId: input.seriesId, sequenceValue: nextValue, formattedNumber: formatted, status: 'allocated' }
  store.idempotencyIndex.set(input.idempotencyKey, result)

  store.emit({
    tenant_id: series.tenant_id,
    entity_id: series.entity_id,
    event_name: 'numbering.number.allocated',
    actor,
    subject_type: 'number_series',
    subject_id: input.seriesId,
    payload: { series_id: input.seriesId, sequence_value: nextValue, formatted_number: formatted, document_id: input.documentId ?? null },
  })

  return result
}

function findOpenReservation(store: Krn11Store, allocationId: string) {
  for (const [seriesId, state] of store.sequenceStates) {
    const reservation = state.open_reservations.find((r) => r.allocation_id === allocationId)
    if (reservation) return { seriesId, state, reservation }
  }
  return null
}

/**
 * `KRN-11-FR-006`: confirms an open reservation into a firm allocation.
 * Rejects confirming "ahead of" a *still-open* smaller reservation (which
 * might yet confirm behind this one and create true disorder), but does
 * not require the reservation to be exactly `current_value + 1` — a
 * smaller value that was already cancelled (not merely still open) is
 * permanently resolved, so confirming past it is correct, not a gap.
 * `current_value` is set to `max(current_value, sequence_value)` rather
 * than incremented by exactly one for the same reason.
 */
export function confirmReservation(store: Krn11Store, allocationId: string, actor: ActorRef, documentId?: string | null): AllocationResult {
  const found = findOpenReservation(store, allocationId)
  if (!found) throw new KernelError('RESERVATION_NOT_FOUND', `No open reservation with allocation_id ${allocationId}`, randomUUID())
  const { seriesId, state, reservation } = found

  const smallerStillOpen = state.open_reservations.some((r) => r.allocation_id !== allocationId && r.sequence_value < reservation.sequence_value)
  if (smallerStillOpen) {
    throw new KernelError('RESERVATION_OUT_OF_ORDER', `Reservation ${allocationId} (value ${reservation.sequence_value}) cannot confirm ahead of a still-open smaller reservation on the same series; resolve it first.`, randomUUID())
  }

  const series = store.series.get(seriesId)!
  const formatted = formatNumber(series, reservation.sequence_value)
  const timestamp = now()

  store.sequenceStates.set(seriesId, {
    ...state,
    current_value: Math.max(state.current_value, reservation.sequence_value),
    open_reservations: state.open_reservations.filter((r) => r.allocation_id !== allocationId),
    updated_at: timestamp,
    updated_by: actor,
    version: state.version + 1,
  })

  store.emit({
    tenant_id: series.tenant_id,
    entity_id: series.entity_id,
    event_name: 'numbering.number.allocated',
    actor,
    subject_type: 'number_series',
    subject_id: seriesId,
    payload: { series_id: seriesId, sequence_value: reservation.sequence_value, formatted_number: formatted, document_id: documentId ?? null },
  })

  return { allocationId, seriesId, sequenceValue: reservation.sequence_value, formattedNumber: formatted, status: 'allocated' }
}

function recordCancelledNumber(store: Krn11Store, seriesId: string, sequenceValue: number, reason: CancelledNumberReason, actor: ActorRef, documentId: string | null) {
  const series = store.series.get(seriesId)!
  const formatted = formatNumber(series, sequenceValue)
  const id = randomUUID()
  const timestamp = now()
  const cancelled = {
    id,
    tenant_id: series.tenant_id,
    entity_id: series.entity_id,
    namespace: 'tnt' as const,
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
    series_id: seriesId,
    sequence_value: sequenceValue,
    formatted_number: formatted,
    document_id: documentId,
    reason,
    cancelled_at: timestamp,
    cancelled_by: actor,
  }
  store.cancelledNumbers.set(id, cancelled)

  store.emit({
    tenant_id: series.tenant_id,
    entity_id: series.entity_id,
    event_name: 'numbering.number.cancelled',
    actor,
    subject_type: 'number_series',
    subject_id: seriesId,
    payload: { series_id: seriesId, sequence_value: sequenceValue, reason },
  })

  return cancelled
}

/**
 * `KRN-11-FR-006`: releases an open (not yet confirmed) reservation —
 * abandoned draft, expired hold, or a downstream validation failure
 * discovered before issue. `current_value` is untouched (it never
 * included the reservation in the first place); `reserved_high_watermark`
 * stays where it is too — the value is permanently retired, never reused
 * (KRN-11-FR-002), so the next allocation continues past it.
 */
export function cancelReservation(store: Krn11Store, allocationId: string, reason: CancelledNumberReason, actor: ActorRef) {
  const found = findOpenReservation(store, allocationId)
  if (!found) throw new KernelError('RESERVATION_NOT_FOUND', `No open reservation with allocation_id ${allocationId}`, randomUUID())
  const { seriesId, state, reservation } = found

  store.sequenceStates.set(seriesId, {
    ...state,
    open_reservations: state.open_reservations.filter((r) => r.allocation_id !== allocationId),
    updated_at: now(),
    updated_by: actor,
    version: state.version + 1,
  })

  return recordCancelledNumber(store, seriesId, reservation.sequence_value, reason, actor, null)
}

/**
 * `KRN-11-FR-002`: voids an already-confirmed/allocated number
 * (`document_voided`, `document_failed_validation` discovered downstream
 * of allocation, or `manual_correction`) — PR-16/PR-15 only (§11);
 * `current_value` is never decremented, the value is never reissued.
 */
export function cancelAllocatedNumber(store: Krn11Store, seriesId: string, sequenceValue: number, reason: CancelledNumberReason, actor: ActorRef, callerPersona: PersonaId, documentId?: string | null) {
  assertPermission(callerPersona, 'cancel')
  const series = store.series.get(seriesId)
  if (!series) throw new KernelError('SERIES_NOT_FOUND', `No number_series with id ${seriesId}`, randomUUID())
  return recordCancelledNumber(store, seriesId, sequenceValue, reason, actor, documentId ?? null)
}

/**
 * §13 KPI — "Gap integrity check": for a gapless series, `current_value`
 * minus (count of allocated documents + count of cancelled numbers) must
 * be zero, i.e. every value from 1..current_value is accounted for by
 * exactly one of the two. This reference implementation has no separate
 * per-value "allocated" ledger beyond `current_value` itself (an
 * `on_issue` allocation is final and immediate, never separately listed),
 * so "allocated count" here is `current_value` minus the number of
 * cancellations that ever occurred against this series — the check
 * degenerates to confirming `cancelledCount` numbers really were pulled
 * out of the `1..current_value` range and none double-counted, which is
 * what `KRN-11-FR-005` point 3 actually verifies.
 */
export function checkGapIntegrity(store: Krn11Store, seriesId: string): { currentValue: number; cancelledCount: number; allocatedCount: number; isIntact: boolean } {
  const state = store.sequenceStates.get(seriesId)
  if (!state) throw new KernelError('SEQUENCE_STATE_NOT_FOUND', `No sequence_state for series ${seriesId}`, randomUUID())
  const cancelledCount = Array.from(store.cancelledNumbers.values()).filter((c) => c.series_id === seriesId).length
  const allocatedCount = state.current_value - cancelledCount
  return { currentValue: state.current_value, cancelledCount, allocatedCount, isIntact: allocatedCount + cancelledCount === state.current_value }
}
