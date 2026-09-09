import { randomUUID } from 'node:crypto'
import type { Krn06Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { StoredEvent } from '../contracts/event.js'
import { recordEvent } from './event-service.js'
import { recordDeliveryAttempt } from './delivery-service.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

export interface ReplayFilter {
  subject_id?: string
  time_range?: { from: string; to: string }
  correlation_id?: string
  event_type?: string
}

export interface ReplayResult {
  matched_event_count: number
  target_subscription_id: string
  matched_events: StoredEvent[]
}

/**
 * `KRN-06-FR-006`: PR-21 only, always logged (§9). Redelivers matching
 * `event` rows to exactly one nominated subscription — never broadcasts
 * to every live subscriber of the matched event types (§11 negative
 * case), and never re-executes the original mutation, only its
 * already-recorded event (there is no mutation to re-execute here; KRN-06
 * only ever redelivers what it already durably holds).
 */
export function executeReplay(store: Krn06Store, tenantId: string, filter: ReplayFilter, targetSubscriptionId: string, actor: ActorRef, callerPersona: PersonaId): ReplayResult {
  assertPermission(callerPersona, 'replay.execute')

  const subscription = store.subscriptions.get(targetSubscriptionId)
  if (!subscription) {
    throw new KernelError('SUBSCRIPTION_NOT_FOUND', `No subscription with id ${targetSubscriptionId}`, randomUUID())
  }

  let matched = store.events.filter((e) => e.tenant_id === tenantId)
  if (filter.subject_id) matched = matched.filter((e) => e.subject_id === filter.subject_id)
  if (filter.correlation_id) matched = matched.filter((e) => e.correlation_id === filter.correlation_id)
  if (filter.event_type) matched = matched.filter((e) => e.event_name === filter.event_type)
  if (filter.time_range) {
    const { from, to } = filter.time_range
    matched = matched.filter((e) => e.occurred_at >= from && e.occurred_at <= to)
  }
  matched = [...matched].sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0))

  for (const event of matched) {
    recordDeliveryAttempt(store, event, subscription, 'succeeded', actor)
  }

  recordEvent(store, {
    tenant_id: tenantId,
    entity_id: targetSubscriptionId,
    event_name: 'core.event_bus.replay_executed',
    actor,
    subject_type: 'subscription',
    subject_id: targetSubscriptionId,
    payload: { target_subscription_id: targetSubscriptionId, matched_event_count: matched.length },
  })

  return { matched_event_count: matched.length, target_subscription_id: targetSubscriptionId, matched_events: matched }
}
