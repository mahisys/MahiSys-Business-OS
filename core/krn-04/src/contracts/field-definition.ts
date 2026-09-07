/**
 * `field_definition` — KRN-04.md §4.1.
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const FieldDataTypeSchema = z.enum([
  'string', 'text', 'integer', 'decimal', 'boolean', 'date', 'timestamptz', 'enum', 'ref', 'money', 'quantity', 'json',
])
export type FieldDataType = z.infer<typeof FieldDataTypeSchema>

export const SemanticRoleSchema = z.enum(['identifier', 'meaningful', 'excluded'])
export const FieldDefinitionStatusSchema = z.enum(['active', 'deprecated', 'retired']) // no `draft` of its own — KRN-04.md §5
export type FieldDefinitionStatus = z.infer<typeof FieldDefinitionStatusSchema>

/** KRN-04.md §5: `active → deprecated → retired`. `deprecated` requires `sunset_at` (enforced by the refine below, not by this map). */
export const FIELD_DEFINITION_STATUS_TRANSITIONS: Record<FieldDefinitionStatus, FieldDefinitionStatus[]> = {
  active: ['deprecated'],
  deprecated: ['retired'],
  retired: [],
}

export const FieldDefinitionObjectSchema = withUniversalFields({
  entity_id: uuid, // parent entity_definition (this tenant's own copy, D-34)
  code: z.string().min(1), // unique within the parent entity
  data_type: FieldDataTypeSchema,
  is_required: z.boolean(),
  default: z.unknown().nullable(),
  // Inline declarative expression for single-field validation. A more
  // complex cross-field/entity-level rule is a separate `validation_rule`
  // record (validation-rule.ts) — KRN-04.md §4.1 documents both existing;
  // this is this draft's split between the two, flagged per Vol 6 §4/L13.
  validation: z.string().nullable(),
  is_indexed: z.boolean(), // a `tnt` field is indexed only where declared (Vol 2 §1.1)
  is_sensitive: z.boolean(), // KRN-03 reads this for field-level masking — KRN-04 never enforces access itself (L11)
  semantic_role: SemanticRoleSchema,
  deprecated_at: z.string().datetime().nullable(),
  sunset_at: z.string().date().nullable(), // required whenever deprecated_at is set — KRN-04-FR-003
  status: FieldDefinitionStatusSchema,
})

export const FieldDefinitionSchema = FieldDefinitionObjectSchema.refine(
  (f) => f.deprecated_at === null || f.sunset_at !== null,
  { message: 'sunset_at is required whenever deprecated_at is set (KRN-04-FR-003)' },
)
export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>
