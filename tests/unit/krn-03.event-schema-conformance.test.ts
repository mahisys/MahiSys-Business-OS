/**
 * KRN-03 event-schema conformance — same rationale as KRN-01/02/04's:
 * runs the real service functions and validates actual emitted events
 * against the real Zod schemas, not just hand-built contract-test
 * fixtures.
 */
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import { createRole, deprecateRole } from '@mahisys/krn-03'
import { createPermissionSet, updatePermissionSetGrants } from '@mahisys/krn-03'
import { grantPermission, revokePermission, checkPermissionGrantExpiry } from '@mahisys/krn-03'
import { createDataScopeRule, supersedeDataScopeRule } from '@mahisys/krn-03'
import { createFieldPolicy, supersedeFieldPolicy } from '@mahisys/krn-03'
import { createDelegation, checkDelegationStart, checkDelegationExpiry, revokeDelegation } from '@mahisys/krn-03'
import {
  RoleCreatedEventSchema,
  RoleDeprecatedEventSchema,
  RoleGrantedEventSchema,
  RoleRevokedEventSchema,
  PermissionGrantExpiredEventSchema,
  PermissionSetCreatedEventSchema,
  PermissionSetUpdatedEventSchema,
  ScopeRuleChangedEventSchema,
  FieldPolicyChangedEventSchema,
  PolicyChangedEventSchema,
  DelegationCreatedEventSchema,
  DelegationStartedEventSchema,
  DelegationExpiredEventSchema,
  DelegationRevokedEventSchema,
} from '@mahisys/krn-03'
import { newStore, sysActor, userActor, TENANT_ID, DEAL_ENTITY_REF, USER_A, USER_B } from './krn-03.fixtures.js'

const SCHEMA_BY_EVENT_NAME: Record<string, z.ZodTypeAny> = {
  'access.role.created': RoleCreatedEventSchema,
  'access.role.deprecated': RoleDeprecatedEventSchema,
  'access.role.granted': RoleGrantedEventSchema,
  'access.role.revoked': RoleRevokedEventSchema,
  'access.permission_grant.expired': PermissionGrantExpiredEventSchema,
  'access.permission_set.created': PermissionSetCreatedEventSchema,
  'access.permission_set.updated': PermissionSetUpdatedEventSchema,
  'access.scope_rule.changed': ScopeRuleChangedEventSchema,
  'access.field_policy.changed': FieldPolicyChangedEventSchema,
  'access.policy.changed': PolicyChangedEventSchema,
  'access.delegation.created': DelegationCreatedEventSchema,
  'access.delegation.started': DelegationStartedEventSchema,
  'access.delegation.expired': DelegationExpiredEventSchema,
  'access.delegation.revoked': DelegationRevokedEventSchema,
}

describe('KRN-03 — every emitted event validates against its declared Zod schema', () => {
  it('exercises every KRN-03 mutation and checks each resulting event', () => {
    const store = newStore()

    const role = createRole(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'R1', name: 'R1', description: '', is_assignable_to_agent: false, permission_set_ids: [] }, sysActor, 'PR-21') // access.role.created
    const role2 = createRole(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'R2', name: 'R2', description: '', is_assignable_to_agent: false, permission_set_ids: [] }, sysActor, 'PR-21')
    deprecateRole(store, role2.id, sysActor, 'PR-21') // access.role.deprecated

    const set = createPermissionSet(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'PS1', name: 'PS1', grants: [] }, sysActor, 'PR-21') // access.permission_set.created
    updatePermissionSetGrants(store, set.id, [{ entity_ref: DEAL_ENTITY_REF, action: 'read', scope_rule_id: null }], sysActor, 'PR-21') // access.permission_set.updated

    const grant = grantPermission(store, { tenant_id: TENANT_ID, subject_type: 'user', subject_id: USER_A, role_id: role.id, permission_set_id: null, scope_override_id: null, expires_at: null }, sysActor, 'PR-21') // access.role.granted
    revokePermission(store, grant.id, sysActor, 'PR-21') // access.role.revoked

    const expiringGrant = grantPermission(store, { tenant_id: TENANT_ID, subject_type: 'user', subject_id: USER_B, role_id: null, permission_set_id: set.id, scope_override_id: null, expires_at: '2026-09-14T00:00:00.000Z' }, sysActor, 'PR-21')
    checkPermissionGrantExpiry(store, expiringGrant.id, '2026-09-15T00:00:00.000Z', sysActor) // access.permission_grant.expired

    const scopeRule = createDataScopeRule(store, { tenant_id: TENANT_ID, namespace: 'tnt', scope_type: 'tenant', org_unit_id: null, entity_scope_id: null, expression: null, applies_to_entity_ref: DEAL_ENTITY_REF }, sysActor, 'PR-21') // access.scope_rule.changed + access.policy.changed
    supersedeDataScopeRule(store, scopeRule.id, {}, sysActor, 'PR-21') // access.scope_rule.changed + access.policy.changed (again, for the new version)

    const fieldPolicy = createFieldPolicy(store, { tenant_id: TENANT_ID, namespace: 'tnt', entity_ref: DEAL_ENTITY_REF, field_ref: '00000000-0000-7000-8200-0000000000fc', role_id: role.id, policy: 'hidden', mask_strategy: null }, sysActor, 'PR-16') // access.field_policy.changed + access.policy.changed
    supersedeFieldPolicy(store, fieldPolicy.id, { policy: 'masked', mask_strategy: 'full' }, sysActor, 'PR-16') // access.field_policy.changed + access.policy.changed

    const delegation = createDelegation(store, { tenant_id: TENANT_ID, from_subject_id: USER_A, to_subject_id: USER_B, permission_set_id: null, period: { from: '2026-09-14', to: '2026-09-19', is_open_ended: false }, reason: 'leave' }, userActor, 'OTHER', USER_A) // access.delegation.created
    checkDelegationStart(store, delegation.id, '2026-09-17T00:00:00.000Z', sysActor) // access.delegation.started
    revokeDelegation(store, delegation.id, userActor, 'OTHER', USER_A) // access.delegation.revoked

    const delegation2 = createDelegation(store, { tenant_id: TENANT_ID, from_subject_id: USER_A, to_subject_id: USER_B, permission_set_id: null, period: { from: '2026-09-14', to: '2026-09-19', is_open_ended: false }, reason: 'leave 2' }, userActor, 'OTHER', USER_A)
    checkDelegationStart(store, delegation2.id, '2026-09-17T00:00:00.000Z', sysActor)
    checkDelegationExpiry(store, delegation2.id, '2026-09-21T00:00:00.000Z', sysActor) // access.delegation.expired

    expect(store.events.length).toBeGreaterThanOrEqual(19)

    for (const event of store.events) {
      const schema = SCHEMA_BY_EVENT_NAME[event.event_name]
      expect(schema, `no schema registered for emitted event_name "${event.event_name}"`).toBeDefined()
      const result = schema.safeParse(event)
      if (!result.success) {
        throw new Error(`Event ${event.event_name} does not match its declared schema: ${JSON.stringify(result.error.issues, null, 2)}`)
      }
    }
  })
})
