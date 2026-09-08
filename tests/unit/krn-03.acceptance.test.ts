/**
 * KRN-03 acceptance tests — every G/W/T in KRN-03.md §16, written against
 * the real service functions (Vol 6 §6 step 3).
 *
 * KRN-03 does not own the business records its scope rules ultimately
 * filter (Deals, Invoices, Payroll, P&L — those belong to SLS-04, FIN-02,
 * PPL-08, FIN-08, per L3), so several samples are adapted to what KRN-03
 * actually owns: the resolution primitives (`hasEffectivePermission`,
 * `isRowInScope`, `resolveFieldPolicy`) a record-owning module's
 * data-access layer would call, rather than a literal record store KRN-03
 * has no business holding.
 */
import { describe, it, expect } from 'vitest'
import { createPermissionSet, createRole, grantPermission, revokeGrantsForSubject } from '@mahisys/krn-03'
import { createDataScopeRule } from '@mahisys/krn-03'
import { createFieldPolicy } from '@mahisys/krn-03'
import { createDelegation, checkDelegationStart, checkDelegationExpiry } from '@mahisys/krn-03'
import { hasEffectivePermission, isRowInScope, resolveFieldPolicy, resolveEffectivePermissions, checkAgentActionGrant, getEffectivePermissionsViewer } from '@mahisys/krn-03'
import { newStore, grantRoleWithScope, sysActor, userActor, TENANT_ID, DEAL_ENTITY_REF, INVOICE_ENTITY_REF, USER_A, USER_B } from './krn-03.fixtures.js'

describe('KRN-03-FR-001 — permission shape and default-deny for ungranted actions', () => {
  it('a user holding {entity: Deal, action: read, scope: org_unit_and_below} can read but not post', () => {
    const store = newStore()
    const scope = createDataScopeRule(store, { tenant_id: TENANT_ID, namespace: 'tnt', scope_type: 'org_unit_and_below', org_unit_id: 'org-sales', entity_scope_id: null, expression: null, applies_to_entity_ref: DEAL_ENTITY_REF }, sysActor, 'PR-21')
    grantRoleWithScope(store, USER_A, DEAL_ENTITY_REF, 'read', scope.id)

    expect(hasEffectivePermission(store, 'user', USER_A, DEAL_ENTITY_REF, 'read')).toBe(true)
    expect(hasEffectivePermission(store, 'user', USER_A, DEAL_ENTITY_REF, 'post')).toBe(false) // post was never granted

    const dealInScope = { org_unit_id: 'org-sales-north' }
    const dealOutOfScope = { org_unit_id: 'org-finance' }
    const ctx = { callerOrgUnitId: null, callerUserId: null, callerLegalEntityId: null, orgUnitAndBelowIds: ['org-sales', 'org-sales-north'], record: dealInScope }
    expect(isRowInScope(store, scope.id, ctx)).toBe(true)
    expect(isRowInScope(store, scope.id, { ...ctx, record: dealOutOfScope })).toBe(false)
  })
})

describe('KRN-03-FR-002 — data scope types (rule_based, alongside org_unit_and_below)', () => {
  it('a rule_based scope on Invoice filters by owner_user_id, a different mechanism from the org-unit scope above', () => {
    const store = newStore()
    const ruleScope = createDataScopeRule(
      store,
      { tenant_id: TENANT_ID, namespace: 'tnt', scope_type: 'rule_based', org_unit_id: null, entity_scope_id: null, expression: { field: 'party.owner_user_id', operator: 'eq', value: USER_A }, applies_to_entity_ref: INVOICE_ENTITY_REF },
      sysActor,
      'PR-21',
    )
    grantRoleWithScope(store, USER_A, INVOICE_ENTITY_REF, 'read', ruleScope.id)

    const ownInvoice = { 'party.owner_user_id': USER_A }
    const othersInvoice = { 'party.owner_user_id': USER_B }
    const ctx = { callerOrgUnitId: null, callerUserId: USER_A, callerLegalEntityId: null, orgUnitAndBelowIds: null, record: ownInvoice }
    expect(isRowInScope(store, ruleScope.id, ctx)).toBe(true)
    expect(isRowInScope(store, ruleScope.id, { ...ctx, record: othersInvoice })).toBe(false)
  })
})

