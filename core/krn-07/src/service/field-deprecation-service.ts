import type { Krn07Store } from './store.js'
import type { Rule } from '../contracts/rule.js'
import { collectFieldRefs } from '../contracts/rule-condition.js'

/**
 * `KRN-07.md §12` consumed event: `metadata.field.deprecated` (KRN-04).
 * A condition referencing a field KRN-04 has deprecated is flagged for
 * review rather than silently continuing to evaluate against a
 * sunsetting field (L12's deprecate-not-remove discipline extending into
 * rule content). This is the handler function the real event
 * subscription would call once KRN-06 wiring exists at the API layer —
 * same "consumed event, handler exists, no live subscription harness
 * yet" pattern as KRN-03's `revokeGrantsForSubject`.
 */
export function findRulesReferencingField(store: Krn07Store, fieldRef: string): Rule[] {
  return Array.from(store.rules.values()).filter((r) => {
    if (r.status !== 'active' && r.status !== 'draft') return false
    return collectFieldRefs(r.conditions).has(fieldRef)
  })
}
