/**
 * KRN-03 API request/response contracts — KRN-03.md §10.
 */
import { z } from 'zod'
import { cursorListRequest, cursorListResponse, uuid } from '@mahisys/shared'
import { RoleSchema } from './role.js'
import { PermissionSetSchema } from './permission-set.js'
import { PermissionGrantObjectSchema, PermissionGrantSchema } from './permission-grant.js'
import { DataScopeRuleObjectSchema, DataScopeRuleSchema } from './data-scope-rule.js'
import { FieldPolicyObjectSchema, FieldPolicySchema } from './field-policy.js'
import { DelegationObjectSchema, DelegationSchema } from './delegation.js'
import { PermissionActionSchema } from './permission-set.js'

const OMIT_SERVER_MANAGED = {
  id: true, ext: true, created_at: true, created_by: true,
  updated_at: true, updated_by: true, version: true, deleted_at: true,
  deleted_by: true, source: true, trace_id: true,
} as const

// CRUD /api/v1/access/roles
export const RoleCreateRequestSchema = RoleSchema.omit(OMIT_SERVER_MANAGED)
export const RoleListResponseSchema = cursorListResponse(RoleSchema)

// CRUD /api/v1/access/permission-sets
export const PermissionSetCreateRequestSchema = PermissionSetSchema.omit(OMIT_SERVER_MANAGED)
export const PermissionSetListResponseSchema = cursorListResponse(PermissionSetSchema)

// CRUD /api/v1/access/permission-grants
export const PermissionGrantCreateRequestSchema = PermissionGrantObjectSchema.omit({ ...OMIT_SERVER_MANAGED, status: true })
export const PermissionGrantListResponseSchema = cursorListResponse(PermissionGrantSchema)

// CRUD /api/v1/access/scopes
export const DataScopeRuleCreateRequestSchema = DataScopeRuleObjectSchema.omit({ ...OMIT_SERVER_MANAGED, status: true })
export const DataScopeRuleListResponseSchema = cursorListResponse(DataScopeRuleSchema)

// CRUD /api/v1/access/field-policies
export const FieldPolicyCreateRequestSchema = FieldPolicyObjectSchema.omit({ ...OMIT_SERVER_MANAGED, status: true })
export const FieldPolicyListResponseSchema = cursorListResponse(FieldPolicySchema)

// CRUD /api/v1/access/delegations
export const DelegationCreateRequestSchema = DelegationObjectSchema.omit({ ...OMIT_SERVER_MANAGED, status: true })
export const DelegationListResponseSchema = cursorListResponse(DelegationSchema)

// GET /api/v1/access/effective-permissions
export const EffectivePermissionsRequestSchema = z.object({
  user_id: uuid.optional(),
  agent_id: uuid.optional(),
  service_account_id: uuid.optional(),
})
export const EffectiveGrantSchema = z.object({
  entity_ref: uuid,
  action: PermissionActionSchema,
  scope_rule_id: uuid.nullable(),
})
export const EffectivePermissionsResponseSchema = z.object({
  subject_type: z.enum(['user', 'agent_identity', 'service_account']),
  subject_id: uuid,
  grants: z.array(EffectiveGrantSchema),
})

export const RoleListRequestSchema = cursorListRequest(z.object({ namespace: z.string().optional(), status: z.string().optional() }))
