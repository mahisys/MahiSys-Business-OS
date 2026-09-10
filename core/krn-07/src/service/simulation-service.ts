import { randomUUID } from 'node:crypto'
import type { Krn07Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { evaluateRuleCondition } from '../contracts/rule-condition.js'
import type { RuleType } from '../contracts/rule-set.js'
import type { PersonaId } from './permissions.js'
import { assertDomainAccess } from './permissions.js'
import { KernelError } from './errors.js'

/**
 * One historical record to simulate against. KRN-07 has no business
 * record store of its own to sample from (L3) — the caller (the module
 * that owns the historical AR/quote/reorder records, e.g. FIN-02) passes
 * the bounded sample directly, the same pre-resolved-input pattern used
 * everywhere else in this project for cross-module boundaries.
 */
export interface SimulationSampleRecord {
  subject_type: string
  subject_id: string
  context: Record<string, unknown>
  prior_outcome: Record<string, unknown> | null
}

export interface SimulationDiffRow {
  subject_type: string
  subject_id: string
  prior_outcome: Record<string, unknown> | null
  proposed_outcome: Record<string, unknown> | null
  changed: boolean
}

export interface SimulationResult {
  simulation_id: string
  rule_set_id: string
  rows: SimulationDiffRow[]
  changed_count: number
  sample_count: number
}

/**
 * `KRN-07-FR-003`: runs read-only against a bounded historical sample and
 * reports a per-record diff — never writes to the live `evaluation_log`
 * (§17 item 5: simulation results are ephemeral job output, not a
 * separately-declared entity), and never touches the live rule_set/rule
 * rows regardless of outcome. Evaluates every currently-`draft` rule in
 * the target rule_set (the proposed change under review) — an already-
 * `active` rule_set has nothing left to simulate against itself; the
 * caller runs simulation before activating a *draft* revision.
 */
export function simulateRuleSet(store: Krn07Store, ruleSetId: string, sample: SimulationSampleRecord[], actor: ActorRef, callerPersona: PersonaId, callerDomainOverride?: RuleType[]): SimulationResult {
  const ruleSet = store.ruleSets.get(ruleSetId)
  if (!ruleSet) throw new KernelError('RULE_SET_NOT_FOUND', `No rule_set with id ${ruleSetId}`, randomUUID())
  assertDomainAccess(callerPersona, 'simulate', ruleSet.rule_type, callerDomainOverride)

  const draftRules = Array.from(store.rules.values())
    .filter((r) => r.rule_set_id === ruleSetId && r.status === 'draft')
    .sort((a, b) => a.priority - b.priority)

  const rows: SimulationDiffRow[] = sample.map((record) => {
    const match = draftRules.find((r) => evaluateRuleCondition(r.conditions, record.context))
    const proposedOutcome = match ? { actions: match.actions } : null
    return {
      subject_type: record.subject_type,
      subject_id: record.subject_id,
      prior_outcome: record.prior_outcome,
      proposed_outcome: proposedOutcome,
      changed: JSON.stringify(record.prior_outcome) !== JSON.stringify(proposedOutcome),
    }
  })

  const changedCount = rows.filter((r) => r.changed).length
  const simulationId = randomUUID()

  store.emit({
    tenant_id: ruleSet.tenant_id,
    entity_id: ruleSet.entity_id,
    event_name: 'rules.simulation.completed',
    actor,
    subject_type: 'rule_set',
    subject_id: ruleSetId,
    payload: { rule_set_id: ruleSetId, simulation_id: simulationId, changed_count: changedCount, sample_count: sample.length },
  })

  return { simulation_id: simulationId, rule_set_id: ruleSetId, rows, changed_count: changedCount, sample_count: sample.length }
}
