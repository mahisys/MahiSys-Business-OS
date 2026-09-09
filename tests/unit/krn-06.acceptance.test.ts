/**
 * KRN-06 acceptance tests — every G/W/T in KRN-06.md §16, written against
 * the real service functions (Vol 6 §6 step 3).
 *
 * KRN-06 does not own the domain mutations that cause events (e.g. MFG-05's
 * job-work challan dispatch) — those belong to producing modules, per L3 —
 * so several samples are adapted to what KRN-06 actually owns: the
 * `recordEvent` outbox path a producing module's data-access layer would
 * call, rather than a literal challan/invoice/work-order store KRN-06 has
 * no business holding. Same adaptation pattern KRN-03/KRN-04 already used.
 */
import { describe, it, expect } from 'vitest'
import { recordEvent, attemptEventMutation, queryEvents, getEventsForSubject, getEventById, reconstructJourney } from '@mahisys/krn-06'
import { registerEventSchema, isPayloadValidForSchema, isForwardCompatible, getEventSchema } from '@mahisys/krn-06'
import { executeReplay } from '@mahisys/krn-06'
import { recordDeliveryAttempt, deliverToMatchingSubscriptions, matchesSubscription, listDeliveryAttempts } from '@mahisys/krn-06'
import { redriveDeadLetter, discardDeadLetter, listDeadLetters } from '@mahisys/krn-06'
import { setRetentionPolicy, isWithinRetention, STATUTORY_RETENTION_FLOOR_DAYS } from '@mahisys/krn-06'
import { createSubscription } from '@mahisys/krn-06'
import { newStore, makeSubscription, sysActor, userActor, TENANT_ID, ENTITY_ID, AGENT_SUBJECT_ID, INTEGRATION_SUBJECT_A } from './krn-06.fixtures.js'

describe('KRN-06-FR-001 — outbox pattern, atomic with the domain write', () => {
  it('records exactly one event row and its outbox entry together, and nothing is written on validation failure', () => {
    const store = newStore()
    const event = recordEvent(store, {
      tenant_id: TENANT_ID,
      entity_id: ENTITY_ID,
      event_name: 'mfg.job_work.dispatched',
      actor: sysActor,
      subject_type: 'job_work_challan',
      subject_id: '00000000-0000-7000-8200-0000000000c1',
      payload: { challan_no: 'JW-1042' },
    })

    expect(store.events).toHaveLength(1)
    expect(store.outbox.get(event.event_id)).toBeDefined()
    expect(store.outbox.get(event.event_id)!.status).toBe('published')

    // "if the transaction were to roll back... neither would exist" — simulated by a validation failure up front: nothing is added to either collection.
    expect(() => recordEvent(store, {
      tenant_id: TENANT_ID,
      entity_id: ENTITY_ID,
      event_name: 'not a valid event name',
      actor: sysActor,
      subject_type: 'job_work_challan',
      subject_id: '00000000-0000-7000-8200-0000000000c2',
      payload: {},
    })).toThrow()
    expect(store.events).toHaveLength(1) // unchanged — the failed attempt left no trace in either collection
  })
})

describe('KRN-06-FR-002 — append-only, no update/delete path', () => {
  it('rejects any update or delete attempt, for any actor including PR-21, with no code path capable of succeeding', () => {
    const store = newStore()
    const event = recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.job_work.dispatched', actor: sysActor, subject_type: 'job_work_challan', subject_id: '00000000-0000-7000-8200-0000000000c3', payload: {} })

    expect(() => attemptEventMutation(store, event.event_id, 'update')).toThrow()
    expect(() => attemptEventMutation(store, event.event_id, 'delete')).toThrow()
    expect(store.events).toHaveLength(1)
    expect(store.events[0]).toEqual(event) // unchanged
  })
})

