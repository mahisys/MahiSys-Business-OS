/**
 * KRN-06's own administrative event contracts — KRN-06.md §12. Vol 1 gives
 * no explicit Events: line for KRN-06 (§17 item 2, flagged, D-31-class
 * gap); this draft proposes the minimal set below on the reasoning that L4
 * applies to KRN-06's own mutations exactly as it applies to every other
 * module's. These events themselves flow through the same `recordEvent`
 * outbox path as any other module's mutations (§12: "recursive, but
 * consistent") — see event-service.ts's `recordEvent`, which every
 * function in this module (including these administrative ones) calls.
 */
import { z } from 'zod'
import { eventEnvelope, uuid } from '@mahisys/shared'

export const SubscriptionCreatedPayloadSchema = z.object({ subscription_id: uuid, subscriber_type: z.string(), event_pattern: z.string() })
export const SubscriptionCreatedEventSchema = eventEnvelope('core.event_bus.subscription_created', SubscriptionCreatedPayloadSchema)

export const SubscriptionPausedPayloadSchema = z.object({ subscription_id: uuid })
export const SubscriptionPausedEventSchema = eventEnvelope('core.event_bus.subscription_paused', SubscriptionPausedPayloadSchema)

export const SubscriptionDisabledPayloadSchema = z.object({ subscription_id: uuid })
export const SubscriptionDisabledEventSchema = eventEnvelope('core.event_bus.subscription_disabled', SubscriptionDisabledPayloadSchema)

export const DeadLetterCreatedPayloadSchema = z.object({ dead_letter_id: uuid, event_id: uuid, subscription_id: uuid, failure_reason: z.string() })
export const DeadLetterCreatedEventSchema = eventEnvelope('core.event_bus.dead_letter_created', DeadLetterCreatedPayloadSchema)

export const DeadLetterRedrivenPayloadSchema = z.object({ dead_letter_id: uuid, event_id: uuid, subscription_id: uuid })
export const DeadLetterRedrivenEventSchema = eventEnvelope('core.event_bus.dead_letter_redriven', DeadLetterRedrivenPayloadSchema)

export const DeadLetterDiscardedPayloadSchema = z.object({ dead_letter_id: uuid, event_id: uuid, subscription_id: uuid })
export const DeadLetterDiscardedEventSchema = eventEnvelope('core.event_bus.dead_letter_discarded', DeadLetterDiscardedPayloadSchema)

export const ReplayExecutedPayloadSchema = z.object({ target_subscription_id: uuid, matched_event_count: z.number().int().nonnegative() })
export const ReplayExecutedEventSchema = eventEnvelope('core.event_bus.replay_executed', ReplayExecutedPayloadSchema)

export const SchemaRegisteredPayloadSchema = z.object({ event_schema_id: uuid, event_name: z.string(), version: z.number().int() })
export const SchemaRegisteredEventSchema = eventEnvelope('core.event_bus.schema_registered', SchemaRegisteredPayloadSchema)

export const SchemaDeprecatedPayloadSchema = z.object({ event_schema_id: uuid, event_name: z.string(), version: z.number().int() })
export const SchemaDeprecatedEventSchema = eventEnvelope('core.event_bus.schema_deprecated', SchemaDeprecatedPayloadSchema)
