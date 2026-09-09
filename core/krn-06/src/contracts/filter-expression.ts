/**
 * `subscription.filter_expression` — KRN-03.md's `RuleCondition` shape
 * (mirroring `P-12 Rule.conditions`, Vol 2 §P-12), reused by name here per
 * KRN-06.md §4.1's own note ("same expression-tree shape as P-12, not free
 * text"). Defined locally rather than imported from `@mahisys/krn-03` — Vol
 * 6 §7 ("a module directory contains no reference to another module's
 * internals") applies exactly as it did when KRN-03 first defined this
 * shape locally instead of importing a non-existent P-12 owner (KRN-07,
 * Rules Engine, isn't built yet). Two independent local copies of the same
 * documented primitive shape, not a cross-module dependency.
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

export function evaluateRuleCondition(condition: RuleCondition, payload: Record<string, unknown>): boolean {
  if ('all' in condition) return condition.all.every((c) => evaluateRuleCondition(c, payload))
  if ('any' in condition) return condition.any.some((c) => evaluateRuleCondition(c, payload))
  const actual = payload[condition.field]
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
