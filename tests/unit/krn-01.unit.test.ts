/**
 * KRN-01 unit tests — Vol 6 §5 Definition of Done ("Unit tests for all
 * rules, calculations and state transitions") and §6's acceptance-
 * criteria step, for the parts of KRN-01.md §16 that are pure rule/
 * calculation logic rather than end-to-end service behaviour.
 *
 * Directory note: Vol 6 §7 lists `/tests` as containing "contract, unit,
 * journey, persona, statutory, upgrade, security" — no separate
 * "acceptance" folder. Vol 6 §5's Definition of Done treats "Unit tests"
 * and "Acceptance criteria (Given/When/Then)" as related but distinct
 * checklist items, both scoped to a single module, both distinct from
 * cross-module Journey/Persona tests. This file covers exhaustive state-
 * transition-legality unit tests; end-to-end acceptance scenarios that
 * require an actual service (not just a pure function) live in
 * `tests/unit/krn-01.acceptance.test.ts` in the same directory, for the
 * same reason.
 */
import { describe, it, expect } from 'vitest'
import { isValidTransition, terminalStates } from '@mahisys/shared'
import {
  TENANT_STATUS_TRANSITIONS,
  type TenantStatus,
} from '@mahisys/krn-01'
import {
  FISCAL_PERIOD_STATUS_TRANSITIONS,
  type FiscalPeriodStatus,
} from '@mahisys/krn-01'
import {
  MIGRATION_STATUS_TRANSITIONS,
  isValidTierPromotion,
  type MigrationStatus,
  type IsolationTier,
} from '@mahisys/krn-01'

const TENANT_STATES: TenantStatus[] = ['trial', 'active', 'suspended', 'closed']
const FISCAL_PERIOD_STATES: FiscalPeriodStatus[] = ['open', 'closed', 'permanently_closed']
const MIGRATION_STATES: MigrationStatus[] = ['none', 'scheduled', 'in_progress', 'completed', 'failed']
const TIERS: IsolationTier[] = ['row', 'schema', 'dedicated']

/** Exhaustively checks every (from, to) pair against an explicit valid-pairs set. */
function assertExhaustiveTransitions<S extends string>(
  states: S[],
  transitions: Record<S, S[]>,
  validPairs: Array<[S, S]>,
) {
  const validSet = new Set(validPairs.map(([f, t]) => `${f}->${t}`))
  for (const from of states) {
    for (const to of states) {
      const expected = validSet.has(`${from}->${to}`)
      expect(isValidTransition(transitions, from, to), `${from} -> ${to}`).toBe(expected)
    }
  }
}

describe('KRN-01 unit — tenant.status state machine (KRN-01.md §5)', () => {
  it('permits exactly trial→active, active→suspended, suspended→active, suspended→closed', () => {
    assertExhaustiveTransitions(TENANT_STATES, TENANT_STATUS_TRANSITIONS, [
      ['trial', 'active'],
      ['active', 'suspended'],
      ['suspended', 'active'],
      ['suspended', 'closed'],
    ])
  })

  it('closed is terminal — no transition out, ever (KRN-01.md §5, L12 spirit)', () => {
    expect(terminalStates(TENANT_STATUS_TRANSITIONS)).toEqual(['closed'])
  })

  it('rejects skipping trial straight to suspended or closed', () => {
    expect(isValidTransition(TENANT_STATUS_TRANSITIONS, 'trial', 'suspended')).toBe(false)
    expect(isValidTransition(TENANT_STATUS_TRANSITIONS, 'trial', 'closed')).toBe(false)
  })

  it('rejects active→closed directly (must pass through suspended)', () => {
    expect(isValidTransition(TENANT_STATUS_TRANSITIONS, 'active', 'closed')).toBe(false)
  })
})

describe('KRN-01 unit — fiscal_period.status state machine (KRN-01.md §5)', () => {
  it('permits exactly open→closed, closed→open, closed→permanently_closed', () => {
    assertExhaustiveTransitions(FISCAL_PERIOD_STATES, FISCAL_PERIOD_STATUS_TRANSITIONS, [
      ['open', 'closed'],
      ['closed', 'open'],
      ['closed', 'permanently_closed'],
    ])
  })

  it('permanently_closed is terminal — no reopen path, ever', () => {
    expect(terminalStates(FISCAL_PERIOD_STATUS_TRANSITIONS)).toEqual(['permanently_closed'])
  })

  it('rejects open→permanently_closed directly (must pass through closed)', () => {
    expect(isValidTransition(FISCAL_PERIOD_STATUS_TRANSITIONS, 'open', 'permanently_closed')).toBe(false)
  })
})

describe('KRN-01 unit — isolation_assignment.migration_status state machine (KRN-01.md §5)', () => {
  it('permits exactly none→scheduled, scheduled→in_progress, in_progress→{completed,failed}, failed→scheduled', () => {
    assertExhaustiveTransitions(MIGRATION_STATES, MIGRATION_STATUS_TRANSITIONS, [
      ['none', 'scheduled'],
      ['scheduled', 'in_progress'],
      ['in_progress', 'completed'],
      ['in_progress', 'failed'],
      ['failed', 'scheduled'],
    ])
  })

  it('completed is terminal', () => {
    expect(terminalStates(MIGRATION_STATUS_TRANSITIONS)).toEqual(['completed'])
  })

  it('failed → scheduled is the only retry path (not failed → in_progress directly)', () => {
    expect(isValidTransition(MIGRATION_STATUS_TRANSITIONS, 'failed', 'in_progress')).toBe(false)
    expect(isValidTransition(MIGRATION_STATUS_TRANSITIONS, 'failed', 'scheduled')).toBe(true)
  })
})

describe('KRN-01 unit — isolation tier promotion is monotonic (KRN-01-DR-001, §17 item 3)', () => {
  it('permits every forward pair exhaustively', () => {
    const validPairs: Array<[IsolationTier, IsolationTier]> = [
      ['row', 'schema'],
      ['schema', 'dedicated'],
      ['row', 'dedicated'],
    ]
    const validSet = new Set(validPairs.map(([f, t]) => `${f}->${t}`))
    for (const from of TIERS) {
      for (const to of TIERS) {
        expect(isValidTierPromotion(from, to), `${from} -> ${to}`).toBe(validSet.has(`${from}->${to}`))
      }
    }
  })

  it('rejects every downgrade and every no-op', () => {
    expect(isValidTierPromotion('dedicated', 'schema')).toBe(false)
    expect(isValidTierPromotion('dedicated', 'row')).toBe(false)
    expect(isValidTierPromotion('schema', 'row')).toBe(false)
    expect(isValidTierPromotion('dedicated', 'dedicated')).toBe(false)
  })
})
