/**
 * KRN-03 unit tests — exhaustive state-transition legality for all four
 * KRN-03 state machines (Vol 6 §5 Definition of Done).
 */
import { describe, it, expect } from 'vitest'
import { isValidTransition, terminalStates } from '@mahisys/shared'
import { ROLE_STATUS_TRANSITIONS, type RoleStatus } from '@mahisys/krn-03'
import { PERMISSION_GRANT_STATUS_TRANSITIONS, type PermissionGrantStatus } from '@mahisys/krn-03'
import { DATA_SCOPE_RULE_STATUS_TRANSITIONS, type DataScopeRuleStatus } from '@mahisys/krn-03'
import { DELEGATION_STATUS_TRANSITIONS, type DelegationStatus } from '@mahisys/krn-03'

const ROLE_STATES: RoleStatus[] = ['active', 'deprecated']
const GRANT_STATES: PermissionGrantStatus[] = ['active', 'revoked', 'expired']
const SCOPE_RULE_STATES: DataScopeRuleStatus[] = ['active', 'superseded']
const DELEGATION_STATES: DelegationStatus[] = ['pending', 'active', 'expired', 'revoked']

function assertExhaustive<S extends string>(states: S[], transitions: Record<S, S[]>, validPairs: Array<[S, S]>) {
  const validSet = new Set(validPairs.map(([f, t]) => `${f}->${t}`))
  for (const from of states) {
    for (const to of states) {
      expect(isValidTransition(transitions, from, to), `${from} -> ${to}`).toBe(validSet.has(`${from}->${to}`))
    }
  }
}

describe('KRN-03 unit — role.status state machine (KRN-03.md §5)', () => {
  it('permits exactly active→deprecated', () => {
    assertExhaustive(ROLE_STATES, ROLE_STATUS_TRANSITIONS, [['active', 'deprecated']])
  })

  it('deprecated is terminal (L12 — not deletion)', () => {
    expect(terminalStates(ROLE_STATUS_TRANSITIONS)).toEqual(['deprecated'])
  })
})

describe('KRN-03 unit — permission_grant.status state machine (KRN-03.md §5)', () => {
  it('permits active to either expired or revoked, nothing else', () => {
    assertExhaustive(GRANT_STATES, PERMISSION_GRANT_STATUS_TRANSITIONS, [
      ['active', 'expired'],
      ['active', 'revoked'],
    ])
  })

  it('both expired and revoked are terminal — re-granting creates a new record', () => {
    expect(terminalStates(PERMISSION_GRANT_STATUS_TRANSITIONS).sort()).toEqual(['expired', 'revoked'])
  })
})

describe('KRN-03 unit — data_scope_rule.status state machine (KRN-03.md §5)', () => {
  it('permits exactly active→superseded', () => {
    assertExhaustive(SCOPE_RULE_STATES, DATA_SCOPE_RULE_STATUS_TRANSITIONS, [['active', 'superseded']])
  })

  it('superseded is terminal — the superseding version takes a new id', () => {
    expect(terminalStates(DATA_SCOPE_RULE_STATUS_TRANSITIONS)).toEqual(['superseded'])
  })
})

describe('KRN-03 unit — delegation.status state machine (KRN-03.md §5)', () => {
  it('permits pending→active, active→{expired,revoked}', () => {
    assertExhaustive(DELEGATION_STATES, DELEGATION_STATUS_TRANSITIONS, [
      ['pending', 'active'],
      ['active', 'expired'],
      ['active', 'revoked'],
    ])
  })

  it('rejects pending going straight to expired or revoked, skipping active', () => {
    expect(isValidTransition(DELEGATION_STATUS_TRANSITIONS, 'pending', 'expired')).toBe(false)
    expect(isValidTransition(DELEGATION_STATUS_TRANSITIONS, 'pending', 'revoked')).toBe(false)
  })
})
