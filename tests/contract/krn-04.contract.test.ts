/**
 * KRN-04 contract tests — Vol 6 §6 step 2, written before any
 * implementation exists. Scope: shape only (entity fields/enums, API
 * request/response shape, event schema shape) — not business behaviour.
 */
import { describe, it, expect } from 'vitest'
import {
  PrimitiveIdSchema,
  EntityDefinitionSchema,
  FieldDefinitionSchema,
  RelationshipDefinitionSchema,
  ValidationRuleSchema,
  ComputedFieldSchema,
  SchemaVersionSchema,
  ExtensionPointSchema,
  EntityDefinitionCreateRequestSchema,
  SchemaVersionCreateRequestSchema,
  DiffResponseSchema,
  EntityCreatedEventSchema,
  SchemaVersionPromotedEventSchema,
  RelationshipCreatedEventSchema,
} from '@mahisys/krn-04'
import { ErrorResponseSchema } from '@mahisys/shared'

const actor = { type: 'service' as const, id: '019103b1-6e2a-7c3d-9a1b-000000000001' }
const now = new Date().toISOString()
const today = now.slice(0, 10)

const baseUniversal = {
  tenant_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
  entity_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
  namespace: 'sys' as const,
  ext: {},
  created_at: now,
  created_by: actor,
  updated_at: now,
  updated_by: actor,
  version: 1,
  deleted_at: null,
  deleted_by: null,
  source: 'api' as const,
  trace_id: '019103b1-6e2a-7c3d-9a1b-000000000002',
}

describe('KRN-04 contract — primitive catalogue', () => {
  it('accepts every P-01..P-12 id and rejects a thirteenth primitive', () => {
    for (let i = 1; i <= 12; i++) {
      expect(PrimitiveIdSchema.safeParse(`P-${String(i).padStart(2, '0')}`).success).toBe(true)
    }
    expect(PrimitiveIdSchema.safeParse('P-13').success).toBe(false)
  })
})

describe('KRN-04 contract — entity_definition', () => {
  const validEntity = {
    ...baseUniversal,
    id: '019103b1-6e2a-7c3d-9a1b-000000000010',
    code: 'Item',
    primitive_id: 'P-02' as const,
    owning_module: 'SCM-01',
    label_key: 'label.item',
    is_document: false,
    state_machine_id: null,
    semantic_index_policy: 'standard' as const,
    offline_profile: 'online' as const,
    schema_version_id: null,
    deprecated_at: null,
    sunset_at: null,
    status: 'active' as const,
  }

  it('accepts a well-formed entity_definition', () => {
    expect(EntityDefinitionSchema.safeParse(validEntity).success).toBe(true)
  })

  it('rejects an entity_definition with no primitive_id (KRN-04-FR-001)', () => {
    const { primitive_id: _drop, ...withoutPrimitive } = validEntity
    expect(EntityDefinitionSchema.safeParse(withoutPrimitive).success).toBe(false)
  })

  it('rejects status: deprecated with no sunset_at (KRN-04.md §5, found during implementation)', () => {
    expect(EntityDefinitionSchema.safeParse({ ...validEntity, status: 'deprecated', sunset_at: null }).success).toBe(false)
    expect(EntityDefinitionSchema.safeParse({ ...validEntity, status: 'deprecated', deprecated_at: now, sunset_at: today }).success).toBe(true)
  })

  it('EntityDefinitionCreateRequestSchema omits server-managed fields but keeps tenant_id/namespace caller-supplied', () => {
    const shape = EntityDefinitionCreateRequestSchema.shape as Record<string, unknown>
    expect(shape.id).toBeUndefined()
    expect(shape.trace_id).toBeUndefined()
    expect(shape.tenant_id).toBeDefined()
    expect(shape.namespace).toBeDefined()
  })
})

describe('KRN-04 contract — field_definition', () => {
  const validField = {
    ...baseUniversal,
    id: '019103b1-6e2a-7c3d-9a1b-000000000020',
    entity_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
    code: 'warranty_months',
    data_type: 'integer' as const,
    is_required: false,
    default: 12,
    validation: null,
    is_indexed: true,
    is_sensitive: false,
    semantic_role: 'meaningful' as const,
    deprecated_at: null,
    sunset_at: null,
    status: 'active' as const,
  }

  it('accepts a well-formed field_definition', () => {
    expect(FieldDefinitionSchema.safeParse(validField).success).toBe(true)
  })

  it('rejects deprecated_at set without sunset_at (KRN-04-FR-003)', () => {
    expect(FieldDefinitionSchema.safeParse({ ...validField, deprecated_at: now, sunset_at: null }).success).toBe(false)
  })
})

describe('KRN-04 contract — relationship_definition (KRN-04-FR-006)', () => {
  it('accepts a well-formed relationship_definition', () => {
    const valid = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000030',
      entity_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      target_entity_id: '019103b1-6e2a-7c3d-9a1b-000000000011',
      code: 'has_lines',
      name: 'Has line items',
      cardinality: 'one_to_many' as const,
      cascade_behaviour: 'cascade_soft_delete' as const,
    }
    expect(RelationshipDefinitionSchema.safeParse(valid).success).toBe(true)
  })
})

