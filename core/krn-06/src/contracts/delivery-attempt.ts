/**
 * `delivery_attempt` — KRN-06.md §4.1. Not field-detailed in Vol 1/2 (§17
 * item 1, bulk-approved per D-31). Terminal per attempt (§5): a failed
 * attempt never mutates itself, a new row is created for the retry with
 * an incremented `attempt_no`, preserving full delivery history per
 * subscription (P-08's append-only ethos applies to this entity too).
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const DeliveryAttemptStatusSchema = z.enum(['pending', 'succeeded', 'failed'])
export type DeliveryAttemptStatus = z.infer<typeof DeliveryAttemptStatusSchema>

export const DELIVERY_ATTEMPT_STATUS_TRANSITIONS: Record<DeliveryAttemptStatus, DeliveryAttemptStatus[]> = {
  pending: ['succeeded', 'failed'],
  succeeded: [],
  failed: [],
}

export const DeliveryAttemptObjectSchema = withUniversalFields({
  event_id: uuid,
  subscription_id: uuid,
  attempt_no: z.number().int().positive(),
  status: DeliveryAttemptStatusSchema,
  attempted_at: z.string().datetime(),
  latency_ms: z.number().int().nonnegative().nullable(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
})

export const DeliveryAttemptSchema = DeliveryAttemptObjectSchema.refine(
  (a) => (a.status === 'failed') === (a.error_code !== null && a.error_message !== null),
  { message: 'error_code/error_message are required if and only if status is failed (KRN-06.md §4.1)' },
)
export type DeliveryAttempt = z.infer<typeof DeliveryAttemptSchema>
