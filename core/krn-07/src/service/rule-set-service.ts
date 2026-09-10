import { randomUUID } from 'node:crypto'
import type { Krn07Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { RuleSet, MatchMode, RuleType } from '../contracts/rule-set.js'
import { RuleTypeSchema, RULE_SET_STATUS_TRANSITIONS } from '../contracts/rule-set.js'
import type { PersonaId } from './permissions.js'
import { assertDomainAccess } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateRuleSetInput {
  tenant_id: string
  entity_id: string
  namespace: 'sys' | 'tnt'
  name: string
  rule_type: string // raw, validated at runtime — see the KRN-07-FR-006 tax guard below
  owning_module: string
  match_mode: MatchMode
  description: string
}

function now() {
  return new Date().toISOString()
}

/**
 * `KRN-07-FR-006`: no `rule_set` may ever declare `rule_type: tax` — L7
 * reserves tax logic to CMP-01 exclusively. Checked explicitly, before
 * general enum validation, so the rejection names L7 specifically rather
 * than reading as a generic invalid-enum error; applies to every persona
 * including PR-21 (§11 negative case) — this function takes no exception
 * for any caller.
 */
function assertNotTaxRuleType(ruleType: string) {
  if (ruleType === 'tax') {
    throw new KernelError('TAX_RULE_TYPE_FORBIDDEN', 'No rule_set may declare rule_type: tax — tax logic is CMP-01\'s exclusive responsibility under L7 (KRN-07-FR-006).', randomUUID())
  }
}

export function createRuleSet(store: Krn07Store, input: CreateRuleSetInput, actor: ActorRef, callerPersona: PersonaId, callerDomainOverride?: RuleType[]): RuleSet {
  assertNotTaxRuleType(input.rule_type)
  const parsed = RuleTypeSchema.safeParse(input.rule_type)
  if (!parsed.success) {
    throw new KernelError('INVALID_RULE_TYPE', `"${input.rule_type}" is not a declared rule_type (KRN-07.md §4.1).`, randomUUID())
  }
  const ruleType = parsed.data
  assertDomainAccess(callerPersona, 'edit_draft', ruleType, callerDomainOverride)

  const id = randomUUID()
  const timestamp = now()
  const ruleSet: RuleSet = {
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
    name: input.name,
    rule_type: ruleType,
    owning_module: input.owning_module,
    match_mode: input.match_mode,
    status: 'draft',
    description: input.description,
  }
  store.ruleSets.set(id, ruleSet)
  return ruleSet
}

/**
 * `KRN-07.md §11`: activation of higher-impact rule types (credit,
 * pricing) is gated more tightly than lower-impact ones — modeled here as
 * the same domain-grant check `createRuleSet` uses, just against the
 * `activate` action instead of `edit_draft`. §11 also notes activation
 * "may route through a KRN-05 approval matrix" for high-impact types;
 * KRN-05 doesn't exist yet (Phase 1) — degrades to direct execution per
 * D-21, same convention as KRN-01's `tenant.lifecycle`.
 *
 * §10 lists only `POST /rule-sets/{id}/activate` — no separate endpoint
 * to activate an individual `rule`, even though `rule.status` (§5) is its
 * own `draft → active` machine. This draft's reading: activating a
 * `rule_set` cascades to every `draft` rule within it, matching how §5
 * frames a rule set as the unit an owner actually activates. Not
 * literally stated either way in KRN-07.md — a genuine gap alongside its
 * other §17 items, flagged here rather than guessed silently.
 */
export function activateRuleSet(store: Krn07Store, ruleSetId: string, actor: ActorRef, callerPersona: PersonaId, callerDomainOverride?: RuleType[]): RuleSet {
  const ruleSet = store.ruleSets.get(ruleSetId)
  if (!ruleSet) throw new KernelError('RULE_SET_NOT_FOUND', `No rule_set with id ${ruleSetId}`, randomUUID())
  assertDomainAccess(callerPersona, 'activate', ruleSet.rule_type, callerDomainOverride)
  if (!isValidTransition(RULE_SET_STATUS_TRANSITIONS, ruleSet.status, 'active')) {
    throw new KernelError('ILLEGAL_RULE_SET_STATUS_TRANSITION', `Cannot transition rule_set from ${ruleSet.status} to active (KRN-07.md §5).`, randomUUID())
  }

  const timestamp = now()
  const updated: RuleSet = { ...ruleSet, status: 'active', updated_at: timestamp, updated_by: actor, version: ruleSet.version + 1 }
  store.ruleSets.set(ruleSetId, updated)

  for (const rule of store.rules.values()) {
    if (rule.rule_set_id === ruleSetId && rule.status === 'draft') {
      store.rules.set(rule.id, { ...rule, status: 'active', updated_at: timestamp, updated_by: actor, version: rule.version + 1 })
    }
  }

  store.emit({
    tenant_id: ruleSet.tenant_id,
    entity_id: ruleSet.entity_id,
    event_name: 'rules.set.activated',
    actor,
    subject_type: 'rule_set',
    subject_id: ruleSetId,
    payload: { rule_set_id: ruleSetId, rule_type: ruleSet.rule_type },
  })

  return updated
}

function transitionToDeprecated(store: Krn07Store, ruleSet: RuleSet, target: 'superseded' | 'retired', actor: ActorRef): RuleSet {
  if (!isValidTransition(RULE_SET_STATUS_TRANSITIONS, ruleSet.status, target)) {
    throw new KernelError('ILLEGAL_RULE_SET_STATUS_TRANSITION', `Cannot transition rule_set from ${ruleSet.status} to ${target} (KRN-07.md §5).`, randomUUID())
  }
  const timestamp = now()
  const updated: RuleSet = { ...ruleSet, status: target, updated_at: timestamp, updated_by: actor, version: ruleSet.version + 1 }
  store.ruleSets.set(ruleSet.id, updated)

  store.emit({
    tenant_id: ruleSet.tenant_id,
    entity_id: ruleSet.entity_id,
    event_name: 'rules.set.deprecated',
    actor,
    subject_type: 'rule_set',
    subject_id: ruleSet.id,
    payload: { rule_set_id: ruleSet.id, status: target },
  })

  return updated
}

/** `retired` — deliberate deactivation with no replacement. Same domain-gated action as `activateRuleSet`. */
export function retireRuleSet(store: Krn07Store, ruleSetId: string, actor: ActorRef, callerPersona: PersonaId, callerDomainOverride?: RuleType[]): RuleSet {
  const ruleSet = store.ruleSets.get(ruleSetId)
  if (!ruleSet) throw new KernelError('RULE_SET_NOT_FOUND', `No rule_set with id ${ruleSetId}`, randomUUID())
  assertDomainAccess(callerPersona, 'activate', ruleSet.rule_type, callerDomainOverride)
  return transitionToDeprecated(store, ruleSet, 'retired', actor)
}

/** `superseded` — a replacement rule_set takes over the same rule_type and scope. Internal consequence of publishing a replacement, not independently persona-gated beyond the replacement's own activation check. */
export function supersedeRuleSet(store: Krn07Store, ruleSetId: string, actor: ActorRef): RuleSet {
  const ruleSet = store.ruleSets.get(ruleSetId)
  if (!ruleSet) throw new KernelError('RULE_SET_NOT_FOUND', `No rule_set with id ${ruleSetId}`, randomUUID())
  return transitionToDeprecated(store, ruleSet, 'superseded', actor)
}

export function getRuleSet(store: Krn07Store, id: string): RuleSet | undefined {
  return store.ruleSets.get(id)
}

export function readRuleSets(store: Krn07Store, tenantId: string, callerPersona: PersonaId, callerDomainOverride?: RuleType[]): RuleSet[] {
  return Array.from(store.ruleSets.values()).filter((rs) => rs.tenant_id === tenantId && assertReadable(callerPersona, rs.rule_type, callerDomainOverride))
}

function assertReadable(persona: PersonaId, ruleType: RuleType, callerDomainOverride?: RuleType[]): boolean {
  try {
    assertDomainAccess(persona, 'read', ruleType, callerDomainOverride)
    return true
  } catch {
    return false
  }
}
