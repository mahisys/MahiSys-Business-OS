/**
 * KRN-11 permission tests — Vol 6 §6 step 4, from KRN-11.md §11.
 */
import { describe, it, expect } from 'vitest'
import { hasPermission } from '@mahisys/krn-11'
import { createSeries, updateSeries, closeSeries, rolloverSeries } from '@mahisys/krn-11'
import { allocate, cancelAllocatedNumber } from '@mahisys/krn-11'
import { listCancelledNumbers } from '@mahisys/krn-11'
import { newStores, makeSeries, sysActor, userActor, TENANT_ID, LEGAL_ENTITY_ID } from './krn-11.fixtures.js'

describe('KRN-11 permission matrix (§11) — positive cases', () => {
  it('PR-21 configures/closes series and reads cancelled numbers, but does not cancel', () => {
    expect(hasPermission('PR-21', 'series.configure')).toBe(true)
    expect(hasPermission('PR-21', 'series.close')).toBe(true)
    expect(hasPermission('PR-21', 'rollover')).toBe(true)
    expect(hasPermission('PR-21', 'cancel')).toBe(false)
    expect(hasPermission('PR-21', 'cancelled_numbers.read')).toBe(true)
  })

  it('PR-16 approves rollover and cancels, but does not configure/close', () => {
    expect(hasPermission('PR-16', 'series.configure')).toBe(false)
    expect(hasPermission('PR-16', 'series.close')).toBe(false)
    expect(hasPermission('PR-16', 'rollover')).toBe(true)
    expect(hasPermission('PR-16', 'cancel')).toBe(true)
  })

  it('PR-15 can cancel (own entity, with reason) and read, nothing else', () => {
    expect(hasPermission('PR-15', 'cancel')).toBe(true)
    expect(hasPermission('PR-15', 'cancelled_numbers.read')).toBe(true)
    expect(hasPermission('PR-15', 'series.configure')).toBe(false)
    expect(hasPermission('PR-15', 'rollover')).toBe(false)
  })

  it('PR-25 External CA/Auditor has read-only access to the register, nothing else', () => {
    expect(hasPermission('PR-25', 'cancelled_numbers.read')).toBe(true)
    expect(hasPermission('PR-25', 'series.configure')).toBe(false)
    expect(hasPermission('PR-25', 'cancel')).toBe(false)
    expect(hasPermission('PR-25', 'rollover')).toBe(false)
  })
})

describe('KRN-11 permission matrix (§11) — negative cases', () => {
  it('no persona other than PR-21/PR-28 holds series.configure', () => {
    for (const persona of ['PR-16', 'PR-15', 'PR-25', 'OTHER'] as const) {
      expect(hasPermission(persona, 'series.configure'), persona).toBe(false)
    }
  })

  it('OTHER (every document-creating persona) holds nothing — no direct KRN-11 screen at all', () => {
    const actions = ['series.configure', 'series.close', 'rollover', 'cancel', 'cancelled_numbers.read'] as const
    for (const action of actions) {
      expect(hasPermission('OTHER', action), action).toBe(false)
    }
  })

  it('PR-15 (Accountant) cannot close a series or trigger rollover (§11 negative case)', () => {
    expect(hasPermission('PR-15', 'series.close')).toBe(false)
    expect(hasPermission('PR-15', 'rollover')).toBe(false)
  })
})

describe('KRN-11 write paths actually enforce the matrix, not just report it', () => {
  it('createSeries: PR-21 succeeds, OTHER is rejected', () => {
    const { krn11 } = newStores()
    const input = { tenant_id: TENANT_ID, entity_id: LEGAL_ENTITY_ID, namespace: 'tnt' as const, document_type_id: '00000000-0000-7000-8200-00000000d001', location_id: null, fiscal_year: null, prefix: 'X/', suffix: '', width: 3, separator: null, is_gapless: false, reset_policy: 'never' as const, allocation_mode: 'on_issue' as const }
    expect(() => createSeries(krn11, input, sysActor, 'PR-21')).not.toThrow()
    expect(() => createSeries(krn11, input, userActor, 'OTHER')).toThrow()
  })

  it('closeSeries: PR-21 succeeds, PR-15 is rejected', () => {
    const { krn11 } = newStores()
    const series = makeSeries(krn11)
    expect(() => closeSeries(krn11, series.id, userActor, 'PR-15')).toThrow()
    expect(() => closeSeries(krn11, series.id, sysActor, 'PR-21')).not.toThrow()
  })

  it('rollover: PR-15 is rejected; PR-16 (approve) and PR-21 (propose, degraded per D-21) both succeed', () => {
    const { krn11 } = newStores()
    const seriesForPR16 = makeSeries(krn11)
    const seriesForPR21 = makeSeries(krn11)
    const seriesForPR15 = makeSeries(krn11)
    expect(() => rolloverSeries(krn11, seriesForPR15.id, 'FY2028', userActor, 'PR-15')).toThrow()
    expect(() => rolloverSeries(krn11, seriesForPR16.id, 'FY2028', userActor, 'PR-16')).not.toThrow()
    expect(() => rolloverSeries(krn11, seriesForPR21.id, 'FY2028', sysActor, 'PR-21')).not.toThrow()
  })

  it('cancel: PR-16 succeeds, PR-21 is rejected (only PR-15/PR-16 hold cancel, not PR-21)', () => {
    const { krn11 } = newStores()
    const series = makeSeries(krn11)
    const alloc = allocate(krn11, { seriesId: series.id, idempotencyKey: 'perm-1' }, sysActor)
    expect(() => cancelAllocatedNumber(krn11, series.id, alloc.sequenceValue, 'manual_correction', sysActor, 'PR-21')).toThrow()
    expect(() => cancelAllocatedNumber(krn11, series.id, alloc.sequenceValue, 'manual_correction', userActor, 'PR-16')).not.toThrow()
  })

  it('cancelled_numbers.read: PR-25 succeeds (read-only), OTHER is rejected', () => {
    const { krn11 } = newStores()
    expect(() => listCancelledNumbers(krn11, TENANT_ID, {}, 'PR-25')).not.toThrow()
    expect(() => listCancelledNumbers(krn11, TENANT_ID, {}, 'OTHER')).toThrow()
  })

  it('allocate is never persona-gated — no callerPersona parameter exists on it at all (§11 own note)', () => {
    const { krn11 } = newStores()
    const series = makeSeries(krn11)
    // allocate()'s signature (store, input, actor) has no persona slot to even pass a rejected one — this is exercised structurally, not by a throw.
    expect(() => allocate(krn11, { seriesId: series.id, idempotencyKey: 'no-gate-1' }, sysActor)).not.toThrow()
  })

  it('PATCH on immutable fields is rejected regardless of role once a number is allocated — an engine rule, not a permission decision', () => {
    const { krn11 } = newStores()
    const series = makeSeries(krn11)
    allocate(krn11, { seriesId: series.id, idempotencyKey: 'immutable-1' }, sysActor)
    // Even PR-21, who otherwise holds series.configure, cannot bypass the integrity rule.
    expect(() => updateSeries(krn11, series.id, { width: 9 }, sysActor, 'PR-21')).toThrow()
  })
})
