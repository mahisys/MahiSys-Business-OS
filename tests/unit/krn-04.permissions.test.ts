/**
 * KRN-04 permission tests — Vol 6 §6 step 4, from KRN-04.md §11.
 *
 * Scope note: same as KRN-01/02/03's — this exercises KRN-04's own
 * bootstrap matrix, not a real KRN-03 layer (doesn't exist yet, and can't
 * — KRN-03 itself depends on KRN-04, see permissions.ts's module doc).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { hasPermission, isWithinProvisioningWindow } from '@mahisys/krn-04'
import { type Krn04Store } from '@mahisys/krn-04'
import { createEntityDefinition } from '@mahisys/krn-04'
import { createFieldDefinition } from '@mahisys/krn-04'
import { createExtensionPoint } from '@mahisys/krn-04'
import { createSchemaVersionDraft, validateSchemaVersion, rehearseSchemaVersion, promoteSchemaVersion, rollbackSchemaVersion } from '@mahisys/krn-04'
import { newStore, makeEntity, sysActor, userActor, agentActor, TENANT_ID } from './krn-04.fixtures.js'

describe('KRN-04 permission matrix (§11) — positive cases', () => {
  it('PR-21 holds every tnt write grant plus read/diff', () => {
    expect(hasPermission('PR-21', 'entity.create_tnt')).toBe(true)
    expect(hasPermission('PR-21', 'field.create_tnt')).toBe(true)
    expect(hasPermission('PR-21', 'schema_version.promote_tnt')).toBe(true)
    expect(hasPermission('PR-21', 'schema_version.rollback_tnt')).toBe(true)
    expect(hasPermission('PR-21', 'diff.read')).toBe(true)
  })

  it('PR-01 (Owner) can read entities and diffs (summary) but holds no write grant', () => {
    expect(hasPermission('PR-01', 'entity.read')).toBe(true)
    expect(hasPermission('PR-01', 'diff.read')).toBe(true)
    expect(hasPermission('PR-01', 'entity.create_tnt')).toBe(false)
  })

  it('PR-02 (Functional Head) can read but never writes directly — proposes via STU-01', () => {
    expect(hasPermission('PR-02', 'entity.read')).toBe(true)
    expect(hasPermission('PR-02', 'entity.create_tnt')).toBe(false)
    expect(hasPermission('PR-02', 'diff.read')).toBe(false)
  })
})

describe('KRN-04 permission matrix (§11) — negative cases', () => {
  it('no persona other than PR-21 holds schema_version.promote_tnt', () => {
    const personas = ['PR-28', 'PR-01', 'PR-02', 'OTHER'] as const
    for (const persona of personas) {
      expect(hasPermission(persona, 'schema_version.promote_tnt'), persona).toBe(false)
    }
  })

  it('OTHER (every other internal persona) can read implicitly but writes nothing', () => {
    expect(hasPermission('OTHER', 'entity.read')).toBe(true)
    expect(hasPermission('OTHER', 'entity.create_tnt')).toBe(false)
    expect(hasPermission('OTHER', 'diff.read')).toBe(false)
  })
})

describe('KRN-04 write paths actually enforce the matrix, not just report it', () => {
  let store: Krn04Store
  beforeEach(() => {
    store = newStore()
  })

  it('createEntityDefinition (tnt): PR-21 succeeds, OTHER is rejected', () => {
    expect(() =>
      createEntityDefinition(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'A', primitive_id: 'P-02', owning_module: 'SLS-04', label_key: 'label.a', is_document: false, state_machine_id: null, semantic_index_policy: 'standard', offline_profile: 'online', schema_version_id: null }, sysActor, 'PR-21'),
    ).not.toThrow()
    expect(() =>
      createEntityDefinition(store, { tenant_id: TENANT_ID, namespace: 'tnt', code: 'B', primitive_id: 'P-02', owning_module: 'SLS-04', label_key: 'label.b', is_document: false, state_machine_id: null, semantic_index_policy: 'standard', offline_profile: 'online', schema_version_id: null }, userActor, 'OTHER'),
    ).toThrow()
  })

  it('createEntityDefinition (sys): a service actor succeeds regardless of persona, a user actor is rejected even claiming PR-21', () => {
    expect(() =>
      createEntityDefinition(store, { tenant_id: TENANT_ID, namespace: 'sys', code: 'Item', primitive_id: 'P-02', owning_module: 'SCM-01', label_key: 'label.item', is_document: false, state_machine_id: null, semantic_index_policy: 'standard', offline_profile: 'online', schema_version_id: null }, sysActor, 'OTHER'),
    ).not.toThrow()
    expect(() =>
      createEntityDefinition(store, { tenant_id: TENANT_ID, namespace: 'sys', code: 'Item2', primitive_id: 'P-02', owning_module: 'SCM-01', label_key: 'label.item2', is_document: false, state_machine_id: null, semantic_index_policy: 'standard', offline_profile: 'online', schema_version_id: null }, userActor, 'PR-21'),
    ).toThrow()
  })

  it('an agent actor is rejected on a sys write even nominally holding PR-21 (L9)', () => {
    expect(() =>
      createEntityDefinition(store, { tenant_id: TENANT_ID, namespace: 'sys', code: 'Item3', primitive_id: 'P-02', owning_module: 'SCM-01', label_key: 'label.item3', is_document: false, state_machine_id: null, semantic_index_policy: 'standard', offline_profile: 'online', schema_version_id: null }, agentActor, 'PR-21'),
    ).toThrow()
  })

  it('createFieldDefinition (tnt field on a sys entity): PR-21 succeeds, PR-02 is rejected (KRN-04-FR-002 gate is on the field\'s own namespace)', () => {
    const entity = makeEntity(store, { namespace: 'sys', code: 'Item', owning_module: 'SCM-01' })
    expect(() =>
      createFieldDefinition(store, { tenant_id: TENANT_ID, namespace: 'tnt', entity_id: entity.id, code: 'warranty_months', data_type: 'integer', is_required: false, default: null, validation: null, is_indexed: true, is_sensitive: false, semantic_role: 'meaningful' }, sysActor, 'PR-21'),
    ).not.toThrow()
    expect(() =>
      createFieldDefinition(store, { tenant_id: TENANT_ID, namespace: 'tnt', entity_id: entity.id, code: 'other_field', data_type: 'string', is_required: false, default: null, validation: null, is_indexed: false, is_sensitive: false, semantic_role: 'meaningful' }, userActor, 'PR-02'),
    ).toThrow()
  })

  it('createExtensionPoint: rejects a non-service actor unconditionally (KRN-04-FR-005 — no human role holds this grant)', () => {
    const entity = makeEntity(store, { namespace: 'sys', code: 'SalesOrder', owning_module: 'SLS-04' })
    expect(() => createExtensionPoint(store, { tenant_id: TENANT_ID, entity_id: entity.id, code: 'computed_slot_1', kind: 'computed_slot', constraints: {} }, userActor)).toThrow()
    expect(() => createExtensionPoint(store, { tenant_id: TENANT_ID, entity_id: entity.id, code: 'computed_slot_1', kind: 'computed_slot', constraints: {} }, sysActor)).not.toThrow()
  })

  it('schema_version.promote: PR-21 can promote a tnt version, PR-02 cannot', () => {
    const draftA = createSchemaVersionDraft(store, { tenant_id: TENANT_ID, namespace: 'tnt', release_id: null, version_no: 1, diff: [] }, sysActor, 'PR-21')
    validateSchemaVersion(store, draftA.id, sysActor, 'PR-21')
    rehearseSchemaVersion(store, draftA.id, 'shadow-tenant', sysActor, 'PR-21')
    expect(() => promoteSchemaVersion(store, draftA.id, sysActor, 'PR-21')).not.toThrow()

    const draftB = createSchemaVersionDraft(store, { tenant_id: TENANT_ID, namespace: 'tnt', release_id: null, version_no: 2, diff: [] }, sysActor, 'PR-21')
    validateSchemaVersion(store, draftB.id, sysActor, 'PR-21')
    rehearseSchemaVersion(store, draftB.id, 'shadow-tenant', sysActor, 'PR-21')
    expect(() => promoteSchemaVersion(store, draftB.id, userActor, 'PR-02')).toThrow()
  })

  it('schema_version.promote (sys): platform-only — no persona grant substitutes for a service actor, even PR-21', () => {
    const draft = createSchemaVersionDraft(store, { tenant_id: TENANT_ID, namespace: 'sys', release_id: '00000000-0000-7000-8100-0000000000bb', version_no: 1, diff: [] }, sysActor, 'PR-21')
    validateSchemaVersion(store, draft.id, sysActor, 'PR-21')
    rehearseSchemaVersion(store, draft.id, 'shadow-tenant', sysActor, 'PR-21')
    expect(() => promoteSchemaVersion(store, draft.id, userActor, 'PR-21')).toThrow()
    expect(() => promoteSchemaVersion(store, draft.id, sysActor, 'PR-21')).not.toThrow()
  })

  it('schema_version.rollback: PR-21 can roll back a tnt version, PR-02 cannot', () => {
    const draft = createSchemaVersionDraft(store, { tenant_id: TENANT_ID, namespace: 'tnt', release_id: null, version_no: 1, diff: [] }, sysActor, 'PR-21')
    validateSchemaVersion(store, draft.id, sysActor, 'PR-21')
    rehearseSchemaVersion(store, draft.id, 'shadow-tenant', sysActor, 'PR-21')
    promoteSchemaVersion(store, draft.id, sysActor, 'PR-21')
    expect(() => rollbackSchemaVersion(store, draft.id, userActor, 'PR-02')).toThrow()
    expect(() => rollbackSchemaVersion(store, draft.id, sysActor, 'PR-21')).not.toThrow()
  })
})

describe('KRN-04 §11 negative case — PR-28 outside the provisioning window', () => {
  it('is within the window only while the tenant is trial', () => {
    expect(isWithinProvisioningWindow('trial')).toBe(true)
    expect(isWithinProvisioningWindow('active')).toBe(false)
    expect(isWithinProvisioningWindow('suspended')).toBe(false)
    expect(isWithinProvisioningWindow('closed')).toBe(false)
  })
})
