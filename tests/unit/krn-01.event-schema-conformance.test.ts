/**
 * KRN-01 event-schema conformance — Vol 6 §5 Definition of Done: "Events
 * emitted match the declared schema exactly." The contract tests
 * (tests/contract/krn-01.contract.test.ts) validate the *declared* event
 * schemas against hand-built fixtures; this file closes the other half —
 * it runs the real service functions and validates what they *actually
 * emit* against those same Zod schemas, so drift between the two can't
 * go unnoticed.
 */
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import {
  createTenant,
  transitionTenantLifecycle,
  promoteIsolationTier,
  createOrgUnit,
  createCostCentre,
  closeFiscalPeriod,
  reopenFiscalPeriod,
  createFiscalCalendar,
  createFiscalPeriod,
} from '@mahisys/krn-01'
import {
  TenantProvisionedEventSchema,
  TenantActivatedEventSchema,
  TenantIsolationChangedEventSchema,
  LegalEntityCreatedEventSchema,
  OrgUnitCreatedEventSchema,
  CostCentreCreatedEventSchema,
  FiscalPeriodClosedEventSchema,
  FiscalPeriodReopenedEventSchema,
} from '@mahisys/krn-01'
import { newStore, makeTenant, makeLegalEntity, sysActor, userActor } from './krn-01.fixtures.js'

const SCHEMA_BY_EVENT_NAME: Record<string, z.ZodTypeAny> = {
  'core.tenant.provisioned': TenantProvisionedEventSchema,
  'core.tenant.activated': TenantActivatedEventSchema,
  'core.tenant.isolation_changed': TenantIsolationChangedEventSchema,
  'core.legal_entity.created': LegalEntityCreatedEventSchema,
  'core.org_unit.created': OrgUnitCreatedEventSchema,
  'core.cost_centre.created': CostCentreCreatedEventSchema,
  'core.fiscal_period.closed': FiscalPeriodClosedEventSchema,
  'core.fiscal_period.reopened': FiscalPeriodReopenedEventSchema,
}

describe('KRN-01 — every emitted event validates against its declared Zod schema', () => {
  it('exercises every KRN-01 mutation and checks each resulting event', () => {
    const store = newStore()

    const tenant = makeTenant(store) // core.tenant.provisioned
    transitionTenantLifecycle(store, tenant.id, 'activate', userActor, 'PR-21') // core.tenant.activated
    promoteIsolationTier(store, tenant.id, 'schema', sysActor, 'PR-21') // core.tenant.isolation_changed
    const e1 = makeLegalEntity(store, tenant.id) // core.legal_entity.created
    const orgUnit = createOrgUnit(
      store,
      { tenant_id: tenant.id, entity_id: e1.id, parent_org_unit_id: null, code: 'HQ', name: 'HQ', org_unit_type: 'division', location_id: null, status: 'active' },
      sysActor,
      'PR-21',
    ) // core.org_unit.created
    createCostCentre(
      store,
      { tenant_id: tenant.id, entity_id: e1.id, parent_cost_centre_id: null, code: 'CC', name: 'CC', org_unit_id: orgUnit.id, status: 'active' },
      sysActor,
      'PR-21',
    ) // core.cost_centre.created
    const cal = createFiscalCalendar(store, { tenant_id: tenant.id, entity_id: e1.id, fiscal_year: 'FY2027' }, sysActor)
    const period = createFiscalPeriod(store, { tenant_id: tenant.id, fiscal_calendar_id: cal.id, entity_id: e1.id, period_no: 1, from: '2027-01-01', to: '2027-01-31', status: 'open' }, sysActor)
    closeFiscalPeriod(store, period.id, userActor, 'PR-16') // core.fiscal_period.closed
    reopenFiscalPeriod(store, period.id, userActor, 'PR-16') // core.fiscal_period.reopened

    expect(store.events.length).toBeGreaterThanOrEqual(8)

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
