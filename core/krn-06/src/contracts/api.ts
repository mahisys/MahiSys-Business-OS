/**
 * KRN-06 API request/response contracts — KRN-06.md §10. Base path
 * `/api/v1/core/{entity}` per Vol 0 §42. No POST/PATCH/DELETE exists for
 * `events` — the only route to a new event is a mutation in a producing
 * module's own transaction (KRN-06-FR-001); this is a deliberate absence,
 * not an omission, so no `EventCreateRequestSchema` is defined here.
 */
import { z } from 'zod'
import { cursorListRequest, cursorListResponse, uuid } from '@mahisys/shared'
import { StoredEventSchema } from './event.js'
import { SubscriptionSchema } from './subscription.js'
import { EventSchemaSchema } from './event-schema.js'
import { DeadLetterSchema } from './dead-letter.js'

const OMIT_SERVER_MANAGED = {
  id: true, ext: true, created_at: true, created_by: true,
  updated_at: true, updated_by: true, version: true, deleted_at: true,
  deleted_by: true, source: true, trace_id: true,
} as const

// GET /api/v1/core/events
export const EventQueryFilterSchema = z.object({
  subject_type: z.string().optional(),
  subject_id: uuid.optional(),
  event_name: z.string().optional(),
  correlation_id: uuid.optional(),
  causation_id: uuid.optional(),
  occurred_from: z.string().datetime().optional(),
  occurred_to: z.string().datetime().optional(),
})
export const EventListRequestSchema = cursorListRequest(EventQueryFilterSchema)
export const EventListResponseSchema = cursorListResponse(StoredEventSchema)

// CRUD /api/v1/core/subscriptions
export const SubscriptionCreateRequestSchema = SubscriptionSchema.omit({ ...OMIT_SERVER_MANAGED, status: true })
export const SubscriptionListResponseSchema = cursorListResponse(SubscriptionSchema)

// GET /api/v1/core/event-schemas — read-only at runtime (§17 item 4)
export const EventSchemaListResponseSchema = cursorListResponse(EventSchemaSchema)

// POST /api/v1/core/replay
export const ReplayRequestSchema = z.object({
  subject_id: uuid.optional(),
  time_range: z.object({ from: z.string().datetime(), to: z.string().datetime() }).optional(),
  correlation_id: uuid.optional(),
  event_type: z.string().optional(),
  target_subscription_id: uuid,
})
export const ReplayResponseSchema = z.object({
  matched_event_count: z.number().int().nonnegative(),
  target_subscription_id: uuid,
})

// GET /api/v1/core/dead-letters
export const DeadLetterListResponseSchema = cursorListResponse(DeadLetterSchema)
