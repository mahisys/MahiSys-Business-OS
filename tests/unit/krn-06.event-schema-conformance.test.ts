/**
 * KRN-06 event-schema conformance — same rationale as KRN-01/02/03/04's:
 * runs the real service functions and validates actual emitted events
 * against the real Zod schemas, not just hand-built contract-test
 * fixtures.
 */
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import { createSubscription, pauseSubscription, disableSubscription } from '@mahisys/krn-06'
import { recordEvent } from '@mahisys/krn-06'
import { recordDeliveryAttempt } from '@mahisys/krn-06'
import { redriveDeadLetter, discardDeadLetter } from '@mahisys/krn-06'
import { executeReplay } from '@mahisys/krn-06'
import { registerEventSchema } from '@mahisys/krn-06'
import {
  SubscriptionCreatedEventSchema,
  SubscriptionPausedEventSchema,
  SubscriptionDisabledEventSchema,
  DeadLetterCreatedEventSchema,
  DeadLetterRedrivenEventSchema,
  DeadLetterDiscardedEventSchema,
  ReplayExecutedEventSchema,
  SchemaRegisteredEventSchema,
  SchemaDeprecatedEventSchema,
} from '@mahisys/krn-06'
import { newStore, makeSubscription, sysActor, TENANT_ID, ENTITY_ID, INTEGRATION_SUBJECT_A } from './krn-06.fixtures.js'

const SCHEMA_BY_EVENT_NAME: Record<string, z.ZodTypeAny> = {
  'core.event_bus.subscription_created': SubscriptionCreatedEventSchema,
  'core.event_bus.subscription_paused': SubscriptionPausedEventSchema,
  'core.event_bus.subscription_disabled': SubscriptionDisabledEventSchema,
  'core.event_bus.dead_letter_created': DeadLetterCreatedEventSchema,
  'core.event_bus.dead_letter_redriven': DeadLetterRedrivenEventSchema,
  'core.event_bus.dead_letter_discarded': DeadLetterDiscardedEventSchema,
  'core.event_bus.replay_executed': ReplayExecutedEventSchema,
  'core.event_bus.schema_registered': SchemaRegisteredEventSchema,
  'core.event_bus.schema_deprecated': SchemaDeprecatedEventSchema,
  // Non-administrative event names recorded directly in these tests (simulating a producing module) carry no KRN-06-owned schema — only KRN-06's own administrative events (§12) are validated below.
}

describe('KRN-06 — every emitted administrative event validates against its declared Zod schema', () => {
  it('exercises every KRN-06 administrative mutation and checks each resulting event', () => {
    const store = newStore()

    const sub1 = createSubscription(store, { tenant_id: TENANT_ID, subscriber_type: 'integration', subscriber_id: INTEGRATION_SUBJECT_A, event_pattern: 'mfg.*', filter_expression: null, delivery_mode: 'push', idempotency_key_field: 'event_id' }, sysActor, 'PR-21') // subscription_created
    pauseSubscription(store, sub1.id, sysActor, 'PR-21', 'irrelevant') // subscription_paused
    const sub2 = createSubscription(store, { tenant_id: TENANT_ID, subscriber_type: 'integration', subscriber_id: INTEGRATION_SUBJECT_A, event_pattern: 'scm.*', filter_expression: null, delivery_mode: 'push', idempotency_key_field: 'event_id', retry_ceiling: 1 }, sysActor, 'PR-21')
    disableSubscription(store, sub2.id, sysActor, 'PR-21', 'irrelevant') // subscription_disabled

    const subForDeadLetter = makeSubscription(store, { retry_ceiling: 1 })
    const event = recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.job_work.dispatched', actor: sysActor, subject_type: 'job_work_challan', subject_id: '00000000-0000-7000-8200-0000000000m1', payload: {} })
    recordDeliveryAttempt(store, event, subForDeadLetter, 'failed', sysActor, { error_code: 'E', error_message: 'e' })
    recordDeliveryAttempt(store, event, subForDeadLetter, 'failed', sysActor, { error_code: 'E', error_message: 'e' }) // dead_letter_created
    const deadLetter = Array.from(store.deadLetters.values())[0]
    redriveDeadLetter(store, deadLetter.id, sysActor, 'PR-21') // dead_letter_redriven

    const subForDeadLetter2 = makeSubscription(store, { retry_ceiling: 1 })
    const event2 = recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.job_work.dispatched', actor: sysActor, subject_type: 'job_work_challan', subject_id: '00000000-0000-7000-8200-0000000000m2', payload: {} })
    recordDeliveryAttempt(store, event2, subForDeadLetter2, 'failed', sysActor, { error_code: 'E', error_message: 'e' })
    recordDeliveryAttempt(store, event2, subForDeadLetter2, 'failed', sysActor, { error_code: 'E', error_message: 'e' })
    const deadLetter2 = Array.from(store.deadLetters.values()).find((d) => d.id !== deadLetter.id)!
    discardDeadLetter(store, deadLetter2.id, sysActor, 'PR-21') // dead_letter_discarded

    const replayTarget = makeSubscription(store)
    executeReplay(store, TENANT_ID, {}, replayTarget.id, sysActor, 'PR-21') // replay_executed

    registerEventSchema(store, { tenant_id: TENANT_ID, event_name: 'krn.test.registered', schema_version: 1, payload_schema: { required_fields: [], optional_fields: [] }, owning_module: 'KRN-06', effective_from: new Date().toISOString() }, sysActor) // schema_registered
    registerEventSchema(store, { tenant_id: TENANT_ID, event_name: 'krn.test.registered', schema_version: 2, payload_schema: { required_fields: [], optional_fields: ['note'] }, owning_module: 'KRN-06', effective_from: new Date().toISOString() }, sysActor) // schema_registered (again) + schema_deprecated (v1)

    const administrativeEvents = store.events.filter((e) => e.event_name.startsWith('core.event_bus.'))
    expect(administrativeEvents.length).toBeGreaterThanOrEqual(9)

    for (const event of administrativeEvents) {
      const schema = SCHEMA_BY_EVENT_NAME[event.event_name]
      expect(schema, `no schema registered for emitted event_name "${event.event_name}"`).toBeDefined()
      const result = schema.safeParse(event)
      if (!result.success) {
        throw new Error(`Event ${event.event_name} does not match its declared schema: ${JSON.stringify(result.error.issues, null, 2)}`)
      }
    }
  })
})
