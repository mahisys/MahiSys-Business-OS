/**
 * Shared test fixtures for KRN-10 acceptance/permission tests.
 */
import { createStore as createKrn06Store, type Krn06Store } from '@mahisys/krn-06'
import { createStore as createKrn10Store, type Krn10Store } from '@mahisys/krn-10'
import { recordAuditEntry } from '@mahisys/krn-10'

export const sysActor = { type: 'service' as const, id: '00000000-0000-7000-8200-000000000001' }
export const userActor = { type: 'user' as const, id: '00000000-0000-7000-8200-000000000002' }
export const userActor2 = { type: 'user' as const, id: '00000000-0000-7000-8200-000000000003' }
export const agentActor = { type: 'agent' as const, id: '00000000-0000-7000-8200-000000000009', version: 'v1' }

export const TENANT_ID = '00000000-0000-7000-8200-0000000000f0'
export const TENANT_ID_2 = '00000000-0000-7000-8200-0000000000f1'
export const STOCK_ITEM_SUBJECT = '00000000-0000-7000-8200-0000000000s1'
export const PAYROLL_SUBJECT = '00000000-0000-7000-8200-0000000000p1'
export const INVOICE_SUBJECT = '00000000-0000-7000-8200-0000000000i1'

export function newStores(): { krn06: Krn06Store; krn10: Krn10Store } {
  const krn06 = createKrn06Store()
  const krn10 = createKrn10Store(krn06)
  return { krn06, krn10 }
}

export function makeMutationEntry(
  krn10: Krn10Store,
  overrides: Partial<{ tenant_id: string; subject_type: string; subject_id: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; actor: typeof userActor }> = {},
) {
  return recordAuditEntry(krn10, {
    tenant_id: overrides.tenant_id ?? TENANT_ID,
    subject_type: overrides.subject_type ?? 'stock_item',
    subject_id: overrides.subject_id ?? STOCK_ITEM_SUBJECT,
    action: 'update',
    before: overrides.before !== undefined ? overrides.before : { quantity: 120 },
    after: overrides.after !== undefined ? overrides.after : { quantity: 95 },
    actor: overrides.actor ?? sysActor,
    ip_address: '10.0.0.1',
    device_id: 'device-1',
    source: 'api',
    trace_id: '00000000-0000-7000-8200-0000000000aa',
  })
}
