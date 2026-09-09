/**
 * KRN-06's own bootstrap permission matrix — KRN-06.md §11, transcribed
 * directly, plus `retention.configure` (see D-38 in decisions-taken.md:
 * §11's table has no column for the retention-configuration action §1/§2
 * explicitly name as one of PR-21's jobs — a missing-control gap in the
 * same vein as KRN-01's D-32, fixed directly rather than left silently
 * ungated).
 *
 * `event.read`'s row/scope nuance (PR-21 tenant-wide vs PR-29/PR-30's "own
 * scope only") is NOT a boolean this matrix can express — it is enforced
 * separately in event-service.ts's `queryEvents`/`getEventById` via an
 * explicit, pre-resolved scope parameter, mirroring KRN-03's
 * `isRowInScope` pattern (L3: KRN-06 never reaches into KRN-03 itself to
 * resolve a caller's actual scope).
 */
import { randomUUID } from 'node:crypto'
import { KernelError } from './errors.js'

export type PersonaId = 'PR-21' | 'PR-29' | 'PR-30' | 'PR-25' | 'PR-26' | 'PR-28' | 'OTHER'

export type Krn06Action =
  | 'event.read'
  | 'subscription.create'
  | 'subscription.manage'
  | 'replay.execute'
  | 'dead_letter.read'
  | 'dead_letter.redrive_discard'
  | 'event_schema.register'
  | 'retention.configure'

const MATRIX: Record<PersonaId, Record<Krn06Action, boolean>> = {
  'PR-21': {
    'event.read': true,
    'subscription.create': true,
    'subscription.manage': true,
    'replay.execute': true,
    'dead_letter.read': true,
    'dead_letter.redrive_discard': true,
    'event_schema.register': false, // §17 item 4 — this draft treats registration as a deployment-time/service-actor action for everyone, including PR-21
    'retention.configure': true,
  },
  'PR-29': {
    'event.read': true, // own registered data_scope only — enforced separately, see module doc above
    'subscription.create': false, // registered through INT-03/STU-07, never self-service
    'subscription.manage': false,
    'replay.execute': false,
    'dead_letter.read': false,
    'dead_letter.redrive_discard': false,
    'event_schema.register': false,
    'retention.configure': false,
  },
  'PR-30': {
    'event.read': true, // own subscription scope only
    'subscription.create': true, // own integration's subscriptions only — ownership checked in subscription-service.ts
    'subscription.manage': true, // own only
    'replay.execute': false,
    'dead_letter.read': true, // own subscription's dead letters only
    'dead_letter.redrive_discard': false,
    'event_schema.register': false,
    'retention.configure': false,
  },
  'PR-25': {
    // Representative of PR-25 External CA/Auditor and PR-26 Regulator — identical row per §11 (no raw stream; SEC-06 scoped export instead).
    'event.read': false,
    'subscription.create': false,
    'subscription.manage': false,
    'replay.execute': false,
    'dead_letter.read': false,
    'dead_letter.redrive_discard': false,
    'event_schema.register': false,
    'retention.configure': false,
  },
  'PR-26': {
    'event.read': false,
    'subscription.create': false,
    'subscription.manage': false,
    'replay.execute': false,
    'dead_letter.read': false,
    'dead_letter.redrive_discard': false,
    'event_schema.register': false,
    'retention.configure': false,
  },
  'PR-28': {
    'event.read': true, // own tenant, provisioning window only — window itself not enforced here (no provisioning-window concept exists in this module; flagged, not silently ignored)
    'subscription.create': true, // own tenant, provisioning window only
    'subscription.manage': true,
    'replay.execute': false,
    'dead_letter.read': false,
    'dead_letter.redrive_discard': false,
    'event_schema.register': false,
    'retention.configure': false,
  },
  OTHER: {
    // Representative of every other internal/external persona (PR-01..20, 22..24, 27) — no direct raw-stream screen at all.
    'event.read': false,
    'subscription.create': false,
    'subscription.manage': false,
    'replay.execute': false,
    'dead_letter.read': false,
    'dead_letter.redrive_discard': false,
    'event_schema.register': false,
    'retention.configure': false,
  },
}

export function hasPermission(persona: PersonaId, action: Krn06Action): boolean {
  return MATRIX[persona][action]
}

/** Shared enforcement helper — throws on denial. */
export function assertPermission(persona: PersonaId, action: Krn06Action) {
  if (!hasPermission(persona, action)) {
    throw new KernelError('FORBIDDEN', `Persona ${persona} does not hold ${action} (KRN-06.md §11).`, randomUUID())
  }
}
