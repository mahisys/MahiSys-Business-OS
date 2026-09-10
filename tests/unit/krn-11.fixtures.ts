/**
 * Shared test fixtures for KRN-11 acceptance/permission tests.
 */
import { createStore as createKrn06Store, type Krn06Store } from '@mahisys/krn-06'
import { createStore as createKrn11Store, type Krn11Store } from '@mahisys/krn-11'
import { createSeries, createSeriesAssignment } from '@mahisys/krn-11'
import type { AllocationMode, ResetPolicy } from '@mahisys/krn-11'

export const sysActor = { type: 'service' as const, id: '00000000-0000-7000-8200-000000000001' }
export const userActor = { type: 'user' as const, id: '00000000-0000-7000-8200-000000000002' }

export const TENANT_ID = '00000000-0000-7000-8200-0000000000f0'
export const LEGAL_ENTITY_ID = '00000000-0000-7000-8200-0000000000e1'
export const LEGAL_ENTITY_ID_2 = '00000000-0000-7000-8200-0000000000e2'
export const DOCUMENT_TYPE_TAX_INVOICE = '00000000-0000-7000-8200-00000000d001'
export const LOCATION_PUNE = '00000000-0000-7000-8200-0000000000l1'
export const LOCATION_NASHIK = '00000000-0000-7000-8200-0000000000l2'

export function newStores(): { krn06: Krn06Store; krn11: Krn11Store } {
  const krn06 = createKrn06Store()
  const krn11 = createKrn11Store(krn06)
  return { krn06, krn11 }
}

export function makeSeries(
  krn11: Krn11Store,
  overrides: Partial<{
    entity_id: string
    location_id: string | null
    is_gapless: boolean
    allocation_mode: AllocationMode
    reset_policy: ResetPolicy
    fiscal_year: string | null
    width: number
  }> = {},
) {
  return createSeries(
    krn11,
    {
      tenant_id: TENANT_ID,
      entity_id: overrides.entity_id ?? LEGAL_ENTITY_ID,
      namespace: 'tnt',
      document_type_id: DOCUMENT_TYPE_TAX_INVOICE,
      location_id: overrides.location_id ?? null,
      fiscal_year: overrides.reset_policy === 'never' ? null : (overrides.fiscal_year ?? 'FY2027'),
      prefix: 'INV/',
      suffix: '',
      width: overrides.width ?? 4,
      separator: null,
      is_gapless: overrides.is_gapless ?? true,
      reset_policy: overrides.reset_policy ?? 'fiscal_year',
      allocation_mode: overrides.allocation_mode ?? 'on_issue',
    },
    sysActor,
    'PR-21',
  )
}

export function makeAssignment(krn11: Krn11Store, seriesId: string, overrides: Partial<{ location_id: string | null; priority: number }> = {}) {
  return createSeriesAssignment(
    krn11,
    {
      tenant_id: TENANT_ID,
      entity_id: LEGAL_ENTITY_ID,
      namespace: 'tnt',
      series_id: seriesId,
      document_type_id: DOCUMENT_TYPE_TAX_INVOICE,
      location_id: overrides.location_id ?? null,
      priority: overrides.priority ?? 0,
      effective_from: new Date().toISOString(),
    },
    sysActor,
    'PR-21',
  )
}
