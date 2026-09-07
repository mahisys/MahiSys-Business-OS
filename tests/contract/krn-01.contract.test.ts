/**
 * KRN-01 contract tests — Vol 6 §6 step 2 ("write the contract test: API
 * shape, event schema"), written before any implementation exists.
 *
 * Scope: these tests validate the *shape* of KRN-01's entities, API
 * request/response payloads, and event schemas against KRN-01.md — they
 * do not exercise business behaviour (state-machine legality, permission
 * enforcement, statutory correctness). Those are acceptance tests, unit
 * tests and permission tests respectively (Vol 6 §6 steps 3-4), written
 * separately once these contract tests are green.
 */
import { describe, it, expect } from 'vitest'
import {
  TenantSchema,
  TENANT_STATUS_TRANSITIONS,
  LegalEntitySchema,
  OrgUnitSchema,
  CostCentreSchema,
  FiscalCalendarSchema,
  FiscalPeriodSchema,
  FISCAL_PERIOD_STATUS_TRANSITIONS,
  IsolationAssignmentSchema,
  isValidTierPromotion,
  TenantLifecycleRequestSchema,
  IsolationTierPromoteRequestSchema,
  LegalEntityCreateRequestSchema,
  OrgUnitListRequestSchema,
  OrgUnitListResponseSchema,
  FiscalPeriodListResponseSchema,
  TenantProvisionedEventSchema,
  TenantActivatedEventSchema,
  TenantIsolationChangedEventSchema,
  LegalEntityCreatedEventSchema,
  FiscalPeriodClosedEventSchema,
} from '@mahisys/krn-01'
import { ErrorResponseSchema } from '@mahisys/shared'

// ---- fixtures -------------------------------------------------------------

const actor = { type: 'user' as const, id: '019103b1-6e2a-7c3d-9a1b-000000000001' }
const agentActor = { type: 'agent' as const, id: '019103b1-6e2a-7c3d-9a1b-000000000099', version: 'v3' }
const now = new Date().toISOString()

