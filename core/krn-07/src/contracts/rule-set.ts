/**
 * `rule_set` — KRN-07.md §4.1. Not field-detailed in Vol 1/2 (§17 item 1,
 * bulk-approved per D-31). `rule_type` never includes `tax` — enforced at
 * creation time (KRN-07-FR-006), not merely omitted from the enum (a
 * caller could otherwise pass an arbitrary string); the enum below
 * intentionally excludes it entirely, so the schema itself is the first
 * line of enforcement.
 */
import { z } from 'zod'
import { withUniversalFields } from '@mahisys/shared'

export const RuleTypeSchema = z.enum(['pricing', 'credit', 'reorder', 'eligibility', 'approval_threshold', 'compliance_check'])
export type RuleType = z.infer<typeof RuleTypeSchema>

export const MatchModeSchema = z.enum(['first_match', 'accumulate'])
export type MatchMode = z.infer<typeof MatchModeSchema>

export const RuleSetStatusSchema = z.enum(['draft', 'active', 'superseded', 'retired'])
export type RuleSetStatus = z.infer<typeof RuleSetStatusSchema>

/** KRN-07.md §5: `draft → active → (superseded | retired)`, both terminal. */
export const RULE_SET_STATUS_TRANSITIONS: Record<RuleSetStatus, RuleSetStatus[]> = {
  draft: ['active'],
  active: ['superseded', 'retired'],
  superseded: [],
  retired: [],
}

export const RuleSetSchema = withUniversalFields({
  name: z.string().min(1),
  rule_type: RuleTypeSchema,
  owning_module: z.string().min(1),
  match_mode: MatchModeSchema,
  status: RuleSetStatusSchema,
  description: z.string(),
})
export type RuleSet = z.infer<typeof RuleSetSchema>
