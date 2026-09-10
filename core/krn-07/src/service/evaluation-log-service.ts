import type { Krn07Store } from './store.js'
import type { EvaluationLogEntry } from '../contracts/evaluation-log.js'
import type { RuleType } from '../contracts/rule-set.js'
import type { PersonaId } from './permissions.js'
import { hasDomainAccess } from './permissions.js'

export interface EvaluationLogFilter {
  subject_type?: string
  rule_set_id?: string
}

/** `evaluation_log.read (own domain)` — filters silently to rule sets the caller's domain grants cover, same list-query semantics as KRN-06's `queryEvents`. PR-29's further "own declared data scope" narrowing is a subject-level scope (L3, pre-resolved by the caller) layered on top via `subjectAllowList`, not a rule_type-domain concern. */
export function readEvaluationLog(store: Krn07Store, tenantId: string, filter: EvaluationLogFilter, callerPersona: PersonaId, callerDomainOverride?: RuleType[], subjectAllowList?: string[] | null): EvaluationLogEntry[] {
  let results = store.evaluationLog.filter((e) => e.tenant_id === tenantId)

  results = results.filter((e) => {
    const ruleSet = store.ruleSets.get(e.rule_set_id)
    if (!ruleSet) return false
    return hasDomainAccess(callerPersona, 'log_read', ruleSet.rule_type, callerDomainOverride)
  })

  if (subjectAllowList) {
    results = results.filter((e) => subjectAllowList.includes(e.subject_type))
  }
  if (filter.subject_type) results = results.filter((e) => e.subject_type === filter.subject_type)
  if (filter.rule_set_id) results = results.filter((e) => e.rule_set_id === filter.rule_set_id)

  return results
}
