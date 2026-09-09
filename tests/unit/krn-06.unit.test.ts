/**
 * KRN-06 unit tests — exhaustive state-transition legality for all four
 * KRN-06 state machines (Vol 6 §5 Definition of Done).
 */
import { describe, it, expect } from 'vitest'
import { isValidTransition, terminalStates } from '@mahisys/shared'
import { OUTBOX_STATUS_TRANSITIONS, type OutboxStatus } from '@mahisys/krn-06'
import { DELIVERY_ATTEMPT_STATUS_TRANSITIONS, type DeliveryAttemptStatus } from '@mahisys/krn-06'
import { DEAD_LETTER_STATUS_TRANSITIONS, type DeadLetterStatus } from '@mahisys/krn-06'
import { SUBSCRIPTION_STATUS_TRANSITIONS, type SubscriptionStatus } from '@mahisys/krn-06'
import { EVENT_SCHEMA_STATUS_TRANSITIONS, type EventSchemaStatus } from '@mahisys/krn-06'

const OUTBOX_STATES: OutboxStatus[] = ['pending', 'published']
const DELIVERY_ATTEMPT_STATES: DeliveryAttemptStatus[] = ['pending', 'succeeded', 'failed']
const DEAD_LETTER_STATES: DeadLetterStatus[] = ['open', 'redriven', 'discarded']
const SUBSCRIPTION_STATES: SubscriptionStatus[] = ['active', 'paused', 'disabled']
const EVENT_SCHEMA_STATES: EventSchemaStatus[] = ['draft', 'active', 'deprecated']

function assertExhaustive<S extends string>(states: S[], transitions: Record<S, S[]>, validPairs: Array<[S, S]>) {
  const validSet = new Set(validPairs.map(([f, t]) => `${f}->${t}`))
  for (const from of states) {
    for (const to of states) {
      expect(isValidTransition(transitions, from, to), `${from} -> ${to}`).toBe(validSet.has(`${from}->${to}`))
    }
  }
}

describe('KRN-06 unit — outbox.status state machine (KRN-06.md §5)', () => {
  it('permits exactly pending→published', () => {
    assertExhaustive(OUTBOX_STATES, OUTBOX_STATUS_TRANSITIONS, [['pending', 'published']])
  })

  it('published is terminal — no other transition exists (KRN-06-FR-002-adjacent, §5)', () => {
    expect(terminalStates(OUTBOX_STATUS_TRANSITIONS)).toEqual(['published'])
  })
})

describe('KRN-06 unit — delivery_attempt.status state machine (KRN-06.md §5)', () => {
  it('permits pending to either succeeded or failed, nothing else', () => {
    assertExhaustive(DELIVERY_ATTEMPT_STATES, DELIVERY_ATTEMPT_STATUS_TRANSITIONS, [
      ['pending', 'succeeded'],
      ['pending', 'failed'],
    ])
  })

  it('both succeeded and failed are terminal per attempt — a retry creates a new row', () => {
    expect(terminalStates(DELIVERY_ATTEMPT_STATUS_TRANSITIONS).sort()).toEqual(['failed', 'succeeded'])
  })
})

describe('KRN-06 unit — dead_letter.status state machine (KRN-06.md §5)', () => {
  it('permits open to either redriven or discarded, nothing else', () => {
    assertExhaustive(DEAD_LETTER_STATES, DEAD_LETTER_STATUS_TRANSITIONS, [
      ['open', 'redriven'],
      ['open', 'discarded'],
    ])
  })

  it('both redriven and discarded are terminal for that row — a later failure creates a new dead_letter', () => {
    expect(terminalStates(DEAD_LETTER_STATUS_TRANSITIONS).sort()).toEqual(['discarded', 'redriven'])
  })
})

describe('KRN-06 unit — subscription.status state machine (KRN-06.md §5)', () => {
  it('permits active↔paused and active→disabled, nothing else (including no paused→disabled shortcut, not stated in §5)', () => {
    assertExhaustive(SUBSCRIPTION_STATES, SUBSCRIPTION_STATUS_TRANSITIONS, [
      ['active', 'paused'],
      ['paused', 'active'],
      ['active', 'disabled'],
    ])
  })

  it('disabled is terminal — "requires explicit re-creation to resume" (§5)', () => {
    expect(terminalStates(SUBSCRIPTION_STATUS_TRANSITIONS)).toEqual(['disabled'])
  })
})

describe('KRN-06 unit — event_schema.status state machine (inferred, see event-schema.ts header note)', () => {
  it('permits draft→active→deprecated only', () => {
    assertExhaustive(EVENT_SCHEMA_STATES, EVENT_SCHEMA_STATUS_TRANSITIONS, [
      ['draft', 'active'],
      ['active', 'deprecated'],
    ])
  })

  it('deprecated is terminal — a corrected schema is a new version, not a reopened old one (L12 ethos)', () => {
    expect(terminalStates(EVENT_SCHEMA_STATUS_TRANSITIONS)).toEqual(['deprecated'])
  })
})
