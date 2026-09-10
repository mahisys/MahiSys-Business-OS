/**
 * KRN-07 unit tests — exhaustive state-transition legality (Vol 6 §5
 * Definition of Done).
 */
import { describe, it, expect } from 'vitest'
import { isValidTransition, terminalStates } from '@mahisys/shared'
import { RULE_SET_STATUS_TRANSITIONS, type RuleSetStatus } from '@mahisys/krn-07'
import { RULE_STATUS_TRANSITIONS, type RuleStatus } from '@mahisys/krn-07'

const RULE_SET_STATES: RuleSetStatus[] = ['draft', 'active', 'superseded', 'retired']
const RULE_STATES: RuleStatus[] = ['draft', 'active', 'expired', 'retired']

function assertExhaustive<S extends string>(states: S[], transitions: Record<S, S[]>, validPairs: Array<[S, S]>) {
  const validSet = new Set(validPairs.map(([f, t]) => `${f}->${t}`))
  for (const from of states) {
    for (const to of states) {
      expect(isValidTransition(transitions, from, to), `${from} -> ${to}`).toBe(validSet.has(`${from}->${to}`))
    }
  }
}

describe('KRN-07 unit — rule_set.status state machine (KRN-07.md §5)', () => {
  it('permits draft→active, active→{superseded,retired}, nothing else', () => {
    assertExhaustive(RULE_SET_STATES, RULE_SET_STATUS_TRANSITIONS, [
      ['draft', 'active'],
      ['active', 'superseded'],
      ['active', 'retired'],
    ])
  })

  it('superseded and retired are both terminal', () => {
    expect(terminalStates(RULE_SET_STATUS_TRANSITIONS).sort()).toEqual(['retired', 'superseded'])
  })
})

describe('KRN-07 unit — rule.status state machine (KRN-07.md §5)', () => {
  it('permits draft→active, active→{expired,retired}, nothing else', () => {
    assertExhaustive(RULE_STATES, RULE_STATUS_TRANSITIONS, [
      ['draft', 'active'],
      ['active', 'expired'],
      ['active', 'retired'],
    ])
  })

  it('expired and retired are both terminal — editing conditions/actions/priority/period never changes status (a new rule_version instead)', () => {
    expect(terminalStates(RULE_STATUS_TRANSITIONS).sort()).toEqual(['expired', 'retired'])
  })
})
