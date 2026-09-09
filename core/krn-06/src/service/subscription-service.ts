import { randomUUID } from 'node:crypto'
import type { Krn06Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { Subscription, SubscriberType, DeliveryMode } from '../contracts/subscription.js'
import { SUBSCRIPTION_STATUS_TRANSITIONS, DEFAULT_RETRY_CEILING } from '../contracts/subscription.js'
import type { RuleCondition } from '../contracts/filter-expression.js'
import { recordEvent } from './event-service.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateSubscriptionInput {
  tenant_id: string
  subscriber_type: SubscriberType
  subscriber_id: string
  event_pattern: string
  filter_expression: RuleCondition | null
  delivery_mode: DeliveryMode
  idempotency_key_field: string
  retry_ceiling?: number
}

function now() {
  return new Date().toISOString()
}

/** `KRN-06.md §11`: PR-29 never self-service (registered through INT-03/STU-07); PR-30/PR-28 only their own; PR-21 unrestricted. */
export function createSubscription(store: Krn06Store, input: CreateSubscriptionInput, actor: ActorRef, callerPersona: PersonaId): Subscription {
  assertPermission(callerPersona, 'subscription.create')

  const id = randomUUID()
  const timestamp = now()
  const subscription: Subscription = {
    id,
    tenant_id: input.tenant_id,
    entity_id: id,
    namespace: 'tnt',
    ext: {},
    created_at: timestamp,
    created_by: actor,
    updated_at: timestamp,
    updated_by: actor,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    source: 'api',
    trace_id: randomUUID(),
    subscriber_type: input.subscriber_type,
    subscriber_id: input.subscriber_id,
    event_pattern: input.event_pattern,
    filter_expression: input.filter_expression,
    delivery_mode: input.delivery_mode,
    idempotency_key_field: input.idempotency_key_field,
    retry_ceiling: input.retry_ceiling ?? DEFAULT_RETRY_CEILING,
    status: 'active',
  }
  store.subscriptions.set(id, subscription)

  recordEvent(store, {
    tenant_id: input.tenant_id,
    entity_id: id,
    event_name: 'core.event_bus.subscription_created',
    actor,
    subject_type: 'subscription',
    subject_id: id,
    payload: { subscription_id: id, subscriber_type: input.subscriber_type, event_pattern: input.event_pattern },
  })

  return subscription
}

/**
 * §11 negative case: "PR-30 Integration Service Account attempting to
 * manage a subscription belonging to a different service account → 403."
 * PR-21 is exempt from the ownership check (tenant-wide, per §11);
 * every other subscription-managing persona (PR-30, PR-28) may only ever
 * touch a subscription whose `subscriber_id` is their own caller id.
 */
function assertOwnsSubscription(subscription: Subscription, callerPersona: PersonaId, callerSubjectId: string) {
  if (callerPersona === 'PR-21') return
  if (subscription.subscriber_id !== callerSubjectId) {
    throw new KernelError('FORBIDDEN_NOT_SUBSCRIPTION_OWNER', `${callerPersona} may only manage its own subscriptions (KRN-06.md §11).`, randomUUID())
  }
}

function transition(store: Krn06Store, subscription: Subscription, target: Subscription['status'], actor: ActorRef): Subscription {
  if (!isValidTransition(SUBSCRIPTION_STATUS_TRANSITIONS, subscription.status, target)) {
    throw new KernelError('ILLEGAL_SUBSCRIPTION_STATUS_TRANSITION', `Cannot transition subscription from ${subscription.status} to ${target} (KRN-06.md §5).`, randomUUID(), { from: subscription.status, to: target })
  }
  const timestamp = now()
  const updated: Subscription = { ...subscription, status: target, updated_at: timestamp, updated_by: actor, version: subscription.version + 1 }
  store.subscriptions.set(subscription.id, updated)
  return updated
}

export function pauseSubscription(store: Krn06Store, id: string, actor: ActorRef, callerPersona: PersonaId, callerSubjectId: string): Subscription {
  assertPermission(callerPersona, 'subscription.manage')
  const subscription = store.subscriptions.get(id)
  if (!subscription) throw new KernelError('SUBSCRIPTION_NOT_FOUND', `No subscription with id ${id}`, randomUUID())
  assertOwnsSubscription(subscription, callerPersona, callerSubjectId)
  const updated = transition(store, subscription, 'paused', actor)

  recordEvent(store, {
    tenant_id: subscription.tenant_id,
    entity_id: id,
    event_name: 'core.event_bus.subscription_paused',
    actor,
    subject_type: 'subscription',
    subject_id: id,
    payload: { subscription_id: id },
  })

  return updated
}

/** §12 names `.paused` and `.disabled` explicitly but no "resumed"/"reactivated" event — not invented here (L15); the `active ↔ paused` reversal is visible via the subscription's own `status` field and `updated_at`, same as any other un-eventful field change elsewhere in the platform's extrapolated entities. */
export function resumeSubscription(store: Krn06Store, id: string, actor: ActorRef, callerPersona: PersonaId, callerSubjectId: string): Subscription {
  assertPermission(callerPersona, 'subscription.manage')
  const subscription = store.subscriptions.get(id)
  if (!subscription) throw new KernelError('SUBSCRIPTION_NOT_FOUND', `No subscription with id ${id}`, randomUUID())
  assertOwnsSubscription(subscription, callerPersona, callerSubjectId)
  return transition(store, subscription, 'active', actor)
}

export function disableSubscription(store: Krn06Store, id: string, actor: ActorRef, callerPersona: PersonaId, callerSubjectId: string): Subscription {
  assertPermission(callerPersona, 'subscription.manage')
  const subscription = store.subscriptions.get(id)
  if (!subscription) throw new KernelError('SUBSCRIPTION_NOT_FOUND', `No subscription with id ${id}`, randomUUID())
  assertOwnsSubscription(subscription, callerPersona, callerSubjectId)
  const updated = transition(store, subscription, 'disabled', actor)

  recordEvent(store, {
    tenant_id: subscription.tenant_id,
    entity_id: id,
    event_name: 'core.event_bus.subscription_disabled',
    actor,
    subject_type: 'subscription',
    subject_id: id,
    payload: { subscription_id: id },
  })

  return updated
}

export function getSubscription(store: Krn06Store, id: string): Subscription | undefined {
  return store.subscriptions.get(id)
}
