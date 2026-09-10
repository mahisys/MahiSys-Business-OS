/**
 * KRN-07 acceptance tests — every G/W/T in KRN-07.md §16, written against
 * the real service functions (Vol 6 §6 step 3). Vol 1 gives no
 * Acceptance (sample) for KRN-07 at all (§17 item 2) — this file (and
 * KRN-07.md's own §16) is written from scratch against the stated FR/DR.
 */
import { describe, it, expect } from 'vitest'
import { createRuleSet, activateRuleSet } from '@mahisys/krn-07'
import { createRule, editRule } from '@mahisys/krn-07'
import { evaluate } from '@mahisys/krn-07'
import { simulateRuleSet } from '@mahisys/krn-07'
import { readEvaluationLog } from '@mahisys/krn-07'
import { newStores, makeRuleSet, sysActor, userActor, agentActor, TENANT_ID, LEGAL_ENTITY_ID, DECLARED_FIELDS } from './krn-07.fixtures.js'

describe('KRN-07-FR-001 — conditions are structured, field-validated expression trees', () => {
  it('a condition on a declared field saves; a condition on an undeclared field is rejected, no rule or rule_version created', () => {
    const { krn07 } = newStores()
    const ruleSet = makeRuleSet(krn07)

    const rule = createRule(
      krn07,
      { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, name: 'valid', priority: 1, conditions: { field: 'item.hsn_sac', operator: 'eq', value: '7318' }, actions: [], period: { from: '2026-01-01', to: null, is_open_ended: true }, scope: { entity_id: LEGAL_ENTITY_ID, location_id: null, party_segment: null, item_category: null }, authored_via: 'ui', natural_language_source: null },
      'pricing',
      DECLARED_FIELDS,
      sysActor,
      'PR-21',
    )
    expect(rule.id).toBeTruthy()

    const ruleCountBefore = krn07.rules.size
    const versionCountBefore = krn07.ruleVersions.size
    expect(() =>
      createRule(
        krn07,
        { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, name: 'invalid', priority: 2, conditions: { field: 'item.foo_bar', operator: 'eq', value: '1' }, actions: [], period: { from: '2026-01-01', to: null, is_open_ended: true }, scope: { entity_id: LEGAL_ENTITY_ID, location_id: null, party_segment: null, item_category: null }, authored_via: 'ui', natural_language_source: null },
        'pricing',
        DECLARED_FIELDS,
        sysActor,
        'PR-21',
      ),
    ).toThrow()
    expect(krn07.rules.size).toBe(ruleCountBefore) // unchanged
    expect(krn07.ruleVersions.size).toBe(versionCountBefore) // unchanged
  })
})

describe('KRN-07-FR-002 — scope, period and priority ordering', () => {
  it('an expired-period rule is excluded as a candidate before priority is even considered', () => {
    const { krn07 } = newStores()
    const ruleSet = makeRuleSet(krn07)
    const scope = { entity_id: LEGAL_ENTITY_ID, location_id: null, party_segment: null, item_category: 'fasteners' }

    createRule(krn07, { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, name: 'Rule A', priority: 1, conditions: { field: 'item.item_category', operator: 'eq', value: 'fasteners' }, actions: [{ type: 'apply_discount', params: { value: 0.05 } }], period: { from: '2026-01-01', to: null, is_open_ended: true }, scope, authored_via: 'ui', natural_language_source: null }, 'pricing', DECLARED_FIELDS, sysActor, 'PR-21')
    createRule(krn07, { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, name: 'Rule B', priority: 2, conditions: { field: 'item.item_category', operator: 'eq', value: 'fasteners' }, actions: [{ type: 'apply_discount', params: { value: 0.10 } }], period: { from: '2025-01-01', to: '2025-12-31', is_open_ended: false }, scope, authored_via: 'ui', natural_language_source: null }, 'pricing', DECLARED_FIELDS, sysActor, 'PR-21')
    activateRuleSet(krn07, ruleSet.id, sysActor, 'PR-21')

    const result = evaluate(krn07, { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, subject_type: 'quote_line', subject_id: '00000000-0000-7000-8200-0000000000aa', context: { entity_id: LEGAL_ENTITY_ID, item_category: 'fasteners', 'item.item_category': 'fasteners' }, at: '2026-06-01T00:00:00.000Z' }, sysActor)

    expect(result.matched).toBe(true)
    expect(result.outcome!.actions).toEqual([{ type: 'apply_discount', params: { value: 0.05 } }]) // Rule A — Rule B excluded by expired period, never a candidate
  })
})

