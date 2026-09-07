import { randomUUID } from 'node:crypto'
import type { Krn01Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { LegalEntity } from '../contracts/legal-entity.js'
import { assertPermission, type PersonaId } from './permissions.js'

// `entity_id` is deliberately omitted from the create input: like `tenant`
// (KRN-01.md §4.1 note), a legal_entity record isn't scoped to *another*
// legal entity — Vol 2 §1.2's `entity_id` ("legal entity within tenant")
// is naturally self-referential here, set to the record's own `id` below.
// Not called out explicitly in KRN-01.md the way tenant's omission is —
// flagged as a reasonable extrapolation, consistent with Vol 6 §4/L13's
// pattern of flagging rather than silently guessing on genuine gaps.
export type CreateLegalEntityInput = Omit<
  LegalEntity,
  'id' | 'entity_id' | 'namespace' | 'ext' | 'created_at' | 'created_by' | 'updated_at' | 'updated_by' | 'version' | 'deleted_at' | 'deleted_by' | 'source' | 'trace_id'
>

export function createLegalEntity(
  store: Krn01Store,
  input: CreateLegalEntityInput,
  actor: ActorRef,
  callerPersona: PersonaId,
): LegalEntity {
  assertPermission(store, callerPersona, 'legal_entity.write', input.tenant_id)

  const id = randomUUID()
  const timestamp = new Date().toISOString()
  const entity: LegalEntity = {
    id,
    entity_id: id, // self-referential — see CreateLegalEntityInput doc above
    namespace: 'sys',
    ext: {},
    created_at: timestamp,
    created_by: actor,
    updated_at: timestamp,
    updated_by: actor,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    source: 'api',
    trace_id: randomUUID(),
    ...input,
  }
  store.legalEntities.set(id, entity)

  store.emit({
    event_name: 'core.legal_entity.created',
    tenant_id: entity.tenant_id,
    entity_id: id,
    subject_type: 'legal_entity',
    subject_id: id,
    payload: { legal_entity_id: id, tenant_id: entity.tenant_id },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return entity
}

/**
 * KRN-01-FR-006: independent lookup of a legal entity's GSTIN for a given
 * GST state code. GSTIN's first two digits are the GST state code by
 * statutory format, so no separate `state_code` field is needed on
 * `tax_registrations` — derived here rather than stored redundantly.
 */
export function findTaxRegistrationForState(
  store: Krn01Store,
  legalEntityId: string,
  gstStateCode: string,
): LegalEntity['tax_registrations'][number] | undefined {
  const entity = store.legalEntities.get(legalEntityId)
  if (!entity) return undefined
  return entity.tax_registrations.find(
    (reg) => reg.type === 'gstin' && reg.number.slice(0, 2) === gstStateCode,
  )
}
