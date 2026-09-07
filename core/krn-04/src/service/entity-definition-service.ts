import { randomUUID } from 'node:crypto'
import type { Krn04Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { EntityDefinition } from '../contracts/entity-definition.js'
import { ENTITY_DEFINITION_STATUS_TRANSITIONS } from '../contracts/entity-definition.js'
import type { PrimitiveId } from '../contracts/primitive.js'
import type { PersonaId } from './permissions.js'
import { assertPermission, assertServiceActorForSysWrite } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateEntityDefinitionInput {
  tenant_id: string
  namespace: 'sys' | 'tnt'
  code: string
  primitive_id: PrimitiveId | undefined // undefined only to let a runtime caller bypass TS and exercise KRN-04-FR-001's rejection path
  owning_module: string
  label_key: string
  is_document: boolean
  state_machine_id: string | null
  semantic_index_policy: 'none' | 'standard' | 'restricted'
  offline_profile: 'full' | 'read' | 'online'
  schema_version_id: string | null
}

function now() {
  return new Date().toISOString()
}

function assertNamespaceWriteAllowed(namespace: 'sys' | 'tnt', actor: ActorRef, callerPersona: PersonaId, action: 'entity.create_tnt' | 'entity.update_tnt') {
  if (namespace === 'sys') {
    assertServiceActorForSysWrite(actor.type, action)
  } else {
    assertPermission(callerPersona, action)
  }
}

/**
 * KRN-04-FR-001: every entity declares a primitive. Enforced twice — the
 * Zod contract makes `primitive_id` non-optional for any well-typed
 * caller, and this runtime check proves the rejection path for real
 * (the acceptance test bypasses TS to construct the omitted case), per
 * the same "prove it, don't just type it" discipline KRN-01/02 followed.
 */
export function createEntityDefinition(
  store: Krn04Store,
  input: CreateEntityDefinitionInput,
  actor: ActorRef,
  callerPersona: PersonaId,
): EntityDefinition {
  assertNamespaceWriteAllowed(input.namespace, actor, callerPersona, 'entity.create_tnt')

  if (!input.primitive_id) {
    throw new KernelError('PRIMITIVE_ID_REQUIRED', 'entity_definition.primitive_id is mandatory (KRN-04-FR-001).', randomUUID())
  }

  const existing = Array.from(store.entityDefinitions.values()).find(
    (e) => e.tenant_id === input.tenant_id && e.namespace === input.namespace && e.owning_module === input.owning_module && e.code === input.code,
  )
  if (existing) {
    throw new KernelError('ENTITY_CODE_ALREADY_EXISTS', `code ${input.code} already exists for (tenant_id, namespace, owning_module) (KRN-04.md §4.1).`, randomUUID())
  }

  const id = randomUUID()
  const timestamp = now()
  const entity: EntityDefinition = {
    id,
    tenant_id: input.tenant_id,
    entity_id: id,
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
    code: input.code,
    primitive_id: input.primitive_id,
    owning_module: input.owning_module,
    label_key: input.label_key,
    is_document: input.is_document,
    state_machine_id: input.state_machine_id,
    semantic_index_policy: input.semantic_index_policy,
    offline_profile: input.offline_profile,
    schema_version_id: input.schema_version_id,
    deprecated_at: null,
    sunset_at: null,
    status: 'draft',
  }
  store.entityDefinitions.set(id, entity)

  store.emit({
    event_name: 'metadata.entity.created',
    tenant_id: entity.tenant_id,
    entity_id: id,
    subject_type: 'entity_definition',
    subject_id: id,
    payload: { entity_definition_id: id, code: entity.code },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return entity
}

/** Added during implementation — draft → active had no event (L4). See KRN-04.md §12. */
export function activateEntityDefinition(store: Krn04Store, entityDefinitionId: string, actor: ActorRef): EntityDefinition {
  const entity = mustGet(store, entityDefinitionId)
  const updated = transition(store, entity, 'active', actor)

  store.emit({
    event_name: 'metadata.entity.activated',
    tenant_id: entity.tenant_id,
    entity_id: entityDefinitionId,
    subject_type: 'entity_definition',
    subject_id: entityDefinitionId,
    payload: { entity_definition_id: entityDefinitionId, code: entity.code },
    occurred_at: updated.updated_at,
    recorded_at: updated.updated_at,
    actor,
  })

  return updated
}

/** KRN-04-FR-003 at entity granularity (KRN-04.md §5, found during implementation — see KRN-04.md §4.1). */
export function deprecateEntityDefinition(
  store: Krn04Store,
  entityDefinitionId: string,
  sunsetAt: string,
  actor: ActorRef,
  callerPersona: PersonaId,
): EntityDefinition {
  const entity = mustGet(store, entityDefinitionId)
  assertNamespaceWriteAllowed(entity.namespace, actor, callerPersona, 'entity.update_tnt')

  if (!sunsetAt) {
    throw new KernelError('SUNSET_AT_REQUIRED', 'sunset_at is required to deprecate an entity_definition (KRN-04-FR-003 at entity granularity).', randomUUID())
  }

  const updated = transition(store, entity, 'deprecated', actor)
  const withSunset: EntityDefinition = { ...updated, deprecated_at: updated.updated_at, sunset_at: sunsetAt }
  store.entityDefinitions.set(entityDefinitionId, withSunset)

  store.emit({
    event_name: 'metadata.entity.deprecated',
    tenant_id: entity.tenant_id,
    entity_id: entityDefinitionId,
    subject_type: 'entity_definition',
    subject_id: entityDefinitionId,
    payload: { entity_definition_id: entityDefinitionId, code: entity.code, sunset_at: sunsetAt },
    occurred_at: withSunset.updated_at,
    recorded_at: withSunset.updated_at,
    actor,
  })

  return withSunset
}

/**
 * deprecated → retired, reachable once `sunset_at` has passed with no
 * live records referencing the entity (KRN-04.md §5, L12). Added during
 * implementation — this transition had no event (L4). See KRN-04.md §12.
 */
export function retireEntityDefinition(store: Krn04Store, entityDefinitionId: string, actor: ActorRef, callerPersona: PersonaId): EntityDefinition {
  const entity = mustGet(store, entityDefinitionId)
  assertNamespaceWriteAllowed(entity.namespace, actor, callerPersona, 'entity.update_tnt')
  const updated = transition(store, entity, 'retired', actor)

  store.emit({
    event_name: 'metadata.entity.retired',
    tenant_id: entity.tenant_id,
    entity_id: entityDefinitionId,
    subject_type: 'entity_definition',
    subject_id: entityDefinitionId,
    payload: { entity_definition_id: entityDefinitionId, code: entity.code },
    occurred_at: updated.updated_at,
    recorded_at: updated.updated_at,
    actor,
  })

  return updated
}

function mustGet(store: Krn04Store, id: string): EntityDefinition {
  const entity = store.entityDefinitions.get(id)
  if (!entity) {
    throw new KernelError('ENTITY_DEFINITION_NOT_FOUND', `No entity_definition with id ${id}`, randomUUID())
  }
  return entity
}

function transition(store: Krn04Store, entity: EntityDefinition, target: EntityDefinition['status'], actor: ActorRef): EntityDefinition {
  if (!isValidTransition(ENTITY_DEFINITION_STATUS_TRANSITIONS, entity.status, target)) {
    throw new KernelError(
      'ILLEGAL_ENTITY_DEFINITION_STATUS_TRANSITION',
      `Cannot transition entity_definition from ${entity.status} to ${target} (KRN-04.md §5).`,
      randomUUID(),
      { from: entity.status, to: target },
    )
  }
  const timestamp = now()
  const updated: EntityDefinition = { ...entity, status: target, updated_at: timestamp, updated_by: actor, version: entity.version + 1 }
  store.entityDefinitions.set(entity.id, updated)
  return updated
}

export function getEntityDefinition(store: Krn04Store, id: string): EntityDefinition | undefined {
  return store.entityDefinitions.get(id)
}