describe('KRN-03-FR-003 — field-level policy (masked/hidden, per role)', () => {
  it('resolves masked with its strategy and hidden distinctly, and null when no policy is declared', () => {
    const store = newStore()
    const role = createRole(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'PAYROLL_VIEWER', name: 'Payroll Viewer', description: '', is_assignable_to_agent: false, permission_set_ids: [] }, sysActor, 'PR-21')
    const salaryField = '00000000-0000-7000-8200-0000000000f1'
    const marginField = '00000000-0000-7000-8200-0000000000f2'
    const payrollEntity = '00000000-0000-7000-8200-0000000000f3'
    const pnlEntity = '00000000-0000-7000-8200-0000000000f4'

    createFieldPolicy(store, { tenant_id: TENANT_ID, namespace: 'tnt', entity_ref: payrollEntity, field_ref: salaryField, role_id: role.id, policy: 'masked', mask_strategy: 'partial' }, sysActor, 'PR-16')
    createFieldPolicy(store, { tenant_id: TENANT_ID, namespace: 'tnt', entity_ref: pnlEntity, field_ref: marginField, role_id: role.id, policy: 'hidden', mask_strategy: null }, sysActor, 'PR-16')

    expect(resolveFieldPolicy(store, role.id, payrollEntity, salaryField)).toEqual({ policy: 'masked', mask_strategy: 'partial' })
    expect(resolveFieldPolicy(store, role.id, pnlEntity, marginField)).toEqual({ policy: 'hidden', mask_strategy: null })
    expect(resolveFieldPolicy(store, role.id, pnlEntity, 'some-other-field')).toBeNull()
  })
})

describe('KRN-03-FR-004 — delegation transfers a bounded set for a bounded period, expires automatically', () => {
  it('the peer resolves the delegated grant only once active, and loses it once expired', () => {
    const store = newStore()
    const set = createPermissionSet(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'PS_APPROVE', name: 'Approve', grants: [{ entity_ref: DEAL_ENTITY_REF, action: 'approve', scope_rule_id: null }] }, sysActor, 'PR-21')
    grantPermission(store, { tenant_id: TENANT_ID, subject_type: 'user', subject_id: USER_A, role_id: null, permission_set_id: set.id, scope_override_id: null, expires_at: null }, sysActor, 'PR-21')

    const delegation = createDelegation(
      store,
      { tenant_id: TENANT_ID, from_subject_id: USER_A, to_subject_id: USER_B, permission_set_id: set.id, period: { from: '2026-09-14', to: '2026-09-19', is_open_ended: false }, reason: 'annual leave' },
      userActor,
      'PR-02',
      USER_A,
    )
    expect(delegation.status).toBe('pending')

    // Before period.from (Monday): peer has nothing yet.
    checkDelegationStart(store, delegation.id, '2026-09-13T00:00:00.000Z', sysActor)
    expect(hasEffectivePermission(store, 'user', USER_B, DEAL_ENTITY_REF, 'approve')).toBe(false)

    // Day 4 (Thursday): active, peer can approve within the delegated set.
    const started = checkDelegationStart(store, delegation.id, '2026-09-17T00:00:00.000Z', sysActor)
    expect(started.status).toBe('active')
    expect(hasEffectivePermission(store, 'user', USER_B, DEAL_ENTITY_REF, 'approve')).toBe(true)

    // Day 6: auto-expires with no human action, peer's next approval attempt is rejected.
    const expired = checkDelegationExpiry(store, delegation.id, '2026-09-21T00:00:00.000Z', sysActor)
    expect(expired.status).toBe('expired')
    expect(hasEffectivePermission(store, 'user', USER_B, DEAL_ENTITY_REF, 'approve')).toBe(false)

    expect(store.events.some((e) => e.event_name === 'access.delegation.started')).toBe(true)
    expect(store.events.some((e) => e.event_name === 'access.delegation.expired')).toBe(true)
  })
})

