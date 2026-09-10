import { randomUUID } from 'node:crypto'
import type { Krn07Store } from './store.js'
import type { ActorRef, Period } from '@mahisys/shared'
import type { Rule, RuleAction, RuleScope, AuthoredVia } from '../contracts/rule.js'
import type { RuleType } from '../contracts/rule-set.js'
import type { RuleCondition } from '../contracts/rule-condition.js'
import { collectFieldRefs } from '../contracts/rule-condition.js'
import type { PersonaId } from './permissions.js'
import { assertDomainAccess } from './permissions.js'
import { KernelError } from './errors.js'

function now() {
  return new Date().toISOString()
}

/**
 * `KRN-07-FR-001`: every field reference in a condition tree must exist
 * in KRN-04's `field_definition` registry — KRN-07 never reaches into
 * KRN-04's tables itself (L3); `declaredFieldRefs` is the caller's
 * pre-resolved set, same pattern as every other module's L3-compliant
 * "pass the scope, don't fetch it yourself" parameter this session.
 */
function assertConditionFieldsDeclared(conditions: RuleCondition, declaredFieldRefs: Set<string>) {
  const referenced = collectFieldRefs(conditions)
  for (const field of referenced) {
    if (!declaredFieldRefs.has(field)) {
      throw new KernelError('UNDECLARED_CONDITION_FIELD', `Condition references field "${field}", which is not declared in KRN-04's field_definition registry (KRN-07-FR-001).`, randomUUID(), { field })
    }
  }
}

export interface CreateRuleInput {
  tenant_id: string
  rule_set_id: string
  name: string
  priority: number
  conditions: RuleCondition
  actions: RuleAction[]
  period: Period
  scope: RuleScope
  authored_via: AuthoredVia
  natural_language_source: string | null
}

/** Creates the rule (status `draft`) and its first `rule_version` (version_no 1) together — `current_version_id` always points at a real, existing version, never left dangling. */
export function createRule(
  store: Krn07Store,
  input: CreateRuleInput,
  ruleSetRuleType: RuleType,
  declaredFieldRefs: Set<string>,
  actor: ActorRef,
  callerPersona: PersonaId,
  callerDomainOverride?: RuleType[],
): Rule {
  assertDomainAccess(callerPersona, 'edit_draft', ruleSetRuleType, callerDomainOverride)
  assertConditionFieldsDeclared(input.conditions, declaredFieldRefs)

  const ruleId = randomUUID()
  const versionId = randomUUID()
  const timestamp = now()

  store.ruleVersions.set(versionId, {
    id: versionId,
    tenant_id: input.tenant_id,
    entity_id: input.scope.entity_id,
    namespace: 'tnt',
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
    rule_id: ruleId,
    version_no: 1,
    conditions: input.conditions,
    actions: input.actions,
    priority: input.priority,
    period: input.period,
    change_reason: null,
    superseded_by_version_id: null,
  })

  const rule: Rule = {
    id: ruleId,
    tenant_id: input.tenant_id,
    entity_id: input.scope.entity_id,
    namespace: 'tnt',
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
    rule_set_id: input.rule_set_id,
    rule_type: ruleSetRuleType,
    name: input.name,
    priority: input.priority,
    conditions: input.conditions,
    actions: input.actions,
    period: input.period,
    scope: input.scope,
    status: 'draft',
    current_version_id: versionId,
    authored_by: actor,
    authored_via: input.authored_via,
    natural_language_source: input.natural_language_source,
  }
  store.rules.set(ruleId, rule)

  store.emit({
    tenant_id: input.tenant_id,
    entity_id: input.scope.entity_id,
    event_name: 'rules.rule.version_created',
    actor,
    subject_type: 'rule',
    subject_id: ruleId,
    payload: { rule_id: ruleId, rule_version_id: versionId, version_no: 1 },
  })

  return rule
}

export interface EditRuleInput {
  conditions?: RuleCondition
  actions?: RuleAction[]
  priority?: number
  period?: Period
  change_reason: string | null
}

/**
 * `KRN-07.md §5`: editing an active rule's conditions/actions/priority/
 * period never changes `rule.status` — it creates a new `rule_version`
 * and advances `current_version_id`, leaving the rule `active` (or
 * `draft`) throughout. The prior version is marked `superseded_by_
 * version_id` but never deleted (append-only, mirrors P-08/P-09).
 */
export function editRule(store: Krn07Store, ruleId: string, patch: EditRuleInput, declaredFieldRefs: Set<string>, actor: ActorRef, callerPersona: PersonaId, callerDomainOverride?: RuleType[]): Rule {
  const rule = store.rules.get(ruleId)
  if (!rule) throw new KernelError('RULE_NOT_FOUND', `No rule with id ${ruleId}`, randomUUID())
  assertDomainAccess(callerPersona, 'edit_draft', rule.rule_type, callerDomainOverride)

  const nextConditions = patch.conditions ?? rule.conditions
  if (patch.conditions) assertConditionFieldsDeclared(nextConditions, declaredFieldRefs)
  const nextActions = patch.actions ?? rule.actions
  const nextPriority = patch.priority ?? rule.priority
  const nextPeriod = patch.period ?? rule.period

  const priorVersion = store.ruleVersions.get(rule.current_version_id)!
  const newVersionId = randomUUID()
  const timestamp = now()

  store.ruleVersions.set(rule.current_version_id, { ...priorVersion, superseded_by_version_id: newVersionId, updated_at: timestamp, updated_by: actor, version: priorVersion.version + 1 })

  store.ruleVersions.set(newVersionId, {
    id: newVersionId,
    tenant_id: rule.tenant_id,
    entity_id: rule.entity_id,
    namespace: 'tnt',
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
    rule_id: ruleId,
    version_no: priorVersion.version_no + 1,
    conditions: nextConditions,
    actions: nextActions,
    priority: nextPriority,
    period: nextPeriod,
    change_reason: patch.change_reason,
    superseded_by_version_id: null,
  })

  const updated: Rule = { ...rule, conditions: nextConditions, actions: nextActions, priority: nextPriority, period: nextPeriod, current_version_id: newVersionId, updated_at: timestamp, updated_by: actor, version: rule.version + 1 }
  store.rules.set(ruleId, updated)

  store.emit({
    tenant_id: rule.tenant_id,
    entity_id: rule.entity_id,
    event_name: 'rules.rule.version_created',
    actor,
    subject_type: 'rule',
    subject_id: ruleId,
    payload: { rule_id: ruleId, rule_version_id: newVersionId, version_no: priorVersion.version_no + 1 },
  })

  return updated
}

export function getRule(store: Krn07Store, id: string): Rule | undefined {
  return store.rules.get(id)
}
