/**
 * KRN-04 event-schema conformance — same rationale as KRN-01/02's: runs
 * the real service functions and validates actual emitted events against
 * the real Zod schemas, not just hand-built contract-test fixtures.
 */
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import { createEntityDefinition, activateEntityDefinition, deprecateEntityDefinition, retireEntityDefinition } from '@mahisys/krn-04'
import { createFieldDefinition, updateFieldDefinition, deprecateFieldDefinition, retireFieldDefinition } from '@mahisys/krn-04'
import { createRelationshipDefinition } from '@mahisys/krn-04'
import { createValidationRule } from '@mahisys/krn-04'
import { createComputedField } from '@mahisys/krn-04'
import { createExtensionPoint } from '@mahisys/krn-04'
import { createSchemaVersionDraft, validateSchemaVersion, rehearseSchemaVersion, promoteSchemaVersion, rollbackSchemaVersion } from '@mahisys/krn-04'
import {
  EntityCreatedEventSchema,
  EntityActivatedEventSchema,
  EntityDeprecatedEventSchema,
  EntityRetiredEventSchema,
  FieldAddedEventSchema,
  FieldUpdatedEventSchema,
  FieldDeprecatedEventSchema,
  FieldRetiredEventSchema,
  RelationshipCreatedEventSchema,
  ValidationRuleCreatedEventSchema,
  ComputedFieldCreatedEventSchema,
  ExtensionPointCreatedEventSchema,
  SchemaVersionValidatedEventSchema,
  SchemaVersionRehearsedEventSchema,
  SchemaVersionPromotedEventSchema,
  SchemaVersionSupersededEventSchema,
  SchemaVersionRolledBackEventSchema,
} from '@mahisys/krn-04'
import { newStore, makeEntity, sysActor, TENANT_ID } from './krn-04.fixtures.js'

const SCHEMA_BY_EVENT_NAME: Record<string, z.ZodTypeAny> = {
  'metadata.entity.created': EntityCreatedEventSchema,
  'metadata.entity.activated': EntityActivatedEventSchema,
  'metadata.entity.deprecated': EntityDeprecatedEventSchema,
  'metadata.entity.retired': EntityRetiredEventSchema,
  'metadata.field.added': FieldAddedEventSchema,
  'metadata.field.updated': FieldUpdatedEventSchema,
  'metadata.field.deprecated': FieldDeprecatedEventSchema,
  'metadata.field.retired': FieldRetiredEventSchema,
  'metadata.relationship.created': RelationshipCreatedEventSchema,
  'metadata.validation_rule.created': ValidationRuleCreatedEventSchema,
  'metadata.computed_field.created': ComputedFieldCreatedEventSchema,
  'metadata.extension_point.created': ExtensionPointCreatedEventSchema,
  'metadata.schema.version_validated': SchemaVersionValidatedEventSchema,
  'metadata.schema.version_rehearsed': SchemaVersionRehearsedEventSchema,
  'metadata.schema.version_promoted': SchemaVersionPromotedEventSchema,
  'metadata.schema.version_superseded': SchemaVersionSupersededEventSchema,
  'metadata.schema.version_rolled_back': SchemaVersionRolledBackEventSchema,
}

