/**
 * `validation_rule` — KRN-04.md §4.1. Cross-field/entity-level validation
 * (KRN-04-FR-004's expression grammar, KRN-07-owned per §3's scope note —
 * KRN-04 references the grammar, it does not evaluate it).
 */
import { withUniversalFields, uuid } from '@mahisys/shared'
import { z } from 'zod'

export const ValidationSeveritySchema = z.enum(['block', 'warn'])
export type ValidationSeverity = z.infer<typeof ValidationSeveritySchema>

export const ValidationRuleSchema = withUniversalFields({
  entity_id: uuid,
  field_id: uuid.nullable(), // null when the rule is cross-field/entity-level
  expression: z.string().min(1), // KRN-07 grammar
  error_message_key: z.string().min(1), // localisation key (KRN-19)
  severity: ValidationSeveritySchema,
})
export type ValidationRule = z.infer<typeof ValidationRuleSchema>
