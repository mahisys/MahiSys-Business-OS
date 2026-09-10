/**
 * KRN-11 unit tests — exhaustive state-transition legality (Vol 6 §5
 * Definition of Done). KRN-11 has one formal entity state machine
 * (`number_series.status`); the "per-number lifecycle" KRN-11.md §5
 * describes is implicit across `sequence_state`/`cancelled_number`
 * fields, not its own `*_TRANSITIONS` map — exercised directly in the
 * acceptance tests instead.
 */
import { describe, it, expect } from 'vitest'
import { isValidTransition, terminalStates } from '@mahisys/shared'
import { NUMBER_SERIES_STATUS_TRANSITIONS, type NumberSeriesStatus } from '@mahisys/krn-11'

const SERIES_STATES: NumberSeriesStatus[] = ['active', 'closed']

describe('KRN-11 unit — number_series.status state machine (KRN-11.md §5)', () => {
  it('permits exactly active→closed', () => {
    const validSet = new Set(['active->closed'])
    for (const from of SERIES_STATES) {
      for (const to of SERIES_STATES) {
        expect(isValidTransition(NUMBER_SERIES_STATUS_TRANSITIONS, from, to), `${from} -> ${to}`).toBe(validSet.has(`${from}->${to}`))
      }
    }
  })

  it('closed is terminal — no reversal; a series that resumes issuing requires a new series (L12)', () => {
    expect(terminalStates(NUMBER_SERIES_STATUS_TRANSITIONS)).toEqual(['closed'])
  })
})
