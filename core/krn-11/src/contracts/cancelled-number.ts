/**
 * `cancelled_number` — KRN-11.md §4.1. Not field-detailed in Vol 1 (§17
 * item 2, bulk-approved per D-31). The permanent, append-only record of
 * every sequence value that was consumed and then cancelled — the primary
 * GST-audit evidence artefact (§9/§13/§14).
 */
import { z } from 'zod'
import { withUniversalFields, uuid, ActorRefSchema } from '@mahisys/shared'

export const CancelledNumberReasonSchema = z.enum(['document_failed_validation', 'reservation_expired', 'document_voided', 'manual_correction'])
export type CancelledNumberReason = z.infer<typeof CancelledNumberReasonSchema>

export const CancelledNumberSchema = withUniversalFields({
  series_id: uuid,
  sequence_value: z.number().int().positive(),
  formatted_number: z.string(),
  document_id: uuid.nullable(), // null when the reservation was released before any document existed to attach it to
  reason: CancelledNumberReasonSchema,
  cancelled_at: z.string().datetime(),
  cancelled_by: ActorRefSchema,
})
export type CancelledNumber = z.infer<typeof CancelledNumberSchema>