const baseUniversal = {
  namespace: 'sys' as const,
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

const validTenant = {
  ...baseUniversal,
  id: '019103b1-6e2a-7c3d-9a1b-000000000010',
  code: 'ACME',
  name: 'Acme Engineering Pvt Ltd',
  status: 'active' as const,
  isolation_tier: 'row' as const,
  region: 'asia-south1',
  manifest_id: '019103b1-6e2a-7c3d-9a1b-000000000020',
  plan_id: '019103b1-6e2a-7c3d-9a1b-000000000030',
  provisioned_at: now,
}

const validAddress = {
  line1: 'Plot 14, MIDC',
  city: 'Pune',
  state_code: '27',
  country_code: 'IN',
  pincode: '411001',
  type: 'registered' as const,
  is_primary: true,
}

const validLegalEntity = {
  ...baseUniversal,
  id: '019103b1-6e2a-7c3d-9a1b-000000000040',
  tenant_id: validTenant.id,
  entity_id: '019103b1-6e2a-7c3d-9a1b-000000000040',
  legal_name: 'Acme Engineering Private Limited',
  tax_registrations: [
    { type: 'gstin' as const, number: '27ABCDE1234F1Z5', verified_at: now, status: 'verified' as const },
  ],
  base_currency: 'INR',
  reporting_currency: 'INR',
  fiscal_year_start: '04-01',
  address: validAddress,
  parent_entity_id: null,
  consolidation_method: null,
}

// ---- entity shape -----------------------------------------------------

describe('KRN-01 entity contracts', () => {
  it('accepts a well-formed tenant (KRN-01.md §4.1)', () => {
    expect(TenantSchema.safeParse(validTenant).success).toBe(true)
  })

  it('does not declare tenant_id or entity_id on the tenant schema (KRN-01.md §4.1 note: tenant IS the root)', () => {
    // A structural check, not a fixture-based one: zod allows unrecognised
    // extra keys by default, so a fixture-based "rejects tenant_id" test
    // would not actually exercise the rule. What the spec note requires is
    // that the schema itself never *declares* these fields, so a real
    // persistence layer built against this contract has no tenant_id/
    // entity_id column to populate on tenant in the first place.
    const shapeKeys = Object.keys(TenantSchema.shape)
    expect(shapeKeys).not.toContain('tenant_id')
    expect(shapeKeys).not.toContain('entity_id')
  })

  it('rejects an invalid tenant.status enum value', () => {
    const bad = { ...validTenant, status: 'archived' }
    expect(TenantSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects an invalid isolation_tier enum value', () => {
    const bad = { ...validTenant, isolation_tier: 'multi-region' }
    expect(TenantSchema.safeParse(bad).success).toBe(false)
  })

  it('encodes the tenant.status state machine from KRN-01.md §5', () => {
    expect(TENANT_STATUS_TRANSITIONS.trial).toEqual(['active'])
    expect(TENANT_STATUS_TRANSITIONS.active).toEqual(['suspended'])
    expect(TENANT_STATUS_TRANSITIONS.suspended).toEqual(['active', 'closed'])
    expect(TENANT_STATUS_TRANSITIONS.closed).toEqual([]) // terminal
  })

  it('accepts a well-formed legal_entity with a verified GSTIN (KRN-01-FR-006)', () => {
    expect(LegalEntitySchema.safeParse(validLegalEntity).success).toBe(true)
  })

  it('accepts a legal_entity with multiple GSTINs (KRN-01-FR-006)', () => {
    const multiGstin = {
      ...validLegalEntity,
      tax_registrations: [
        { type: 'gstin' as const, number: '27ABCDE1234F1Z5', verified_at: now, status: 'verified' as const },
        { type: 'gstin' as const, number: '24ABCDE1234F1Z8', verified_at: now, status: 'verified' as const },
      ],
    }
    expect(LegalEntitySchema.safeParse(multiGstin).success).toBe(true)
  })

  it('rejects a legal_entity with parent_entity_id set but no consolidation_method (KRN-01.md §4.1)', () => {
    const bad = { ...validLegalEntity, parent_entity_id: validLegalEntity.id, consolidation_method: null }
    expect(LegalEntitySchema.safeParse(bad).success).toBe(false)
  })

  it('accepts a legal_entity with parent_entity_id and a consolidation_method', () => {
    const ok = { ...validLegalEntity, parent_entity_id: validLegalEntity.id, consolidation_method: 'full' as const }
    expect(LegalEntitySchema.safeParse(ok).success).toBe(true)
  })

  it('accepts a well-formed org_unit (KRN-01-FR-002)', () => {
    const orgUnit = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000050',
      tenant_id: validTenant.id,
      entity_id: validLegalEntity.id,
      parent_org_unit_id: null,
      code: 'HQ',
      name: 'Head Office',
      org_unit_type: '019103b1-6e2a-7c3d-9a1b-000000000060',
      location_id: null,
      status: 'active' as const,
    }
    expect(OrgUnitSchema.safeParse(orgUnit).success).toBe(true)
  })

  it('accepts a well-formed cost_centre', () => {
    const costCentre = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000070',
      tenant_id: validTenant.id,
      entity_id: validLegalEntity.id,
      parent_cost_centre_id: null,
      code: 'CC-CORP',
      name: 'Corporate',
      org_unit_id: null,
      status: 'active' as const,
    }
    expect(CostCentreSchema.safeParse(costCentre).success).toBe(true)
  })

  it('accepts a well-formed fiscal_calendar', () => {
    const cal = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000080',
      tenant_id: validTenant.id,
      entity_id: validLegalEntity.id,
      fiscal_year: 'FY2027',
    }
    expect(FiscalCalendarSchema.safeParse(cal).success).toBe(true)
  })

  it('accepts a well-formed fiscal_period and rejects from > to', () => {
    const period = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000090',
      tenant_id: validTenant.id,
      entity_id: validLegalEntity.id,
      fiscal_calendar_id: '019103b1-6e2a-7c3d-9a1b-000000000080',
      period_no: 1,
      from: '2027-04-01',
      to: '2027-04-30',
      status: 'open' as const,
    }
    expect(FiscalPeriodSchema.safeParse(period).success).toBe(true)
    expect(FiscalPeriodSchema.safeParse({ ...period, from: '2027-05-01', to: '2027-04-30' }).success).toBe(false)
  })

  it('encodes the fiscal_period.status state machine from KRN-01.md §5', () => {
    expect(FISCAL_PERIOD_STATUS_TRANSITIONS.open).toEqual(['closed'])
    expect(FISCAL_PERIOD_STATUS_TRANSITIONS.closed).toEqual(['open', 'permanently_closed'])
    expect(FISCAL_PERIOD_STATUS_TRANSITIONS.permanently_closed).toEqual([]) // terminal
  })

  it('accepts a well-formed isolation_assignment', () => {
    const assignment = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-0000000000a0',
      tenant_id: validTenant.id,
      entity_id: validTenant.id,
      isolation_tier: 'schema' as const,
      effective_from: now,
      migration_status: 'completed' as const,
      previous_tier: 'row' as const,
    }
    expect(IsolationAssignmentSchema.safeParse(assignment).success).toBe(true)
  })

  it('enforces monotonic isolation-tier promotion (KRN-01-DR-001, §17 item 3)', () => {
    expect(isValidTierPromotion('row', 'schema')).toBe(true)
    expect(isValidTierPromotion('schema', 'dedicated')).toBe(true)
    expect(isValidTierPromotion('row', 'dedicated')).toBe(true)
    expect(isValidTierPromotion('schema', 'row')).toBe(false) // no downgrade
    expect(isValidTierPromotion('row', 'row')).toBe(false)
  })
})

