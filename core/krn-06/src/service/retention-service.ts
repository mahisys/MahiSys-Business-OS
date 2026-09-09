import { randomUUID } from 'node:crypto'
import type { Krn06Store } from './store.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

/**
 * `KRN-06-FR-009`: retention is tenant-configurable above a statutory
 * floor. §17 item 3 flags that Vol 2 §P-08 never states the floor's actual
 * value. This draft uses 2922 days (8 years) as a clearly-flagged
 * placeholder — the longer of India's two most likely applicable periods
 * (Companies Act 2013 books-of-account retention: 8 years; GST record
 * retention: 72 months/6 years from the annual-return due date) — pending
 * human confirmation of the actual applicable statutory period(s), per
 * §14's compliance-touchpoint note. Not blocking: the mechanism (reject
 * below-floor configuration at write time, per FR-009's own acceptance
 * sample) is fully implemented and testable regardless of the exact
 * number; only the number itself needs correcting once confirmed — same
 * "deferred number, not blocking" treatment as D-16/D-30's pricing figures.
 */
export const STATUTORY_RETENTION_FLOOR_DAYS = 2922

/**
 * §11's permission table has no `retention.configure` column despite §1/§2
 * naming "configures retention above the statutory floor" as one of
 * PR-21's stated jobs — a missing-control gap in the same vein as KRN-01's
 * D-32, fixed directly (see decisions-taken.md D-38) rather than left
 * silently ungated. PR-21 only, matching every other administrative
 * action in this module.
 */
export function setRetentionPolicy(store: Krn06Store, tenantId: string, days: number, callerPersona: PersonaId): number {
  assertPermission(callerPersona, 'retention.configure')
  if (days < STATUTORY_RETENTION_FLOOR_DAYS) {
    throw new KernelError('RETENTION_BELOW_STATUTORY_FLOOR', `Requested retention of ${days} days is below the statutory floor of ${STATUTORY_RETENTION_FLOOR_DAYS} days (KRN-06-FR-009).`, randomUUID())
  }
  store.retentionByTenant.set(tenantId, days)
  return days
}

export function getRetentionPolicy(store: Krn06Store, tenantId: string): number {
  return store.retentionByTenant.get(tenantId) ?? STATUTORY_RETENTION_FLOOR_DAYS
}

/** `KRN-06-FR-009`'s acceptance sample: an event older than the statutory floor but within the tenant's configured retention remains readable — i.e. retention only ever governs deletion eligibility, never a read-time filter beyond what `queryEvents`'s own scope/filter parameters already apply. This function answers only "is `ageDays` still within the tenant's configured retention," the read path itself never calls it (no event is ever hidden by age alone; retention deletion is a housekeeping job outside this reference implementation's scope, per D-12's later stack decisions). */
export function isWithinRetention(store: Krn06Store, tenantId: string, ageDays: number): boolean {
  return ageDays <= getRetentionPolicy(store, tenantId)
}
