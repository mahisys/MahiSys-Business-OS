/**
 * `rule` — KRN-07.md §4.1, Vol 2 §P-12 verbatim as child of `rule_set`.
 * `scope.entity_id` (a KRN-01 legal-entity reference nested *inside* the
 * `scope` object) is a different field from the record's own top-level
 * universal `entity_id` (Vol 2 §1.2) — nesting means there is no actual
 * name collision the way KRN-10's D-40/KRN-06's D-38 field-naming gaps
 * were, but the two are easy to conflate when reading, so noted here.
 */
import { z } from 'zod'
import { withUniversalFields, uuid, ActorRefSchema, PeriodSchema } from '@mahisys/shared'
import { RuleConditionSchema } from './rule-condition.js'
import { RuleTypeSchema } from './rule-set.js'

export const RuleStatusSchema = z.enum(['draft', 'active', 'expired', 'retired'])
export type RuleStatus = z.infer<typeof RuleStatusSchema>

/** KRN-07.md §5: `draft → active → (expired | retired)`, both terminal. Editing an active rule's conditions/actions/priority/period never changes `status` — it creates a new `rule_version` instead (rule-version-service.ts). */
export const RULE_STATUS_TRANSITIONS: Record<RuleStatus, RuleStatus[]> = {
  draft: ['active'],
  active: ['expired', 'retired'],
  expired: [],
  retired: [],
}

export const AuthoredViaSchema = z.enum(['ui', 'natural_language', 'manifest'])
export type AuthoredVia = z.infer<typeof AuthoredViaSchema>

/** Module-declared action vocabulary (§3: KRN-07 stores and evaluates `{type: apply_discount, value: 12%}`, it does not know what "discount" means to the consuming module). */
export const RuleActionSchema = z.object({
  type: z.string().min(1),
  params: z.record(z.string(), z.unknown()),
})
export type RuleAction = z.infer<typeof RuleActionSchema>

export const RuleScopeSchema = z.object({
  entity_id: uuid, // KRN-01 legal entity
  location_id: uuid.nullable(),
  party_segment: z.string().nullable(),
  item_category: z.string().nullable(),
})
export type RuleScope = z.infer<typeof RuleScopeSchema>

export const RuleObjectSchema = withUniversalFields({
  rule_set_id: uuid,
  rule_type: RuleTypeSchema, // inherited from rule_set at creation time
  name: z.string().min(1),
  priority: z.number().int(),
  conditions: RuleConditionSchema,
  actions: z.array(RuleActionSchema),
  period: PeriodSchema,
  scope: RuleScopeSchema,
  status: RuleStatusSchema,
  current_version_id: uuid,
  authored_by: ActorRefSchema,
  authored_via: AuthoredViaSchema,
  natural_language_source: z.string().nullable(),
})

export const RuleSchema = RuleObjectSchema.refine(
  (r) => (r.authored_via === 'natural_language') === (r.natural_language_source !== null),
  { message: 'natural_language_source is set if and only if authored_via is natural_language (KRN-07.md §4.1, Vol 2 §P-12)' },
)
export type Rule = z.infer<typeof RuleSchema>
