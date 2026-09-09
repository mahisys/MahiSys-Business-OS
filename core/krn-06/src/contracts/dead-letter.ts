/**
 * `dead_letter` — KRN-06.md §4.1. Not field-detailed in Vol 1/2 (§17 item
 * 1, bulk-approved per D-31). `redriven_by`/`redriven_at` are populated
 * only on the `redriven` transition — "Human only — see §11" (§4.1's own
 * note): PR-21 is the only persona that can ever populate them, enforced
 * in dead-letter-service.ts, not by this schema (a schema cannot check
 * *who* an actor is beyond its `type`).
 */
import { z } from 'zod'
import { withUniversalFields, uuid, ActorRefSchema } from '@mahisys/shared'

export const DeadLetterStatusSchema = z.enum(['open', 'redriven', 'discarded'])
export type DeadLetterStatus = z.infer<typeof DeadLetterStatusSchema>

/** KRN-06.md §5: `open` → `redriven` | `discarded`, both terminal for that row — a subsequent failure of the same event/subscription pair creates a *new* dead_letter row rather than reopening the old one. */
export const DEAD_LETTER_STATUS_TRANSITIONS: Record<DeadLetterStatus, DeadLetterStatus[]> = {
  open: ['redriven', 'discarded'],
  redriven: [],
  discarded: [],
}

export const DeadLetterObjectSchema = withUniversalFields({
  event_id: uuid,
  subscription_id: uuid,
  failure_reason: z.string().min(1),
  first_failed_at: z.string().datetime(),
  last_attempted_at: z.string().datetime(),
  attempt_count: z.number().int().positive(),
  status: DeadLetterStatusSchema,
  redriven_by: ActorRefSchema.nullable(),
  redriven_at: z.string().datetime().nullable(),
})

export const DeadLetterSchema = DeadLetterObjectSchema.refine(
  (d) => (d.status === 'redriven') === (d.redriven_by !== null && d.redriven_at !== null),
  { message: 'redriven_by/redriven_at are set if and only if status is redriven (KRN-06.md §4.1)' },
)
export type DeadLetter = z.infer<typeof DeadLetterSchema>
