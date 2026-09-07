/**
 * `legal_entity` entity contract — KRN-01.md §4.1, verbatim from Vol 1,
 * plus KRN-01-FR-006 (multi-GSTIN per entity, an addition beyond Vol 1's
 * literal text — see KRN-01.md §17 item 5).
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'
import { AddressSchema } from '@mahisys/shared'

/** Same shape as `P-01 Party.tax_registrations` (Vol 2 §P-01). */
export const TaxRegistrationSchema = z.object({
  type: z.enum(['gstin', 'pan', 'tan', 'cin', 'udyam']),
  number: z.string().min(1),
  verified_at: z.string().datetime().nullable(),
  status: z.enum(['unverified', 'verified', 'invalid']),
})
export type TaxRegistration = z.infer<typeof TaxRegistrationSchema>

export const ConsolidationMethodSchema = z.enum(['full', 'proportional', 'equity', 'none'])
export type ConsolidationMethod = z.infer<typeof ConsolidationMethodSchema>

// Plain object shape, kept separate from the refined schema below so that
// derived request schemas (e.g. LegalEntityCreateRequestSchema) can still
// call `.omit()` — zod's `.refine()` returns a ZodEffects wrapper that does
// not expose `.omit()`/`.pick()`.
export const LegalEntityObjectSchema = withUniversalFields({
  legal_name: z.string().min(1),
  // KRN-01-FR-006: a legal entity may hold multiple GSTINs (one per state
  // of operation), each independently verifiable via ITG-07.
  tax_registrations: z.array(TaxRegistrationSchema),
  base_currency: z.string().length(3),
  reporting_currency: z.string().length(3),
  fiscal_year_start: z.string().regex(/^\d{2}-\d{2}$/, 'MM-DD'),
  address: AddressSchema,
  parent_entity_id: uuid.nullable(),
  consolidation_method: ConsolidationMethodSchema.nullable(),
})

export const LegalEntitySchema = LegalEntityObjectSchema.refine(
  (e) => e.parent_entity_id === null || e.consolidation_method !== null,
  { message: 'consolidation_method is required when parent_entity_id is set (KRN-01.md §4.1)' },
)
export type LegalEntity = z.infer<typeof LegalEntitySchema>
