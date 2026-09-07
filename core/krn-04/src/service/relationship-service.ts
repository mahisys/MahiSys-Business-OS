import { randomUUID } from 'node:crypto'
import type { Krn04Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { RelationshipDefinition, Cardinality, CascadeBehaviour } from '../contracts/relationship-definition.js'
import type { PersonaId } from './permissions.js'
import { assertPermission, assertServiceActorForSysWrite } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateRelationshipDefinitionInput {
  tenant_id: string
  namespace: 'sys' | 'tnt'
  entity_id: string
  target_entity_id: string
  code: string
  name: string
  cardinality: Cardinality
  cascade_behaviour: CascadeBehaviour
}

function now() {
  return new Date().toISOString()
}

/**
 * KRN-04-FR-006: `target_entity_id` must share `owning_module` with
 * `entity_id` — a cross-record invariant only the service layer can
 * check (it requires looking up both `entity_definition` rows).
 * `relationship_definition` writes are not separately named in §11's
 * action list; gated the same way as `entity/field.*_tnt` writes since
 * it belongs to the same owned-entity family (flagged per Vol 6 §4/L13).
 */
export function createRelationshipDefinition(
  store: Krn04Store,
  input: CreateRelationshipDefinitionInput,
  actor: ActorRef,
  callerPersona: PersonaId,
): RelationshipDefinition {
  if (input.namespace === 'sys') {
    assertServiceActorForSysWrite(actor.type, 'relationship.create')
  } else {
    assertPermission(callerPersona, 'entity.create_tnt')
  }

  const source = store.entityDefinitions.get(input.entity_id)
  const target = store.entityDefinitions.get(input.target_entity_id)
  if (!source) {
    throw new KernelError('ENTITY_DEFINITION_NOT_FOUND', `No entity_definition with id ${input.entity_id}`, randomUUID())
  }
  if (!target) {
    throw new KernelError('ENTITY_DEFINITION_NOT_FOUND', `No entity_definition with id ${input.target_entity_id}`, randomUUID())
  }
  if (source.owning_module !== target.owning_module) {
    throw new KernelError(
      'RELATIONSHIP_CROSS_MODULE_FORBIDDEN',
      `A relationship_definition may not target another module's entity (KRN-04-FR-006): ${source.owning_module} vs ${target.owning_module}.`,
      randomUUID(),
    )
  }

  const id = randomUUID()
  const timestamp = now()
  const relationship: RelationshipDefinition = {
    id,
    tenant_id: input.tenant_id,
    entity_id: input.entity_id,
    namespace: input.namespace,
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
    target_entity_id: input.target_entity_id,
    code: input.code,
    name: input.name,
    cardinality: input.cardinality,
    cascade_behaviour: input.cascade_behaviour,
  }
  store.relationshipDefinitions.set(id, relationship)

  store.emit({
    event_name: 'metadata.relationship.created',
    tenant_id: relationship.tenant_id,
    entity_id: relationship.entity_id,
    subject_type: 'relationship_definition',
    subject_id: id,
    payload: { relationship_definition_id: id, entity_definition_id: input.entity_id, target_entity_definition_id: input.target_entity_id, code: relationship.code },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return relationship
}
