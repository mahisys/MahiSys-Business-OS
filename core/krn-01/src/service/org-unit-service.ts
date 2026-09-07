import { randomUUID } from 'node:crypto'
import type { Krn01Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { OrgUnit } from '../contracts/org-unit.js'
import { assertPermission, canProposeOrgUnit, type PersonaId } from './permissions.js'
import { KernelError } from './errors.js'

export { resolveOrgUnitChain } from './org-unit-tree.js'
import { resolveOrgUnitChain } from './org-unit-tree.js'

export type CreateOrgUnitInput = Omit<
  OrgUnit,
  'id' | 'namespace' | 'ext' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by' | 'version' | 'deleted_at' | 'deleted_by' | 'source' | 'trace_id'
>

/**
 * `callerOrgUnitId` is required when `callerPersona` is `PR-02` — the org
 * unit they head, used for the own-function-subtree check
 * (`canProposeOrgUnit`, KRN-01.md §11 negative case). Ignored for every
 * other persona.
 */
export function createOrgUnit(
  store: Krn01Store,
  input: CreateOrgUnitInput,
  actor: ActorRef,
  callerPersona: PersonaId,
  callerOrgUnitId?: string,
): OrgUnit {
  assertPermission(store, callerPersona, 'org_unit.write', input.tenant_id)

  if (callerPersona === 'PR-02') {
    if (!callerOrgUnitId || !canProposeOrgUnit(store, callerOrgUnitId, input.parent_org_unit_id)) {
      throw new KernelError(
        'FORBIDDEN_OUTSIDE_OWN_FUNCTION',
        'PR-02 may only propose an org unit inside their own function\'s subtree (KRN-01.md §11).',
        randomUUID(),
      )
    }
  }

  const id = randomUUID()
  const timestamp = new Date().toISOString()
  const orgUnit: OrgUnit = {
    id,
    namespace: 'sys',
    ext: {},
    created_at: timestamp,
    created_by: actor,
    updated_at: timestamp,
    updated_by: actor,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    source: 'api',
    trace_id: randomUUID(),
    ...input,
  }
  store.orgUnits.set(id, orgUnit)

  store.emit({
    event_name: 'core.org_unit.created',
    tenant_id: orgUnit.tenant_id,
    entity_id: orgUnit.entity_id,
    subject_type: 'org_unit',
    subject_id: id,
    payload: { org_unit_id: id, entity_id: orgUnit.entity_id },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return orgUnit
}
