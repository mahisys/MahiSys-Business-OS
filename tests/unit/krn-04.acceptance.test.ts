/**
 * KRN-04 acceptance tests — every G/W/T in KRN-04.md §16, written against
 * the real service functions (Vol 6 §6 step 3). Written failing first
 * against `NotImplementedError`-style stubs, per the same protocol
 * KRN-01/KRN-02 followed.
 *
 * FR-002 and FR-004's literal Vol 1 samples describe a *business record*
 * being written against a declared schema — KRN-04 does not own business
 * records itself (§3, L3: that belongs to each record-owning module).
 * Both are adapted to what KRN-04 actually owns: the field/computed-field
 * *declaration* and the type-check/consistency primitive a record-owning
 * module would call, per the doc comments in `field-definition-service.ts`.
 */
import { describe, it, expect } from 'vitest'
import { createStore, type Krn04Store } from '@mahisys/krn-04'
import { createEntityDefinition } from '@mahisys/krn-04'
import { createFieldDefinition, deprecateFieldDefinition, matchesDataType } from '@mahisys/krn-04'
import { createComputedField } from '@mahisys/krn-04'
import { createExtensionPoint, assertExtensionAllowed } from '@mahisys/krn-04'
import { createRelationshipDefinition } from '@mahisys/krn-04'
import {
  createSchemaVersionDraft,
  validateSchemaVersion,
  rehearseSchemaVersion,
  promoteSchemaVersion,
  rollbackSchemaVersion,
  computeDiff,
} from '@mahisys/krn-04'
import { newStore, makeEntity, sysActor, TENANT_ID, TENANT_ID_2 } from './krn-04.fixtures.js'

describe('KRN-04-FR-001 — every entity declares a primitive', () => {
  it('rejects a tnt entity create with no primitive_id, creates no row, emits no event', () => {
    const store = newStore()
    expect(() =>
      createEntityDefinition(
        store,
        { tenant_id: TENANT_ID, namespace: 'tnt', code: 'GatePassReturn', primitive_id: undefined, owning_module: 'MFG-05', label_key: 'label.gate_pass_return', is_document: false, state_machine_id: null, semantic_index_policy: 'standard', offline_profile: 'online', schema_version_id: null },
        sysActor,
        'PR-21',
      ),
    ).toThrow()
    expect(store.entityDefinitions.size).toBe(0)
    expect(store.events).toHaveLength(0)
  })
})

describe('KRN-04-FR-002 — tnt fields live in ext with declared type/validation', () => {
  it('declares a tnt field on a sys entity with is_indexed, and the type-check primitive rejects a mismatched value', () => {
    const store = newStore()
    const item = makeEntity(store, { namespace: 'sys', code: 'Item', owning_module: 'SCM-01' })
    const field = createFieldDefinition(
      store,
      { tenant_id: TENANT_ID, namespace: 'tnt', entity_id: item.id, code: 'warranty_months', data_type: 'integer', is_required: false, default: null, validation: null, is_indexed: true, is_sensitive: false, semantic_role: 'meaningful' },
      sysActor,
      'PR-21',
    )
    expect(field.is_indexed).toBe(true)
    expect(field.data_type).toBe('integer')
    expect(matchesDataType('integer', 24)).toBe(true)
    expect(matchesDataType('integer', 'twenty-four')).toBe(false)
  })
})

describe('KRN-04-FR-003 — field deprecation requires sunset and migration path', () => {
  it('rejects deprecation without sunset_at; accepts it with sunset_at and keeps the field resolvable', () => {
    const store = newStore()
    const entity = makeEntity(store)
    const field = createFieldDefinition(
      store,
      { tenant_id: TENANT_ID, namespace: 'tnt', entity_id: entity.id, code: 'legacy_tax_code', data_type: 'string', is_required: false, default: null, validation: null, is_indexed: false, is_sensitive: false, semantic_role: 'meaningful' },
      sysActor,
      'PR-21',
    )

    expect(() => deprecateFieldDefinition(store, field.id, null, sysActor, 'PR-21')).toThrow()
    expect(store.fieldDefinitions.get(field.id)!.status).toBe('active')

    const deprecated = deprecateFieldDefinition(store, field.id, '2027-01-01', sysActor, 'PR-21')
    expect(deprecated.status).toBe('deprecated')
    expect(deprecated.sunset_at).toBe('2027-01-01')
    // still resolvable — not hard-deleted (L12)
    expect(store.fieldDefinitions.get(field.id)).toBeDefined()
  })
})

