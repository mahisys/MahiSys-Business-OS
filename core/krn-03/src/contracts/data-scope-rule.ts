/**
 * `data_scope_rule` — KRN-03.md §4.1 (KRN-03-FR-002, verbatim shape).
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const ScopeTypeSchema = z.enum(['own', 'org_unit', 'org_unit_and_below', 'entity', 'tenant', 'rule_based'])
export type ScopeType = z.infer<typeof ScopeTypeSchema>

/**
 * `P-12 Rule.conditions`'s structured condition-tree shape (Vol 2 §P-12) —
 * defined here, the same way KRN-01's `legal-entity.ts` locally defines
 * `TaxRegistrationSchema` for `P-01 Party.tax_registrations`'s shape,
 * rather than reinventing a different one. P-12 has no owning module yet
 * (KRN-07, Rules Engine, isn't built) — KRN-07 will own the evaluator
 * this shape is handed to when it exists (§17 item 3); KRN-03 only stores
 * and reuses the shape, it does not evaluate a general rule engine.
 */
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

export const DataScopeRuleStatusSchema = z.enum(['active', 'superseded'])
export type DataScopeRuleStatus = z.infer<typeof DataScopeRuleStatusSchema>

export const DATA_SCOPE_RULE_STATUS_TRANSITIONS: Record<DataScopeRuleStatus, DataScopeRuleStatus[]> = {
  active: ['superseded'],
  superseded: [],
}

export const DataScopeRuleObjectSchema = withUniversalFields({
  scope_type: ScopeTypeSchema,
  org_unit_id: uuid.nullable(), // for org_unit / org_unit_and_below
  entity_scope_id: uuid.nullable(), // KRN-01 legal_entity, for the entity type
  expression: RuleConditionSchema.nullable(), // only for rule_based
  applies_to_entity_ref: uuid.nullable(), // KRN-04 entity_definition
  status: DataScopeRuleStatusSchema,
})

export const DataScopeRuleSchema = DataScopeRuleObjectSchema.refine(
  (r) => (r.scope_type === 'rule_based') === (r.expression !== null),
  { message: 'expression is required if and only if scope_type is rule_based (KRN-03.md §4.1)' },
).refine(
  (r) => (r.scope_type === 'org_unit' || r.scope_type === 'org_unit_and_below') ? r.org_unit_id !== null : true,
  { message: 'org_unit_id is required when scope_type is org_unit or org_unit_and_below (KRN-03.md §4.1)' },
).refine(
  (r) => r.scope_type !== 'entity' || r.entity_scope_id !== null,
  { message: 'entity_scope_id is required when scope_type is entity (KRN-03.md §4.1)' },
)
export type DataScopeRule = z.infer<typeof DataScopeRuleSchema>
