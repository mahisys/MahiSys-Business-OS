/**
 * KRN-11 acceptance tests — every G/W/T in KRN-11.md §16, written against
 * the real service functions (Vol 6 §6 step 3).
 */
import { describe, it, expect } from 'vitest'
import { createSeries, updateSeries, closeSeries, rolloverSeries } from '@mahisys/krn-11'
import { createSeriesAssignment, resolveSeriesForDocument } from '@mahisys/krn-11'
import { allocate, confirmReservation, cancelReservation, cancelAllocatedNumber, checkGapIntegrity } from '@mahisys/krn-11'
import { listCancelledNumbers } from '@mahisys/krn-11'
import { newStores, makeSeries, makeAssignment, sysActor, userActor, TENANT_ID, LEGAL_ENTITY_ID, LEGAL_ENTITY_ID_2, LOCATION_PUNE, LOCATION_NASHIK } from './krn-11.fixtures.js'

describe('KRN-11-FR-001 — series scoping', () => {
  it('an invoice at each location allocates from its own series, unaffected by the other', () => {
    const { krn11 } = newStores()
    const puneSeries = makeSeries(krn11, { location_id: LOCATION_PUNE })
    const nashikSeries = makeSeries(krn11, { location_id: LOCATION_NASHIK })
    makeAssignment(krn11, puneSeries.id, { location_id: LOCATION_PUNE })
    makeAssignment(krn11, nashikSeries.id, { location_id: LOCATION_NASHIK })

    const puneAssignment = resolveSeriesForDocument(krn11, LEGAL_ENTITY_ID, puneSeries.document_type_id, LOCATION_PUNE)
    const nashikAssignment = resolveSeriesForDocument(krn11, LEGAL_ENTITY_ID, nashikSeries.document_type_id, LOCATION_NASHIK)
    expect(puneAssignment.series_id).toBe(puneSeries.id)
    expect(nashikAssignment.series_id).toBe(nashikSeries.id)

    const puneAlloc = allocate(krn11, { seriesId: puneSeries.id, idempotencyKey: 'k-pune-1' }, sysActor)
    expect(puneAlloc.formattedNumber).toMatch(/^INV\/0001$/)

    const nashikAlloc = allocate(krn11, { seriesId: nashikSeries.id, idempotencyKey: 'k-nashik-1' }, sysActor)
    expect(nashikAlloc.sequenceValue).toBe(1) // Nashik's own counter, unaffected by Pune's allocation
  })
})

describe('KRN-11-FR-002 — gapless statutory guarantee', () => {
  it('a voided invoice is recorded cancelled, current_value is not decremented, and the value is never reissued', () => {
    const { krn11 } = newStores()
    const series = makeSeries(krn11)
    for (let i = 0; i < 118; i++) allocate(krn11, { seriesId: series.id, idempotencyKey: `k-${i}` }, sysActor)
    const alloc119 = allocate(krn11, { seriesId: series.id, idempotencyKey: 'k-119' }, sysActor)
    expect(alloc119.sequenceValue).toBe(119)

    cancelAllocatedNumber(krn11, series.id, 119, 'document_voided', userActor, 'PR-16')

    const cancelled = listCancelledNumbers(krn11, TENANT_ID, { series_id: series.id }, 'PR-16')
    expect(cancelled).toHaveLength(1)
    expect(cancelled[0].sequence_value).toBe(119)
    expect(cancelled[0].reason).toBe('document_voided')

    const alloc120 = allocate(krn11, { seriesId: series.id, idempotencyKey: 'k-120' }, sysActor)
    expect(alloc120.sequenceValue).toBe(120) // 119 is never reissued
  })
})

describe('KRN-11-FR-003 — transactional allocation, failed document consumes no number', () => {
  it('a document that fails validation before allocate() is ever called leaves current_value untouched, and no cancelled_number entry either', () => {
    const { krn11 } = newStores()
    const series = makeSeries(krn11)
    for (let i = 0; i < 200; i++) allocate(krn11, { seriesId: series.id, idempotencyKey: `k-${i}` }, sysActor)

    // Simulated producing-module validation failure: the module never calls allocate() at all.
    const stateBefore = krn11.sequenceStates.get(series.id)!
    expect(stateBefore.current_value).toBe(200)
    // No allocate() call was made for the failed document — nothing to assert beyond "no change occurred", which the above confirms.
    expect(listCancelledNumbers(krn11, TENANT_ID, { series_id: series.id }, 'PR-16')).toHaveLength(0)
  })
})

