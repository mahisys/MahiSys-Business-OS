/**
 * `sequence_state` — KRN-11.md §4.1: the live, hot-path counter, kept
 * separate from `number_series`'s declarative configuration so the
 * concurrency-critical row stays small (KRN-11-DR-002).
 *
 * `open_reservations` is an addition beyond §4.1's field table (see
 * decisions-taken.md D-39): the API surface (§10) names a
 * `{allocation_id}` path parameter for `/confirm` and `/cancel`, but §5
 * explicitly says the per-number lifecycle is "carried implicitly across
 * `sequence_state` and `cancelled_number`, not a separate entity's own
 * field" — ruling out a whole new top-level owned entity for it. This
 * array is the minimal structure needed to give `allocation_id` something
 * concrete to resolve against during the open (reserved-but-not-yet-
 * confirmed) phase, added as a field on the existing `sequence_state`
 * entity rather than inventing a new one.
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const OpenReservationSchema = z.object({
  allocation_id: uuid,
  sequence_value: z.number().int().positive(),
  reserved_at: z.string().datetime(),
  expires_at: z.string().datetime().nullable(),
  idempotency_key: z.string(),
})
export type OpenReservation = z.infer<typeof OpenReservationSchema>

export const SequenceStateObjectSchema = withUniversalFields({
  series_id: uuid,
  current_value: z.number().int().nonnegative(), // last value successfully allocated (not merely reserved)
  reserved_high_watermark: z.number().int().nonnegative(),
  locked_at: z.string().datetime().nullable(),
  open_reservations: z.array(OpenReservationSchema),
})

export const SequenceStateSchema = SequenceStateObjectSchema.refine(
  (s) => s.current_value <= s.reserved_high_watermark,
  { message: 'current_value must never exceed reserved_high_watermark (KRN-11.md §4.1)' },
)
export type SequenceState = z.infer<typeof SequenceStateSchema>
