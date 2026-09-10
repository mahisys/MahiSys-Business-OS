/**
 * KRN-07 permission tests — Vol 6 §6 step 4, from KRN-07.md §11.
 */
import { describe, it, expect } from 'vitest'
import { hasDomainAccess } from '@mahisys/krn-07'
import { createRuleSet, activateRuleSet, retireRuleSet } from '@mahisys/krn-07'
import { createRule } from '@mahisys/krn-07'
import { simulateRuleSet } from '@mahisys/krn-07'
import { newStores, makeRuleSet, sysActor, userActor, agentActor, TENANT_ID, LEGAL_ENTITY_ID, DECLARED_FIELDS } from './krn-07.fixtures.js'

describe('KRN-07 permission matrix (§11) — positive cases', () => {
  it('PR-21 holds every action across every domain', () => {
    for (const rt of ['pricing', 'credit', 'reorder', 'eligibility', 'approval_threshold', 'compliance_check'] as const) {
      expect(hasDomainAccess('PR-21', 'read', rt)).toBe(true)
      expect(hasDomainAccess('PR-21', 'edit_draft', rt)).toBe(true)
      expect(hasDomainAccess('PR-21', 'activate', rt)).toBe(true)
    }
  })

  it('PR-08 Sales Manager holds pricing/eligibility, not credit/reorder', () => {
    expect(hasDomainAccess('PR-08', 'edit_draft', 'pricing')).toBe(true)
    expect(hasDomainAccess('PR-08', 'edit_draft', 'eligibility')).toBe(true)
    expect(hasDomainAccess('PR-08', 'edit_draft', 'credit')).toBe(false)
    expect(hasDomainAccess('PR-08', 'edit_draft', 'reorder')).toBe(false)
  })

  it('PR-16 CFO holds credit/approval_threshold for edit, but reads all domains (controller visibility)', () => {
    expect(hasDomainAccess('PR-16', 'edit_draft', 'credit')).toBe(true)
    expect(hasDomainAccess('PR-16', 'edit_draft', 'pricing')).toBe(false)
    expect(hasDomainAccess('PR-16', 'read', 'pricing')).toBe(true) // cross-domain read
    expect(hasDomainAccess('PR-16', 'read', 'reorder')).toBe(true)
  })

  it('PR-06 Purchase Officer holds only reorder', () => {
    expect(hasDomainAccess('PR-06', 'edit_draft', 'reorder')).toBe(true)
    expect(hasDomainAccess('PR-06', 'edit_draft', 'pricing')).toBe(false)
  })

  it('PR-15 Accountant reads evaluation_log across all domains (explainability only), edits nothing', () => {
    expect(hasDomainAccess('PR-15', 'log_read', 'credit')).toBe(true)
    expect(hasDomainAccess('PR-15', 'log_read', 'pricing')).toBe(true)
    expect(hasDomainAccess('PR-15', 'edit_draft', 'credit')).toBe(false)
    expect(hasDomainAccess('PR-15', 'read', 'credit')).toBe(false) // no editor access at all (§11)
  })

  it('PR-02 Functional Head resolves domain via callerDomainOverride, not a static grant', () => {
    expect(hasDomainAccess('PR-02', 'read', 'credit')).toBe(false) // no override supplied
    expect(hasDomainAccess('PR-02', 'read', 'credit', ['credit'])).toBe(true)
    expect(hasDomainAccess('PR-02', 'read', 'pricing', ['credit'])).toBe(false)
    expect(hasDomainAccess('PR-02', 'edit_draft', 'credit', ['credit'])).toBe(false) // edit is a hard ✗ regardless of override (§11: "reviews/proposes via process, not direct edit")
  })
})