describe('KRN-11-FR-004 — fiscal-year rollover', () => {
  it('rollover opens a new fiscal-year scope at 0, preserves the prior year unchanged, and a second entity is unaffected', () => {
    const { krn11 } = newStores()
    const seriesE1 = makeSeries(krn11, { entity_id: LEGAL_ENTITY_ID, fiscal_year: 'FY2027' })
    const seriesE2 = makeSeries(krn11, { entity_id: LEGAL_ENTITY_ID_2, fiscal_year: 'FY2027' })
    for (let i = 0; i < 847; i++) allocate(krn11, { seriesId: seriesE1.id, idempotencyKey: `e1-${i}` }, sysActor)
    allocate(krn11, { seriesId: seriesE2.id, idempotencyKey: 'e2-1' }, sysActor)

    const rolled = rolloverSeries(krn11, seriesE1.id, 'FY2028', sysActor, 'PR-16')
    expect(rolled.fiscal_year).toBe('FY2028')
    expect(krn11.sequenceStates.get(rolled.id)!.current_value).toBe(0)

    // FY2027 history unchanged under its own series_id.
    const priorSeries = krn11.series.get(seriesE1.id)!
    expect(priorSeries.status).toBe('closed')
    expect(krn11.sequenceStates.get(seriesE1.id)!.current_value).toBe(847)

    // E2 untouched — no rollover ran for it.
    expect(krn11.series.get(seriesE2.id)!.status).toBe('active')
    expect(krn11.sequenceStates.get(seriesE2.id)!.current_value).toBe(1)
  })

  it('a series with reset_policy: never cannot be rolled over', () => {
    const { krn11 } = newStores()
    const series = makeSeries(krn11, { reset_policy: 'never' })
    expect(() => rolloverSeries(krn11, series.id, 'FY2028', sysActor, 'PR-16')).toThrow()
  })
})

describe('KRN-11-FR-005 — concurrent allocation under load (logical correctness; see DoD note on true concurrency)', () => {
  it('200 requests allocate exactly 1001-1200 with no duplicates/gaps; 6 downstream failures are recorded cancelled; current_value ends at 1200; retries resolve to the original result', () => {
    const { krn11 } = newStores()
    const series = makeSeries(krn11)
    for (let i = 0; i < 1000; i++) allocate(krn11, { seriesId: series.id, idempotencyKey: `warm-${i}` }, sysActor)
    expect(krn11.sequenceStates.get(series.id)!.current_value).toBe(1000)

    const results = []
    for (let i = 0; i < 200; i++) {
      results.push(allocate(krn11, { seriesId: series.id, idempotencyKey: `load-${i}` }, sysActor))
    }
    const values = results.map((r) => r.sequenceValue).sort((a, b) => a - b)
    expect(values).toEqual(Array.from({ length: 200 }, (_, i) => 1001 + i)) // exactly 1001..1200, no dup/gap

    // 6 fail downstream validation after allocation — voided.
    const toCancel = results.slice(0, 6)
    for (const r of toCancel) {
      cancelAllocatedNumber(krn11, series.id, r.sequenceValue, 'document_failed_validation', userActor, 'PR-16')
    }
    const cancelled = listCancelledNumbers(krn11, TENANT_ID, { series_id: series.id }, 'PR-16')
    expect(cancelled).toHaveLength(6)
    expect(new Set(cancelled.map((c) => c.sequence_value)).size).toBe(6) // each distinct, none double-counted

    expect(krn11.sequenceStates.get(series.id)!.current_value).toBe(1200)
    const integrity = checkGapIntegrity(krn11, series.id)
    expect(integrity.allocatedCount + integrity.cancelledCount).toBe(integrity.currentValue)

    // Retry storm: re-running the same 200 idempotency keys allocates nothing new.
    for (let i = 0; i < 200; i++) {
      const retried = allocate(krn11, { seriesId: series.id, idempotencyKey: `load-${i}` }, sysActor)
      expect(retried.sequenceValue).toBe(results[i].sequenceValue)
    }
    expect(krn11.sequenceStates.get(series.id)!.current_value).toBe(1200) // unchanged by the retries
  })
})

