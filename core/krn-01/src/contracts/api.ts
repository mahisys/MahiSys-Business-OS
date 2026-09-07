/**
 * KRN-01 API surface contract — KRN-01.md §10.
 */
import { z } from 'zod'
import { cursorListRequest, cursorListResponse, uuid } from '@mahisys/shared'
import { TenantSchema, IsolationTierSchema } from './tenant.js'
import { LegalEntityObjectSchema } from './legal-entity.js'
import { OrgUnitSchema } from './org-unit.js'
import { CostCentreSchema } from './cost-centre.js'
import { FiscalPeriodSchema, FiscalPeriodStatusSchema } from './fiscal-period.js'
import { IsolationAssignmentSchema } from './isolation-assignment.js'

// POST /api/v1/core/tenants/{id}/lifecycle — KRN-01-FR-004: process-governed,
// never a direct status write.
export const TenantLifecycleActionSchema = z.enum(['activate', 'suspend', 'close'])
export const TenantLifecycleRequestSchema = z.object({
  action: TenantLifecycleActionSchema,
})
export const TenantLifecycleResponseSchema = TenantSchema

// POST /api/v1/core/tenants/{id}/isolation-tier/promote
export const IsolationTierPromoteRequestSchema = z.object({
  target_tier: IsolationTierSchema,
})
export const IsolationTierPromoteResponseSchema = IsolationAssignmentSchema

// CRUD /api/v1/core/legal-entities
export const LegalEntityCreateRequestSchema = LegalEntityObjectSchema.omit({
  id: true,
  created_at: true,
  created_by: true,
  updated_at: true,
  updated_by: true,
  version: true,
  deleted_at: true,
  deleted_by: true,
  trace_id: true,
}).refine(
  (e) => e.parent_entity_id === null || e.consolidation_method !== null,
  { message: 'consolidation_method is required when parent_entity_id is set (KRN-01.md §4.1)' },
)

// CRUD /api/v1/core/org-units
export const OrgUnitCreateRequestSchema = OrgUnitSchema.omit({
  id: true,
  created_at: true,
  created_by: true,
  updated_at: true,
  updated_by: true,
  version: true,
  deleted_at: true,
  deleted_by: true,
  trace_id: true,
})
export const OrgUnitListFilterSchema = z.object({
  entity_id: uuid.optional(),
  parent_org_unit_id: uuid.optional(),
  status: z.enum(['active', 'inactive']).optional(),
})
export const OrgUnitListRequestSchema = cursorListRequest(OrgUnitListFilterSchema)
export const OrgUnitListResponseSchema = cursorListResponse(OrgUnitSchema)

// CRUD /api/v1/core/cost-centres
export const CostCentreCreateRequestSchema = CostCentreSchema.omit({
  id: true,
  created_at: true,
  created_by: true,
  updated_at: true,
  updated_by: true,
  version: true,
  deleted_at: true,
  deleted_by: true,
  trace_id: true,
})

// GET /api/v1/core/fiscal-periods
export const FiscalPeriodListFilterSchema = z.object({
  entity_id: uuid.optional(),
  fiscal_year: z.string().optional(),
  status: FiscalPeriodStatusSchema.optional(),
})
export const FiscalPeriodListRequestSchema = cursorListRequest(FiscalPeriodListFilterSchema)
export const FiscalPeriodListResponseSchema = cursorListResponse(FiscalPeriodSchema)

// POST /api/v1/core/fiscal-periods/{id}/close and /reopen — no request body,
// the id is a path param; response is the updated period.
export const FiscalPeriodCloseResponseSchema = FiscalPeriodSchema
export const FiscalPeriodReopenResponseSchema = FiscalPeriodSchema