describe('KRN-03-FR-005 — enforcement at the data-access layer (single shared resolution path)', () => {
  it('four simulated consumers (API list, CSV export, Copilot, scheduled report) all call the same function and get the same answer', () => {
    const store = newStore()
    const scope = createDataScopeRule(store, { tenant_id: TENANT_ID, namespace: 'tnt', scope_type: 'org_unit', org_unit_id: 'org-sales', entity_scope_id: null, expression: null, applies_to_entity_ref: DEAL_ENTITY_REF }, sysActor, 'PR-21')
    grantRoleWithScope(store, USER_A, DEAL_ENTITY_REF, 'read', scope.id)

    const apiListResult = resolveEffectivePermissions(store, 'user', USER_A)
    const csvExportResult = resolveEffectivePermissions(store, 'user', USER_A)
    const copilotResult = resolveEffectivePermissions(store, 'user', USER_A)
    const scheduledReportResult = resolveEffectivePermissions(store, 'user', USER_A)

    expect(csvExportResult).toEqual(apiListResult)
    expect(copilotResult).toEqual(apiListResult)
    expect(scheduledReportResult).toEqual(apiListResult)
    expect(apiListResult.some((g) => g.entity_ref === DEAL_ENTITY_REF && g.action === 'read')).toBe(true)
  })
})

describe('KRN-03-FR-006 — permission and trust ceiling are independent gates (D-25: KRN-03 is trust-ceiling-unaware)', () => {
  it('checkAgentActionGrant answers only the grant half — it holds no ceiling concept at all', () => {
    const store = newStore()
    const agentId = '00000000-0000-7000-8200-0000000000ag'
    const set = createPermissionSet(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'PS_PO_CREATE', name: 'PO create', grants: [{ entity_ref: DEAL_ENTITY_REF, action: 'create', scope_rule_id: null }] }, sysActor, 'PR-21')
    grantPermission(store, { tenant_id: TENANT_ID, subject_type: 'agent_identity', subject_id: agentId, role_id: null, permission_set_id: set.id, scope_override_id: null, expires_at: null }, sysActor, 'PR-21')

    // The grant permits it — this is the entirety of what KRN-03 answers.
    // `checkAgentActionGrant`'s signature takes no ceiling parameter at
    // all (see its type in effective-permissions-service.ts) — whether
    // the agent may commit without a human (its L2 trust ceiling) is
    // INT-04's question, never represented in this module (D-25).
    expect(checkAgentActionGrant(store, agentId, DEAL_ENTITY_REF, 'create')).toBe(true)
    expect(checkAgentActionGrant(store, agentId, DEAL_ENTITY_REF, 'post')).toBe(false) // never granted — same default-deny, regardless of any ceiling
  })
})

describe('KRN-03-DR-001 — Studio-generated entities inherit enforcement (default-deny)', () => {
  it('a role with no explicit grant for a newly generated entity returns zero visibility, not an error', () => {
    const store = newStore()
    const gatePassReturnEntity = '00000000-0000-7000-8200-0000000000gp'
    expect(hasEffectivePermission(store, 'user', USER_A, gatePassReturnEntity, 'read')).toBe(false)
    expect(resolveEffectivePermissions(store, 'user', USER_A)).toEqual([])
  })
})

describe('KRN-03-DR-002 — one screen answers "what can this agent see" in the same vocabulary as a human', () => {
  it('the effective-permissions viewer returns an identical shape for a user and an agent_identity', () => {
    const store = newStore()
    const agentId = '00000000-0000-7000-8200-0000000000ag'
    const set = createPermissionSet(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'PS_WATCH', name: 'Watch', grants: [{ entity_ref: DEAL_ENTITY_REF, action: 'read', scope_rule_id: null }] }, sysActor, 'PR-21')
    grantPermission(store, { tenant_id: TENANT_ID, subject_type: 'agent_identity', subject_id: agentId, role_id: null, permission_set_id: set.id, scope_override_id: null, expires_at: null }, sysActor, 'PR-21')
    grantPermission(store, { tenant_id: TENANT_ID, subject_type: 'user', subject_id: USER_A, role_id: null, permission_set_id: set.id, scope_override_id: null, expires_at: null }, sysActor, 'PR-21')

    const agentView = getEffectivePermissionsViewer(store, 'agent_identity', agentId, 'PR-21', 'someone-else')
    const userView = getEffectivePermissionsViewer(store, 'user', USER_A, 'PR-21', 'someone-else')

    expect(Object.keys(agentView)).toEqual(Object.keys(userView))
    expect(agentView.grants).toEqual(userView.grants)
  })
})

