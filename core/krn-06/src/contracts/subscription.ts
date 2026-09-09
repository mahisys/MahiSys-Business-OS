/**
 * `subscription` — KRN-06.md §4.1. Not field-detailed in Vol 1/2 (§17
 * item 1, bulk-approved per D-31). `retry_ceiling` is an addition beyond
 * the drafted field table — §17 item 6 flags the dead-letter threshold as
 * unspecified and proposes "configurable per subscription, platform
 * default 5 attempts"; this draft implements that proposal directly as a
 * field rather than a hard-coded constant, so it is genuinely
 * configurable as §17 item 6 itself proposes. See decisions-taken.md D-38.
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'
import { RuleConditionSchema } from './filter-expression.js'

export const SubscriberTypeSchema = z.enum(['module', 'agent', 'integration', 'webhook'])
export type SubscriberType = z.infer<typeof SubscriberTypeSchema>

export const DeliveryModeSchema = z.enum(['push', 'pull'])
export type DeliveryMode = z.infer<typeof DeliveryModeSchema>

export const SubscriptionStatusSchema = z.enum(['active', 'paused', 'disabled'])
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>

/** KRN-06.md §5: `active ↔ paused` (reversible), `active → disabled` (terminal — "requires explicit re-creation to resume"). No transition out of `disabled` and none directly from `paused` to `disabled` is stated in §5's text, so none is implemented — a paused subscription must first resume before it can be disabled, matching the prose literally rather than inferring an unstated shortcut. */
export const SUBSCRIPTION_STATUS_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  active: ['paused', 'disabled'],
  paused: ['active'],
  disabled: [],
}

export const DEFAULT_RETRY_CEILING = 5 // §17 item 6's proposed platform default

export const SubscriptionSchema = withUniversalFields({
  subscriber_type: SubscriberTypeSchema,
  subscriber_id: uuid,
  event_pattern: z.string().min(1),
  filter_expression: RuleConditionSchema.nullable(),
  delivery_mode: DeliveryModeSchema,
  idempotency_key_field: z.string().min(1),
  retry_ceiling: z.number().int().positive(),
  status: SubscriptionStatusSchema,
})
export type Subscription = z.infer<typeof SubscriptionSchema>

/** KRN-06.md §4.1's `event_pattern`: exact name or a `module.entity.*` wildcard. */
export function matchesEventPattern(pattern: string, eventName: string): boolean {
  if (!pattern.includes('*')) return pattern === eventName
  const escaped = pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^${escaped}$`).test(eventName)
}