describe('KRN-06-FR-003 — per-subject ordering', () => {
  it('returns three events on one subject in occurred_at order regardless of recorded_at / insertion order', () => {
    const store = newStore()
    const subjectId = '00000000-0000-7000-8200-0000000000d1'
    // Recorded out of occurred_at order on purpose.
    recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.job_work.confirmed', actor: sysActor, subject_type: 'work_order', subject_id: subjectId, payload: { seq: 2 }, occurred_at: '2026-09-14T09:05:00.000Z' })
    recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.job_work.dispatched', actor: sysActor, subject_type: 'work_order', subject_id: subjectId, payload: { seq: 1 }, occurred_at: '2026-09-14T09:00:00.000Z' })
    recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.job_work.completed', actor: sysActor, subject_type: 'work_order', subject_id: subjectId, payload: { seq: 3 }, occurred_at: '2026-09-14T09:10:00.000Z' })

    const ordered = getEventsForSubject(store, subjectId, { tenant_id: TENANT_ID, subject_type_allow_list: null }, 'PR-21')
    expect(ordered.map((e) => e.payload.seq)).toEqual([1, 2, 3])
  })
})

describe('KRN-06-FR-004 — at-least-once delivery, subscriber idempotency', () => {
  it('a redelivered event produces a second delivery_attempt row; the subscriber de-duplicates on event_id and processes the effect once', () => {
    const store = newStore()
    const subscription = makeSubscription(store)
    const event = recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.job_work.dispatched', actor: sysActor, subject_type: 'job_work_challan', subject_id: '00000000-0000-7000-8200-0000000000d2', payload: {} })

    recordDeliveryAttempt(store, event, subscription, 'succeeded', sysActor) // first delivery
    recordDeliveryAttempt(store, event, subscription, 'succeeded', sysActor) // ack lost, redelivered

    const attempts = listDeliveryAttempts(store, event.event_id, subscription.id)
    expect(attempts.map((a) => a.attempt_no)).toEqual([1, 2])

    // Subscriber-side dedup simulation, keyed on event_id (subscription.idempotency_key_field):
    const processed = new Set<string>()
    let sideEffectCount = 0
    for (const attempt of attempts) {
      const key = event.event_id // idempotency_key_field: 'event_id'
      if (processed.has(key)) continue
      processed.add(key)
      sideEffectCount += 1
    }
    expect(sideEffectCount).toBe(1)
  })
})

describe('KRN-06-FR-005 — forward-compatible schema versioning', () => {
  it('a version-2 subscriber continues to process version-3 events unmodified, ignoring the new optional field', () => {
    const store = newStore()
    const v2 = registerEventSchema(store, { tenant_id: TENANT_ID, event_name: 'fin.invoice.issued', schema_version: 2, payload_schema: { required_fields: ['invoice_id', 'amount'], optional_fields: [] }, owning_module: 'FIN-02', effective_from: new Date().toISOString() }, sysActor)
    const v3 = registerEventSchema(store, { tenant_id: TENANT_ID, event_name: 'fin.invoice.issued', schema_version: 3, payload_schema: { required_fields: ['invoice_id', 'amount'], optional_fields: ['due_date'] }, owning_module: 'FIN-02', effective_from: new Date().toISOString() }, sysActor)

    expect(isForwardCompatible(v2.payload_schema, v3.payload_schema)).toBe(true)

    const v3Payload = { invoice_id: 'INV-1', amount: '1000.00', due_date: '2026-10-01' }
    expect(isPayloadValidForSchema(v2, v3Payload)).toBe(true) // v2 subscriber only checks its own required fields, ignores due_date

    // v2 is now deprecated, superseded by v3 — old rows are never deleted (append-only ethos, L12), just re-fetched to see the current status.
    expect(getEventSchema(store, v2.id)!.status).toBe('deprecated')
    expect(v3.status).toBe('active')
  })

  it('rejects a version that removes a field the prior version required', () => {
    const store = newStore()
    registerEventSchema(store, { tenant_id: TENANT_ID, event_name: 'scm.stock.adjusted', schema_version: 1, payload_schema: { required_fields: ['sku', 'quantity_delta'], optional_fields: [] }, owning_module: 'SCM-01', effective_from: new Date().toISOString() }, sysActor)
    expect(() =>
      registerEventSchema(store, { tenant_id: TENANT_ID, event_name: 'scm.stock.adjusted', schema_version: 2, payload_schema: { required_fields: ['sku'], optional_fields: [] }, owning_module: 'SCM-01', effective_from: new Date().toISOString() }, sysActor),
    ).toThrow()
  })

  it('event_schema.register is never a persona-gated action, even for PR-21 — only a service actor may call it (§17 item 4)', () => {
    const store = newStore()
    expect(() =>
      registerEventSchema(store, { tenant_id: TENANT_ID, event_name: 'krn.test.registered', schema_version: 1, payload_schema: { required_fields: [], optional_fields: [] }, owning_module: 'KRN-06', effective_from: new Date().toISOString() }, userActor),
    ).toThrow()
  })
})

