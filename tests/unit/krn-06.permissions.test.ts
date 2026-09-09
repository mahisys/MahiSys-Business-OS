/**
 * KRN-06 permission tests — Vol 6 §6 step 4, from KRN-06.md §11.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { hasPermission } from '@mahisys/krn-06'
import { type Krn06Store } from '@mahisys/krn-06'
import { createSubscription, pauseSubscription, disableSubscription } from '@mahisys/krn-06'
import { recordEvent, queryEvents } from '@mahisys/krn-06'
import { redriveDeadLetter, discardDeadLetter } from '@mahisys/krn-06'
import { recordDeliveryAttempt } from '@mahisys/krn-06'
import { executeReplay } from '@mahisys/krn-06'
import { registerEventSchema } from '@mahisys/krn-06'
import { setRetentionPolicy } from '@mahisys/krn-06'
import { newStore, makeSubscription, sysActor, userActor, TENANT_ID, ENTITY_ID, INTEGRATION_SUBJECT_A, INTEGRATION_SUBJECT_B } from './krn-06.fixtures.js'

describe('KRN-06 permission matrix (§11) — positive cases', () => {
  it('PR-21 holds every administrative grant', () => {
    expect(hasPermission('PR-21', 'event.read')).toBe(true)
    expect(hasPermission('PR-21', 'subscription.create')).toBe(true)
    expect(hasPermission('PR-21', 'subscription.manage')).toBe(true)
    expect(hasPermission('PR-21', 'replay.execute')).toBe(true)
    expect(hasPermission('PR-21', 'dead_letter.read')).toBe(true)
    expect(hasPermission('PR-21', 'dead_letter.redrive_discard')).toBe(true)
    expect(hasPermission('PR-21', 'retention.configure')).toBe(true)
  })

  it('PR-30 Integration Service Account can read/create/manage/read-dead-letters but not replay or redrive', () => {
    expect(hasPermission('PR-30', 'event.read')).toBe(true)
    expect(hasPermission('PR-30', 'subscription.create')).toBe(true)
    expect(hasPermission('PR-30', 'subscription.manage')).toBe(true)
    expect(hasPermission('PR-30', 'dead_letter.read')).toBe(true)
    expect(hasPermission('PR-30', 'replay.execute')).toBe(false)
    expect(hasPermission('PR-30', 'dead_letter.redrive_discard')).toBe(false)
  })

  it('PR-29 Agent can only read (own scope) — no subscription self-service, no replay, no dead-letter access', () => {
    expect(hasPermission('PR-29', 'event.read')).toBe(true)
    expect(hasPermission('PR-29', 'subscription.create')).toBe(false)
    expect(hasPermission('PR-29', 'replay.execute')).toBe(false)
    expect(hasPermission('PR-29', 'dead_letter.read')).toBe(false)
  })
})

describe('KRN-06 permission matrix (§11) — negative cases', () => {
  it('no persona at all holds event_schema.register — a deployment-time/service action, not a runtime grant (§17 item 4)', () => {
    const personas = ['PR-21', 'PR-29', 'PR-30', 'PR-25', 'PR-26', 'PR-28', 'OTHER'] as const
    for (const persona of personas) {
      expect(hasPermission(persona, 'event_schema.register'), persona).toBe(false)
    }
  })

  it('PR-25 External CA/Auditor and PR-26 Regulator hold nothing at all — SEC-06 scoped export only, never the raw stream', () => {
    for (const persona of ['PR-25', 'PR-26'] as const) {
      expect(hasPermission(persona, 'event.read'), persona).toBe(false)
      expect(hasPermission(persona, 'dead_letter.read'), persona).toBe(false)
      expect(hasPermission(persona, 'subscription.create'), persona).toBe(false)
    }
  })

  it('OTHER (every other internal/external persona) holds nothing — no direct raw-stream screen at all', () => {
    const actions = ['event.read', 'subscription.create', 'subscription.manage', 'replay.execute', 'dead_letter.read', 'dead_letter.redrive_discard', 'retention.configure'] as const
    for (const action of actions) {
      expect(hasPermission('OTHER', action), action).toBe(false)
    }
  })

  it('only PR-21 holds dead_letter.redrive_discard — no other persona, no agent regardless of trust ceiling (KRN-06-FR-007)', () => {
    const personas = ['PR-29', 'PR-30', 'PR-25', 'PR-26', 'PR-28', 'OTHER'] as const
    for (const persona of personas) {
      expect(hasPermission(persona, 'dead_letter.redrive_discard'), persona).toBe(false)
    }
  })
})

describe('KRN-06 write paths actually enforce the matrix, not just report it', () => {
  let store: Krn06Store
  beforeEach(() => {
    store = newStore()
  })

  it('createSubscription: PR-30 succeeds, OTHER is rejected', () => {
    expect(() => createSubscription(store, { tenant_id: TENANT_ID, subscriber_type: 'integration', subscriber_id: INTEGRATION_SUBJECT_A, event_pattern: 'mfg.*', filter_expression: null, delivery_mode: 'push', idempotency_key_field: 'event_id' }, userActor, 'PR-30')).not.toThrow()
    expect(() => createSubscription(store, { tenant_id: TENANT_ID, subscriber_type: 'integration', subscriber_id: INTEGRATION_SUBJECT_A, event_pattern: 'mfg.*', filter_expression: null, delivery_mode: 'push', idempotency_key_field: 'event_id' }, userActor, 'OTHER')).toThrow()
  })

  it('subscription.manage: PR-30 may only manage its own subscription, not one belonging to a different service account (§11 negative case)', () => {
    const ownSub = createSubscription(store, { tenant_id: TENANT_ID, subscriber_type: 'integration', subscriber_id: INTEGRATION_SUBJECT_A, event_pattern: 'mfg.*', filter_expression: null, delivery_mode: 'push', idempotency_key_field: 'event_id' }, sysActor, 'PR-21')
    const othersSub = createSubscription(store, { tenant_id: TENANT_ID, subscriber_type: 'integration', subscriber_id: INTEGRATION_SUBJECT_B, event_pattern: 'scm.*', filter_expression: null, delivery_mode: 'push', idempotency_key_field: 'event_id' }, sysActor, 'PR-21')

    expect(() => pauseSubscription(store, ownSub.id, userActor, 'PR-30', INTEGRATION_SUBJECT_A)).not.toThrow()
    expect(() => pauseSubscription(store, othersSub.id, userActor, 'PR-30', INTEGRATION_SUBJECT_A)).toThrow()
    // PR-21 is exempt from the ownership check.
    expect(() => disableSubscription(store, othersSub.id, sysActor, 'PR-21', 'irrelevant-for-PR-21')).not.toThrow()
  })

  it('replay.execute: PR-21 succeeds, PR-30 is rejected even though it can read/create subscriptions', () => {
    const target = makeSubscription(store)
    expect(() => executeReplay(store, TENANT_ID, {}, target.id, sysActor, 'PR-21')).not.toThrow()
    expect(() => executeReplay(store, TENANT_ID, {}, target.id, userActor, 'PR-30')).toThrow()
  })

  it('dead_letter.redrive_discard: PR-21 succeeds, every other persona is rejected (KRN-06-FR-007)', () => {
    const subscription = makeSubscription(store, { retry_ceiling: 1 })
    const event = recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.job_work.dispatched', actor: sysActor, subject_type: 'job_work_challan', subject_id: '00000000-0000-7000-8200-0000000000k1', payload: {} })
    // Two failures exceed retry_ceiling of 1.
    recordDeliveryAttempt(store, event, subscription, 'failed', sysActor, { error_code: 'E', error_message: 'e' })
    recordDeliveryAttempt(store, event, subscription, 'failed', sysActor, { error_code: 'E', error_message: 'e' })
    const created = Array.from(store.deadLetters.values())[0]

    expect(() => discardDeadLetter(store, created.id, userActor, 'PR-30')).toThrow()
    expect(() => redriveDeadLetter(store, created.id, sysActor, 'PR-21')).not.toThrow()
  })

  it('event_schema.register: rejected for a user actor even under PR-21, accepted only for a service actor', () => {
    expect(() =>
      registerEventSchema(store, { tenant_id: TENANT_ID, event_name: 'krn.test.registered', schema_version: 1, payload_schema: { required_fields: [], optional_fields: [] }, owning_module: 'KRN-06', effective_from: new Date().toISOString() }, userActor),
    ).toThrow()
    expect(() =>
      registerEventSchema(store, { tenant_id: TENANT_ID, event_name: 'krn.test.registered', schema_version: 1, payload_schema: { required_fields: [], optional_fields: [] }, owning_module: 'KRN-06', effective_from: new Date().toISOString() }, sysActor),
    ).not.toThrow()
  })

  it('retention.configure: PR-21 succeeds, OTHER is rejected (D-38)', () => {
    expect(() => setRetentionPolicy(store, TENANT_ID, 3650, 'PR-21')).not.toThrow()
    expect(() => setRetentionPolicy(store, TENANT_ID, 3650, 'OTHER')).toThrow()
  })

  it('event.read: PR-25/PR-26 are rejected outright — no raw-stream access at any privilege level', () => {
    expect(() => queryEvents(store, {}, { tenant_id: TENANT_ID, subject_type_allow_list: null }, 'PR-25')).toThrow()
    expect(() => queryEvents(store, {}, { tenant_id: TENANT_ID, subject_type_allow_list: null }, 'PR-26')).toThrow()
    expect(() => queryEvents(store, {}, { tenant_id: TENANT_ID, subject_type_allow_list: null }, 'PR-21')).not.toThrow()
  })
})
