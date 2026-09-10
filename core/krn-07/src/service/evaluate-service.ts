import { randomUUID } from 'node:crypto'
import type { Krn07Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { Rule } from '../contracts/rule.js'
import type { RuleType } from '../contracts/rule-set.js'
import { evaluateRuleCondition } from '../contracts/rule-condition.js'
import { KernelError } from './errors.js'

export interface EvaluateInput {
  tenant_id: string
  rule_set_id?: string
  rule_type?: RuleType
  subject_type: string
  subject_id: string
  context: Record<string, unknown>
  /** Evaluation instant — defaults to now. Explicit for backdated/offline-sync evaluations. */
  at?: string
}

export interface EvaluateResult {
  matched: boolean
  outcome: Record<string, unknown> | null
  rule_id: string | null
  rule_version_id: string | null
  evaluated_at: string
}

function now() {
  return new Date().toISOString()
}

/** `KRN-07-FR-002`: scope filtering (does this rule apply to this subject at all) and period exclusion happen before priority ordering — a rule out of scope or out of period is never a candidate, regardless of priority. */
function isCandidate(rule: Rule, context: Record<string, unknown>, atIso: string): boolean {
  if (rule.status !== 'active') return false
  if (context.entity_id !== undefined && rule.scope.entity_id !== context.entity_id) return false
  if (rule.scope.location_id !== null && context.location_id !== undefined && rule.scope.location_id !== context.location_id) return false
  if (rule.scope.party_segment !== null && context.party_segment !== undefined && rule.scope.party_segment !== context.party_segment) return false
  if (rule.scope.item_category !== null && context.item_category !== undefined && rule.scope.item_category !== context.item_category) return false

  const at = new Date(atIso).getTime()
  const from = new Date(rule.period.from).getTime()
  if (at < from) return false
  if (rule.period.to !== null && at > new Date(rule.period.to).getTime()) return false

  return true
}

/**
 * `KRN-07-FR-005`: the single synchronous evaluation entry point, called
 * by any producing module within its own request. Not persona-gated
 * (§11's own note — governed entirely by the calling module's own
 * permission matrix, same rationale as KRN-11's `allocate()`). Never
 * emits a KRN-06 event (deliberate, §17 item 3) — only the
 * `evaluation_log` entry is written, always, whether or not anything
 * matched.
 *
 * `match_mode: accumulate` combines every matching rule's actions into
 * one outcome (`primary` = the lowest-priority match, `additional`= the
 * rest) rather than returning a list of independent results — kept to a
 * single `rule_id`/`rule_version_id` pair on `evaluation_log` so
 * `KRN-07-FR-004`'s "the exact version that fired" stays unambiguous for
 * the primary explanation, with the rest still visible inside `outcome`.
 */
export function evaluate(store: Krn07Store, input: EvaluateInput, actor: ActorRef): EvaluateResult {
  const ruleSet = input.rule_set_id
    ? store.ruleSets.get(input.rule_set_id)
    : Array.from(store.ruleSets.values()).find((rs) => rs.tenant_id === input.tenant_id && rs.rule_type === input.rule_type && rs.status === 'active')

  if (!ruleSet) {
    throw new KernelError('RULE_SET_NOT_FOUND', 'No matching active rule_set for this evaluation request.', randomUUID())
  }

  const evaluatedAt = input.at ?? now()
  const candidates = Array.from(store.rules.values())
    .filter((r) => r.rule_set_id === ruleSet.id && isCandidate(r, input.context, evaluatedAt))
    .sort((a, b) => a.priority - b.priority)

  const matches = candidates.filter((r) => evaluateRuleCondition(r.conditions, input.context))

  let result: EvaluateResult
  if (matches.length === 0) {
    result = { matched: false, outcome: null, rule_id: null, rule_version_id: null, evaluated_at: evaluatedAt }
  } else {
    const primary = matches[0]
    const outcome: Record<string, unknown> = { actions: primary.actions }
    if (ruleSet.match_mode === 'accumulate' && matches.length > 1) {
      outcome.additional_matches = matches.slice(1).map((r) => ({ rule_id: r.id, actions: r.actions }))
    }
    result = { matched: true, outcome, rule_id: primary.id, rule_version_id: primary.current_version_id, evaluated_at: evaluatedAt }
  }

  store.evaluationLog.push({
    evaluation_log_id: randomUUID(),
    tenant_id: input.tenant_id,
    rule_set_id: ruleSet.id,
    rule_id: result.rule_id,
    rule_version_id: result.rule_version_id,
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    input_snapshot: input.context,
    matched: result.matched,
    outcome: result.outcome,
    evaluated_at: evaluatedAt,
    evaluated_for: actor,
    correlation_id: null,
    latency_ms: 0,
  })

  return result
}
