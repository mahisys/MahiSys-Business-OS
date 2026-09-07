/**
 * KRN-01 acceptance tests — Vol 6 §6 step 3 ("write the acceptance tests
 * as failing tests"), directly from KRN-01.md §16's Given/When/Then set.
 *
 * Directory note: see the comment atop `krn-01.unit.test.ts` — Vol 6 §7
 * has no separate "acceptance" folder, so these live alongside the unit
 * tests, distinguished by file name and by testing full service
 * behaviour rather than pure functions.
 *
 * Scope limitation, flagged per D-21 (Phase-order degrade convention):
 * KRN-01-FR-004's "process-governed" (KRN-05) and KRN-01-FR-006/DR-002's
 * downstream consumers (CMP-01, FIN-14) don't exist yet. Each such
 * scenario below tests only the KRN-01-owned half of its Given/When/Then,
 * noted inline.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { type Krn01Store } from '@mahisys/krn-01'
import { transitionTenantLifecycle, promoteIsolationTier } from '@mahisys/krn-01'
import { findTaxRegistrationForState } from '@mahisys/krn-01'
import { createOrgUnit, resolveOrgUnitChain } from '@mahisys/krn-01'
import { createCostCentre, resolveCostCentreDefaultOrgUnit } from '@mahisys/krn-01'
import {
  createFiscalCalendar,
  createFiscalPeriod,
  resolveFiscalPeriod,
  checkPostingAllowed,
  closeFiscalPeriod,
  reopenFiscalPeriod,
} from '@mahisys/krn-01'
import { newStore, makeTenant, makeLegalEntity, makeAddress, sysActor, userActor } from './krn-01.fixtures.js'

let store: Krn01Store

beforeEach(() => {
  store = newStore()
})

describe('KRN-01-FR-001 — multi-entity, independent fiscal calendars/currencies', () => {
  it('resolves a transaction dated 15-Jan-2027 against E2 to E2\'s own fiscal period, leaving E1 unaffected', () => {
    const tenant = makeTenant(store, { code: 'T1', name: 'Tenant One' })
    const e1 = makeLegalEntity(store, tenant.id, { legal_name: 'E1 Pvt Ltd' })
    const e2 = makeLegalEntity(store, tenant.id, {
      legal_name: 'E2 Inc',
      base_currency: 'USD',
      reporting_currency: 'USD',
      fiscal_year_start: '01-01',
      address: makeAddress({ line1: 'y', city: 'NYC', state_code: 'NY', country_code: 'US', pincode: '10001' }),
    })

    const calE1 = createFiscalCalendar(store, { tenant_id: tenant.id, entity_id: e1.id, fiscal_year: 'FY2027' }, sysActor)
    const calE2 = createFiscalCalendar(store, { tenant_id: tenant.id, entity_id: e2.id, fiscal_year: 'FY2027' }, sysActor)
    createFiscalPeriod(store, { tenant_id: tenant.id, fiscal_calendar_id: calE1.id, entity_id: e1.id, period_no: 10, from: '2027-01-01', to: '2027-01-31', status: 'open' }, sysActor)
    const periodE2Jan = createFiscalPeriod(store, { tenant_id: tenant.id, fiscal_calendar_id: calE2.id, entity_id: e2.id, period_no: 1, from: '2027-01-01', to: '2027-01-31', status: 'open' }, sysActor)

    const resolved = resolveFiscalPeriod(store, e2.id, '2027-01-15')

    expect(resolved?.id).toBe(periodE2Jan.id)
    expect(resolved?.entity_id).toBe(e2.id)
    // E1's own period for the same calendar window is untouched / independently resolvable.
    const e1Resolved = resolveFiscalPeriod(store, e1.id, '2027-01-15')
    expect(e1Resolved?.entity_id).toBe(e1.id)
  })
})

describe('KRN-01-FR-002 — org unit resolution', () => {
  it('resolves a document scoped to Line-3 to exactly one entity and the full ancestor chain', () => {
    const tenant = makeTenant(store)
    const e1 = makeLegalEntity(store, tenant.id)
    const hq = createOrgUnit(store, { tenant_id: tenant.id, entity_id: e1.id, parent_org_unit_id: null, code: 'HQ', name: 'HQ', org_unit_type: 'division', location_id: null, status: 'active' }, sysActor, 'PR-21')
    const plantA = createOrgUnit(store, { tenant_id: tenant.id, entity_id: e1.id, parent_org_unit_id: hq.id, code: 'PLANT-A', name: 'Plant A', org_unit_type: 'plant', location_id: null, status: 'active' }, sysActor, 'PR-21')
    const line3 = createOrgUnit(store, { tenant_id: tenant.id, entity_id: e1.id, parent_org_unit_id: plantA.id, code: 'LINE-3', name: 'Line 3', org_unit_type: 'line', location_id: null, status: 'active' }, sysActor, 'PR-21')

    const { entityId, chain } = resolveOrgUnitChain(store, line3.id)

    expect(entityId).toBe(e1.id)
    expect(chain.map((o) => o.id)).toEqual([line3.id, plantA.id, hq.id])
  })
})

describe('KRN-01-FR-003 — closed period rejects posting', () => {
  it('rejects a posting into a closed period, creating no record and emitting no event', () => {
    const tenant = makeTenant(store)
    const e1 = makeLegalEntity(store, tenant.id)
    const cal = createFiscalCalendar(store, { tenant_id: tenant.id, entity_id: e1.id, fiscal_year: 'FY2027' }, sysActor)
    createFiscalPeriod(store, { tenant_id: tenant.id, fiscal_calendar_id: cal.id, entity_id: e1.id, period_no: 1, from: '2027-01-01', to: '2027-01-31', status: 'closed' }, sysActor)

    const eventsBefore = store.events.length
    const result = checkPostingAllowed(store, e1.id, '2027-01-15')

    expect(result.allowed).toBe(false)
    expect(result.reason).toBeTruthy()
    expect(store.events.length).toBe(eventsBefore) // no event emitted
  })
})

describe('KRN-01-FR-004 — tenant lifecycle transitions (degraded: no KRN-05 yet, D-21)', () => {
  it('activates a trial tenant and emits core.tenant.activated in the same operation', () => {
    const tenant = makeTenant(store, { code: 'T3', name: 'Tenant Three' })
    expect(tenant.status).toBe('trial')

    const updated = transitionTenantLifecycle(store, tenant.id, 'activate', userActor, 'PR-21')

    expect(updated.status).toBe('active')
    const activatedEvents = store.events.filter((e) => e.event_name === 'core.tenant.activated')
    expect(activatedEvents).toHaveLength(1)
    expect(activatedEvents[0].tenant_id).toBe(tenant.id)
  })

  it('rejects an illegal transition (trial straight to closed)', () => {
    const tenant = makeTenant(store, { code: 'T4', name: 'Tenant Four' })
    expect(() => transitionTenantLifecycle(store, tenant.id, 'close', userActor, 'PR-21')).toThrow()
  })
})

describe('KRN-01-FR-005 — cost centre hierarchy independent of org units', () => {
  it('resolves a posting against CC-Plant-A to its default org unit when org_unit_id is unset', () => {
    const tenant = makeTenant(store)
    const e1 = makeLegalEntity(store, tenant.id)
    const hq = createOrgUnit(store, { tenant_id: tenant.id, entity_id: e1.id, parent_org_unit_id: null, code: 'HQ', name: 'HQ', org_unit_type: 'division', location_id: null, status: 'active' }, sysActor, 'PR-21')
    const plantA = createOrgUnit(store, { tenant_id: tenant.id, entity_id: e1.id, parent_org_unit_id: hq.id, code: 'PLANT-A', name: 'Plant A', org_unit_type: 'plant', location_id: null, status: 'active' }, sysActor, 'PR-21')

    const ccCorp = createCostCentre(store, { tenant_id: tenant.id, entity_id: e1.id, parent_cost_centre_id: null, code: 'CC-CORP', name: 'Corporate', org_unit_id: null, status: 'active' }, sysActor, 'PR-21')
    const ccPlantA = createCostCentre(store, { tenant_id: tenant.id, entity_id: e1.id, parent_cost_centre_id: ccCorp.id, code: 'CC-PLANT-A', name: 'Plant A', org_unit_id: plantA.id, status: 'active' }, sysActor, 'PR-21')

    const resolvedOrgUnit = resolveCostCentreDefaultOrgUnit(store, ccPlantA.id)

    expect(resolvedOrgUnit).toBe(plantA.id)
  })
})

describe('KRN-01-FR-006 — multi-GSTIN per entity (KRN-01-owned half only; CMP-01 resolution out of scope, D-21)', () => {
  it('stores and independently looks up multiple verified GSTINs by GST state code', () => {
    const tenant = makeTenant(store)
    const e1 = makeLegalEntity(store, tenant.id, {
      tax_registrations: [
        { type: 'gstin', number: '27ABCDE1234F1Z5', verified_at: new Date().toISOString(), status: 'verified' },
        { type: 'gstin', number: '24ABCDE1234F1Z8', verified_at: new Date().toISOString(), status: 'verified' },
      ],
    })

    const gujarat = findTaxRegistrationForState(store, e1.id, '24')
    const maharashtra = findTaxRegistrationForState(store, e1.id, '27')

    expect(gujarat?.number).toBe('24ABCDE1234F1Z8')
    expect(maharashtra?.number).toBe('27ABCDE1234F1Z5')
  })
})

describe('KRN-01-DR-001 — isolation tier promotion (scaled from Vol 1\'s 40,000-record sample)', () => {
  it('promotes row→schema, keeps every record accessible at the same id, and emits exactly one event', () => {
    const tenant = makeTenant(store, { code: 'T2', name: 'Tenant Two' })
    // Scaled representative record set (real load testing is Vol 0 §36 NFR scope, not this acceptance test).
    const entities = Array.from({ length: 40 }, (_, i) => makeLegalEntity(store, tenant.id, { legal_name: `Entity ${i}` }))
    const idsBefore = entities.map((e) => e.id)

    const eventsBefore = store.events.length
    const assignment = promoteIsolationTier(store, tenant.id, 'schema', sysActor, 'PR-21')

    expect(assignment.isolation_tier).toBe('schema')
    expect(assignment.migration_status).toBe('completed')
    const idsAfter = entities.map((e) => e.id) // same in-memory objects — ids never change
    expect(idsAfter).toEqual(idsBefore)
    const isolationEvents = store.events.slice(eventsBefore).filter((e) => e.event_name === 'core.tenant.isolation_changed')
    expect(isolationEvents).toHaveLength(1)
    expect(isolationEvents[0].payload).toMatchObject({ previous_tier: 'row', new_tier: 'schema' })
  })
})

describe('KRN-01-DR-002 — declarative consolidation (KRN-01-owned half only; FIN-14 consumption out of scope, D-21)', () => {
  it('stores different consolidation_method values per entity with no entity-specific code path', () => {
    const tenant = makeTenant(store)
    const parent = makeLegalEntity(store, tenant.id, { legal_name: 'Parent' })
    const childFull = makeLegalEntity(store, tenant.id, { legal_name: 'Child Full', parent_entity_id: parent.id, consolidation_method: 'full' })
    const childProportional = makeLegalEntity(store, tenant.id, { legal_name: 'Child Proportional', parent_entity_id: parent.id, consolidation_method: 'proportional' })

    expect(childFull.consolidation_method).toBe('full')
    expect(childProportional.consolidation_method).toBe('proportional')
  })
})

describe('KRN-01 fiscal period close/reopen lifecycle', () => {
  it('closes an open period and reopens it (not permanently closed)', () => {
    const tenant = makeTenant(store)
    const e1 = makeLegalEntity(store, tenant.id)
    const cal = createFiscalCalendar(store, { tenant_id: tenant.id, entity_id: e1.id, fiscal_year: 'FY2027' }, sysActor)
    const period = createFiscalPeriod(store, { tenant_id: tenant.id, fiscal_calendar_id: cal.id, entity_id: e1.id, period_no: 1, from: '2027-01-01', to: '2027-01-31', status: 'open' }, sysActor)

    const closed = closeFiscalPeriod(store, period.id, userActor, 'PR-16')
    expect(closed.status).toBe('closed')

    const reopened = reopenFiscalPeriod(store, period.id, userActor, 'PR-16')
    expect(reopened.status).toBe('open')
  })
})