describe('KRN-04 — every emitted event validates against its declared Zod schema', () => {
  it('exercises every KRN-04 mutation and checks each resulting event', () => {
    const store = newStore()

    const entity = makeEntity(store, { namespace: 'sys', code: 'Item', owning_module: 'SCM-01' }) // metadata.entity.created + .activated (makeEntity activates)
    const targetEntity = makeEntity(store, { namespace: 'sys', code: 'PurchaseOrder', owning_module: 'SCM-01' })

    const field = createFieldDefinition(store, { tenant_id: TENANT_ID, namespace: 'tnt', entity_id: entity.id, code: 'warranty_months', data_type: 'integer', is_required: false, default: null, validation: null, is_indexed: true, is_sensitive: false, semantic_role: 'meaningful' }, sysActor, 'PR-21') // metadata.field.added
    updateFieldDefinition(store, field.id, { is_indexed: false }, sysActor, 'PR-21') // metadata.field.updated
    deprecateFieldDefinition(store, field.id, '2027-01-01', sysActor, 'PR-21') // metadata.field.deprecated
    retireFieldDefinition(store, field.id, sysActor, 'PR-21') // metadata.field.retired

    deprecateEntityDefinition(store, targetEntity.id, '2027-06-01', sysActor, 'PR-21') // metadata.entity.deprecated
    retireEntityDefinition(store, targetEntity.id, sysActor, 'PR-21') // metadata.entity.retired

    const relSource = makeEntity(store, { namespace: 'sys', code: 'SalesOrder', owning_module: 'SLS-04' })
    const relTarget = makeEntity(store, { namespace: 'sys', code: 'SalesOrderLine', owning_module: 'SLS-04' })
    createRelationshipDefinition(store, { tenant_id: TENANT_ID, namespace: 'sys', entity_id: relSource.id, target_entity_id: relTarget.id, code: 'ordered_via', name: 'Ordered via', cardinality: 'one_to_many', cascade_behaviour: 'restrict' }, sysActor, 'PR-21') // metadata.relationship.created

    createValidationRule(store, { tenant_id: TENANT_ID, namespace: 'sys', entity_id: entity.id, field_id: null, expression: 'total >= 0', error_message_key: 'error.total_negative', severity: 'block' }, sysActor, 'PR-21') // metadata.validation_rule.created

    const priceField = createFieldDefinition(store, { tenant_id: TENANT_ID, namespace: 'sys', entity_id: entity.id, code: 'sale_price', data_type: 'decimal', is_required: true, default: null, validation: null, is_indexed: false, is_sensitive: false, semantic_role: 'meaningful' }, sysActor, 'PR-21')
    createComputedField(store, { tenant_id: TENANT_ID, namespace: 'sys', field_id: priceField.id, expression: '(sale_price - cost) / sale_price', recompute_policy: 'on_write', depends_on: [priceField.id] }, sysActor, 'PR-21') // metadata.computed_field.created

    createExtensionPoint(store, { tenant_id: TENANT_ID, entity_id: entity.id, code: 'computed_slot_1', kind: 'computed_slot', constraints: {} }, sysActor) // metadata.extension_point.created

    const releaseId = '00000000-0000-7000-8100-0000000000cc'
    const v1 = createSchemaVersionDraft(store, { tenant_id: TENANT_ID, namespace: 'sys', release_id: releaseId, version_no: 1, diff: [] }, sysActor, 'PR-21')
    validateSchemaVersion(store, v1.id, sysActor, 'PR-21') // metadata.schema.version_validated
    rehearseSchemaVersion(store, v1.id, 'shadow-tenant', sysActor, 'PR-21') // metadata.schema.version_rehearsed
    promoteSchemaVersion(store, v1.id, sysActor, 'PR-21') // metadata.schema.version_promoted

    const v2 = createSchemaVersionDraft(store, { tenant_id: TENANT_ID, namespace: 'sys', release_id: releaseId, version_no: 2, diff: [] }, sysActor, 'PR-21')
    validateSchemaVersion(store, v2.id, sysActor, 'PR-21')
    rehearseSchemaVersion(store, v2.id, 'shadow-tenant', sysActor, 'PR-21')
    promoteSchemaVersion(store, v2.id, sysActor, 'PR-21') // metadata.schema.version_promoted + v1's metadata.schema.version_superseded

    rollbackSchemaVersion(store, v2.id, sysActor, 'PR-21') // metadata.schema.version_rolled_back + v1's metadata.schema.version_promoted (restored)

    expect(store.events.length).toBeGreaterThanOrEqual(17)

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
