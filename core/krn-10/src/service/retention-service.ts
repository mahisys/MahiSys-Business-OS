import { randomUUID } from 'node:crypto'
import type { Krn10Store } from './store.js'

/**
 * `KRN-10-FR-005`: retention meets the longest applicable statutory
 * requirement and cannot be shortened by a tenant below that floor —
 * "exactly mirroring KRN-08-FR-008's pattern" per KRN-10.md's own text
 * (KRN-08 isn't built yet, so the *pattern* is mirrored from this
 * session's own KRN-06-FR-009 implementation instead, independently
 * reimplemented here per L3/Vol 6 §7, not imported). Same clearly-flagged
 * placeholder-value treatment as KRN-06's D-38: the actual statutory
 * period is unconfirmed (KRN-10.md §14 names GxP/RBI/DGCA retention
 * requirements as the eventual real floor per regulated vertical), so
 * this uses 2922 days (8 years) as a placeholder pending human
 * confirmation — the rejection *mechanism* is fully correct regardless of
 * the constant's exact value.
 */
export const STATUTORY_RETENTION_FLOOR_DAYS = 2922

import { KernelError } from './errors.js'

/** No `retention.configure` action exists in KRN-10.md §11's own table (unlike KRN-06, where D-38 found the gap and added one) — this draft treats retention configuration as a service/deployment-time action here too, not persona-gated, matching how `recordAuditEntry`/`logAccess` are also system-only. */
export function setRetentionPolicy(store: Krn10Store, tenantId: string, days: number): number {
  if (days < STATUTORY_RETENTION_FLOOR_DAYS) {
    throw new KernelError('RETENTION_BELOW_STATUTORY_FLOOR', `Requested retention of ${days} days is below the statutory floor of ${STATUTORY_RETENTION_FLOOR_DAYS} days (KRN-10-FR-005).`, randomUUID())
  }
  store.retentionByTenant.set(tenantId, days)
  return days
}

export function getRetentionPolicy(store: Krn10Store, tenantId: string): number {
  return store.retentionByTenant.get(tenantId) ?? STATUTORY_RETENTION_FLOOR_DAYS
}
