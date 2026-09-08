/**
 * KRN-03 contract tests — Vol 6 §6 step 2, written before any
 * implementation exists. Scope: shape only (entity fields/enums, API
 * request/response shape, event schema shape) — not business behaviour.
 */
import { describe, it, expect } from 'vitest'
import {
  RoleSchema,
  PermissionSetSchema,
  PermissionGrantSchema,
  DataScopeRuleSchema,
  FieldPolicySchema,
  DelegationSchema,
  RoleCreateRequestSchema,
  DelegationCreateRequestSchema,
  EffectivePermissionsResponseSchema,
  RoleCreatedEventSchema,
  RoleGrantedEventSchema,
  DelegationCreatedEventSchema,
} from '@mahisys/krn-03'
import { ErrorResponseSchema } from '@mahisys/shared'

const actor = { type: 'service' as const, id: '019103b1-6e2a-7c3d-9a1b-000000000001' }
const now = new Date().toISOString()

const baseUniversal = {
  tenant_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
  entity_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
  namespace: 'tnt' as const,
  ext: {},
  created_at: now,
  created_by: actor,
  updated_at: now,
  updated_by: actor,
  version: 1,
  deleted_at: null,
  deleted_by: null,
  source: 'api' as const,
  trace_id: '019103b1-6e2a-7c3d-9a1b-000000000002',
}

describe('KRN-03 contract — role', () => {
  const validRole = {
    ...baseUniversal,
    id: '019103b1-6e2a-7c3d-9a1b-000000000010',
    code: 'SALES_MANAGER',
    name: 'Sales Manager',
    description: 'Manages the sales function',
    is_assignable_to_agent: false,
    permission_set_ids: ['019103b1-6e2a-7c3d-9a1b-000000000020'],
    status: 'active' as const,
  }

  it('accepts a well-formed role', () => {
    expect(RoleSchema.safeParse(validRole).success).toBe(true)
  })

  it('RoleCreateRequestSchema omits server-managed fields', () => {
    const shape = RoleCreateRequestSchema.shape as Record<string, unknown>
    expect(shape.id).toBeUndefined()
    expect(shape.trace_id).toBeUndefined()
    expect(shape.permission_set_ids).toBeDefined()
  })
})

describe('KRN-03 contract — permission_set (KRN-03-FR-001)', () => {
  it('accepts a well-formed permission_set with a {entity, action, scope} grant', () => {
    const valid = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000020',
      code: 'PS_SALES_READ',
      name: 'Sales read',
      grants: [{ entity_ref: '019103b1-6e2a-7c3d-9a1b-000000000030', action: 'read' as const, scope_rule_id: '019103b1-6e2a-7c3d-9a1b-000000000040' }],
    }
    expect(PermissionSetSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects an invalid action outside the FR-001 vocabulary', () => {
    const invalid = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000021',
      code: 'PS_BAD',
      name: 'Bad',
      grants: [{ entity_ref: '019103b1-6e2a-7c3d-9a1b-000000000030', action: 'destroy', scope_rule_id: null }],
    }
    expect(PermissionSetSchema.safeParse(invalid).success).toBe(false)
  })
})

describe('KRN-03 contract — permission_grant', () => {
  const base = {
    ...baseUniversal,
    id: '019103b1-6e2a-7c3d-9a1b-000000000050',
    subject_type: 'user' as const,
    subject_id: '019103b1-6e2a-7c3d-9a1b-000000000060',
    scope_override_id: null,
    granted_at: now,
    granted_by: actor,
    expires_at: null,
    status: 'active' as const,
  }

  it('accepts a grant with role_id set and permission_set_id null', () => {
    expect(PermissionGrantSchema.safeParse({ ...base, role_id: '019103b1-6e2a-7c3d-9a1b-000000000070', permission_set_id: null }).success).toBe(true)
  })

  it('accepts a grant with permission_set_id set and role_id null', () => {
    expect(PermissionGrantSchema.safeParse({ ...base, role_id: null, permission_set_id: '019103b1-6e2a-7c3d-9a1b-000000000080' }).success).toBe(true)
  })

  it('rejects a grant with neither role_id nor permission_set_id (KRN-03.md §4.1)', () => {
    expect(PermissionGrantSchema.safeParse({ ...base, role_id: null, permission_set_id: null }).success).toBe(false)
  })
})

describe('KRN-03 contract — data_scope_rule (KRN-03-FR-002)', () => {
  it('accepts every declared scope_type with its required companion field', () => {
    const orgUnit = { ...baseUniversal, id: '019103b1-6e2a-7c3d-9a1b-000000000090', scope_type: 'org_unit' as const, org_unit_id: '019103b1-6e2a-7c3d-9a1b-0000000000a0', entity_scope_id: null, expression: null, applies_to_entity_ref: null, status: 'active' as const }
    expect(DataScopeRuleSchema.safeParse(orgUnit).success).toBe(true)

    const ruleBased = { ...orgUnit, id: '019103b1-6e2a-7c3d-9a1b-0000000000a1', scope_type: 'rule_based' as const, org_unit_id: null, expression: { field: 'party.owner_user_id', operator: 'eq' as const, value: 'actor.id' } }
    expect(DataScopeRuleSchema.safeParse(ruleBased).success).toBe(true)
  })

  it('rejects rule_based with no expression', () => {
    const invalid = { ...baseUniversal, id: '019103b1-6e2a-7c3d-9a1b-0000000000a2', scope_type: 'rule_based' as const, org_unit_id: null, entity_scope_id: null, expression: null, applies_to_entity_ref: null, status: 'active' as const }
    expect(DataScopeRuleSchema.safeParse(invalid).success).toBe(false)
  })

  it('rejects org_unit with no org_unit_id', () => {
    const invalid = { ...baseUniversal, id: '019103b1-6e2a-7c3d-9a1b-0000000000a3', scope_type: 'org_unit' as const, org_unit_id: null, entity_scope_id: null, expression: null, applies_to_entity_ref: null, status: 'active' as const }
    expect(DataScopeRuleSchema.safeParse(invalid).success).toBe(false)
  })
})

