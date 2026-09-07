import { randomUUID } from 'node:crypto'
import type { Krn04Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { ValidationRule, ValidationSeverity } from '../contracts/validation-rule.js'
import type { PersonaId } from './permissions.js'
import { assertPermission, assertServiceActorForSysWrite } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateValidationRuleInput {
  tenant_id: string
  namespace: 'sys' | 'tnt'
  entity_id: string
  field_id: string | null
  expression: string
  error_message_key: string
  severity: ValidationSeverity
}

function now() {
  return new Date().toISOString()
}

/** Not separately named in §11's action list — gated the same way as `entity/field.*_tnt` writes (same owned-entity family, flagged per Vol 6 §4/L13). */
export function createValidationRule(store: Krn04Store, input: CreateValidationRuleInput, actor: ActorRef, callerPersona: PersonaId): ValidationRule {
  if (input.namespace === 'sys') {
    assertServiceActorForSysWrite(actor.type, 'validation_rule.create')
  } else {
    assertPermission(callerPersona, 'entity.create_tnt')
  }

  const entity = store.entityDefinitions.get(input.entity_id)
  if (!entity) {
    throw new KernelError('ENTITY_DEFINITION_NOT_FOUND', `No entity_definition with id ${input.entity_id}`, randomUUID())
  }

  const id = randomUUID()
  const timestamp = now()
  const rule: ValidationRule = {
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
    field_id: input.field_id,
    expression: input.expression,
    error_message_key: input.error_message_key,
    severity: input.severity,
  }
  store.validationRules.set(id, rule)

  store.emit({
    event_name: 'metadata.validation_rule.created',
    tenant_id: rule.tenant_id,
    entity_id: rule.entity_id,
    subject_type: 'validation_rule',
    subject_id: id,
    payload: { validation_rule_id: id, entity_definition_id: input.entity_id },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return rule
}