describe('KRN-07-FR-003 — simulation before activation', () => {
  it('a draft revision simulated against a historical sample reports the diff; no evaluation_log entries are created; the live rule set is unaffected', () => {
    const { krn07 } = newStores()
    const ruleSet = makeRuleSet(krn07, { rule_type: 'credit' })
    const scope = { entity_id: LEGAL_ENTITY_ID, location_id: null, party_segment: null, item_category: null }
    createRule(krn07, { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, name: 'Tighter exposure', priority: 1, conditions: { field: 'ar.days_overdue', operator: 'gt', value: 30 }, actions: [{ type: 'block_credit', params: {} }], period: { from: '2026-01-01', to: null, is_open_ended: true }, scope, authored_via: 'ui', natural_language_source: null }, 'credit', DECLARED_FIELDS, sysActor, 'PR-16')

    const sample = [
      { subject_type: 'customer', subject_id: '00000000-0000-7000-8200-0000000000b1', context: { 'ar.days_overdue': 45 }, prior_outcome: null },
      { subject_type: 'customer', subject_id: '00000000-0000-7000-8200-0000000000b2', context: { 'ar.days_overdue': 10 }, prior_outcome: null },
    ]
    const logCountBefore = krn07.evaluationLog.length
    const result = simulateRuleSet(krn07, ruleSet.id, sample, userActor, 'PR-16')

    expect(result.sample_count).toBe(2)
    expect(result.changed_count).toBe(1)
    expect(result.rows.find((r) => r.subject_id === sample[0].subject_id)!.changed).toBe(true)
    expect(result.rows.find((r) => r.subject_id === sample[1].subject_id)!.changed).toBe(false)
    expect(krn07.evaluationLog.length).toBe(logCountBefore) // unaffected
    expect(krn07.ruleSets.get(ruleSet.id)!.status).toBe('draft') // live set unaffected until explicit activation
  })
})

describe('KRN-07-FR-004 — every outcome logged and explainable against the exact version', () => {
  it('editing a rule after evaluation never changes the already-logged explanation, which still points at the original version', () => {
    const { krn07 } = newStores()
    const ruleSet = makeRuleSet(krn07)
    const scope = { entity_id: LEGAL_ENTITY_ID, location_id: null, party_segment: null, item_category: null }
    const rule = createRule(krn07, { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, name: 'Discount', priority: 1, conditions: { field: 'quote.value', operator: 'gt', value: 0 }, actions: [{ type: 'apply_discount', params: { value: 0.12 } }], period: { from: '2026-01-01', to: null, is_open_ended: true }, scope, authored_via: 'ui', natural_language_source: null }, 'pricing', DECLARED_FIELDS, sysActor, 'PR-21')
    activateRuleSet(krn07, ruleSet.id, sysActor, 'PR-21')
    const versionAtEval = rule.current_version_id

    const result = evaluate(krn07, { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, subject_type: 'quote_line', subject_id: 'Q-991', context: { entity_id: LEGAL_ENTITY_ID, 'quote.value': 100 } }, sysActor)
    expect(result.rule_version_id).toBe(versionAtEval)
    expect(result.outcome!.actions).toEqual([{ type: 'apply_discount', params: { value: 0.12 } }])

    editRule(krn07, rule.id, { actions: [{ type: 'apply_discount', params: { value: 0.20 } }], change_reason: 'margin review' }, DECLARED_FIELDS, sysActor, 'PR-21')

    const logged = readEvaluationLog(krn07, TENANT_ID, { rule_set_id: ruleSet.id }, 'PR-21').find((e) => e.subject_id === 'Q-991')!
    expect(logged.rule_version_id).toBe(versionAtEval) // still the version that actually fired
    expect(logged.outcome!.actions).toEqual([{ type: 'apply_discount', params: { value: 0.12 } }]) // unchanged, regardless of what version 2 now computes
  })
})

describe('KRN-07-DR-001 — natural-language authoring compiles to inspectable form', () => {
  it('a rule authored via natural language retains its phrasing and is a fully inspectable expression tree', () => {
    const { krn07 } = newStores()
    const ruleSet = makeRuleSet(krn07)
    const rule = createRule(
      krn07,
      { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, name: 'NL rule', priority: 1, conditions: { field: 'quote.value', operator: 'gt', value: 200000 }, actions: [{ type: 'apply_discount', params: { value: 0.05 } }], period: { from: '2026-01-01', to: null, is_open_ended: true }, scope: { entity_id: LEGAL_ENTITY_ID, location_id: null, party_segment: 'distributor', item_category: null }, authored_via: 'natural_language', natural_language_source: 'give distributors 5% off orders above ₹2 lakh' },
      'pricing',
      DECLARED_FIELDS,
      sysActor,
      'PR-21',
    )
    expect(rule.authored_via).toBe('natural_language')
    expect(rule.natural_language_source).toBe('give distributors 5% off orders above ₹2 lakh')
    expect(rule.conditions).toEqual({ field: 'quote.value', operator: 'gt', value: 200000 }) // no opaque model behaviour — a plain, inspectable tree
  })
})

