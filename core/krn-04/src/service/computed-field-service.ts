import { randomUUID } from 'node:crypto'
import type { Krn04Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { ComputedField, RecomputePolicy } from '../contracts/computed-field.js'
import type { PersonaId } from './permissions.js'
import { assertPermission, assertServiceActorForSysWrite } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateComputedFieldInput {
  tenant_id: string
  namespace: 'sys' | 'tnt'
  field_id: string
  expression: string
  recompute_policy: RecomputePolicy
  depends_on: string[]
}

function now() {
  return new Date().toISOString()
}

/** Not separately named in §11's action list — gated the same way as `entity/field.*_tnt` writes (same owned-entity family, flagged per Vol 6 §4/L13). */
export function createComputedField(store: Krn04Store, input: CreateComputedFieldInput, actor: ActorRef, callerPersona: PersonaId): ComputedField {
  if (input.namespace === 'sys') {
    assertServiceActorForSysWrite(actor.type, 'computed_field.create')
  } else {
    assertPermission(callerPersona, 'field.create_tnt')
  }

  const field = store.fieldDefinitions.get(input.field_id)
  if (!field) {
    throw new KernelError('FIELD_DEFINITION_NOT_FOUND', `No field_definition with id ${input.field_id}`, randomUUID())
  }

  const id = randomUUID()
  const timestamp = now()
  const computed: ComputedField = {
    id,
    tenant_id: input.tenant_id,
    entity_id: field.entity_id,
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
    field_id: input.field_id,
    expression: input.expression,
    recompute_policy: input.recompute_policy,
    depends_on: input.depends_on,
  }
  store.computedFields.set(id, computed)

  store.emit({
    event_name: 'metadata.computed_field.created',
    tenant_id: computed.tenant_id,
    entity_id: computed.entity_id,
    subject_type: 'computed_field',
    subject_id: id,
    payload: { computed_field_id: id, field_definition_id: input.field_id },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return computed
}