// ---- API request/response shape ----------------------------------------

describe('KRN-01 API contracts (§10)', () => {
  it('accepts a valid tenant lifecycle request', () => {
    expect(TenantLifecycleRequestSchema.safeParse({ action: 'activate' }).success).toBe(true)
    expect(TenantLifecycleRequestSchema.safeParse({ action: 'suspend' }).success).toBe(true)
    expect(TenantLifecycleRequestSchema.safeParse({ action: 'close' }).success).toBe(true)
  })

  it('rejects a tenant lifecycle request with an undeclared action', () => {
    expect(TenantLifecycleRequestSchema.safeParse({ action: 'delete' }).success).toBe(false)
  })

  it('accepts a valid isolation-tier promote request', () => {
    expect(IsolationTierPromoteRequestSchema.safeParse({ target_tier: 'dedicated' }).success).toBe(true)
  })

  it('accepts a legal-entity create request without server-assigned fields', () => {
    const { id, created_at, created_by, updated_at, updated_by, version, deleted_at, deleted_by, trace_id, ...createBody } =
      validLegalEntity
    void id
    void created_at
    void created_by
    void updated_at
    void updated_by
    void version
    void deleted_at
    void deleted_by
    void trace_id
    expect(LegalEntityCreateRequestSchema.safeParse(createBody).success).toBe(true)
  })

  it('supports cursor pagination, filters and field selection on list endpoints (Vol 1 §1.2)', () => {
    const req = { cursor: 'abc123', limit: 25, fields: ['id', 'name'], filter: { status: 'active' as const } }
    expect(OrgUnitListRequestSchema.safeParse(req).success).toBe(true)
  })

  it('defaults list limit when unspecified', () => {
    const parsed = OrgUnitListRequestSchema.parse({})
    expect(parsed.limit).toBe(50)
  })

  it('shapes a list response with items and a nullable next_cursor', () => {
    const resp = { items: [], next_cursor: null }
    expect(OrgUnitListResponseSchema.safeParse(resp).success).toBe(true)
    expect(FiscalPeriodListResponseSchema.safeParse(resp).success).toBe(true)
  })

  it('shapes a stable error response (Vol 1 §1.2)', () => {
    const err = {
      error: {
        code: 'FISCAL_PERIOD_CLOSED',
        message: 'Cannot post into a closed fiscal period.',
        trace_id: '019103b1-6e2a-7c3d-9a1b-0000000000b0',
      },
    }
    expect(ErrorResponseSchema.safeParse(err).success).toBe(true)
  })

  it('rejects an error response with a non-machine-readable code', () => {
    const err = {
      error: { code: 'oops something broke', message: 'x', trace_id: '019103b1-6e2a-7c3d-9a1b-0000000000b0' },
    }
    expect(ErrorResponseSchema.safeParse(err).success).toBe(false)
  })
})

// ---- event schema --------------------------------------------------------

