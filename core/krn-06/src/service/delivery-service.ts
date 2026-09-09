import { randomUUID } from 'node:crypto'
import type { Krn06Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { DeliveryAttempt } from '../contracts/delivery-attempt.js'
import type { Subscription } from '../contracts/subscription.js'
import type { StoredEvent } from '../contracts/event.js'
import { matchesEventPattern } from '../contracts/subscription.js'
import { evaluateRuleCondition } from '../contracts/filter-expression.js'
import { createDeadLetter } from './dead-letter-service.js'

function now() {
  return new Date().toISOString()
}

/** `KRN-06-FR-008`: pattern match first, then the structured filter (never free text/executable code) against `payload`. */
export function matchesSubscription(subscription: Subscription, event: StoredEvent): boolean {
  if (subscription.status !== 'active') return false
  if (!matchesEventPattern(subscription.event_pattern, event.event_name)) return false
  if (subscription.filter_expression !== null && !evaluateRuleCondition(subscription.filter_expression, event.payload)) return false
  return true
}

/**
 * `KRN-06-FR-004`: at-least-once — a caller may invoke this more than once
 * for the same `(event, subscription)` pair (a lost ack causing
 * redelivery); each call creates a *new* `delivery_attempt` row with an
 * incremented `attempt_no`, never mutates a prior one (§5). When a
 * `failed` outcome pushes the subscription's own consecutive-failure
 * count past its `retry_ceiling` (KRN-06-FR-007), a `dead_letter` is
 * created — system-actor, not persona-gated, since this is the delivery
 * mechanism's own consequence, not a human action.
 */
export function recordDeliveryAttempt(
  store: Krn06Store,
  event: StoredEvent,
  subscription: Subscription,
  outcome: 'succeeded' | 'failed',
  systemActor: ActorRef,
  errorInfo?: { error_code: string; error_message: string },
): DeliveryAttempt {
  const priorAttempts = Array.from(store.deliveryAttempts.values()).filter((a) => a.event_id === event.event_id && a.subscription_id === subscription.id)
  const attemptNo = priorAttempts.length + 1
  const id = randomUUID()
  const timestamp = now()
  const attempt: DeliveryAttempt = {
    id,
    tenant_id: event.tenant_id,
    entity_id: id,
    namespace: 'tnt',
    ext: {},
    created_at: timestamp,
    created_by: systemActor,
    updated_at: timestamp,
    updated_by: systemActor,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    source: 'api',
    trace_id: event.trace_id,
    event_id: event.event_id,
    subscription_id: subscription.id,
    attempt_no: attemptNo,
    status: outcome,
    attempted_at: timestamp,
    latency_ms: 0,
    error_code: outcome === 'failed' ? (errorInfo?.error_code ?? 'DELIVERY_FAILED') : null,
    error_message: outcome === 'failed' ? (errorInfo?.error_message ?? 'delivery failed') : null,
  }
  store.deliveryAttempts.set(id, attempt)

  if (outcome === 'failed') {
    const consecutiveFailures = Array.from(store.deliveryAttempts.values())
      .filter((a) => a.event_id === event.event_id && a.subscription_id === subscription.id && a.status === 'failed').length
    const alreadyDeadLettered = Array.from(store.deadLetters.values()).some((d) => d.event_id === event.event_id && d.subscription_id === subscription.id)
    if (consecutiveFailures > subscription.retry_ceiling && !alreadyDeadLettered) {
      createDeadLetter(store, event, subscription, attempt.error_message ?? 'delivery failed', consecutiveFailures, systemActor)
    }
  }

  return attempt
}

/** Delivers `event` to every currently-matching subscription — the concrete mechanism `FR-006`'s replay reuses, scoped to one nominated subscription instead of "every live subscriber." */
export function deliverToMatchingSubscriptions(store: Krn06Store, event: StoredEvent, systemActor: ActorRef): DeliveryAttempt[] {
  const matching = Array.from(store.subscriptions.values()).filter((s) => matchesSubscription(s, event))
  return matching.map((s) => recordDeliveryAttempt(store, event, s, 'succeeded', systemActor))
}

export function listDeliveryAttempts(store: Krn06Store, eventId: string, subscriptionId: string): DeliveryAttempt[] {
  return Array.from(store.deliveryAttempts.values())
    .filter((a) => a.event_id === eventId && a.subscription_id === subscriptionId)
    .sort((a, b) => a.attempt_no - b.attempt_no)
}
