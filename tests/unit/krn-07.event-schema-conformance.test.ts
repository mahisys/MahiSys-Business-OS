/**
 * KRN-07 event-schema conformance — same rationale as KRN-11/10's (D-39):
 * runs the real service functions and validates actual events recorded
 * in the real `Krn06Store` against the real Zod schemas.
 */
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import { createRuleSet, activateRuleSet, retireRuleSet } from '@mahisys/krn-07'
import { createRule, editRule } from '@mahisys/krn-07'
import { simulateRuleSet } from '@mahisys/krn-07'
import { RuleSetActivatedEventSchema, RuleVersionCreatedEventSchema, RuleSetDeprecatedEventSchema, SimulationCompletedEventSchema } from '@mahisys/krn-07'
import { newStores, sysActor, userActor, TENANT_ID, LEGAL_ENTITY_ID, DECLARED_FIELDS } from './krn-07.fixtures.js'

const SCHEMA_BY_EVENT_NAME: Record<string, z.ZodTypeAny> = {
  'rules.set.activated': RuleSetActivatedEventSchema,
  'rules.rule.version_created': RuleVersionCreatedEventSchema,
  'rules.set.deprecated': RuleSetDeprecatedEventSchema,
  'rules.simulation.completed': SimulationCompletedEventSchema,
}

describe('KRN-07 — every emitted event validates against its declared Zod schema, recorded through the real KRN-06 store', () => {
  it('exercises rule_set/rule lifecycle changes and simulation completion', () => {
    const { krn06, krn07 } = newStores()

    const ruleSet = createRuleSet(krn07, { tenant_id: TENANT_ID, entity_id: LEGAL_ENTITY_ID, namespace: 'tnt', name: 'Set', rule_type: 'pricing', owning_module: 'SLS-07', match_mode: 'first_match', description: '' }, sysActor, 'PR-21')
    const scope = { entity_id: LEGAL_ENTITY_ID, location_id: null, party_segment: null, item_category: null }
    const rule = createRule(krn07, { tenant_id: TENANT_ID, rule_set_id: ruleSet.id, name: 'r', priority: 1, conditions: { field: 'quote.value', operator: 'gt', value: 0 }, actions: [], period: { from: '2026-01-01', to: null, is_open_ended: true }, scope, authored_via: 'ui', natural_language_source: null }, 'pricing', DECLARED_FIELDS, sysActor, 'PR-21') // rules.rule.version_created

    activateRuleSet(krn07, ruleSet.id, sysActor, 'PR-21') // rules.set.activated

    editRule(krn07, rule.id, { priority: 2, change_reason: 'reorder' }, DECLARED_FIELDS, sysActor, 'PR-21') // rules.rule.version_created (again)

    const reorderSet = createRuleSet(krn07, { tenant_id: TENANT_ID, entity_id: LEGAL_ENTITY_ID, namespace: 'tnt', name: 'Reorder set', rule_type: 'reorder', owning_module: 'SCM-02', match_mode: 'first_match', description: '' }, sysActor, 'PR-21')
    activateRuleSet(krn07, reorderSet.id, sysActor, 'PR-21')
    retireRuleSet(krn07, reorderSet.id, userActor, 'PR-06') // rules.set.deprecated

    simulateRuleSet(krn07, ruleSet.id, [], userActor, 'PR-21') // rules.simulation.completed — no draft rules, empty sample, still a valid run

    const krn07Events = krn06.events.filter((e) => e.event_name.startsWith('rules.'))
    expect(krn07Events.length).toBeGreaterThanOrEqual(5)

    for (const event of krn07Events) {
      const schema = SCHEMA_BY_EVENT_NAME[event.event_name]
      expect(schema, `no schema registered for emitted event_name "${event.event_name}"`).toBeDefined()
      const result = schema.safeParse(event)
      if (!result.success) {
        throw new Error(`Event ${event.event_name} does not match its declared schema: ${JSON.stringify(result.error.issues, null, 2)}`)
      }
    }

    // Per-evaluation calls never reach KRN-06 at all (KRN-07-FR-005) — sanity-checked here.
    expect(krn06.events.some((e) => e.subject_type === 'evaluation_log')).toBe(false)
  })
})
