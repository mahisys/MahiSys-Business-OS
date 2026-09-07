/**
 * Shared test fixtures for KRN-01 acceptance/permission tests. Not a test
 * file itself (vitest only collects `tests/**\/*.test.ts`), so this is
 * safe to import from both.
 */
import { createStore, type Krn01Store } from '@mahisys/krn-01'
import { createTenant } from '@mahisys/krn-01'
import { createLegalEntity, type CreateLegalEntityInput } from '@mahisys/krn-01'

export const sysActor = { type: 'service' as const, id: '00000000-0000-7000-8000-000000000001' }
export const userActor = { type: 'user' as const, id: '00000000-0000-7000-8000-000000000002' }

export function newStore(): Krn01Store {
  return createStore()
}

export function makeTenant(store: Krn01Store, overrides: Partial<{ code: string; name: string }> = {}) {
  return createTenant(
    store,
    {
      code: overrides.code ?? `T-${Math.random().toString(36).slice(2, 8)}`,
      name: overrides.name ?? 'Test Tenant',
      region: 'asia-south1',
      manifest_id: '00000000-0000-7000-8000-0000000000f1',
      plan_id: '00000000-0000-7000-8000-0000000000f2',
    },
    sysActor,
  )
}

export function makeAddress(overrides: Partial<Parameters<typeof mkAddress>[0]> = {}) {
  return mkAddress(overrides)
}
function mkAddress(overrides: {
  line1?: string
  city?: string
  state_code?: string
  country_code?: string
  pincode?: string
} = {}) {
  return {
    line1: overrides.line1 ?? 'Plot 14, MIDC',
    city: overrides.city ?? 'Pune',
    state_code: overrides.state_code ?? '27',
    country_code: overrides.country_code ?? 'IN',
    pincode: overrides.pincode ?? '411001',
    type: 'registered' as const,
    is_primary: true,
  }
}

export function makeLegalEntity(
  store: Krn01Store,
  tenantId: string,
  overrides: Partial<Omit<CreateLegalEntityInput, 'tenant_id'>> = {},
) {
  return createLegalEntity(
    store,
    {
      tenant_id: tenantId,
      legal_name: overrides.legal_name ?? 'Test Legal Entity Pvt Ltd',
      tax_registrations: overrides.tax_registrations ?? [],
      base_currency: overrides.base_currency ?? 'INR',
      reporting_currency: overrides.reporting_currency ?? 'INR',
      fiscal_year_start: overrides.fiscal_year_start ?? '04-01',
      address: overrides.address ?? mkAddress(),
      parent_entity_id: overrides.parent_entity_id ?? null,
      consolidation_method: overrides.consolidation_method ?? null,
    },
    sysActor,
    'PR-21',
  )
}