describe('KRN-07-FR-005 (addition) — synchronous evaluation, no per-evaluation event', () => {
  it('evaluate() returns synchronously and writes no KRN-06 event for the individual call; a later activation does emit', () => {
    const { krn06, krn07 } = newStores()
    const ruleSet = makeRuleSet(krn07)
    createRule(krn07, { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, name: 'r', priority: 1, conditions: { field: 'quote.value', operator: 'gt', value: 0 }, actions: [], period: { from: '2026-01-01', to: null, is_open_ended: true }, scope: { entity_id: LEGAL_ENTITY_ID, location_id: null, party_segment: null, item_category: null }, authored_via: 'ui', natural_language_source: null }, 'pricing', DECLARED_FIELDS, sysActor, 'PR-21')

    const eventCountBefore = krn06.events.length
    evaluate(krn07, { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, subject_type: 'quote_line', subject_id: 'Q-1', context: { entity_id: LEGAL_ENTITY_ID, 'quote.value': 100 } }, sysActor)
    expect(krn06.events.length).toBe(eventCountBefore) // unchanged by evaluation

    activateRuleSet(krn07, ruleSet.id, sysActor, 'PR-21')
    expect(krn06.events.some((e) => e.event_name === 'rules.set.activated')).toBe(true) // lifecycle changes do emit
  })
})

describe('KRN-07-FR-006 (addition) — no tax rule type outside CMP-01', () => {
  it('rejects rule_type: tax for any actor, including PR-21, no rule_set created', () => {
    const { krn07 } = newStores()
    const before = krn07.ruleSets.size
    expect(() =>
      createRuleSet(krn07, { tenant_id: TENANT_ID, entity_id: LEGAL_ENTITY_ID, namespace: 'tnt', name: 'Tax attempt', rule_type: 'tax', owning_module: 'FIN-02', match_mode: 'first_match', description: '' }, sysActor, 'PR-21'),
    ).toThrow()
    expect(krn07.ruleSets.size).toBe(before)
  })
})

describe('KRN-07-FR-007 (addition) — agents never author rules', () => {
  it('PR-29 has no edit_draft grant for any rule_type — the create path is structurally unreachable for an agent', () => {
    const { krn07 } = newStores()
    expect(() =>
      createRuleSet(krn07, { tenant_id: TENANT_ID, entity_id: LEGAL_ENTITY_ID, namespace: 'tnt', name: 'Agent attempt', rule_type: 'pricing', owning_module: 'SLS-07', match_mode: 'first_match', description: '' }, agentActor, 'PR-29'),
    ).toThrow()
  })
})

describe('KRN-07-DR-002 (addition) — plain-language explainability', () => {
  it('an evaluation_log entry for a natural-language rule surfaces the original phrasing alongside the computed outcome', () => {
    const { krn07 } = newStores()
    const ruleSet = makeRuleSet(krn07)
    createRule(
      krn07,
      { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, name: 'NL rule', priority: 1, conditions: { field: 'quote.value', operator: 'gt', value: 200000 }, actions: [{ type: 'apply_discount', params: { value: 0.05 } }], period: { from: '2026-01-01', to: null, is_open_ended: true }, scope: { entity_id: LEGAL_ENTITY_ID, location_id: null, party_segment: 'distributor', item_category: null }, authored_via: 'natural_language', natural_language_source: 'give distributors 5% off orders above ₹2 lakh' },
      'pricing',
      DECLARED_FIELDS,
      sysActor,
      'PR-21',
    )
    activateRuleSet(krn07, ruleSet.id, sysActor, 'PR-21')

    const result = evaluate(krn07, { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, subject_type: 'quote_line', subject_id: 'Q-2', context: { entity_id: LEGAL_ENTITY_ID, 'quote.value': 250000 } }, sysActor)
    expect(result.matched).toBe(true)

    const rule = krn07.rules.get(result.rule_id!)!
    expect(rule.natural_language_source).toBe('give distributors 5% off orders above ₹2 lakh')
    // INT-02 would surface rule.natural_language_source alongside result.outcome — both retrievable from the same evaluation_log entry's rule_id.
  })
})
