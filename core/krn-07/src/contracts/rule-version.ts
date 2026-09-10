/**
 * `rule_version` — KRN-07.md §4.1. Not field-detailed in Vol 1/2 (§17
 * item 1, bulk-approved per D-31): an append-only snapshot created every
 * time a rule's conditions/actions/priority/period changes, so
 * `evaluation_log` can reference the *exact* version that produced a
 * historical outcome even after the rule is later edited (KRN-07-FR-004).
 */
import { z } from 'zod'
import { withUniversalFields, uuid, PeriodSchema } from '@mahisys/shared'
import { RuleConditionSchema } from './rule-condition.js'
import { RuleActionSchema } from './rule.js'

export const RuleVersionObjectSchema = withUniversalFields({
  rule_id: uuid,
  version_no: z.number().int().positive(), // monotonic per rule — deliberately not named `version`, avoiding the universal optimistic-lock field name (see KRN-10's D-40 precedent)
  conditions: RuleConditionSchema,
  actions: z.array(RuleActionSchema),
  priority: z.number().int(),
  period: PeriodSchema,
  change_reason: z.string().nullable(),
  superseded_by_version_id: uuid.nullable(),
})
export type RuleVersion = z.infer<typeof RuleVersionObjectSchema>
export const RuleVersionSchema = RuleVersionObjectSchema