describe('KRN-03-DR-003 — single resolution source, no bespoke or cached scope logic', () => {
  it("an agent's own scan and a semantic-graph traversal on a user's behalf both resolve through the same function, scoped to their own respective subject", () => {
    const store = newStore()
    const agentId = '00000000-0000-7000-8200-0000000000ag'
    const agentSet = createPermissionSet(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'PS_AGENT', name: 'Agent', grants: [{ entity_ref: DEAL_ENTITY_REF, action: 'read', scope_rule_id: null }] }, sysActor, 'PR-21')
    grantPermission(store, { tenant_id: TENANT_ID, subject_type: 'agent_identity', subject_id: agentId, role_id: null, permission_set_id: agentSet.id, scope_override_id: null, expires_at: null }, sysActor, 'PR-21')

    const userScope = createDataScopeRule(store, { tenant_id: TENANT_ID, namespace: 'tnt', scope_type: 'org_unit', org_unit_id: 'org-sales', entity_scope_id: null, expression: null, applies_to_entity_ref: DEAL_ENTITY_REF }, sysActor, 'PR-21')
    grantRoleWithScope(store, USER_A, DEAL_ENTITY_REF, 'read', userScope.id)

    const agentScanResult = resolveEffectivePermissions(store, 'agent_identity', agentId) // the agent's own scheduled scan
    const semanticGraphResult = resolveEffectivePermissions(store, 'user', USER_A) // INT-01 traversal on the user's behalf

    expect(agentScanResult.every((g) => g.scope_rule_id === null)).toBe(true) // the agent's own grant, unscoped
    expect(semanticGraphResult.some((g) => g.scope_rule_id === userScope.id)).toBe(true) // the user's own org-unit scope
    expect(agentScanResult).not.toEqual(semanticGraphResult) // neither borrows the other's — each resolved independently through the one path
  })
})

describe('KRN-03.md §12 consumed events — identity deactivation closes access automatically', () => {
  it('revokes every active grant for a deactivated subject, leaves an already-inactive one untouched', () => {
    const store = newStore()
    const set = createPermissionSet(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'PS_TEMP', name: 'Temp', grants: [{ entity_ref: DEAL_ENTITY_REF, action: 'read', scope_rule_id: null }] }, sysActor, 'PR-21')
    const grant1 = grantPermission(store, { tenant_id: TENANT_ID, subject_type: 'user', subject_id: USER_A, role_id: null, permission_set_id: set.id, scope_override_id: null, expires_at: null }, sysActor, 'PR-21')
    const grant2 = grantPermission(store, { tenant_id: TENANT_ID, subject_type: 'user', subject_id: USER_A, role_id: null, permission_set_id: set.id, scope_override_id: null, expires_at: null }, sysActor, 'PR-21')
    // A third grant for the same subject, already revoked before deactivation — must stay revoked, not error.
    const grant3 = grantPermission(store, { tenant_id: TENANT_ID, subject_type: 'user', subject_id: USER_A, role_id: null, permission_set_id: set.id, scope_override_id: null, expires_at: null }, sysActor, 'PR-21')
    store.permissionGrants.set(grant3.id, { ...grant3, status: 'revoked' })

    expect(hasEffectivePermission(store, 'user', USER_A, DEAL_ENTITY_REF, 'read')).toBe(true)

    const revoked = revokeGrantsForSubject(store, 'user', USER_A, sysActor)

    expect(revoked.map((g) => g.id).sort()).toEqual([grant1.id, grant2.id].sort())
    expect(store.permissionGrants.get(grant1.id)!.status).toBe('revoked')
    expect(store.permissionGrants.get(grant2.id)!.status).toBe('revoked')
    expect(store.permissionGrants.get(grant3.id)!.status).toBe('revoked') // untouched, was already revoked
    expect(hasEffectivePermission(store, 'user', USER_A, DEAL_ENTITY_REF, 'read')).toBe(false)
  })
})