describe('KRN-04-FR-004 — computed fields are declarative, not opaque behaviour', () => {
  it('stores the declarative expression verbatim, retrievable identically by any caller', () => {
    const store = newStore()
    const entity = makeEntity(store)
    const field = createFieldDefinition(
      store,
      { tenant_id: TENANT_ID, namespace: 'tnt', entity_id: entity.id, code: 'sale_price', data_type: 'decimal', is_required: true, default: null, validation: null, is_indexed: false, is_sensitive: false, semantic_role: 'meaningful' },
      sysActor,
      'PR-21',
    )
    const computed = createComputedField(
      store,
      { tenant_id: TENANT_ID, namespace: 'tnt', field_id: field.id, expression: '(sale_price - cost) / sale_price', recompute_policy: 'on_write', depends_on: [field.id] },
      sysActor,
      'PR-21',
    )
    expect(computed.expression).toBe('(sale_price - cost) / sale_price')
    // "evaluated consistently everywhere" — the same stored record is what every surface (API, report, export, semantic index) reads; no per-surface copy exists in this store.
    expect(store.computedFields.get(computed.id)!.expression).toBe(computed.expression)
  })
})

describe('KRN-04-FR-005 — extension attempted outside a declared point is blocked', () => {
  it('rejects a hook not declared on the entity, accepts the one that is', () => {
    const store = newStore()
    const salesOrder = makeEntity(store, { namespace: 'sys', code: 'SalesOrder', owning_module: 'SLS-04' })
    createExtensionPoint(store, { tenant_id: TENANT_ID, entity_id: salesOrder.id, code: 'computed_slot_1', kind: 'computed_slot', constraints: {} }, sysActor)

    expect(() => assertExtensionAllowed(store, salesOrder.id, 'before_save', 'hook_before')).toThrow()
    expect(() => assertExtensionAllowed(store, salesOrder.id, 'computed_slot_1', 'computed_slot')).not.toThrow()
    expect(store.extensionPoints.size).toBe(1) // the rejected attempt recorded no usage
  })
})

describe('KRN-04-FR-006 — relationship definitions are module-scoped', () => {
  it('rejects a relationship whose target belongs to a different owning_module', () => {
    const store = newStore()
    const scmEntity = makeEntity(store, { owning_module: 'SCM-02' })
    const finEntity = makeEntity(store, { owning_module: 'FIN-01' })
    expect(() =>
      createRelationshipDefinition(
        store,
        { tenant_id: TENANT_ID, namespace: 'tnt', entity_id: scmEntity.id, target_entity_id: finEntity.id, code: 'posts_to', name: 'Posts to', cardinality: 'one_to_one', cascade_behaviour: 'restrict' },
        sysActor,
        'PR-21',
      ),
    ).toThrow()
  })
})

describe('KRN-04-DR-001 — namespace separation enforced at the engine', () => {
  it('rejects a non-service actor writing a sys entity, regardless of persona', () => {
    const store = newStore()
    expect(() =>
      createEntityDefinition(
        store,
        { tenant_id: TENANT_ID, namespace: 'sys', code: 'Item', primitive_id: 'P-02', owning_module: 'SCM-01', label_key: 'label.item', is_document: false, state_machine_id: null, semantic_index_policy: 'standard', offline_profile: 'online', schema_version_id: null },
        { type: 'user', id: '00000000-0000-7000-8100-000000000002' },
        'PR-21',
      ),
    ).toThrow()
  })

  it('a tnt write on the same tenant succeeds independently of the sys rejection above', () => {
    const store = newStore()
    const entity = makeEntity(store)
    expect(entity.namespace).toBe('tnt')
  })
})

