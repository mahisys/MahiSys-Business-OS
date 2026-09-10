/**
 * KRN-11's own bootstrap permission matrix — KRN-11.md §11, transcribed
 * directly. `rollover`'s PR-21 "propose" / PR-16 "approve" split collapses
 * into one action both personas hold `true` for, under the D-21 degrade
 * convention (KRN-05 doesn't exist yet) — the same pattern KRN-01 uses for
 * `tenant.lifecycle`/`isolation_tier.promote`.
 *
 * `allocate`/`confirm` are deliberately absent from this matrix — §11's
 * own note: "not persona-gated at all... called internally by a
 * transacting module's own document-creation action, which is itself
 * governed by that module's own permission matrix." No `callerPersona`
 * parameter exists on those service functions for that reason.
 */
import { randomUUID } from 'node:crypto'
import { KernelError } from './errors.js'

export type PersonaId = 'PR-21' | 'PR-16' | 'PR-15' | 'PR-25' | 'PR-28' | 'OTHER'

export type Krn11Action =
  | 'series.configure'
  | 'series.close'
  | 'rollover'
  | 'cancel'
  | 'cancelled_numbers.read'

const MATRIX: Record<PersonaId, Record<Krn11Action, boolean>> = {
  'PR-21': {
    'series.configure': true,
    'series.close': true,
    rollover: true, // propose; approval per KRN-05 matrix (deferred, D-21)
    cancel: false,
    'cancelled_numbers.read': true,
  },
  'PR-16': {
    'series.configure': false,
    'series.close': false,
    rollover: true, // approve
    cancel: true,
    'cancelled_numbers.read': true,
  },
  'PR-15': {
    'series.configure': false,
    'series.close': false,
    rollover: false,
    cancel: true, // own entity's documents, with reason — ownership checked in sequence-service.ts
    'cancelled_numbers.read': true,
  },
  'PR-25': {
    'series.configure': false,
    'series.close': false,
    rollover: false,
    cancel: false,
    'cancelled_numbers.read': true, // read-only, scoped, evidence-pack export via KRN-10
  },
  'PR-28': {
    'series.configure': true, // own tenant, provisioning window only — window itself not enforced here (no provisioning-window concept exists in this module; flagged, not silently ignored, same caveat as KRN-06's identical PR-28 row)
    'series.close': false,
    rollover: false,
    cancel: false,
    'cancelled_numbers.read': false,
  },
  OTHER: {
    // Representative of every document-creating persona (PR-05..09, etc.) — no direct KRN-11 screen at all.
    'series.configure': false,
    'series.close': false,
    rollover: false,
    cancel: false,
    'cancelled_numbers.read': false,
  },
}

export function hasPermission(persona: PersonaId, action: Krn11Action): boolean {
  return MATRIX[persona][action]
}

/** Shared enforcement helper — throws on denial. */
export function assertPermission(persona: PersonaId, action: Krn11Action) {
  if (!hasPermission(persona, action)) {
    throw new KernelError('FORBIDDEN', `Persona ${persona} does not hold ${action} (KRN-11.md §11).`, randomUUID())
  }
}
