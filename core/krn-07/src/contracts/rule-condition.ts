/**
 * `P-12 Rule.conditions` — the structured expression-tree shape (Vol 2
 * §P-12): never free text, never executable code. KRN-03 and KRN-06 each
 * already define this exact shape locally, since they needed it before
 * KRN-07 (P-12's actual owning module) existed to import from — per L3/
 * Vol 6 §7, a module never reaches into another's internals, so each
 * defines its own copy rather than a shared cross-import.
 *
 * KRN-07 is now that owning module — this is the canonical definition
 * going forward for any *new* module that needs this shape. Retrofitting
 * KRN-03/KRN-06's already-working local copies to import from here
 * instead is out of scope for this session (no functional gap, pure
 * refactor risk for no behavioural gain) — noted for awareness, not
 * treated as a decision requiring action now.
 */
import { z } from 'zod'

export type RuleCondition =
  | { field: string; operator: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'not_in'; value?: unknown }
  | { all: RuleCondition[] }
  | { any: RuleCondition[] }

export const RuleConditionSchema: z.ZodType<RuleCondition> = z.lazy(() =>
  z.union([
    z.object({ field: z.string().min(1), operator: z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'not_in']), value: z.unknown() }),
    z.object({ all: z.array(RuleConditionSchema) }),
    z.object({ any: z.array(RuleConditionSchema) }),
  ]),
)

export function evaluateRuleCondition(condition: RuleCondition, context: Record<string, unknown>): boolean {
  if ('all' in condition) return condition.all.every((c) => evaluateRuleCondition(c, context))
  if ('any' in condition) return condition.any.some((c) => evaluateRuleCondition(c, context))
  const actual = context[condition.field]
  switch (condition.operator) {
    case 'eq': return actual === condition.value
    case 'ne': return actual !== condition.value
    case 'lt': return typeof actual === 'number' && typeof condition.value === 'number' && actual < condition.value
    case 'lte': return typeof actual === 'number' && typeof condition.value === 'number' && actual <= condition.value
    case 'gt': return typeof actual === 'number' && typeof condition.value === 'number' && actual > condition.value
    case 'gte': return typeof actual === 'number' && typeof condition.value === 'number' && actual >= condition.value
    case 'in': return Array.isArray(condition.value) && condition.value.includes(actual)
    case 'not_in': return Array.isArray(condition.value) && !condition.value.includes(actual)
    default: return false
  }
}

/** Every field reference within a condition tree, for KRN-07-FR-001's KRN-04 declared-field validation. */
export function collectFieldRefs(condition: RuleCondition, out: Set<string> = new Set()): Set<string> {
  if ('all' in condition) { for (const c of condition.all) collectFieldRefs(c, out); return out }
  if ('any' in condition) { for (const c of condition.any) collectFieldRefs(c, out); return out }
  out.add(condition.field)
  return out
}