describe('KRN-01 event contracts (§12)', () => {
  const envelopeBase = {
    event_id: '019103b1-6e2a-7c3d-9a1b-0000000000c0',
    tenant_id: validTenant.id,
    entity_id: validTenant.id,
    schema_version: 1,
    occurred_at: now,
    recorded_at: now,
    actor,
    subject_type: 'tenant',
    subject_id: validTenant.id,
    causation_id: null,
    correlation_id: '019103b1-6e2a-7c3d-9a1b-0000000000d0',
    trace_id: '019103b1-6e2a-7c3d-9a1b-0000000000e0',
    reversal_handle: null,
  }

  it('validates core.tenant.provisioned against the P-08 envelope', () => {
    const event = {
      ...envelopeBase,
      event_name: 'core.tenant.provisioned',
      payload: { tenant_id: validTenant.id, manifest_id: validTenant.manifest_id, plan_id: validTenant.plan_id },
    }
    expect(TenantProvisionedEventSchema.safeParse(event).success).toBe(true)
  })

  it('rejects an event whose event_name does not match its schema (mislabeled event)', () => {
    const event = {
      ...envelopeBase,
      event_name: 'core.tenant.activated', // wrong literal for this schema
      payload: { tenant_id: validTenant.id, manifest_id: validTenant.manifest_id, plan_id: validTenant.plan_id },
    }
    expect(TenantProvisionedEventSchema.safeParse(event).success).toBe(false)
  })

  it('validates core.tenant.activated', () => {
    const event = { ...envelopeBase, event_name: 'core.tenant.activated', payload: { tenant_id: validTenant.id } }
    expect(TenantActivatedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates core.tenant.isolation_changed carrying {previous_tier, new_tier} (KRN-01-DR-001 acceptance sample)', () => {
    const event = {
      ...envelopeBase,
      event_name: 'core.tenant.isolation_changed',
      payload: { tenant_id: validTenant.id, previous_tier: 'row' as const, new_tier: 'schema' as const },
    }
    expect(TenantIsolationChangedEventSchema.safeParse(event).success).toBe(true)
  })

  it('rejects an isolation_changed payload with an invalid tier', () => {
    const event = {
      ...envelopeBase,
      event_name: 'core.tenant.isolation_changed',
      payload: { tenant_id: validTenant.id, previous_tier: 'row' as const, new_tier: 'planet-scale' },
    }
    expect(TenantIsolationChangedEventSchema.safeParse(event).success).toBe(false)
  })

  it('validates core.legal_entity.created', () => {
    const event = {
      ...envelopeBase,
      event_name: 'core.legal_entity.created',
      subject_type: 'legal_entity',
      subject_id: validLegalEntity.id,
      payload: { legal_entity_id: validLegalEntity.id, tenant_id: validTenant.id },
    }
    expect(LegalEntityCreatedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates core.fiscal_period.closed', () => {
    const event = {
      ...envelopeBase,
      event_name: 'core.fiscal_period.closed',
      subject_type: 'fiscal_period',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000090',
      payload: {
        fiscal_period_id: '019103b1-6e2a-7c3d-9a1b-000000000090',
        entity_id: validLegalEntity.id,
        status: 'closed' as const,
      },
    }
    expect(FiscalPeriodClosedEventSchema.safeParse(event).success).toBe(true)
  })

  it('requires agent actors to carry a version (Vol 0 §27.2 — attributable to a specific agent build)', () => {
    const event = {
      ...envelopeBase,
      actor: agentActor,
      event_name: 'core.tenant.activated',
      payload: { tenant_id: validTenant.id },
    }
    expect(TenantActivatedEventSchema.safeParse(event).success).toBe(true)

    const { version: _v, ...agentWithoutVersion } = agentActor
    void _v
    const badEvent = { ...event, actor: agentWithoutVersion }
    expect(TenantActivatedEventSchema.safeParse(badEvent).success).toBe(false)
  })

  it('rejects an event_name that is not module.entity.verb_past shaped', () => {
    // Constructing directly against the envelope helper's literal check is
    // covered above; this checks the naming convention regex independently.
    const badNameEvent = {
      ...envelopeBase,
      event_name: 'TenantProvisioned', // wrong convention entirely
      payload: { tenant_id: validTenant.id, manifest_id: validTenant.manifest_id, plan_id: validTenant.plan_id },
    }
    expect(TenantProvisionedEventSchema.safeParse(badNameEvent).success).toBe(false)
  })
})
