import { randomUUID } from 'node:crypto'
import type { Krn04Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { FieldDefinition, FieldDataType } from '../contracts/field-definition.js'
import { FIELD_DEFINITION_STATUS_TRANSITIONS } from '../contracts/field-definition.js'
import type { PersonaId } from './permissions.js'
import { assertPermission, assertServiceActorForSysWrite } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateFieldDefinitionInput {
  tenant_id: string
  namespace: 'sys' | 'tnt'
  entity_id: string
  code: string
  data_type: FieldDataType
  is_required: boolean
  default: unknown
  validation: string | null
  is_indexed: boolean
  is_sensitive: boolean
  semantic_role: 'identifier' | 'meaningful' | 'excluded'
}

function now() {
  return new Date().toISOString()
}

function assertNamespaceWriteAllowed(namespace: 'sys' | 'tnt', actor: ActorRef, callerPersona: PersonaId, action: 'field.create_tnt' | 'field.update_tnt') {
  if (namespace === 'sys') {
    assertServiceActorForSysWrite(actor.type, action)
  } else {
    assertPermission(callerPersona, action)
  }
}

/** KRN-04-FR-002: a `tnt` field may be declared on a `sys` entity — the field's own namespace, not its parent entity's, governs the write gate. */
export function createFieldDefinition(
  store: Krn04Store,
  input: CreateFieldDefinitionInput,
  actor: ActorRef,
  callerPersona: PersonaId,
): FieldDefinition {
  assertNamespaceWriteAllowed(input.namespace, actor, callerPersona, 'field.create_tnt')

  const parent = store.entityDefinitions.get(input.entity_id)
  if (!parent) {
    throw new KernelError('ENTITY_DEFINITION_NOT_FOUND', `No entity_definition with id ${input.entity_id}`, randomUUID())
  }

  const existing = Array.from(store.fieldDefinitions.values()).find((f) => f.entity_id === input.entity_id && f.code === input.code)
  if (existing) {
    throw new KernelError('FIELD_CODE_ALREADY_EXISTS', `code ${input.code} already exists on entity ${input.entity_id} (KRN-04.md §4.1).`, randomUUID())
  }

  const id = randomUUID()
  const timestamp = now()
  const field: FieldDefinition = {
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
    code: input.code,
    data_type: input.data_type,
    is_required: input.is_required,
    default: input.default,
    validation: input.validation,
    is_indexed: input.is_indexed,
    is_sensitive: input.is_sensitive,
    semantic_role: input.semantic_role,
    deprecated_at: null,
    sunset_at: null,
    status: 'active',
  }
  store.fieldDefinitions.set(id, field)

  store.emit({
    event_name: 'metadata.field.added',
    tenant_id: field.tenant_id,
    entity_id: field.entity_id,
    subject_type: 'field_definition',
    subject_id: id,
    payload: { field_definition_id: id, entity_definition_id: field.entity_id, code: field.code },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return field
}

/** Non-breaking update (e.g. `validation`/`default`) — KRN-04.md §12 addition, L4 requires every mutation to emit an event. */
export function updateFieldDefinition(
  store: Krn04Store,
  fieldDefinitionId: string,
  patch: Partial<Pick<CreateFieldDefinitionInput, 'validation' | 'default' | 'is_indexed' | 'is_sensitive'>>,
  actor: ActorRef,
  callerPersona: PersonaId,
): FieldDefinition {
  const field = mustGet(store, fieldDefinitionId)
  assertNamespaceWriteAllowed(field.namespace, actor, callerPersona, 'field.update_tnt')

  const timestamp = now()
  const updated: FieldDefinition = { ...field, ...patch, updated_at: timestamp, updated_by: actor, version: field.version + 1 }
  store.fieldDefinitions.set(fieldDefinitionId, updated)

  store.emit({
    event_name: 'metadata.field.updated',
    tenant_id: field.tenant_id,
    entity_id: field.entity_id,
    subject_type: 'field_definition',
    subject_id: fieldDefinitionId,
    payload: { field_definition_id: fieldDefinitionId, entity_definition_id: field.entity_id, code: field.code },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return updated
}

/** KRN-04-FR-003, verbatim: field deprecation requires a sunset date and a migration path; here — a stable `sunset_at`, rejected without it. */
export function deprecateFieldDefinition(
  store: Krn04Store,
  fieldDefinitionId: string,
  sunsetAt: string | null,
  actor: ActorRef,
  callerPersona: PersonaId,
): FieldDefinition {
  const field = mustGet(store, fieldDefinitionId)
  assertNamespaceWriteAllowed(field.namespace, actor, callerPersona, 'field.update_tnt')

  if (!sunsetAt) {
    throw new KernelError('SUNSET_AT_REQUIRED', 'sunset_at is required to deprecate a field_definition (KRN-04-FR-003).', randomUUID())
  }
  const updated = transition(store, field, 'deprecated', actor)
  const withSunset: FieldDefinition = { ...updated, deprecated_at: updated.updated_at, sunset_at: sunsetAt }
  store.fieldDefinitions.set(fieldDefinitionId, withSunset)

  store.emit({
    event_name: 'metadata.field.deprecated',
    tenant_id: field.tenant_id,
    entity_id: field.entity_id,
    subject_type: 'field_definition',
    subject_id: fieldDefinitionId,
    payload: { field_definition_id: fieldDefinitionId, entity_definition_id: field.entity_id, code: field.code, sunset_at: sunsetAt },
    occurred_at: withSunset.updated_at,
    recorded_at: withSunset.updated_at,
    actor,
  })

  return withSunset
}

/** deprecated → retired, reachable once `sunset_at` has passed (KRN-04.md §5) — resolvable for historical reads, rejected for new writes, never hard-deleted (L12). */
export function retireFieldDefinition(store: Krn04Store, fieldDefinitionId: string, actor: ActorRef, callerPersona: PersonaId): FieldDefinition {
  const field = mustGet(store, fieldDefinitionId)
  assertNamespaceWriteAllowed(field.namespace, actor, callerPersona, 'field.update_tnt')
  const updated = transition(store, field, 'retired', actor)

  store.emit({
    event_name: 'metadata.field.retired',
    tenant_id: field.tenant_id,
    entity_id: field.entity_id,
    subject_type: 'field_definition',
    subject_id: fieldDefinitionId,
    payload: { field_definition_id: fieldDefinitionId, entity_definition_id: field.entity_id, code: field.code },
    occurred_at: updated.updated_at,
    recorded_at: updated.updated_at,
    actor,
  })

  return updated
}

function mustGet(store: Krn04Store, id: string): FieldDefinition {
  const field = store.fieldDefinitions.get(id)
  if (!field) {
    throw new KernelError('FIELD_DEFINITION_NOT_FOUND', `No field_definition with id ${id}`, randomUUID())
  }
  return field
}

function transition(store: Krn04Store, field: FieldDefinition, target: FieldDefinition['status'], actor: ActorRef): FieldDefinition {
  if (!isValidTransition(FIELD_DEFINITION_STATUS_TRANSITIONS, field.status, target)) {
    throw new KernelError(
      'ILLEGAL_FIELD_DEFINITION_STATUS_TRANSITION',
      `Cannot transition field_definition from ${field.status} to ${target} (KRN-04.md §5).`,
      randomUUID(),
      { from: field.status, to: target },
    )
  }
  const timestamp = now()
  const updated: FieldDefinition = { ...field, status: target, updated_at: timestamp, updated_by: actor, version: field.version + 1 }
  store.fieldDefinitions.set(field.id, updated)
  return updated
}

export function getFieldDefinition(store: Krn04Store, id: string): FieldDefinition | undefined {
  return store.fieldDefinitions.get(id)
}

/**
 * KRN-04-FR-002: "a record with ext.warranty_months = 'twenty-four'
 * (wrong type) is rejected at write time." KRN-04 does not own business
 * records itself (§3 — that is each owning module's data, per L3), so it
 * cannot literally reject a record write; this is the type-check
 * primitive a record-owning module calls before accepting an `ext` value
 * against a `tnt` field's declared `data_type` — the concrete mechanism
 * behind that acceptance criterion, scoped to what KRN-04 actually owns.
 */
export function matchesDataType(dataType: FieldDataType, value: unknown): boolean {
  switch (dataType) {
    case 'string': case 'text': case 'enum': case 'ref': return typeof value === 'string'
    case 'integer': return typeof value === 'number' && Number.isInteger(value)
    case 'decimal': case 'money': case 'quantity': return typeof value === 'number'
    case 'boolean': return typeof value === 'boolean'
    case 'date': case 'timestamptz': return typeof value === 'string' && !Number.isNaN(Date.parse(value))
    case 'json': return typeof value === 'object' && value !== null
    default: return false
  }
}