describe('KRN-04 contract — validation_rule and computed_field', () => {
  it('accepts a well-formed validation_rule', () => {
    const valid = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000040',
      entity_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      field_id: null,
      expression: 'total >= 0',
      error_message_key: 'error.total_negative',
      severity: 'block' as const,
    }
    expect(ValidationRuleSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts a well-formed computed_field', () => {
    const valid = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000050',
      field_id: '019103b1-6e2a-7c3d-9a1b-000000000020',
      expression: '(sale_price - cost) / sale_price',
      recompute_policy: 'on_write' as const,
      depends_on: ['019103b1-6e2a-7c3d-9a1b-000000000021'],
    }
    expect(ComputedFieldSchema.safeParse(valid).success).toBe(true)
  })
})

describe('KRN-04 contract — schema_version (D-34)', () => {
  const validSys = {
    ...baseUniversal,
    id: '019103b1-6e2a-7c3d-9a1b-000000000060',
    version_no: 12,
    release_id: '019103b1-6e2a-7c3d-9a1b-000000000099',
    status: 'rehearsed' as const,
    diff: [{ kind: 'field_added' as const, code_path: 'SCM-01.Item.warranty_months' }],
    rehearsed_against: '019103b1-6e2a-7c3d-9a1b-0000000000aa',
    promoted_at: null,
    promoted_by: null,
  }

  it('accepts a sys schema_version carrying release_id', () => {
    expect(SchemaVersionSchema.safeParse(validSys).success).toBe(true)
  })

  it('rejects a tnt schema_version carrying a non-null release_id (D-34)', () => {
    expect(SchemaVersionSchema.safeParse({ ...validSys, namespace: 'tnt', tenant_id: baseUniversal.tenant_id }).success).toBe(false)
  })

  it('SchemaVersionCreateRequestSchema omits lifecycle-managed fields', () => {
    const shape = SchemaVersionCreateRequestSchema.shape as Record<string, unknown>
    expect(shape.status).toBeUndefined()
    expect(shape.promoted_at).toBeUndefined()
    expect(shape.version_no).toBeDefined()
    expect(shape.release_id).toBeDefined()
  })
})

describe('KRN-04 contract — extension_point (KRN-04-FR-005)', () => {
  it('accepts a well-formed extension_point', () => {
    const valid = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000070',
      entity_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      code: 'computed_slot_1',
      kind: 'computed_slot' as const,
      constraints: {},
    }
    expect(ExtensionPointSchema.safeParse(valid).success).toBe(true)
  })
})

describe('KRN-04 contract — diff response (KRN-04-DR-003)', () => {
  it('accepts a structured diff keyed by code, not by internal id', () => {
    const valid = {
      from_version: '019103b1-6e2a-7c3d-9a1b-000000000060',
      to_version: '019103b1-6e2a-7c3d-9a1b-000000000061',
      changes: [{ kind: 'field_added' as const, code_path: 'SCM-01.Item.warranty_months' }],
    }
    expect(DiffResponseSchema.safeParse(valid).success).toBe(true)
  })
})

describe('KRN-04 contract — events (P-08 envelope)', () => {
  it('validates metadata.entity.created against its envelope', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-0000000000e1',
      tenant_id: baseUniversal.tenant_id,
      entity_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      event_name: 'metadata.entity.created',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'entity_definition',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      payload: { entity_definition_id: '019103b1-6e2a-7c3d-9a1b-000000000010', code: 'Item' },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-0000000000e2',
      trace_id: '019103b1-6e2a-7c3d-9a1b-0000000000e3',
      reversal_handle: null,
    }
    expect(EntityCreatedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates metadata.schema.version_promoted carrying release_id (D-34)', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-0000000000f1',
      tenant_id: baseUniversal.tenant_id,
      entity_id: '019103b1-6e2a-7c3d-9a1b-000000000060',
      event_name: 'metadata.schema.version_promoted',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'schema_version',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000060',
      payload: { schema_version_id: '019103b1-6e2a-7c3d-9a1b-000000000060', version_no: 12, release_id: '019103b1-6e2a-7c3d-9a1b-000000000099' },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-0000000000f2',
      trace_id: '019103b1-6e2a-7c3d-9a1b-0000000000f3',
      reversal_handle: null,
    }
    expect(SchemaVersionPromotedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates metadata.relationship.created (added during implementation)', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-0000000000a1',
      tenant_id: baseUniversal.tenant_id,
      entity_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      event_name: 'metadata.relationship.created',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'relationship_definition',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000030',
      payload: {
        relationship_definition_id: '019103b1-6e2a-7c3d-9a1b-000000000030',
        entity_definition_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
        target_entity_definition_id: '019103b1-6e2a-7c3d-9a1b-000000000011',
        code: 'has_lines',
      },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-0000000000a2',
      trace_id: '019103b1-6e2a-7c3d-9a1b-0000000000a3',
      reversal_handle: null,
    }
    expect(RelationshipCreatedEventSchema.safeParse(event).success).toBe(true)
  })
})

describe('KRN-04 contract — error shape reused from @mahisys/shared', () => {
  it('is unchanged (sanity check for the shared import)', () => {
    expect(
      ErrorResponseSchema.safeParse({ error: { code: 'ENTITY_DEFINITION_NOT_FOUND', message: 'x', trace_id: '019103b1-6e2a-7c3d-9a1b-000000000099' } }).success,
    ).toBe(true)
  })
})
