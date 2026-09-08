/**
 * KRN-03 permission tests — Vol 6 §6 step 4, from KRN-03.md §11.
 *
 * Scope note: this exercises KRN-03's own bootstrap matrix for its own
 * admin entities. The §11 negative case "PR-25/26 attempting any
 * create/update/delete/post/reverse action anywhere in the platform" is
 * NOT re-tested here as a KRN-03 runtime check: KRN-03's resolution
 * engine works on `subject_id`/`subject_type`, not on a persona label —
 * "PR-25 never gets granted a write action" is a provisioning-time
 * discipline (whoever authors PR-25's `permission_set` never includes
 * one), not something `resolveEffectivePermissions` itself enforces or
 * could honestly claim to test. Documented here rather than faked.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { hasPermission } from '@mahisys/krn-03'
import { type Krn03Store } from '@mahisys/krn-03'
import { createRole, createPermissionSet, grantPermission } from '@mahisys/krn-03'
import { createFieldPolicy } from '@mahisys/krn-03'
import { createDelegation } from '@mahisys/krn-03'
import { getEffectivePermissionsViewer } from '@mahisys/krn-03'
import { newStore, sysActor, userActor, agentActor, TENANT_ID, DEAL_ENTITY_REF, USER_A, USER_B } from './krn-03.fixtures.js'

describe('KRN-03 permission matrix (§11) — positive cases', () => {
  it('PR-21 holds every admin-reach grant', () => {
    expect(hasPermission('PR-21', 'role.write')).toBe(true)
    expect(hasPermission('PR-21', 'permission_set.write')).toBe(true)
    expect(hasPermission('PR-21', 'scope_and_field_policy.write')).toBe(true)
    expect(hasPermission('PR-21', 'permission_grant.write')).toBe(true)
    expect(hasPermission('PR-21', 'delegation.create_others')).toBe(true)
    expect(hasPermission('PR-21', 'effective_permissions.read_others')).toBe(true)
  })

  it('PR-16/PR-17 can write scope_and_field_policy but hold no other admin-reach grant', () => {
    for (const persona of ['PR-16', 'PR-17'] as const) {
      expect(hasPermission(persona, 'scope_and_field_policy.write'), persona).toBe(true)
      expect(hasPermission(persona, 'role.write'), persona).toBe(false)
      expect(hasPermission(persona, 'permission_grant.write'), persona).toBe(false)
    }
  })

  it('PR-01 can approve grants and read any subject\'s effective permissions, but cannot author roles/sets/policy', () => {
    expect(hasPermission('PR-01', 'permission_grant.write')).toBe(true)
    expect(hasPermission('PR-01', 'effective_permissions.read_others')).toBe(true)
    expect(hasPermission('PR-01', 'role.write')).toBe(false)
    expect(hasPermission('PR-01', 'scope_and_field_policy.write')).toBe(false)
  })
})

describe('KRN-03 permission matrix (§11) — negative cases', () => {
  it('no persona other than PR-21 holds role.write or permission_set.write', () => {
    const personas = ['PR-01', 'PR-16', 'PR-17', 'PR-02', 'PR-25', 'PR-29', 'OTHER'] as const
    for (const persona of personas) {
      expect(hasPermission(persona, 'role.write'), persona).toBe(false)
      expect(hasPermission(persona, 'permission_set.write'), persona).toBe(false)
    }
  })

  it('PR-25 (External CA/Auditor) and PR-29 (Agent) hold only self-read, nothing else', () => {
    for (const persona of ['PR-25', 'PR-29'] as const) {
      expect(hasPermission(persona, 'effective_permissions.read_self'), persona).toBe(true)
      expect(hasPermission(persona, 'effective_permissions.read_others'), persona).toBe(false)
      expect(hasPermission(persona, 'delegation.create_self'), persona).toBe(false)
      expect(hasPermission(persona, 'scope_and_field_policy.write'), persona).toBe(false)
    }
  })

  it('OTHER (every other internal persona) can self-delegate but cannot delegate on behalf of others', () => {
    expect(hasPermission('OTHER', 'delegation.create_self')).toBe(true)
    expect(hasPermission('OTHER', 'delegation.create_others')).toBe(false)
  })
})

describe('KRN-03 write paths actually enforce the matrix, not just report it', () => {
  let store: Krn03Store
  beforeEach(() => {
    store = newStore()
  })

  it('createRole: PR-21 succeeds, OTHER is rejected', () => {
    expect(() => createRole(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'A', name: 'A', description: '', is_assignable_to_agent: false, permission_set_ids: [] }, sysActor, 'PR-21')).not.toThrow()
    expect(() => createRole(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'B', name: 'B', description: '', is_assignable_to_agent: false, permission_set_ids: [] }, userActor, 'OTHER')).toThrow()
  })

  it('grantPermission: an agent identity is rejected unconditionally, even nominally holding PR-21 (§11 negative case, L9)', () => {
    const set = createPermissionSet(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'PS', name: 'PS', grants: [] }, sysActor, 'PR-21')
    expect(() =>
      grantPermission(store, { tenant_id: TENANT_ID, subject_type: 'user', subject_id: USER_A, role_id: null, permission_set_id: set.id, scope_override_id: null, expires_at: null }, agentActor, 'PR-21'),
    ).toThrow()
  })

  it('grantPermission: PR-21 succeeds, OTHER is rejected', () => {
    const set = createPermissionSet(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'PS2', name: 'PS2', grants: [] }, sysActor, 'PR-21')
    expect(() =>
      grantPermission(store, { tenant_id: TENANT_ID, subject_type: 'user', subject_id: USER_A, role_id: null, permission_set_id: set.id, scope_override_id: null, expires_at: null }, sysActor, 'PR-21'),
    ).not.toThrow()
    expect(() =>
      grantPermission(store, { tenant_id: TENANT_ID, subject_type: 'user', subject_id: USER_B, role_id: null, permission_set_id: set.id, scope_override_id: null, expires_at: null }, userActor, 'OTHER'),
    ).toThrow()
  })

  it('createFieldPolicy: PR-16 succeeds, PR-02 is rejected (§11 negative case)', () => {
    const role = createRole(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'R', name: 'R', description: '', is_assignable_to_agent: false, permission_set_ids: [] }, sysActor, 'PR-21')
    expect(() =>
      createFieldPolicy(store, { tenant_id: TENANT_ID, namespace: 'tnt', entity_ref: DEAL_ENTITY_REF, field_ref: '00000000-0000-7000-8200-0000000000fa', role_id: role.id, policy: 'masked', mask_strategy: 'partial' }, sysActor, 'PR-16'),
    ).not.toThrow()
    expect(() =>
      createFieldPolicy(store, { tenant_id: TENANT_ID, namespace: 'tnt', entity_ref: DEAL_ENTITY_REF, field_ref: '00000000-0000-7000-8200-0000000000fb', role_id: role.id, policy: 'hidden', mask_strategy: null }, userActor, 'PR-02'),
    ).toThrow()
  })

  it('createDelegation: self-delegation needs only delegation.create_self, delegating on behalf of another needs delegation.create_others', () => {
    // OTHER holds create_self only — delegating their own set is fine.
    expect(() =>
      createDelegation(store, { tenant_id: TENANT_ID, from_subject_id: USER_A, to_subject_id: USER_B, permission_set_id: null, period: { from: '2026-09-14', to: '2026-09-19', is_open_ended: false }, reason: 'leave' }, userActor, 'OTHER', USER_A),
    ).not.toThrow()
    // OTHER attempting to delegate on someone else's behalf (from_subject_id !== caller) is rejected.
    expect(() =>
      createDelegation(store, { tenant_id: TENANT_ID, from_subject_id: USER_B, to_subject_id: USER_A, permission_set_id: null, period: { from: '2026-09-14', to: '2026-09-19', is_open_ended: false }, reason: 'leave' }, userActor, 'OTHER', USER_A),
    ).toThrow()
    // PR-02 holds create_others too, so the same on-behalf-of call succeeds for them.
    expect(() =>
      createDelegation(store, { tenant_id: TENANT_ID, from_subject_id: USER_B, to_subject_id: USER_A, permission_set_id: null, period: { from: '2026-09-14', to: '2026-09-19', is_open_ended: false }, reason: 'leave' }, userActor, 'PR-02', USER_A),
    ).not.toThrow()
  })

  it('createDelegation: rejects a permission_set the delegator does not themselves hold (KRN-03-FR-004 bounded, §11 negative case)', () => {
    const heldSet = createPermissionSet(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'PS_HELD', name: 'Held', grants: [] }, sysActor, 'PR-21')
    const notHeldSet = createPermissionSet(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'PS_NOT_HELD', name: 'Not held', grants: [] }, sysActor, 'PR-21')
    grantPermission(store, { tenant_id: TENANT_ID, subject_type: 'user', subject_id: USER_A, role_id: null, permission_set_id: heldSet.id, scope_override_id: null, expires_at: null }, sysActor, 'PR-21')

    expect(() =>
      createDelegation(store, { tenant_id: TENANT_ID, from_subject_id: USER_A, to_subject_id: USER_B, permission_set_id: heldSet.id, period: { from: '2026-09-14', to: '2026-09-19', is_open_ended: false }, reason: 'leave' }, userActor, 'OTHER', USER_A),
    ).not.toThrow()
    expect(() =>
      createDelegation(store, { tenant_id: TENANT_ID, from_subject_id: USER_A, to_subject_id: USER_B, permission_set_id: notHeldSet.id, period: { from: '2026-09-14', to: '2026-09-19', is_open_ended: false }, reason: 'leave' }, userActor, 'OTHER', USER_A),
    ).toThrow()
  })

  it('effective_permissions.read: PR-01 can read another subject\'s permissions, OTHER cannot', () => {
    expect(() => getEffectivePermissionsViewer(store, 'user', USER_B, 'PR-01', USER_A)).not.toThrow()
    expect(() => getEffectivePermissionsViewer(store, 'user', USER_B, 'OTHER', USER_A)).toThrow()
    // Self-read is always fine, for any persona.
    expect(() => getEffectivePermissionsViewer(store, 'user', USER_A, 'OTHER', USER_A)).not.toThrow()
  })
})
