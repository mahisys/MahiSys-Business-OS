/**
 * KRN-01's own bootstrap permission matrix — KRN-01.md §11, transcribed
 * directly (this is data, not business logic under test, unlike the
 * service functions in this directory).
 *
 * This is deliberately narrow and KRN-01-scoped. Per Vol 0 §5's layer
 * model, real authorisation enforcement is KRN-03's job (KRN-03-FR-005:
 * "evaluated at the data-access layer") and KRN-03 does not exist yet.
 * KRN-01 has no declared dependency on KRN-03 (KRN-01.md header: "Depends
 * on: none"), so rather than stub an incomplete dependency (forbidden,
 * Vol 6 §9 anti-patterns), KRN-01 owns a minimal, self-contained
 * permission check for its own actions only — exactly mirroring how any
 * single service reasonably validates its own API before a centralised
 * authz service exists. This will be superseded by real KRN-03
 * integration once KRN-03 is implemented (tracked in
 * `/spec/state.md`), not extended further within KRN-01 itself.
 *
 * Row/scope-level nuance (org-unit subtree, provisioning-window) is NOT
 * captured in this coarse table — those are implemented as their own
 * checks in the service functions that need them (`org-unit-service.ts`,
 * `tenant-service.ts`), matching KRN-01.md §11's negative cases exactly.
 */

export type PersonaId = 'PR-01' | 'PR-02' | 'PR-15' | 'PR-16' | 'PR-21' | 'PR-28' | 'OTHER'

export type Krn01Action =
  | 'tenant.read'
  | 'tenant.lifecycle'
  | 'isolation_tier.promote'
  | 'legal_entity.write'
  | 'org_unit.write'
  | 'cost_centre.write'
  | 'fiscal_period.read'
  | 'fiscal_period.close_reopen'

/** Coarse grant matrix, KRN-01.md §11 table (row/scope nuance excluded — see module doc above). */
const MATRIX: Record<PersonaId, Record<Krn01Action, boolean>> = {
  'PR-21': {
    'tenant.read': true,
    'tenant.lifecycle': true, // propose; approval per KRN-05 matrix (deferred, D-21)
    'isolation_tier.promote': true, // propose; approval per KRN-05 matrix (deferred, D-21) — D-32
    'legal_entity.write': true,
    'org_unit.write': true,
    'cost_centre.write': true,
    'fiscal_period.read': true,
    'fiscal_period.close_reopen': false,
  },
  'PR-01': {
    'tenant.read': true,
    'tenant.lifecycle': true, // approve
    'isolation_tier.promote': true, // approve — D-32
    'legal_entity.write': false,
    'org_unit.write': false,
    'cost_centre.write': false,
    'fiscal_period.read': true,
    'fiscal_period.close_reopen': false,
  },
  'PR-02': {
    'tenant.read': true, // own function
    'tenant.lifecycle': false,
    'isolation_tier.promote': false,
    'legal_entity.write': false,
    'org_unit.write': true, // propose, own function only — see canProposeOrgUnit()
    'cost_centre.write': false,
    'fiscal_period.read': true, // own function
    'fiscal_period.close_reopen': false,
  },
  'PR-16': {
    'tenant.read': true,
    'tenant.lifecycle': false,
    'isolation_tier.promote': false,
    'legal_entity.write': true,
    'org_unit.write': false,
    'cost_centre.write': true,
    'fiscal_period.read': true,
    'fiscal_period.close_reopen': true,
  },
  'PR-15': {
    'tenant.read': true,
    'tenant.lifecycle': false,
    'isolation_tier.promote': false,
    'legal_entity.write': false,
    'org_unit.write': false,
    'cost_centre.write': false,
    'fiscal_period.read': true,
    'fiscal_period.close_reopen': false,
  },
  'PR-28': {
    'tenant.read': true, // own tenant, provisioning window only — see isWithinProvisioningWindow()
    'tenant.lifecycle': false,
    'isolation_tier.promote': false,
    'legal_entity.write': true, // same window restriction
    'org_unit.write': true, // same window restriction
    'cost_centre.write': true, // same window restriction
    'fiscal_period.read': false,
    'fiscal_period.close_reopen': false,
  },
  OTHER: {
    'tenant.read': true, // implicit, via lookups embedded in other modules' screens
    'tenant.lifecycle': false,
    'isolation_tier.promote': false,
    'legal_entity.write': false,
    'org_unit.write': false,
    'cost_centre.write': false,
    'fiscal_period.read': false,
    'fiscal_period.close_reopen': false,
  },
}

export function hasPermission(persona: PersonaId, action: Krn01Action): boolean {
  return MATRIX[persona][action]
}

// The two nuanced checks below need `Krn01Store` traversal logic, not just
// a data lookup like the matrix above.
import type { Krn01Store } from './store.js'
import { resolveOrgUnitChain } from './org-unit-tree.js'

/**
 * KRN-01.md §11 negative case: PR-02 may only propose an org unit inside
 * their own function's subtree — `callerOrgUnitId` (the function root PR-02
 * heads) must be `targetParentOrgUnitId` itself or one of its ancestors.
 */
export function canProposeOrgUnit(
  store: Krn01Store,
  callerOrgUnitId: string,
  targetParentOrgUnitId: string | null,
): boolean {
  if (targetParentOrgUnitId === null) {
    // Proposing a new top-level org unit is not "inside a subtree" at all —
    // out of scope for PR-02's function-scoped grant.
    return false
  }
  const { chain } = resolveOrgUnitChain(store, targetParentOrgUnitId)
  return chain.some((orgUnit) => orgUnit.id === callerOrgUnitId)
}

/**
 * KRN-01.md §11 negative case: PR-28 (Implementation Partner) may only act
 * within the provisioning window — before the tenant leaves `trial`.
 */
export function isWithinProvisioningWindow(store: Krn01Store, tenantId: string): boolean {
  const tenant = store.tenants.get(tenantId)
  return tenant?.status === 'trial'
}

import { randomUUID } from 'node:crypto'
import { KernelError } from './errors.js'

/**
 * Shared enforcement helper for the write paths below. Throws on denial;
 * callers don't need to repeat the same `if (!hasPermission...) throw`
 * boilerplate. PR-28's grants are additionally window-scoped (§11) — this
 * checks that automatically whenever `tenantId` is supplied and the caller
 * is PR-28, so every write path gets the window check for free rather than
 * needing to remember it individually.
 */
export function assertPermission(
  store: Krn01Store,
  persona: PersonaId,
  action: Krn01Action,
  tenantId?: string,
) {
  if (!hasPermission(persona, action)) {
    throw new KernelError('FORBIDDEN', `Persona ${persona} does not hold ${action} (KRN-01.md §11).`, randomUUID())
  }
  if (persona === 'PR-28' && tenantId && !isWithinProvisioningWindow(store, tenantId)) {
    throw new KernelError(
      'FORBIDDEN_OUTSIDE_PROVISIONING_WINDOW',
      `PR-28 (Implementation Partner) may only act on tenant ${tenantId} within its provisioning window (KRN-01.md §11).`,
      randomUUID(),
    )
  }
}