describe('KRN-04-DR-002 — metadata change is versioned, diffable, reversible, rehearsed (D-34: per-tenant independent)', () => {
  it('promotes tenant A independently of tenant B on the same release, and rollback restores the prior promoted version', () => {
    const store = newStore()
    const releaseId = '00000000-0000-7000-8100-0000000000aa'

    const v11A = createSchemaVersionDraft(store, { tenant_id: TENANT_ID, namespace: 'sys', release_id: releaseId, version_no: 11, diff: [] }, sysActor, 'PR-21')
    validateSchemaVersion(store, v11A.id, sysActor, 'PR-21')
    rehearseSchemaVersion(store, v11A.id, 'shadow-tenant-A', sysActor, 'PR-21')
    const promoted11A = promoteSchemaVersion(store, v11A.id, sysActor, 'PR-21')
    expect(promoted11A.status).toBe('promoted')

    const v12A = createSchemaVersionDraft(store, { tenant_id: TENANT_ID, namespace: 'sys', release_id: releaseId, version_no: 12, diff: [{ kind: 'field_added', code_path: 'SCM-01.Item.warranty_months' }] }, sysActor, 'PR-21')
    validateSchemaVersion(store, v12A.id, sysActor, 'PR-21')
    rehearseSchemaVersion(store, v12A.id, 'shadow-tenant-A', sysActor, 'PR-21')

    const v12B = createSchemaVersionDraft(store, { tenant_id: TENANT_ID_2, namespace: 'sys', release_id: releaseId, version_no: 12, diff: [] }, sysActor, 'PR-21')
    // tenant B stays in `validated` — never blocks or is blocked by tenant A's promotion
    validateSchemaVersion(store, v12B.id, sysActor, 'PR-21')

    const promoted12A = promoteSchemaVersion(store, v12A.id, sysActor, 'PR-21')
    expect(promoted12A.status).toBe('promoted')
    expect(store.schemaVersions.get(v11A.id)!.status).toBe('superseded')
    expect(store.schemaVersions.get(v12B.id)!.status).toBe('validated') // untouched

    const promotedEvents = store.events.filter((e) => e.event_name === 'metadata.schema.version_promoted')
    expect(promotedEvents).toHaveLength(2)
    expect(promotedEvents.every((e) => (e.payload as { release_id: string }).release_id === releaseId)).toBe(true)

    const rolledBack = rollbackSchemaVersion(store, v12A.id, sysActor, 'PR-21')
    expect(rolledBack.status).toBe('rolled_back')
    expect(store.schemaVersions.get(v11A.id)!.status).toBe('promoted') // restored
    expect(store.events.some((e) => e.event_name === 'metadata.schema.version_rolled_back')).toBe(true)
  })

  it('rejects promoting a version that has not reached rehearsed', () => {
    const store = newStore()
    const draft = createSchemaVersionDraft(store, { tenant_id: TENANT_ID, namespace: 'sys', release_id: null, version_no: 1, diff: [] }, sysActor, 'PR-21')
    expect(() => promoteSchemaVersion(store, draft.id, sysActor, 'PR-21')).toThrow()
  })
})

describe('KRN-04-DR-003 — diff is machine-readable', () => {
  it('returns the structured diff between two versions, keyed by code path', () => {
    const store = newStore()
    const v11 = createSchemaVersionDraft(store, { tenant_id: TENANT_ID, namespace: 'sys', release_id: null, version_no: 11, diff: [] }, sysActor, 'PR-21')
    const v12 = createSchemaVersionDraft(
      store,
      {
        tenant_id: TENANT_ID,
        namespace: 'sys',
        release_id: null,
        version_no: 12,
        diff: [
          { kind: 'field_added', code_path: 'SCM-01.Item.warranty_months' },
          { kind: 'field_added', code_path: 'SCM-01.Item.batch_no' },
          { kind: 'field_added', code_path: 'SCM-01.Item.hsn_code' },
          { kind: 'field_deprecated', code_path: 'SCM-01.Item.legacy_tax_code' },
        ],
      },
      sysActor,
      'PR-21',
    )
    const diff = computeDiff(store, v11.id, v12.id)
    expect(diff).toHaveLength(4)
    expect(diff.map((d) => d.code_path)).toContain('SCM-01.Item.warranty_months')
  })
})

describe('KRN-04-DR-001 (addition to acceptance suite) — every write path stays store-scoped', () => {
  it('never leaks a Krn04Store instance across two independently created stores', () => {
    const storeA: Krn04Store = createStore()
    const storeB: Krn04Store = createStore()
    makeEntity(storeA)
    expect(storeB.entityDefinitions.size).toBe(0)
  })
})