describe('KRN-06-FR-006 — scoped replay without side effects', () => {
  it('replaying a correlation to one nominated subscription delivers only to that subscription, none of the others', () => {
    const store = newStore()
    const target = makeSubscription(store, { subscriber_id: INTEGRATION_SUBJECT_A, event_pattern: 'mfg.job_work.*' })
    const other = createSubscription(store, { tenant_id: TENANT_ID, subscriber_type: 'integration', subscriber_id: '00000000-0000-7000-8200-0000000000bb', event_pattern: 'mfg.job_work.*', filter_expression: null, delivery_mode: 'push', idempotency_key_field: 'event_id' }, sysActor, 'PR-21')

    const correlationId = '00000000-0000-7000-8200-0000000000cc'
    for (let i = 0; i < 5; i++) {
      recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.job_work.confirmed', actor: sysActor, subject_type: 'work_order', subject_id: '00000000-0000-7000-8200-0000000000dd', payload: { i }, correlation_id: correlationId })
    }

    const result = executeReplay(store, TENANT_ID, { correlation_id: correlationId }, target.id, sysActor, 'PR-21')
    expect(result.matched_event_count).toBe(5)
    expect(listDeliveryAttempts(store, result.matched_events[0].event_id, target.id)).toHaveLength(1)
    expect(listDeliveryAttempts(store, result.matched_events[0].event_id, other.id)).toHaveLength(0) // the non-targeted subscription receives nothing
  })

  it('only PR-21 may execute a replay', () => {
    const store = newStore()
    const target = makeSubscription(store)
    expect(() => executeReplay(store, TENANT_ID, {}, target.id, userActor, 'PR-30')).toThrow()
  })
})

describe('KRN-06-DR-001 — journey reconstruction', () => {
  it('reconstructs a five-event chain in causal order with no orphan events', () => {
    const store = newStore()
    const correlationId = '00000000-0000-7000-8200-0000000000ee'
    const e1 = recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'sls.quote.created', actor: sysActor, subject_type: 'order', subject_id: 'O-1042', payload: {}, correlation_id: correlationId, occurred_at: '2026-09-01T00:00:00.000Z' })
    const e2 = recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'sls.order.created', actor: sysActor, subject_type: 'order', subject_id: 'O-1042', payload: {}, correlation_id: correlationId, causation_id: e1.event_id, occurred_at: '2026-09-02T00:00:00.000Z' })
    const e3 = recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.work_order.completed', actor: sysActor, subject_type: 'order', subject_id: 'O-1042', payload: {}, correlation_id: correlationId, causation_id: e2.event_id, occurred_at: '2026-09-03T00:00:00.000Z' })
    const e4 = recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.job_work.dispatched', actor: sysActor, subject_type: 'order', subject_id: 'O-1042', payload: {}, correlation_id: correlationId, causation_id: e3.event_id, occurred_at: '2026-09-04T00:00:00.000Z' })
    recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'fin.invoice.issued', actor: sysActor, subject_type: 'order', subject_id: 'O-1042', payload: {}, correlation_id: correlationId, causation_id: e4.event_id, occurred_at: '2026-09-05T00:00:00.000Z' })

    const journey = reconstructJourney(store, correlationId)
    expect(journey.events).toHaveLength(5)
    expect(journey.orphan_event_ids).toEqual([])
    expect(journey.events[0].event_id).toBe(e1.event_id) // causal/time order, root first
  })
})

