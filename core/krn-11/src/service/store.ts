/**
 * In-memory reference store for KRN-11. Same rationale as the other
 * kernel modules': makes the business rules in KRN-11.md provably correct
 * via acceptance tests before any real persistence layer is wired up
 * (D-12).
 *
 * Unlike KRN-01/02/03/04 (all built before KRN-06 existed, each keeping
 * its own local `events: EmittedEvent[]` array as a stand-in for the real
 * event bus), KRN-11 is the first module built *after* KRN-06 — so it
 * emits through KRN-06's actual published `recordEvent()` API rather than
 * reinventing a local log. `Krn11Store` holds an explicit reference to a
 * `Krn06Store` passed in at construction (dependency injection, not
 * reaching into KRN-06's internals — L3/Vol 6 §7: calling a sibling
 * module's published API is exactly the sanctioned cross-module
 * mechanism, unlike reading its tables directly). See decisions-taken.md
 * D-39.
 */
import { randomUUID } from 'node:crypto'
import type { Krn06Store } from '@mahisys/krn-06'
import { recordEvent } from '@mahisys/krn-06'
import type { NumberSeries } from '../contracts/number-series.js'
import type { SeriesAssignment } from '../contracts/series-assignment.js'
import type { SequenceState } from '../contracts/sequence-state.js'
import type { CancelledNumber } from '../contracts/cancelled-number.js'

export class Krn11Store {
  series = new Map<string, NumberSeries>()
  assignments = new Map<string, SeriesAssignment>()
  /** One row per series, keyed by series_id (not by its own id) — the hot-path counter KRN-11-DR-002 keeps separate from `series`. */
  sequenceStates = new Map<string, SequenceState>()
  cancelledNumbers = new Map<string, CancelledNumber>()
  /** Idempotency-key → prior AllocateResult, per KRN-11-FR-005 point 4: a retried allocate() call resolves to its original result, never issues a second number. */
  idempotencyIndex = new Map<string, { allocationId: string; seriesId: string; sequenceValue: number; formattedNumber: string; status: 'reserved' | 'allocated' }>()

  constructor(private readonly krn06Store: Krn06Store) {}

  /** Every KRN-11 mutation emits through this — the real KRN-06 outbox path, not a local stand-in. */
  emit(input: Omit<Parameters<typeof recordEvent>[1], 'tenant_id'> & { tenant_id: string }) {
    recordEvent(this.krn06Store, input)
  }
}

export function createStore(krn06Store: Krn06Store): Krn11Store {
  return new Krn11Store(krn06Store)
}

export function newId(): string {
  return randomUUID()
}
