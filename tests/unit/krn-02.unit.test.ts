/**
 * KRN-02 unit tests — exhaustive state-transition legality for all four
 * KRN-02 state machines (Vol 6 §5 Definition of Done).
 */
import { describe, it, expect } from 'vitest'
import { isValidTransition, terminalStates } from '@mahisys/shared'
import { USER_STATUS_TRANSITIONS, type UserStatus } from '@mahisys/krn-02'
import { SESSION_STATUS_TRANSITIONS, type SessionStatus } from '@mahisys/krn-02'
import { AGENT_IDENTITY_STATUS_TRANSITIONS, type AgentIdentityStatus } from '@mahisys/krn-02'
import { DEVICE_TRUST_STATUS_TRANSITIONS, type DeviceTrustStatus } from '@mahisys/krn-02'

const USER_STATES: UserStatus[] = ['pending', 'active', 'suspended', 'deactivated']
const SESSION_STATES: SessionStatus[] = ['active', 'idle_timed_out', 'absolute_timed_out', 'revoked', 'logged_out']
const AGENT_STATES: AgentIdentityStatus[] = ['registered', 'active', 'deprecated', 'retired']
const DEVICE_STATES: DeviceTrustStatus[] = ['registered', 'trusted', 'revoked']

function assertExhaustive<S extends string>(states: S[], transitions: Record<S, S[]>, validPairs: Array<[S, S]>) {
  const validSet = new Set(validPairs.map(([f, t]) => `${f}->${t}`))
  for (const from of states) {
    for (const to of states) {
      expect(isValidTransition(transitions, from, to), `${from} -> ${to}`).toBe(validSet.has(`${from}->${to}`))
    }
  }
}

describe('KRN-02 unit — user.status state machine (KRN-02.md §5)', () => {
  it('permits exactly pending→active, active→suspended, suspended→active, suspended→deactivated', () => {
    assertExhaustive(USER_STATES, USER_STATUS_TRANSITIONS, [
      ['pending', 'active'],
      ['active', 'suspended'],
      ['suspended', 'active'],
      ['suspended', 'deactivated'],
    ])
  })

  it('deactivated is terminal (L12 — a returning employee gets a new user record)', () => {
    expect(terminalStates(USER_STATUS_TRANSITIONS)).toEqual(['deactivated'])
  })

  it('rejects skipping straight from active or pending to deactivated', () => {
    expect(isValidTransition(USER_STATUS_TRANSITIONS, 'active', 'deactivated')).toBe(false)
    expect(isValidTransition(USER_STATUS_TRANSITIONS, 'pending', 'deactivated')).toBe(false)
  })
})

describe('KRN-02 unit — session.status state machine (KRN-02.md §5)', () => {
  it('permits active to any of the four end-states, nothing else', () => {
    assertExhaustive(SESSION_STATES, SESSION_STATUS_TRANSITIONS, [
      ['active', 'idle_timed_out'],
      ['active', 'absolute_timed_out'],
      ['active', 'revoked'],
      ['active', 'logged_out'],
    ])
  })

  it('all four end-states are terminal — reconnecting issues a new session, not a transition', () => {
    expect(terminalStates(SESSION_STATUS_TRANSITIONS).sort()).toEqual(
      ['idle_timed_out', 'absolute_timed_out', 'revoked', 'logged_out'].sort(),
    )
  })
})

describe('KRN-02 unit — agent_identity.status state machine (KRN-02.md §5)', () => {
  it('permits registered→active, active→{deprecated,retired}, deprecated→retired', () => {
    assertExhaustive(AGENT_STATES, AGENT_IDENTITY_STATUS_TRANSITIONS, [
      ['registered', 'active'],
      ['active', 'deprecated'],
      ['active', 'retired'],
      ['deprecated', 'retired'],
    ])
  })

  it('retired is terminal', () => {
    expect(terminalStates(AGENT_IDENTITY_STATUS_TRANSITIONS)).toEqual(['retired'])
  })

  it('rejects deprecated→active (no un-deprecation path)', () => {
    expect(isValidTransition(AGENT_IDENTITY_STATUS_TRANSITIONS, 'deprecated', 'active')).toBe(false)
  })
})

describe('KRN-02 unit — device.trust_status state machine (KRN-02.md §5)', () => {
  it('permits registered→{trusted,revoked}, trusted→revoked', () => {
    assertExhaustive(DEVICE_STATES, DEVICE_TRUST_STATUS_TRANSITIONS, [
      ['registered', 'trusted'],
      ['registered', 'revoked'],
      ['trusted', 'revoked'],
    ])
  })

  it('revoked is terminal — a lost-and-recovered device re-registers as a new record', () => {
    expect(terminalStates(DEVICE_TRUST_STATUS_TRANSITIONS)).toEqual(['revoked'])
  })
})
