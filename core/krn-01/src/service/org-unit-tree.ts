/**
 * Low-level org-unit tree walk, factored out of `org-unit-service.ts` so
 * `permissions.ts` (which needs it for `canProposeOrgUnit`) doesn't have to
 * import the service module and create a cycle (`org-unit-service.ts` also
 * needs to call into `permissions.ts` for enforcement).
 */
import { randomUUID } from 'node:crypto'
import type { Krn01Store } from './store.js'
import type { OrgUnit } from '../contracts/org-unit.js'
import { KernelError } from './errors.js'

/** KRN-01-FR-002: resolves the owning entity and the full ancestor chain (nearest first). */
export function resolveOrgUnitChain(store: Krn01Store, orgUnitId: string): { entityId: string; chain: OrgUnit[] } {
  const chain: OrgUnit[] = []
  let current = store.orgUnits.get(orgUnitId)
  if (!current) {
    throw new KernelError('ORG_UNIT_NOT_FOUND', `No org unit with id ${orgUnitId}`, randomUUID())
  }
  const entityId = current.entity_id

  const seen = new Set<string>()
  while (current) {
    if (seen.has(current.id)) {
      // Defensive: a cycle would otherwise loop forever. Unlimited-depth
      // hierarchies (KRN-01-FR-002) must still be acyclic.
      throw new KernelError('ORG_UNIT_CYCLE_DETECTED', `Cycle detected in org unit hierarchy at ${current.id}`, randomUUID())
    }
    seen.add(current.id)
    chain.push(current)
    current = current.parent_org_unit_id ? store.orgUnits.get(current.parent_org_unit_id) : undefined
  }

  return { entityId, chain }
}