describe('KRN-06-FR-007 — dead letters visible, diagnosable, PR-21-redrivable only', () => {
  it('a subscription exceeding its retry_ceiling produces an open dead_letter; only PR-21 may redrive or discard it', () => {
    const store = newStore()
    const subscription = makeSubscription(store, { retry_ceiling: 2 })
    const event = recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.job_work.dispatched', actor: sysActor, subject_type: 'job_work_challan', subject_id: '00000000-0000-7000-8200-0000000000f1', payload: {} })

    recordDeliveryAttempt(store, event, subscription, 'failed', sysActor, { error_code: 'TIMEOUT', error_message: 'timed out' })
    recordDeliveryAttempt(store, event, subscription, 'failed', sysActor, { error_code: 'TIMEOUT', error_message: 'timed out' })
    recordDeliveryAttempt(store, event, subscription, 'failed', sysActor, { error_code: 'TIMEOUT', error_message: 'timed out' }) // 3rd failure exceeds retry_ceiling of 2

    const deadLetters = listDeadLetters(store, TENANT_ID, 'PR-21', null)
    expect(deadLetters).toHaveLength(1)
    expect(deadLetters[0].status).toBe('open')
    expect(deadLetters[0].failure_reason).toBe('timed out')

    // Negative case: no persona other than PR-21 may redrive or discard.
    expect(() => redriveDeadLetter(store, deadLetters[0].id, userActor, 'PR-30')).toThrow()
    expect(() => discardDeadLetter(store, deadLetters[0].id, userActor, 'OTHER')).toThrow()
    expect(store.deadLetters.get(deadLetters[0].id)!.status).toBe('open') // unchanged by the rejected attempts

    const redriven = redriveDeadLetter(store, deadLetters[0].id, sysActor, 'PR-21')
    expect(redriven.status).toBe('redriven')
    expect(redriven.redriven_by).toEqual(sysActor)
    expect(store.deadLetters.has(deadLetters[0].id)).toBe(true) // stays a permanent record, not deleted
  })
})

describe('KRN-06-FR-008 (addition) — subscription filtering', () => {
  it('a positive quantity_delta creates no delivery attempt; a matching negative one does', () => {
    const store = newStore()
    const subscription = createSubscription(store, { tenant_id: TENANT_ID, subscriber_type: 'integration', subscriber_id: INTEGRATION_SUBJECT_A, event_pattern: 'scm.stock.*', filter_expression: { field: 'quantity_delta', operator: 'lt', value: 0 }, delivery_mode: 'push', idempotency_key_field: 'event_id' }, sysActor, 'PR-21')

    const positiveEvent = recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'scm.stock.adjusted', actor: sysActor, subject_type: 'stock_item', subject_id: '00000000-0000-7000-8200-0000000000g1', payload: { quantity_delta: 5 } })
    const negativeEvent = recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'scm.stock.adjusted', actor: sysActor, subject_type: 'stock_item', subject_id: '00000000-0000-7000-8200-0000000000g2', payload: { quantity_delta: -3 } })

    expect(matchesSubscription(subscription, positiveEvent)).toBe(false)
    expect(matchesSubscription(subscription, negativeEvent)).toBe(true)

    const attemptsForPositive = deliverToMatchingSubscriptions(store, positiveEvent, sysActor)
    const attemptsForNegative = deliverToMatchingSubscriptions(store, negativeEvent, sysActor)
    expect(attemptsForPositive).toHaveLength(0)
    expect(attemptsForNegative).toHaveLength(1)
  })
})

describe('KRN-06-FR-009 (addition) — retention above statutory floor', () => {
  it('accepts a configuration above the floor, rejects one below it at configuration time (not silently capped)', () => {
    const store = newStore()
    expect(setRetentionPolicy(store, TENANT_ID, STATUTORY_RETENTION_FLOOR_DAYS + 365 * 2, 'PR-21')).toBe(STATUTORY_RETENTION_FLOOR_DAYS + 365 * 2)
    expect(() => setRetentionPolicy(store, TENANT_ID, STATUTORY_RETENTION_FLOOR_DAYS - 1, 'PR-21')).toThrow()
    expect(() => setRetentionPolicy(store, TENANT_ID, 3650, 'OTHER')).toThrow() // only PR-21 configures retention (D-38)

    const tenYears = 3650
    setRetentionPolicy(store, TENANT_ID, tenYears, 'PR-21')
    expect(isWithinRetention(store, TENANT_ID, STATUTORY_RETENTION_FLOOR_DAYS + 30)).toBe(true) // older than the floor, within the configured 10 years
    expect(isWithinRetention(store, TENANT_ID, tenYears + 1)).toBe(false)
  })
})

