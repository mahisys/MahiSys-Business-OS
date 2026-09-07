/**
 * KRN-01 event contracts — KRN-01.md §12. Each event's payload schema is
 * wrapped in the P-08 event envelope (`@mahisys/shared`'s `eventEnvelope`).
 */
import { z } from 'zod'
import { eventEnvelope, uuid } from '@mahisys/shared'
import { IsolationTierSchema } from './tenant.js'
import { FiscalPeriodStatusSchema } from './fiscal-period.js'

export const TenantProvisionedPayloadSchema = z.object({
  tenant_id: uuid,
  manifest_id: uuid,
  plan_id: uuid,
})
export const TenantProvisionedEventSchema = eventEnvelope(
  'core.tenant.provisioned',
  TenantProvisionedPayloadSchema,
)

export const TenantActivatedPayloadSchema = z.object({ tenant_id: uuid })
export const TenantActivatedEventSchema = eventEnvelope('core.tenant.activated', TenantActivatedPayloadSchema)

export const TenantSuspendedPayloadSchema = z.object({ tenant_id: uuid, reason: z.string().optional() })
export const TenantSuspendedEventSchema = eventEnvelope('core.tenant.suspended', TenantSuspendedPayloadSchema)

export const TenantClosedPayloadSchema = z.object({ tenant_id: uuid, reason: z.string().optional() })
export const TenantClosedEventSchema = eventEnvelope('core.tenant.closed', TenantClosedPayloadSchema)

// KRN-01-DR-001 acceptance sample: carries {previous_tier, new_tier}.
export const TenantIsolationChangedPayloadSchema = z.object({
  tenant_id: uuid,
  previous_tier: IsolationTierSchema,
  new_tier: IsolationTierSchema,
})
export const TenantIsolationChangedEventSchema = eventEnvelope(
  'core.tenant.isolation_changed',
  TenantIsolationChangedPayloadSchema,
)

export const LegalEntityCreatedPayloadSchema = z.object({ legal_entity_id: uuid, tenant_id: uuid })
export const LegalEntityCreatedEventSchema = eventEnvelope(
  'core.legal_entity.created',
  LegalEntityCreatedPayloadSchema,
)

export const LegalEntityUpdatedPayloadSchema = z.object({
  legal_entity_id: uuid,
  changed_fields: z.array(z.string()),
})
export const LegalEntityUpdatedEventSchema = eventEnvelope(
  'core.legal_entity.updated',
  LegalEntityUpdatedPayloadSchema,
)

export const OrgUnitCreatedPayloadSchema = z.object({ org_unit_id: uuid, entity_id: uuid })
export const OrgUnitCreatedEventSchema = eventEnvelope('core.org_unit.created', OrgUnitCreatedPayloadSchema)

export const CostCentreCreatedPayloadSchema = z.object({ cost_centre_id: uuid, entity_id: uuid })
export const CostCentreCreatedEventSchema = eventEnvelope(
  'core.cost_centre.created',
  CostCentreCreatedPayloadSchema,
)

export const FiscalPeriodClosedPayloadSchema = z.object({
  fiscal_period_id: uuid,
  entity_id: uuid,
  status: FiscalPeriodStatusSchema,
})
export const FiscalPeriodClosedEventSchema = eventEnvelope(
  'core.fiscal_period.closed',
  FiscalPeriodClosedPayloadSchema,
)

export const FiscalPeriodReopenedPayloadSchema = z.object({ fiscal_period_id: uuid, entity_id: uuid })
export const FiscalPeriodReopenedEventSchema = eventEnvelope(
  'core.fiscal_period.reopened',
  FiscalPeriodReopenedPayloadSchema,
)
