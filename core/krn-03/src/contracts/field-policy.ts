/**
 * `field_policy` — KRN-03.md §4.1 (KRN-03-FR-003, verbatim shape).
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const FieldPolicyKindSchema = z.enum(['hidden', 'masked', 'read_only'])
export type FieldPolicyKind = z.infer<typeof FieldPolicyKindSchema>

/** Proposed, not sourced (§17 item 4) — bulk-approved per D-31. */
export const MaskStrategySchema = z.enum(['partial', 'full', 'computed_substitute'])
export type MaskStrategy = z.infer<typeof MaskStrategySchema>

export const FieldPolicyStatusSchema = z.enum(['active', 'superseded'])
export type FieldPolicyStatus = z.infer<typeof FieldPolicyStatusSchema>

export const FIELD_POLICY_STATUS_TRANSITIONS: Record<FieldPolicyStatus, FieldPolicyStatus[]> = {
  active: ['superseded'],
  superseded: [],
}

export const FieldPolicyObjectSchema = withUniversalFields({
  entity_ref: uuid, // KRN-04 entity_definition
  field_ref: uuid, // KRN-04 field_definition
  role_id: uuid,
  policy: FieldPolicyKindSchema,
  mask_strategy: MaskStrategySchema.nullable(), // only when policy: masked
  status: FieldPolicyStatusSchema,
})

export const FieldPolicySchema = FieldPolicyObjectSchema.refine(
  (p) => (p.policy === 'masked') === (p.mask_strategy !== null),
  { message: 'mask_strategy is required if and only if policy is masked (KRN-03-FR-003)' },
)
export type FieldPolicy = z.infer<typeof FieldPolicySchema>