describe('KRN-03 contract — field_policy (KRN-03-FR-003)', () => {
  const base = { ...baseUniversal, id: '019103b1-6e2a-7c3d-9a1b-0000000000b0', entity_ref: '019103b1-6e2a-7c3d-9a1b-0000000000b1', field_ref: '019103b1-6e2a-7c3d-9a1b-0000000000b2', role_id: '019103b1-6e2a-7c3d-9a1b-0000000000b3', status: 'active' as const }

  it('requires mask_strategy iff policy is masked', () => {
    expect(FieldPolicySchema.safeParse({ ...base, policy: 'masked', mask_strategy: null }).success).toBe(false)
    expect(FieldPolicySchema.safeParse({ ...base, policy: 'masked', mask_strategy: 'partial' }).success).toBe(true)
    expect(FieldPolicySchema.safeParse({ ...base, policy: 'hidden', mask_strategy: null }).success).toBe(true)
  })
})

describe('KRN-03 contract — delegation (KRN-03-FR-004)', () => {
  it('accepts a bounded delegation, rejects an open-ended one', () => {
    const bounded = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-0000000000c0',
      from_subject_id: '019103b1-6e2a-7c3d-9a1b-0000000000c1',
      to_subject_id: '019103b1-6e2a-7c3d-9a1b-0000000000c2',
      permission_set_id: null,
      period: { from: '2026-09-14', to: '2026-09-19', is_open_ended: false },
      reason: 'annual leave',
      status: 'pending' as const,
    }
    expect(DelegationSchema.safeParse(bounded).success).toBe(true)
    expect(DelegationSchema.safeParse({ ...bounded, period: { from: '2026-09-14', to: null, is_open_ended: true } }).success).toBe(false)
  })

  it('DelegationCreateRequestSchema omits status', () => {
    const shape = DelegationCreateRequestSchema.shape as Record<string, unknown>
    expect(shape.status).toBeUndefined()
  })
})

describe('KRN-03 contract — effective-permissions response (KRN-03-DR-002/003)', () => {
  it('uses the same shape for a user and an agent_identity subject', () => {
    const forUser = { subject_type: 'user' as const, subject_id: '019103b1-6e2a-7c3d-9a1b-0000000000d0', grants: [{ entity_ref: '019103b1-6e2a-7c3d-9a1b-0000000000d1', action: 'read' as const, scope_rule_id: null }] }
    const forAgent = { subject_type: 'agent_identity' as const, subject_id: '019103b1-6e2a-7c3d-9a1b-0000000000d2', grants: [] }
    expect(EffectivePermissionsResponseSchema.safeParse(forUser).success).toBe(true)
    expect(EffectivePermissionsResponseSchema.safeParse(forAgent).success).toBe(true)
  })
})

describe('KRN-03 contract — events (P-08 envelope)', () => {
  it('validates access.role.created', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-0000000000e1',
      tenant_id: baseUniversal.tenant_id,
      entity_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      event_name: 'access.role.created',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'role',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      payload: { role_id: '019103b1-6e2a-7c3d-9a1b-000000000010', code: 'SALES_MANAGER' },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-0000000000e2',
      trace_id: '019103b1-6e2a-7c3d-9a1b-0000000000e3',
      reversal_handle: null,
    }
    expect(RoleCreatedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates access.role.granted', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-0000000000f1',
      tenant_id: baseUniversal.tenant_id,
      entity_id: '019103b1-6e2a-7c3d-9a1b-000000000050',
      event_name: 'access.role.granted',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'permission_grant',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000050',
      payload: { permission_grant_id: '019103b1-6e2a-7c3d-9a1b-000000000050', subject_type: 'user', subject_id: '019103b1-6e2a-7c3d-9a1b-000000000060' },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-0000000000f2',
      trace_id: '019103b1-6e2a-7c3d-9a1b-0000000000f3',
      reversal_handle: null,
    }
    expect(RoleGrantedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates access.delegation.created (added during implementation)', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-0000000000a1',
      tenant_id: baseUniversal.tenant_id,
      entity_id: '019103b1-6e2a-7c3d-9a1b-0000000000c0',
      event_name: 'access.delegation.created',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'delegation',
      subject_id: '019103b1-6e2a-7c3d-9a1b-0000000000c0',
      payload: { delegation_id: '019103b1-6e2a-7c3d-9a1b-0000000000c0', from_subject_id: '019103b1-6e2a-7c3d-9a1b-0000000000c1', to_subject_id: '019103b1-6e2a-7c3d-9a1b-0000000000c2' },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-0000000000a2',
      trace_id: '019103b1-6e2a-7c3d-9a1b-0000000000a3',
      reversal_handle: null,
    }
    expect(DelegationCreatedEventSchema.safeParse(event).success).toBe(true)
  })
})

describe('KRN-03 contract — error shape reused from @mahisys/shared', () => {
  it('is unchanged (sanity check for the shared import)', () => {
    expect(ErrorResponseSchema.safeParse({ error: { code: 'ROLE_NOT_FOUND', message: 'x', trace_id: '019103b1-6e2a-7c3d-9a1b-000000000099' } }).success).toBe(true)
  })
})
