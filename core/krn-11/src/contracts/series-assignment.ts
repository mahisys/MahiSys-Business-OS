/**
 * `series_assignment` — KRN-11.md §4.1. Not field-detailed in Vol 1 (§17
 * item 2, bulk-approved per D-31). Resolves which series a document draws
 * from when more than one candidate could match; the universal `entity_id`
 * doubles as one of the two declared "match keys" (`entity_id`,
 * `document_type_id`), same convention as `number-series.ts`.
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const SeriesAssignmentObjectSchema = withUniversalFields({
  series_id: uuid,
  document_type_id: uuid,
  location_id: uuid.nullable(), // more specific (non-null) assignments win over entity-wide ones
  priority: z.number().int(),
  effective_from: z.string().datetime(),
})
export type SeriesAssignment = z.infer<typeof SeriesAssignmentObjectSchema>