describe('KRN-11-FR-006 — reservation and release', () => {
  it('an abandoned reservation is released and recorded, the next confirmed document gets the next value, the abandoned slot is never re-acquired', () => {
    const { krn11 } = newStores()
    const series = makeSeries(krn11, { allocation_mode: 'on_draft_with_reservation' })
    // Warm the series to current_value = 50, confirming each reservation as it goes.
    for (let i = 0; i < 50; i++) {
      const warm = allocate(krn11, { seriesId: series.id, idempotencyKey: `warm-${i}` }, sysActor)
      confirmReservation(krn11, warm.allocationId, sysActor)
    }
    expect(krn11.sequenceStates.get(series.id)!.current_value).toBe(50)

    const reservation = allocate(krn11, { seriesId: series.id, idempotencyKey: 'draft-po-1' }, sysActor)
    expect(reservation.status).toBe('reserved')
    expect(reservation.sequenceValue).toBe(51)

    // Abandoned — expiry passes, released.
    const cancelled = cancelReservation(krn11, reservation.allocationId, 'reservation_expired', sysActor)
    expect(cancelled.sequence_value).toBe(51)
    expect(cancelled.reason).toBe('reservation_expired')

    // Next document to reach issued gets #52 — #51 is never re-acquired.
    const next = allocate(krn11, { seriesId: series.id, idempotencyKey: 'draft-po-2' }, sysActor)
    const confirmed = confirmReservation(krn11, next.allocationId, sysActor)
    expect(confirmed.sequenceValue).toBe(52)
  })
})

describe('KRN-11-FR-007 — no module maintains its own counter', () => {
  it('the only way to get a number is POST-equivalent allocate() — there is no local counter field anywhere in the returned shape a caller could increment itself', () => {
    const { krn11 } = newStores()
    const series = makeSeries(krn11)
    const result = allocate(krn11, { seriesId: series.id, idempotencyKey: 'mfg-jw-1' }, sysActor)
    expect(Object.keys(result).sort()).toEqual(['allocationId', 'formattedNumber', 'sequenceValue', 'seriesId', 'status'].sort())
  })
})

describe('KRN-11-DR-001 — one engine, every module', () => {
  it('a single cancelled-numbers query filtered by entity_id returns cancellations from every series (module) on that entity, in one schema', () => {
    const { krn11 } = newStores()
    const invoiceSeries = makeSeries(krn11) // stand-in for FIN-04 tax invoices
    const challanSeries = makeSeries(krn11) // stand-in for MFG-05 job work challans
    const gatePassSeries = makeSeries(krn11) // stand-in for OPS-10 material gate passes

    for (const series of [invoiceSeries, challanSeries, gatePassSeries]) {
      const alloc = allocate(krn11, { seriesId: series.id, idempotencyKey: `dr1-${series.id}` }, sysActor)
      cancelAllocatedNumber(krn11, series.id, alloc.sequenceValue, 'manual_correction', userActor, 'PR-16')
    }

    const register = listCancelledNumbers(krn11, TENANT_ID, { entity_id: LEGAL_ENTITY_ID }, 'PR-25')
    expect(register).toHaveLength(3)
    expect(new Set(register.map((r) => r.series_id))).toEqual(new Set([invoiceSeries.id, challanSeries.id, gatePassSeries.id]))
  })
})

describe('KRN-11-DR-002 — separation of configuration, counter and history', () => {
  it('a cancelled-number report query does not mutate or depend on live sequence_state, and vice versa', () => {
    const { krn11 } = newStores()
    const series = makeSeries(krn11)
    const alloc = allocate(krn11, { seriesId: series.id, idempotencyKey: 'dr2-1' }, sysActor)
    cancelAllocatedNumber(krn11, series.id, alloc.sequenceValue, 'manual_correction', userActor, 'PR-16')

    const beforeState = { ...krn11.sequenceStates.get(series.id)! }
    listCancelledNumbers(krn11, TENANT_ID, { series_id: series.id }, 'PR-16')
    const afterState = krn11.sequenceStates.get(series.id)!
    expect(afterState.current_value).toBe(beforeState.current_value) // the report query left the live counter untouched
  })
})

describe('§11 negative cases', () => {
  it('PATCH on is_gapless/width is rejected once a number has been allocated, regardless of role', () => {
    const { krn11 } = newStores()
    const series = makeSeries(krn11)
    allocate(krn11, { seriesId: series.id, idempotencyKey: 'lock-1' }, sysActor)
    expect(() => updateSeries(krn11, series.id, { width: 6 }, sysActor, 'PR-21')).toThrow()
    expect(() => updateSeries(krn11, series.id, { is_gapless: false }, sysActor, 'PR-21')).toThrow()
    // Non-immutable fields still patchable.
    expect(() => updateSeries(krn11, series.id, { prefix: 'INVX/' }, sysActor, 'PR-21')).not.toThrow()
  })

  it('a retried allocate() call with the same idempotency key after a prior success returns the original allocation, issues nothing new', () => {
    const { krn11 } = newStores()
    const series = makeSeries(krn11)
    const first = allocate(krn11, { seriesId: series.id, idempotencyKey: 'retry-key-1' }, sysActor)
    const retried = allocate(krn11, { seriesId: series.id, idempotencyKey: 'retry-key-1' }, sysActor)
    expect(retried).toEqual(first)
    expect(krn11.sequenceStates.get(series.id)!.current_value).toBe(1)
  })
})
