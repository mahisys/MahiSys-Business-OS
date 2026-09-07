/**
 * KRN-04 unit tests — exhaustive state-transition legality for all three
 * KRN-04 state machines (Vol 6 §5 Definition of Done).
 */
import { describe, it, expect } from 'vitest'
import { isValidTransition, terminalStates } from '@mahisys/shared'
import { ENTITY_DEFINITION_STATUS_TRANSITIONS, type EntityDefinitionStatus } from '@mahisys/krn-04'
import { FIELD_DEFINITION_STATUS_TRANSITIONS, type FieldDefinitionStatus } from '@mahisys/krn-04'
import { SCHEMA_VERSION_STATUS_TRANSITIONS, type SchemaVersionStatus } from '@mahisys/krn-04'

const ENTITY_STATES: EntityDefinitionStatus[] = ['draft', 'active', 'deprecated', 'retired']
const FIELD_STATES: FieldDefinitionStatus[] = ['active', 'deprecated', 'retired']
const SCHEMA_VERSION_STATES: SchemaVersionStatus[] = ['draft', 'validated', 'rehearsed', 'promoted', 'superseded', 'rolled_back']

function assertExhaustive<S extends string>(states: S[], transitions: Record<S, S[]>, validPairs: Array<[S, S]>) {
  const validSet = new Set(validPairs.map(([f, t]) => `${f}->${t}`))
  for (const from of states) {
    for (const to of states) {
      expect(isValidTransition(transitions, from, to), `${from} -> ${to}`).toBe(validSet.has(`${from}->${to}`))
    }
  }
}

describe('KRN-04 unit — entity_definition.status state machine (KRN-04.md §5)', () => {
  it('permits exactly draft→active, active→deprecated, deprecated→retired', () => {
    assertExhaustive(ENTITY_STATES, ENTITY_DEFINITION_STATUS_TRANSITIONS, [
      ['draft', 'active'],
      ['active', 'deprecated'],
      ['deprecated', 'retired'],
    ])
  })

  it('retired is terminal (L12)', () => {
    expect(terminalStates(ENTITY_DEFINITION_STATUS_TRANSITIONS)).toEqual(['retired'])
  })

  it('rejects skipping straight from draft or active to retired', () => {
    expect(isValidTransition(ENTITY_DEFINITION_STATUS_TRANSITIONS, 'draft', 'retired')).toBe(false)
    expect(isValidTransition(ENTITY_DEFINITION_STATUS_TRANSITIONS, 'active', 'retired')).toBe(false)
  })
})

describe('KRN-04 unit — field_definition.status state machine (KRN-04.md §5)', () => {
  it('permits exactly active→deprecated, deprecated→retired, with no draft state of its own', () => {
    assertExhaustive(FIELD_STATES, FIELD_DEFINITION_STATUS_TRANSITIONS, [
      ['active', 'deprecated'],
      ['deprecated', 'retired'],
    ])
  })

  it('retired is terminal — resolvable for historical reads, rejected for new writes, never hard-deleted (L12)', () => {
    expect(terminalStates(FIELD_DEFINITION_STATUS_TRANSITIONS)).toEqual(['retired'])
  })
})

describe('KRN-04 unit — schema_version.status state machine (KRN-04.md §5, D-34)', () => {
  it('permits draft→validated→rehearsed→promoted, promoted→{superseded,rolled_back}, superseded→promoted', () => {
    assertExhaustive(SCHEMA_VERSION_STATES, SCHEMA_VERSION_STATUS_TRANSITIONS, [
      ['draft', 'validated'],
      ['validated', 'rehearsed'],
      ['rehearsed', 'promoted'],
      ['promoted', 'superseded'],
      ['promoted', 'rolled_back'],
      ['superseded', 'promoted'],
    ])
  })

  it('rolled_back is the only terminal state', () => {
    expect(terminalStates(SCHEMA_VERSION_STATUS_TRANSITIONS)).toEqual(['rolled_back'])
  })

  it('rejects promoting a draft or validated version directly, skipping rehearsal', () => {
    expect(isValidTransition(SCHEMA_VERSION_STATUS_TRANSITIONS, 'draft', 'promoted')).toBe(false)
    expect(isValidTransition(SCHEMA_VERSION_STATUS_TRANSITIONS, 'validated', 'promoted')).toBe(false)
  })
})