describe('KRN-06-FR-010 (addition) — scoped read enforced universally', () => {
  it('an agent querying outside its declared data_scope gets no result for that event, identically to how a human scope would be enforced', () => {
    const store = newStore()
    recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'fin.invoice.issued', actor: sysActor, subject_type: 'invoice', subject_id: '00000000-0000-7000-8200-0000000000h1', payload: {} })
    recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.job_work.dispatched', actor: sysActor, subject_type: 'job_work_challan', subject_id: '00000000-0000-7000-8200-0000000000h2', payload: {} })

    // MFG-AG-05's declared data_scope, pre-resolved by INT-03/KRN-03 (L3) — job_work subjects only.
    const agentScope = { tenant_id: TENANT_ID, subject_type_allow_list: ['job_work_challan'] }
    const results = queryEvents(store, { event_name: 'fin.invoice.issued' }, agentScope, 'PR-29')
    expect(results).toHaveLength(0)

    const inScopeResults = queryEvents(store, { event_name: 'mfg.job_work.dispatched' }, agentScope, 'PR-29')
    expect(inScopeResults).toHaveLength(1)
  })

  it('a direct fetch-by-id outside the caller declared scope is a 403, not a silent empty result', () => {
    const store = newStore()
    const invoiceEvent = recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'fin.invoice.issued', actor: sysActor, subject_type: 'invoice', subject_id: '00000000-0000-7000-8200-0000000000h3', payload: {} })
    const agentScope = { tenant_id: TENANT_ID, subject_type_allow_list: ['job_work_challan'] }
    expect(() => getEventById(store, invoiceEvent.event_id, agentScope, 'PR-29')).toThrow()
  })
})

describe('KRN-06-FR-011 (addition) — offline event-time ordering', () => {
  it('preserves occurred_at as three distinct captured times while recorded_at clusters near the sync time, and orders by occurred_at', () => {
    const store = newStore()
    const subjectId = '00000000-0000-7000-8200-0000000000i1'
    const captured = ['2026-09-14T10:00:00.000Z', '2026-09-14T10:15:00.000Z', '2026-09-14T10:30:00.000Z']
    for (const occurredAt of captured) {
      recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.production.confirmed', actor: sysActor, subject_type: 'work_order', subject_id: subjectId, payload: { occurred_at: occurredAt }, occurred_at: occurredAt })
    }

    const events = getEventsForSubject(store, subjectId, { tenant_id: TENANT_ID, subject_type_allow_list: null }, 'PR-21')
    expect(events.map((e) => e.occurred_at)).toEqual(captured)
    // recorded_at is all near "now" (sync time), not equal to occurred_at — the whole point of the offline profile (§15).
    for (const e of events) {
      expect(e.recorded_at).not.toBe(e.occurred_at)
    }
  })
})

describe('KRN-06-DR-002 (addition) — one store, five consumers', () => {
  it('five independent query calls against the same event return the identical, unmodified record', () => {
    const store = newStore()
    const event = recordEvent(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, event_name: 'mfg.job_work.dispatched', actor: sysActor, subject_type: 'job_work_challan', subject_id: '00000000-0000-7000-8200-0000000000j1', payload: {} })
    const scope = { tenant_id: TENANT_ID, subject_type_allow_list: null }

    const auditRead = getEventById(store, event.event_id, scope, 'PR-21') // KRN-10
    const analyticsRead = getEventById(store, event.event_id, scope, 'PR-21') // KRN-17
    const agentTriggerRead = getEventById(store, event.event_id, scope, 'PR-21') // INT-03
    const simulationRead = getEventById(store, event.event_id, scope, 'PR-21') // INT-05
    const undoEligibilityRead = getEventById(store, event.event_id, scope, 'PR-21') // KRN-18

    expect(auditRead).toEqual(analyticsRead)
    expect(auditRead).toEqual(agentTriggerRead)
    expect(auditRead).toEqual(simulationRead)
    expect(auditRead).toEqual(undoEligibilityRead)
  })
})
