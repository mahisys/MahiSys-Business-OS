/**
 * Shared test fixtures for KRN-03 acceptance/permission tests.
 */
import { createStore, type Krn03Store } from '@mahisys/krn-03'
import { createRole, createPermissionSet, grantPermission, createDataScopeRule } from '@mahisys/krn-03'
import type { PermissionAction } from '@mahisys/krn-03'

export const sysActor = { type: 'service' as const, id: '00000000-0000-7000-8200-000000000001' }
export const userActor = { type: 'user' as const, id: '00000000-0000-7000-8200-000000000002' }
export const agentActor = { type: 'agent' as const, id: '00000000-0000-7000-8200-000000000009', version: 'v1' }

export const TENANT_ID = '00000000-0000-7000-8200-0000000000f0'

// Stand-ins for KRN-04 entity_definition ids and KRN-02 user ids — KRN-03
// only ever references these by id (L3), it never creates them itself.
export const DEAL_ENTITY_REF = '00000000-0000-7000-8200-00000000d001'
export const INVOICE_ENTITY_REF = '00000000-0000-7000-8200-00000000d002'
export const USER_A = '00000000-0000-7000-8200-0000000000a1'
export const USER_B = '00000000-0000-7000-8200-0000000000a2'

export function newStore(): Krn03Store {
  return createStore()
}

/** Creates a role with one attached permission_set granting `{entityRef, action, scope}`, and a permission_grant of that role to `subjectId`. Returns everything the caller might need to assert against. */
export function grantRoleWithScope(
  store: Krn03Store,
  subjectId: string,
  entityRef: string,
  action: PermissionAction,
  scopeRuleId: string | null,
) {
  const set = createPermissionSet(
    store,
    { tenant_id: TENANT_ID, namespace: 'tnt', code: `PS-${Math.random().toString(36).slice(2, 8)}`, name: 'Test set', grants: [{ entity_ref: entityRef, action, scope_rule_id: scopeRuleId }] },
    sysActor,
    'PR-21',
  )
  const role = createRole(
    store,
    { tenant_id: TENANT_ID, namespace: 'tnt', code: `ROLE-${Math.random().toString(36).slice(2, 8)}`, name: 'Test role', description: '', is_assignable_to_agent: true, permission_set_ids: [set.id] },
    sysActor,
    'PR-21',
  )
  const grant = grantPermission(
    store,
    { tenant_id: TENANT_ID, subject_type: 'user', subject_id: subjectId, role_id: role.id, permission_set_id: null, scope_override_id: null, expires_at: null },
    sysActor,
    'PR-21',
  )
  return { set, role, grant }
}

export function makeOrgUnitScope(store: Krn03Store, orgUnitId: string) {
  return createDataScopeRule(store, { tenant_id: TENANT_ID, namespace: 'tnt', scope_type: 'org_unit', org_unit_id: orgUnitId, entity_scope_id: null, expression: null, applies_to_entity_ref: null }, sysActor, 'PR-21')
}
