/**
 * `computed_field` — KRN-04.md §4.1 (KRN-04-FR-004: declarative,
 * evaluated identically in API, reports, exports and the semantic index).
 */
import { withUniversalFields, uuid } from '@mahisys/shared'
import { z } from 'zod'

export const RecomputePolicySchema = z.enum(['on_write', 'on_read', 'scheduled'])
export type RecomputePolicy = z.infer<typeof RecomputePolicySchema>

export const ComputedFieldSchema = withUniversalFields({
  field_id: uuid, // the field_definition this computation backs
  expression: z.string().min(1),
  recompute_policy: RecomputePolicySchema,
  depends_on: z.array(uuid), // fields/relationships the expression reads
})
export type ComputedField = z.infer<typeof ComputedFieldSchema>
