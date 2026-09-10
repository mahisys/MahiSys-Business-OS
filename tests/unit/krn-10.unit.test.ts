/**
 * KRN-10 unit tests — KRN-10.md §5 declares no state machines at all
 * ("this absence... is itself the point of the module"), so there is no
 * `*_TRANSITIONS` map to exhaustively test the way every other kernel
 * module's unit suite does. In its place: the hash-chain calculation
 * (`computeEntryHash`) is the one pure "rule/calculation" Vol 6 §5's
 * Definition of Done still calls for a dedicated unit test.
 */
import { describe, it, expect } from 'vitest'
import { computeEntryHash } from '@mahisys/krn-10'

describe('KRN-10 unit — computeEntryHash (KRN-10-FR-002)', () => {
  it('is deterministic for identical inputs', () => {
    const a = computeEntryHash(null, { subject_type: 'stock_item', sequence_no: 1 })
    const b = computeEntryHash(null, { subject_type: 'stock_item', sequence_no: 1 })
    expect(a).toBe(b)
  })

  it('changes when prev_hash changes, even with identical content — this is what makes the chain tamper-evident', () => {
    const content = { subject_type: 'stock_item', sequence_no: 2 }
    const withPrevA = computeEntryHash('hash-a', content)
    const withPrevB = computeEntryHash('hash-b', content)
    expect(withPrevA).not.toBe(withPrevB)
  })

  it('changes when any content field changes, holding prev_hash constant — a tampered after-value produces a different hash', () => {
    const untampered = computeEntryHash('hash-a', { subject_type: 'stock_item', sequence_no: 2, after: { quantity: 95 } })
    const tampered = computeEntryHash('hash-a', { subject_type: 'stock_item', sequence_no: 2, after: { quantity: 999 } })
    expect(untampered).not.toBe(tampered)
  })

  it('is insensitive to key order in the canonical object — the sort-based key replacer keeps hashing stable regardless of construction order', () => {
    const a = computeEntryHash('h', { subject_type: 'x', sequence_no: 3, after: { quantity: 1 } })
    const b = computeEntryHash('h', { sequence_no: 3, subject_type: 'x', after: { quantity: 1 } })
    expect(a).toBe(b)
  })
})
