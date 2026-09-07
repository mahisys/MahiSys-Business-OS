/**
 * KRN-01 permission tests — Vol 6 §6 step 4 ("write the permission tests,
 * including negative cases"), from KRN-01.md §11.
 *
 * Scope note: this exercises KRN-01's own bootstrap permission matrix
 * (`service/permissions.ts`), not a real KRN-03 (Access Control)
 * enforcement layer — KRN-03 doesn't exist yet. See that file's doc
 * comment for why this is not "stubbing an incomplete dependency"
 * (KRN-01 declares no dependency on KRN-03).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { hasPermission, canProposeOrgUnit, isWithinProvisioningWindow } from '@mahisys/krn-01'
import { type Krn01Store } from '@mahisys/krn-01'
import { createTenant, transitionTenantLifecycle, promoteIsolationTier } from '@mahisys/krn-01'
import { createOrgUnit, createLegalEntity, createCostCentre, closeFiscalPeriod, createFiscalCalendar, createFiscalPeriod } from '@mahisys/krn-01'
import { newStore, makeTenant, makeLegalEntity, makeAddress, sysActor, userActor } from './krn-01.fixtures.js'

const agentActor = { type: 'agent' as const, id: '00000000-0000-7000-8000-000000000009', version: 'v1' }

describe('KRN-01 permission matrix (§11) — positive cases', () => {
  it('PR-21 can read tenants, propose lifecycle changes, and write legal entities/org units/cost centres', () => {
    expect(hasPermission('PR-21', 'tenant.read')).toBe(true)
    expect(hasPermission('PR-21', 'tenant.lifecycle')).toBe(true)
    expect(hasPermission('PR-21', 'legal_entity.write')).toBe(true)
    expect(hasPermission('PR-21', 'org_unit.write')).toBe(true)
    expect(hasPermission('PR-21', 'cost_centre.write')).toBe(true)
  })

  it('PR-16 (CFO) can close/reopen fiscal periods', () => {
    expect(hasPermission('PR-16', 'fiscal_period.close_reopen')).toBe(true)
  })

  it('PR-01 (Owner) can approve tenant lifecycle but not write legal entities', () => {
    expect(hasPermission('PR-01', 'tenant.lifecycle')).toBe(true)
    expect(hasPermission('PR-01', 'legal_entity.write')).toBe(false)
  })
})

describe('KRN-01 permission matrix (§11) — negative cases', () => {
  it('PR-15 (Accountant) cannot close or reopen a fiscal period', () => {
    expect(hasPermission('PR-15', 'fiscal_period.close_reopen')).toBe(false)
  })

  it('PR-02 (Functional Head) cannot approve tenant lifecycle', () => {
    expect(hasPermission('PR-02', 'tenant.lifecycle')).toBe(false)
  })

  it('OTHER (no direct KRN-01 screen access) cannot write anything', () => {
    expect(hasPermission('OTHER', 'legal_entity.write')).toBe(false)
    expect(hasPermission('OTHER', 'org_unit.write')).toBe(false)
    expect(hasPermission('OTHER', 'cost_centre.write')).toBe(false)
    expect(hasPermission('OTHER', 'tenant.lifecycle')).toBe(false)
    expect(hasPermission('OTHER', 'fiscal_period.close_reopen')).toBe(false)
  })

  it('PR-16 (CFO) has no tenant.lifecycle grant in KRN-01 (distinct from KRN-18\'s separate matrix)', () => {
    expect(hasPermission('PR-16', 'tenant.lifecycle')).toBe(false)
  })
})

describe('KRN-01 write paths actually enforce the matrix, not just report it', () => {
  let store: Krn01Store
  beforeEach(() => {
    store = newStore()
  })

  const address = makeAddress()
  const legalEntityInput = (tenantId: string) => ({
    tenant_id: tenantId,
    legal_name: 'X',
    tax_registrations: [],
    base_currency: 'INR',
    reporting_currency: 'INR',
    fiscal_year_start: '04-01',
    address,
    parent_entity_id: null,
    consolidation_method: null,
  })

  it('createLegalEntity: PR-16 succeeds, PR-15 is rejected', () => {
    const tenant = makeTenant(store)
    expect(() => createLegalEntity(store, legalEntityInput(tenant.id), sysActor, 'PR-16')).not.toThrow()
    expect(() => createLegalEntity(store, legalEntityInput(tenant.id), sysActor, 'PR-15')).toThrow()
  })

  it('createOrgUnit: PR-21 succeeds, PR-15 is rejected', () => {
    const tenant = makeTenant(store)
    const e1 = makeLegalEntity(store, tenant.id)
    const input = { tenant_id: tenant.id, entity_id: e1.id, parent_org_unit_id: null, code: 'X', name: 'X', org_unit_type: 'division', location_id: null, status: 'active' as const }
    expect(() => createOrgUnit(store, input, sysActor, 'PR-21')).not.toThrow()
    expect(() => createOrgUnit(store, input, sysActor, 'PR-15')).toThrow()
  })

  it('createCostCentre: PR-16 succeeds, PR-02 is rejected', () => {
    const tenant = makeTenant(store)
    const e1 = makeLegalEntity(store, tenant.id)
    const input = { tenant_id: tenant.id, entity_id: e1.id, parent_cost_centre_id: null, code: 'X', name: 'X', org_unit_id: null, status: 'active' as const }
    expect(() => createCostCentre(store, input, sysActor, 'PR-16')).not.toThrow()
    expect(() => createCostCentre(store, input, sysActor, 'PR-02')).toThrow()
  })

  it('closeFiscalPeriod: PR-16 succeeds, PR-15 is rejected', () => {
    const tenant = makeTenant(store)
    const e1 = makeLegalEntity(store, tenant.id)
    const cal = createFiscalCalendar(store, { tenant_id: tenant.id, entity_id: e1.id, fiscal_year: 'FY2027' }, sysActor)
    const p1 = createFiscalPeriod(store, { tenant_id: tenant.id, fiscal_calendar_id: cal.id, entity_id: e1.id, period_no: 1, from: '2027-01-01', to: '2027-01-31', status: 'open' }, sysActor)
    const p2 = createFiscalPeriod(store, { tenant_id: tenant.id, fiscal_calendar_id: cal.id, entity_id: e1.id, period_no: 2, from: '2027-02-01', to: '2027-02-28', status: 'open' }, sysActor)
    expect(() => closeFiscalPeriod(store, p1.id, userActor, 'PR-16')).not.toThrow()
    expect(() => closeFiscalPeriod(store, p2.id, userActor, 'PR-15')).toThrow()
  })
})

describe('KRN-01 §11 negative case — isolation_tier.promote (D-32: gap found and fixed during implementation)', () => {
  let store: Krn01Store
  beforeEach(() => {
    store = newStore()
  })

  it('PR-21 can propose a tier promotion; PR-16 (CFO) cannot', () => {
    const tenant = makeTenant(store)
    expect(() => promoteIsolationTier(store, tenant.id, 'schema', sysActor, 'PR-21')).not.toThrow()

    const tenant2 = makeTenant(store)
    expect(() => promoteIsolationTier(store, tenant2.id, 'schema', sysActor, 'PR-16')).toThrow()
  })

  it('matches the matrix exactly: only PR-21 and PR-01 hold isolation_tier.promote', () => {
    const personas = ['PR-01', 'PR-02', 'PR-15', 'PR-16', 'PR-21', 'PR-28', 'OTHER'] as const
    for (const persona of personas) {
      const expected = persona === 'PR-01' || persona === 'PR-21'
      expect(hasPermission(persona, 'isolation_tier.promote'), persona).toBe(expected)
    }
  })
})

describe('KRN-01 §11 negative case — org unit creation outside PR-02\'s own function subtree', () => {
  let store: Krn01Store
  beforeEach(() => {
    store = newStore()
  })

  it('rejects when the target parent is outside the caller\'s own subtree', () => {
    const tenant = makeTenant(store)
    const e1 = makeLegalEntity(store, tenant.id)
    const salesFn = createOrgUnit(store, { tenant_id: tenant.id, entity_id: e1.id, parent_org_unit_id: null, code: 'SALES', name: 'Sales', org_unit_type: 'division', location_id: null, status: 'active' }, sysActor, 'PR-21')
    const opsFn = createOrgUnit(store, { tenant_id: tenant.id, entity_id: e1.id, parent_org_unit_id: null, code: 'OPS', name: 'Operations', org_unit_type: 'division', location_id: null, status: 'active' }, sysActor, 'PR-21')

    // PR-02 heads Sales; proposing a new org unit under Ops (a different function) must be rejected.
    expect(canProposeOrgUnit(store, salesFn.id, opsFn.id)).toBe(false)
    // Proposing within their own function's subtree is fine.
    expect(canProposeOrgUnit(store, salesFn.id, salesFn.id)).toBe(true)
  })
})

describe('KRN-01 §11 negative case — tenant.create is never directly callable by a user or agent', () => {
  let store: Krn01Store
  beforeEach(() => {
    store = newStore()
  })

  it('rejects tenant creation by a user actor regardless of role, and by an agent actor', () => {
    const input = { code: 'X', name: 'X', region: 'asia-south1', manifest_id: 'm', plan_id: 'p' }
    expect(() => createTenant(store, input, userActor)).toThrow()
    expect(() => createTenant(store, input, agentActor)).toThrow()
  })

  it('accepts tenant creation by a service actor (COM-04)', () => {
    const input = { code: 'Y', name: 'Y', region: 'asia-south1', manifest_id: 'm', plan_id: 'p' }
    expect(() => createTenant(store, input, sysActor)).not.toThrow()
  })
})

describe('KRN-01 §11 negative case — PR-28 outside the provisioning window', () => {
  let store: Krn01Store
  beforeEach(() => {
    store = newStore()
  })

  it('is within the window while the tenant is trial, and outside it once active', () => {
    const tenant = makeTenant(store, { code: 'T5', name: 'Tenant Five' })
    expect(isWithinProvisioningWindow(store, tenant.id)).toBe(true)

    transitionTenantLifecycle(store, tenant.id, 'activate', userActor, 'PR-21')
    expect(isWithinProvisioningWindow(store, tenant.id)).toBe(false)
  })
})
