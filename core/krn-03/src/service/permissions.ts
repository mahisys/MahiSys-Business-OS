/**
 * KRN-03's own bootstrap permission matrix — KRN-03.md §11, transcribed
 * directly. This is the module that would normally *be* the permission
 * layer for everything else — but for its own entities it needs the same
 * kind of minimal, self-contained check KRN-01/02/04 use, since a real
 * KRN-03-governs-KRN-03 loop doesn't exist (there is exactly one access-
 * control module, and it cannot depend on itself). Superseded conceptually
 * by nothing — this bootstrap matrix *is* KRN-03's admin-surface
 * enforcement, permanently, not a placeholder for a later real KRN-03
 * (unlike KRN-01/02/04's bootstrap matrices, which really will be
 * superseded once KRN-03 exists and is wired in for their own actions).
 *
 * §11's table combines `data_scope_rule`/`field_policy` writes into one
 * column and `permission_grant.grant`/`revoke` into one column — unlike
 * KRN-04's table, KRN-03's own "Actions on KRN-03's own entities" prose
 * line does not separately name these either, so this matrix keeps them
 * combined, faithfully matching the source rather than over-splitting.
 *
 * Row/scope-level nuance is NOT captured here (mirrors KRN-01/02/04's
 * identical disclaimer): PR-16/PR-17's `scope_and_field_policy.write`
 * grant is coarse — this draft has no KRN-04 field-level "functional
 * domain owner" metadata to check that a CFO is only touching
 * finance-owned fields, not HR-owned ones. Flagged, not silently ignored.
 */

export type PersonaId = 'PR-21' | 'PR-01' | 'PR-16' | 'PR-17' | 'PR-02' | 'PR-25' | 'PR-29' | 'OTHER'

export type Krn03Action =
  | 'role.write'
  | 'permission_set.write'
  | 'scope_and_field_policy.write'
  | 'permission_grant.write'
  | 'delegation.create_self'
  | 'delegation.create_others'
  | 'effective_permissions.read_self'
  | 'effective_permissions.read_others'

const MATRIX: Record<PersonaId, Record<Krn03Action, boolean>> = {
  'PR-21': {
    'role.write': true,
    'permission_set.write': true,
    'scope_and_field_policy.write': true,
    'permission_grant.write': true,
    'delegation.create_self': true,
    'delegation.create_others': true,
    'effective_permissions.read_self': true,
    'effective_permissions.read_others': true,
  },
  'PR-01': {
    'role.write': false,
    'permission_set.write': false,
    'scope_and_field_policy.write': false,
    'permission_grant.write': true, // approves high-privilege grants where routed via KRN-05 (KRN-05 not built — degrade per D-21, no process gate applied here)
    'delegation.create_self': true,
    'delegation.create_others': false,
    'effective_permissions.read_self': true,
    'effective_permissions.read_others': true,
  },
  'PR-16': {
    'role.write': false,
    'permission_set.write': false,
    'scope_and_field_policy.write': true, // finance-owned fields only — coarse, see module doc above
    'permission_grant.write': false,
    'delegation.create_self': true,
    'delegation.create_others': true, // own function, via KRN-05 approval — degrade per D-21
    'effective_permissions.read_self': true,
    'effective_permissions.read_others': false,
  },
  'PR-17': {
    'role.write': false,
    'permission_set.write': false,
    'scope_and_field_policy.write': true, // HR/PII-owned fields only — coarse, see module doc above
    'permission_grant.write': false,
    'delegation.create_self': true,
    'delegation.create_others': true,
    'effective_permissions.read_self': true,
    'effective_permissions.read_others': false,
  },
  'PR-02': {
    'role.write': false,
    'permission_set.write': false,
    'scope_and_field_policy.write': false,
    'permission_grant.write': false, // propose only, via KRN-05
    'delegation.create_self': true,
    'delegation.create_others': true, // own function only
    'effective_permissions.read_self': true,
    'effective_permissions.read_others': true, // own function, read-only
  },
  'PR-25': {
    // Representative of PR-25 External CA/Auditor and PR-26 Regulator — identical row per §11.
    'role.write': false,
    'permission_set.write': false,
    'scope_and_field_policy.write': false,
    'permission_grant.write': false,
    'delegation.create_self': false,
    'delegation.create_others': false,
    'effective_permissions.read_self': true, // their own scope, read-only
    'effective_permissions.read_others': false,
  },
  'PR-29': {
    'role.write': false,
    'permission_set.write': false,
    'scope_and_field_policy.write': false,
    'permission_grant.write': false,
    'delegation.create_self': false,
    'delegation.create_others': false,
    'effective_permissions.read_self': true, // own, read-only, via INT-03 tooling
    'effective_permissions.read_others': false,
  },
  OTHER: {
    // Representative of every other internal persona (PR-03..15, 18..20).
    'role.write': false,
    'permission_set.write': false,
    'scope_and_field_policy.write': false,
    'permission_grant.write': false,
    'delegation.create_self': true, // bounded to a permission set they themselves hold — checked separately, see delegation-service.ts
    'delegation.create_others': false,
    'effective_permissions.read_self': true,
    'effective_permissions.read_others': false,
  },
}

export function hasPermission(persona: PersonaId, action: Krn03Action): boolean {
  return MATRIX[persona][action]
}

import { randomUUID } from 'node:crypto'
import { KernelError } from './errors.js'

/** Shared enforcement helper — throws on denial. */
export function assertPermission(persona: PersonaId, action: Krn03Action) {
  if (!hasPermission(persona, action)) {
    throw new KernelError('FORBIDDEN', `Persona ${persona} does not hold ${action} (KRN-03.md §11).`, randomUUID())
  }
}

/**
 * KRN-03.md §11 negative case: an agent identity is never a valid actor
 * on this module's write endpoints, independent of any grant it
 * otherwise holds (L9's "never... grant permissions" clause applies
 * directly here) — mirrors KRN-02's `assertNotAgentActor`.
 */
export function assertNotAgentActor(actorType: 'user' | 'agent' | 'service', action: string) {
  if (actorType === 'agent') {
    throw new KernelError(
      'FORBIDDEN_AGENT_ACTOR',
      `${action} may never be performed by an agent identity (KRN-03.md §11, L9).`,
      randomUUID(),
    )
  }
}
