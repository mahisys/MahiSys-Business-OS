import { randomUUID } from 'node:crypto'
import type { Krn01Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { CostCentre } from '../contracts/cost-centre.js'
import { assertPermission, type PersonaId } from './permissions.js'

export type CreateCostCentreInput = Omit<
  CostCentre,
  'id' | 'namespace' | 'ext' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by' | 'version' | 'deleted_at' | 'deleted_by' | 'source' | 'trace_id'
>

export function createCostCentre(
  store: Krn01Store,
  input: CreateCostCentreInput,
  actor: ActorRef,
  callerPersona: PersonaId,
): CostCentre {
  assertPermission(store, callerPersona, 'cost_centre.write', input.tenant_id)

  const id = randomUUID()
  const timestamp = new Date().toISOString()
  const costCentre: CostCentre = {
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
  store.costCentres.set(id, costCentre)

  store.emit({
    event_name: 'core.cost_centre.created',
    tenant_id: costCentre.tenant_id,
    entity_id: costCentre.entity_id,
    subject_type: 'cost_centre',
    subject_id: id,
    payload: { cost_centre_id: id, entity_id: costCentre.entity_id },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return costCentre
}

/** KRN-01-FR-005: resolves the org unit a posting against this cost centre defaults to, if any. */
export function resolveCostCentreDefaultOrgUnit(store: Krn01Store, costCentreId: string): string | null {
  const cc = store.costCentres.get(costCentreId)
  return cc?.org_unit_id ?? null
}
