/**
 * `outbox` — KRN-06.md §4.1 [stack-bound: Postgres, polled/streamed by a
 * pgmq- or River-backed worker in the same transaction as the domain
 * write per D-12]. Not field-detailed in Vol 1/2 (§17 item 1, bulk-approved
 * per D-31). In this in-memory reference implementation there is no real
 * worker process — `publishOutboxEntry` in event-service.ts stands in for
 * what the relay worker would do, called synchronously by the same code
 * path that writes the event, since there is no separate process boundary
 * to poll across yet.
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const OutboxStatusSchema = z.enum(['pending', 'published'])
export type OutboxStatus = z.infer<typeof OutboxStatusSchema>

/** KRN-06.md §5: `pending → published` only — a failed publish stays `pending` and is retried, never rolled back, since the underlying event has already been durably recorded. */
export const OUTBOX_STATUS_TRANSITIONS: Record<OutboxStatus, OutboxStatus[]> = {
  pending: ['published'],
  published: [],
}

export const OutboxObjectSchema = withUniversalFields({
  event_id: uuid,
  status: OutboxStatusSchema,
  published_at: z.string().datetime().nullable(),
})

export const OutboxSchema = OutboxObjectSchema.refine(
  (o) => (o.status === 'published') === (o.published_at !== null),
  { message: 'published_at is set if and only if status is published (KRN-06.md §4.1)' },
)
export type OutboxEntry = z.infer<typeof OutboxSchema>