describe('KRN-07 permission matrix (§11) — negative cases', () => {
  it('PR-29 Agent never holds edit_draft, activate or simulate for any domain', () => {
    for (const rt of ['pricing', 'credit', 'reorder', 'eligibility', 'approval_threshold', 'compliance_check'] as const) {
      expect(hasDomainAccess('PR-29', 'edit_draft', rt), rt).toBe(false)
      expect(hasDomainAccess('PR-29', 'activate', rt), rt).toBe(false)
      expect(hasDomainAccess('PR-29', 'simulate', rt), rt).toBe(false)
    }
  })

  it('OTHER holds nothing in any domain — consumes computed effects only', () => {
    const actions = ['read', 'edit_draft', 'activate', 'simulate', 'log_read'] as const
    for (const action of actions) {
      expect(hasDomainAccess('OTHER', action, 'pricing'), action).toBe(false)
    }
  })

  it('PR-28 Implementation Partner never holds activate, even in its own provisioning window', () => {
    for (const rt of ['pricing', 'credit', 'reorder'] as const) {
      expect(hasDomainAccess('PR-28', 'activate', rt), rt).toBe(false)
    }
  })
})

describe('KRN-07 write paths actually enforce the matrix, not just report it', () => {
  it('createRuleSet: PR-15 (Accountant, no editor access) is rejected (§11 negative case)', () => {
    const { krn07 } = newStores()
    expect(() =>
      createRuleSet(krn07, { tenant_id: TENANT_ID, entity_id: LEGAL_ENTITY_ID, namespace: 'tnt', name: 'x', rule_type: 'pricing', owning_module: 'SLS-07', match_mode: 'first_match', description: '' }, userActor, 'PR-15'),
    ).toThrow()
  })

  it('rule_set.activate: PR-06 attempting to activate a pricing rule set (outside their reorder-only domain) → rejected (§11 negative case)', () => {
    const { krn07 } = newStores()
    const ruleSet = makeRuleSet(krn07, { rule_type: 'pricing' })
    expect(() => activateRuleSet(krn07, ruleSet.id, userActor, 'PR-06')).toThrow()
  })

  it('rule_set.activate: PR-28 attempting to activate a live financial rule type → rejected (§11 negative case)', () => {
    const { krn07 } = newStores()
    const ruleSet = makeRuleSet(krn07, { rule_type: 'credit' })
    expect(() => activateRuleSet(krn07, ruleSet.id, userActor, 'PR-28')).toThrow()
  })

  it('createRule: PR-29 Agent attempting to author a rule is rejected, treated as structurally unreachable, not a scope miss', () => {
    const { krn07 } = newStores()
    const ruleSet = makeRuleSet(krn07)
    expect(() =>
      createRule(krn07, { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, name: 'agent rule', priority: 1, conditions: { field: 'quote.value', operator: 'gt', value: 0 }, actions: [], period: { from: '2026-01-01', to: null, is_open_ended: true }, scope: { entity_id: LEGAL_ENTITY_ID, location_id: null, party_segment: null, item_category: null }, authored_via: 'ui', natural_language_source: null }, 'pricing', DECLARED_FIELDS, agentActor, 'PR-29'),
    ).toThrow()
  })

  it('simulation.run: PR-16 succeeds for credit, PR-01 is rejected (reads reports, does not run simulations)', () => {
    const { krn07 } = newStores()
    const ruleSet = makeRuleSet(krn07, { rule_type: 'credit' })
    expect(() => simulateRuleSet(krn07, ruleSet.id, [], userActor, 'PR-16')).not.toThrow()
    expect(() => simulateRuleSet(krn07, ruleSet.id, [], userActor, 'PR-01')).toThrow()
  })

  it('retireRuleSet: uses the same activate-class domain check as activation', () => {
    const { krn07 } = newStores()
    const ruleSet = makeRuleSet(krn07, { rule_type: 'reorder' })
    activateRuleSet(krn07, ruleSet.id, sysActor, 'PR-21')
    expect(() => retireRuleSet(krn07, ruleSet.id, userActor, 'PR-08')).toThrow() // PR-08 has no reorder grant
    expect(() => retireRuleSet(krn07, ruleSet.id, userActor, 'PR-06')).not.toThrow()
  })

  it('every actor, including PR-21, is rejected creating rule_type: tax (KRN-07-FR-006 negative case)', () => {
    const { krn07 } = newStores()
    expect(() =>
      createRuleSet(krn07, { tenant_id: TENANT_ID, entity_id: LEGAL_ENTITY_ID, namespace: 'tnt', name: 'x', rule_type: 'tax', owning_module: 'FIN-02', match_mode: 'first_match', description: '' }, sysActor, 'PR-21'),
    ).toThrow()
  })
})
