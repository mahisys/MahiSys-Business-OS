/**
 * Shared test fixtures for KRN-07 acceptance/permission tests.
 */
import { createStore as createKrn06Store, type Krn06Store } from '@mahisys/krn-06'
import { createStore as createKrn07Store, type Krn07Store } from '@mahisys/krn-07'
import { createRuleSet } from '@mahisys/krn-07'
import type { RuleType, MatchMode } from '@mahisys/krn-07'

export const sysActor = { type: 'service' as const, id: '00000000-0000-7000-8200-000000000001' }
export const userActor = { type: 'user' as const, id: '00000000-0000-7000-8200-000000000002' }
export const agentActor = { type: 'agent' as const, id: '00000000-0000-7000-8200-000000000009', version: 'v1' }

export const TENANT_ID = '00000000-0000-7000-8200-0000000000f0'
export const LEGAL_ENTITY_ID = '00000000-0000-7000-8200-0000000000e1'
export const LOCATION_PUNE = '00000000-0000-7000-8200-0000000000l1'
export const LOCATION_NASHIK = '00000000-0000-7000-8200-0000000000l2'

// Stand-in KRN-04 declared field refs — KRN-07 only ever references these by name (L3), it never creates them itself.
export const DECLARED_FIELDS = new Set(['item.hsn_sac', 'item.item_category', 'quote.value', 'quantity_delta', 'ar.days_overdue'])

export function newStores(): { krn06: Krn06Store; krn07: Krn07Store } {
  const krn06 = createKrn06Store()
  const krn07 = createKrn07Store(krn06)
  return { krn06, krn07 }
}

export function makeRuleSet(
  krn07: Krn07Store,
  overrides: Partial<{ rule_type: RuleType; match_mode: MatchMode; name: string }> = {},
) {
  return createRuleSet(
    krn07,
    {
      tenant_id: TENANT_ID,
      entity_id: LEGAL_ENTITY_ID,
      namespace: 'tnt',
      name: overrides.name ?? 'Test rule set',
      rule_type: overrides.rule_type ?? 'pricing',
      owning_module: 'SLS-07',
      match_mode: overrides.match_mode ?? 'first_match',
      description: 'fixture',
    },
    sysActor,
    'PR-21',
  )
}
