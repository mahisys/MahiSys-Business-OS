/**
 * KRN-02's own bootstrap permission matrix — KRN-02.md §11, transcribed
 * directly. Same rationale as KRN-01's `permissions.ts`: KRN-03 (Access
 * Control) doesn't exist yet and KRN-02 declares no dependency on it, so
 * KRN-02 owns a minimal, self-contained check for its own actions, to be
 * superseded by real KRN-03 integration later.
 *
 * Persona grouping: §11's table groups several personas identically —
 * "All other internal personas (PR-02..15, 17..20)" and "PR-22..24, 27
 * External personas" each get one row. This matrix uses `PR-02` and
 * `PR-22` respectively as the representative persona for those groups,
 * the same simplification KRN-01's matrix makes with `OTHER`.
 *
 * Actions here are the *admin-reach* actions only: `session.revoke_any`
 * means revoking *another* user's session; revoking one's own session is
 * self-service, universally allowed, and not gated by this matrix at all
 * (see `session-service.ts`) — matching §11's "own" qualifiers, which
 * describe something every persona may always do, not a graded grant.
 */

export type PersonaId = 'PR-01' | 'PR-02' | 'PR-16' | 'PR-21' | 'PR-25' | 'PR-28' | 'PR-29' | 'PR-22' | 'OTHER'

export type Krn02Action =
  | 'user.create'
  | 'user.deactivate'
  | 'mfa.reset_others'
  | 'session.revoke_any'
  | 'device.revoke_others'
  | 'service_account.manage'
  | 'agent_identity.read'
  | 'login_attempt.read'
  | 'impersonation.start'

const MATRIX: Record<PersonaId, Record<Krn02Action, boolean>> = {
  'PR-02': {
    // Representative of "all other internal personas (PR-02..15, 17..20)"
    // — none hold any admin-reach grant; self-service (own session read/
    // revoke) is unconditional and not gated by this matrix at all.
    'user.create': false,
    'user.deactivate': false,
    'mfa.reset_others': false,
    'session.revoke_any': false,
    'device.revoke_others': false,
    'service_account.manage': false,
    'agent_identity.read': false,
    'login_attempt.read': false,
    'impersonation.start': false,
  },
  'PR-21': {
    'user.create': true,
    'user.deactivate': true,
    'mfa.reset_others': true,
    'session.revoke_any': true,
    'device.revoke_others': true,
    'service_account.manage': true,
    'agent_identity.read': true,
    'login_attempt.read': true,
    'impersonation.start': true,
  },
  'PR-01': {
    'user.create': false,
    'user.deactivate': false,
    'mfa.reset_others': false,
    'session.revoke_any': false,
    'device.revoke_others': false,
    'service_account.manage': false,
    'agent_identity.read': true, // read
    'login_attempt.read': true, // read, summary only
    'impersonation.start': false,
  },
  'PR-16': {
    'user.create': false,
    'user.deactivate': false,
    'mfa.reset_others': false,
    'session.revoke_any': false,
    'device.revoke_others': false,
    'service_account.manage': false,
    'agent_identity.read': false,
    'login_attempt.read': false,
    'impersonation.start': false,
  },
  'PR-25': {
    'user.create': false,
    'user.deactivate': false,
    'mfa.reset_others': false,
    'session.revoke_any': false,
    'device.revoke_others': false,
    'service_account.manage': false,
    'agent_identity.read': false,
    'login_attempt.read': true, // evidence scope only, per SEC-06
    'impersonation.start': false,
  },
  'PR-28': {
    'user.create': true, // own tenant, provisioning window only — see isWithinProvisioningWindow()
    'user.deactivate': false,
    'mfa.reset_others': true, // same window restriction
    'session.revoke_any': false,
    'device.revoke_others': false,
    'service_account.manage': false,
    'agent_identity.read': false,
    'login_attempt.read': false,
    'impersonation.start': false,
  },
  'PR-29': {
    'user.create': false,
    'user.deactivate': false,
    'mfa.reset_others': false,
    'session.revoke_any': false,
    'device.revoke_others': false,
    'service_account.manage': false,
    'agent_identity.read': true, // own record only, via INT-03 tooling — not a direct user-facing call
    'login_attempt.read': false,
    'impersonation.start': false,
  },
  'PR-22': {
    'user.create': false,
    'user.deactivate': false,
    'mfa.reset_others': false,
    'session.revoke_any': false,
    'device.revoke_others': false,
    'service_account.manage': false,
    'agent_identity.read': false,
    'login_attempt.read': false,
    'impersonation.start': false,
  },
  OTHER: {
    'user.create': false,
    'user.deactivate': false,
    'mfa.reset_others': false,
    'session.revoke_any': false,
    'device.revoke_others': false,
    'service_account.manage': false,
    'agent_identity.read': false,
    'login_attempt.read': false,
    'impersonation.start': false,
  },
}

export function hasPermission(persona: PersonaId, action: Krn02Action): boolean {
  return MATRIX[persona][action]
}

import { randomUUID } from 'node:crypto'
import { KernelError } from './errors.js'
import type { Krn02Store } from './store.js'

/**
 * KRN-02.md §11 negative case: PR-28 (Implementation Partner) may only act
 * within the provisioning window — mirrors KRN-01's identical pattern.
 * Requires the tenant's own status, which KRN-02 does not own (KRN-01
 * does) — this function takes it as a parameter rather than reaching into
 * KRN-01's store (L3: no cross-module table reads), leaving the caller
 * (the actual API layer, once built) responsible for resolving it via
 * KRN-01's own API.
 */
export function isWithinProvisioningWindow(tenantStatus: 'trial' | 'active' | 'suspended' | 'closed'): boolean {
  return tenantStatus === 'trial'
}

/** Shared enforcement helper — throws on denial. */
export function assertPermission(persona: PersonaId, action: Krn02Action) {
  if (!hasPermission(persona, action)) {
    throw new KernelError('FORBIDDEN', `Persona ${persona} does not hold ${action} (KRN-02.md §11).`, randomUUID())
  }
}

/**
 * KRN-02.md §11 negative case (corrected during implementation — see
 * KRN-02.md §11 note and /spec/decisions-taken.md): an `agent_identity`
 * credential attempting to create a human user is rejected regardless of
 * any permission grant it otherwise holds. A `service` actor (COM-04
 * provisioning, per §10) is allowed — mirrors KRN-01's `createTenant`
 * pattern, where the platform's own provisioning actor is a `service`
 * type. Only `agent` is rejected here.
 */
export function assertNotAgentActor(actorType: 'user' | 'agent' | 'service', action: string) {
  if (actorType === 'agent') {
    throw new KernelError(
      'FORBIDDEN_AGENT_ACTOR',
      `${action} may never be performed by an agent identity (KRN-02.md §11).`,
      randomUUID(),
    )
  }
}

/** Referenced so store types are available to consumers importing from this module. */
export type { Krn02Store }
