import { randomUUID } from 'node:crypto'
import type { Krn03Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { DataScopeRule, ScopeType, RuleCondition } from '../contracts/data-scope-rule.js'
import { DATA_SCOPE_RULE_STATUS_TRANSITIONS } from '../contracts/data-scope-rule.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateDataScopeRuleInput {
  tenant_id: string
  namespace: 'sys' | 'tnt'
  scope_type: ScopeType
  org_unit_id: string | null
  entity_scope_id: string | null
  expression: RuleCondition | null
  applies_to_entity_ref: string | null
}

function now() {
  return new Date().toISOString()
}

export function createDataScopeRule(store: Krn03Store, input: CreateDataScopeRuleInput, actor: ActorRef, callerPersona: PersonaId): DataScopeRule {
  assertPermission(callerPersona, 'scope_and_field_policy.write')

  if (input.scope_type === 'rule_based' && input.expression === null) {
    throw new KernelError('EXPRESSION_REQUIRED', 'expression is required when scope_type is rule_based (KRN-03.md §4.1).', randomUUID())
  }

  const id = randomUUID()
  const timestamp = now()
  const rule: DataScopeRule = {
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
    scope_type: input.scope_type,
    org_unit_id: input.org_unit_id,
    entity_scope_id: input.entity_scope_id,
    expression: input.expression,
    applies_to_entity_ref: input.applies_to_entity_ref,
    status: 'active',
  }
  store.dataScopeRules.set(id, rule)
  emitChanged(store, rule, null, actor)
  return rule
}

/** KRN-03.md §5: versioned/effective-dated — supersedes the prior version rather than mutating it (STU-10 upgrade-rehearsal consistency). */
export function supersedeDataScopeRule(store: Krn03Store, dataScopeRuleId: string, patch: Partial<Pick<CreateDataScopeRuleInput, 'org_unit_id' | 'entity_scope_id' | 'expression'>>, actor: ActorRef, callerPersona: PersonaId): DataScopeRule {
  assertPermission(callerPersona, 'scope_and_field_policy.write')

  const prior = store.dataScopeRules.get(dataScopeRuleId)
  if (!prior) {
    throw new KernelError('DATA_SCOPE_RULE_NOT_FOUND', `No data_scope_rule with id ${dataScopeRuleId}`, randomUUID())
  }
  if (!isValidTransition(DATA_SCOPE_RULE_STATUS_TRANSITIONS, prior.status, 'superseded')) {
    throw new KernelError('ILLEGAL_DATA_SCOPE_RULE_STATUS_TRANSITION', `Cannot supersede a data_scope_rule in status ${prior.status} (KRN-03.md §5).`, randomUUID())
  }

  const timestamp = now()
  const supersededPrior: DataScopeRule = { ...prior, status: 'superseded', updated_at: timestamp, updated_by: actor, version: prior.version + 1 }
  store.dataScopeRules.set(dataScopeRuleId, supersededPrior)

  const newId = randomUUID()
  const next: DataScopeRule = {
    ...prior,
    id: newId,
    entity_id: newId,
    created_at: timestamp,
    created_by: actor,
    updated_at: timestamp,
    updated_by: actor,
    version: 1,
    trace_id: randomUUID(),
    ...patch,
    status: 'active',
  }
  store.dataScopeRules.set(newId, next)
  emitChanged(store, next, dataScopeRuleId, actor)
  return next
}

function emitChanged(store: Krn03Store, rule: DataScopeRule, supersededId: string | null, actor: ActorRef) {
  store.emit({
    event_name: 'access.scope_rule.changed',
    tenant_id: rule.tenant_id,
    entity_id: rule.id,
    subject_type: 'data_scope_rule',
    subject_id: rule.id,
    payload: { data_scope_rule_id: rule.id, superseded_id: supersededId },
    occurred_at: rule.created_at,
    recorded_at: rule.created_at,
    actor,
  })
  store.emit({
    event_name: 'access.policy.changed',
    tenant_id: rule.tenant_id,
    entity_id: rule.id,
    subject_type: 'data_scope_rule',
    subject_id: rule.id,
    payload: { policy_type: 'scope_rule', policy_id: rule.id },
    occurred_at: rule.created_at,
    recorded_at: rule.created_at,
    actor,
  })
}

export function getDataScopeRule(store: Krn03Store, id: string): DataScopeRule | undefined {
  return store.dataScopeRules.get(id)
}
