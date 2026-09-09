import { randomUUID } from 'node:crypto'
import type { Krn06Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { DeadLetter } from '../contracts/dead-letter.js'
import type { Subscription } from '../contracts/subscription.js'
import type { StoredEvent } from '../contracts/event.js'
import { DEAD_LETTER_STATUS_TRANSITIONS } from '../contracts/dead-letter.js'
import { recordEvent } from './event-service.js'
import { recordDeliveryAttempt } from './delivery-service.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

function now() {
  return new Date().toISOString()
}

/** Created internally by delivery-service.ts once a subscription's consecutive failures for one event exceed its `retry_ceiling` (KRN-06-FR-007) — never called directly by a persona. */
export function createDeadLetter(store: Krn06Store, event: StoredEvent, subscription: Subscription, failureReason: string, attemptCount: number, systemActor: ActorRef): DeadLetter {
  const id = randomUUID()
  const timestamp = now()
  const deadLetter: DeadLetter = {
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
    failure_reason: failureReason,
    first_failed_at: timestamp,
    last_attempted_at: timestamp,
    attempt_count: attemptCount,
    status: 'open',
    redriven_by: null,
    redriven_at: null,
  }
  store.deadLetters.set(id, deadLetter)

  recordEvent(store, {
    tenant_id: event.tenant_id,
    entity_id: id,
    event_name: 'core.event_bus.dead_letter_created',
    actor: systemActor,
    subject_type: 'dead_letter',
    subject_id: id,
    payload: { dead_letter_id: id, event_id: event.event_id, subscription_id: subscription.id, failure_reason: failureReason },
  })

  return deadLetter
}

/**
 * `KRN-06-FR-007`: "by an administrator" is read strictly — PR-21 only,
 * no exceptions, not even a high-trust-ceiling agent (§8: this action has
 * no corresponding tool in any agent's declared tool set at all, it is
 * not merely permission-denied). Starts a new `delivery_attempt` sequence
 * against the same event/subscription; on success the dead letter itself
 * is not deleted — it stays a permanent record of the failure and its
 * resolution (§5).
 */
export function redriveDeadLetter(store: Krn06Store, deadLetterId: string, actor: ActorRef, callerPersona: PersonaId): DeadLetter {
  assertPermission(callerPersona, 'dead_letter.redrive_discard')
  const deadLetter = store.deadLetters.get(deadLetterId)
  if (!deadLetter) throw new KernelError('DEAD_LETTER_NOT_FOUND', `No dead_letter with id ${deadLetterId}`, randomUUID())
  if (!isValidTransition(DEAD_LETTER_STATUS_TRANSITIONS, deadLetter.status, 'redriven')) {
    throw new KernelError('ILLEGAL_DEAD_LETTER_STATUS_TRANSITION', `Cannot transition dead_letter from ${deadLetter.status} to redriven (KRN-06.md §5).`, randomUUID())
  }

  const event = store.events.find((e) => e.event_id === deadLetter.event_id)
  const subscription = store.subscriptions.get(deadLetter.subscription_id)
  if (event && subscription) {
    recordDeliveryAttempt(store, event, subscription, 'succeeded', actor)
  }

  const timestamp = now()
  const updated: DeadLetter = { ...deadLetter, status: 'redriven', redriven_by: actor, redriven_at: timestamp, updated_at: timestamp, updated_by: actor, version: deadLetter.version + 1 }
  store.deadLetters.set(deadLetterId, updated)

  recordEvent(store, {
    tenant_id: deadLetter.tenant_id,
    entity_id: deadLetterId,
    event_name: 'core.event_bus.dead_letter_redriven',
    actor,
    subject_type: 'dead_letter',
    subject_id: deadLetterId,
    payload: { dead_letter_id: deadLetterId, event_id: deadLetter.event_id, subscription_id: deadLetter.subscription_id },
  })

  return updated
}

/** `KRN-06-FR-007`: PR-21 only — the administrator has decided the event will never be delivered to that subscriber. Terminal, per §5. */
export function discardDeadLetter(store: Krn06Store, deadLetterId: string, actor: ActorRef, callerPersona: PersonaId): DeadLetter {
  assertPermission(callerPersona, 'dead_letter.redrive_discard')
  const deadLetter = store.deadLetters.get(deadLetterId)
  if (!deadLetter) throw new KernelError('DEAD_LETTER_NOT_FOUND', `No dead_letter with id ${deadLetterId}`, randomUUID())
  if (!isValidTransition(DEAD_LETTER_STATUS_TRANSITIONS, deadLetter.status, 'discarded')) {
    throw new KernelError('ILLEGAL_DEAD_LETTER_STATUS_TRANSITION', `Cannot transition dead_letter from ${deadLetter.status} to discarded (KRN-06.md §5).`, randomUUID())
  }

  const timestamp = now()
  const updated: DeadLetter = { ...deadLetter, status: 'discarded', updated_at: timestamp, updated_by: actor, version: deadLetter.version + 1 }
  store.deadLetters.set(deadLetterId, updated)

  recordEvent(store, {
    tenant_id: deadLetter.tenant_id,
    entity_id: deadLetterId,
    event_name: 'core.event_bus.dead_letter_discarded',
    actor,
    subject_type: 'dead_letter',
    subject_id: deadLetterId,
    payload: { dead_letter_id: deadLetterId, event_id: deadLetter.event_id, subscription_id: deadLetter.subscription_id },
  })

  return updated
}

/** `dead_letter.read` — PR-21 tenant-wide, PR-30 restricted to its own subscription's dead letters (enforced by the caller pre-filtering `subscriptionOwnerAllowList`, same L3-compliant pre-resolved-scope pattern as `event.read`). */
export function listDeadLetters(store: Krn06Store, tenantId: string, callerPersona: PersonaId, subscriptionOwnerAllowList: string[] | null): DeadLetter[] {
  assertPermission(callerPersona, 'dead_letter.read')
  let results = Array.from(store.deadLetters.values()).filter((d) => d.tenant_id === tenantId)
  if (subscriptionOwnerAllowList !== null) {
    results = results.filter((d) => subscriptionOwnerAllowList.includes(d.subscription_id))
  }
  return results
}

export function getDeadLetter(store: Krn06Store, id: string): DeadLetter | undefined {
  return store.deadLetters.get(id)
}
