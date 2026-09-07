/**
 * KRN-04 API request/response contracts — KRN-04.md §10. `tenant_id` and
 * `namespace` are always caller-supplied on every create request (never
 * omitted) — per D-34, KRN-04 never infers "which tenant" or "sys vs tnt"
 * itself, matching KRN-02's identical `UserCreateRequestSchema` pattern.
 */
import { z } from 'zod'
import { cursorListRequest, cursorListResponse, uuid } from '@mahisys/shared'
import { EntityDefinitionObjectSchema, EntityDefinitionSchema } from './entity-definition.js'
import { FieldDefinitionObjectSchema, FieldDefinitionSchema } from './field-definition.js'
import { RelationshipDefinitionSchema } from './relationship-definition.js'
import { ValidationRuleSchema } from './validation-rule.js'
import { ComputedFieldSchema } from './computed-field.js'
import { ExtensionPointSchema } from './extension-point.js'
import { SchemaVersionObjectSchema, SchemaDiffSchema } from './schema-version.js'

const OMIT_SERVER_MANAGED = {
  id: true, ext: true, created_at: true, created_by: true,
  updated_at: true, updated_by: true, version: true, deleted_at: true,
  deleted_by: true, source: true, trace_id: true,
} as const

// CRUD /api/v1/metadata/entities
export const EntityDefinitionCreateRequestSchema = EntityDefinitionObjectSchema.omit(OMIT_SERVER_MANAGED)
export const EntityDefinitionListFilterSchema = z.object({
  namespace: z.string().optional(),
  owning_module: z.string().optional(),
  primitive_id: z.string().optional(),
})
export const EntityDefinitionListRequestSchema = cursorListRequest(EntityDefinitionListFilterSchema)
export const EntityDefinitionListResponseSchema = cursorListResponse(EntityDefinitionSchema)

// CRUD /api/v1/metadata/fields
export const FieldDefinitionCreateRequestSchema = FieldDefinitionObjectSchema.omit(OMIT_SERVER_MANAGED)
export const FieldDefinitionListResponseSchema = cursorListResponse(FieldDefinitionSchema)

// CRUD /api/v1/metadata/relationships
export const RelationshipDefinitionCreateRequestSchema = RelationshipDefinitionSchema.omit(OMIT_SERVER_MANAGED)

// CRUD /api/v1/metadata/validations
export const ValidationRuleCreateRequestSchema = ValidationRuleSchema.omit(OMIT_SERVER_MANAGED)

// CRUD /api/v1/metadata/computed-fields
export const ComputedFieldCreateRequestSchema = ComputedFieldSchema.omit(OMIT_SERVER_MANAGED)

// CRUD /api/v1/metadata/extension-points (sys-writable only, KRN-04-FR-005)
export const ExtensionPointCreateRequestSchema = ExtensionPointSchema.omit(OMIT_SERVER_MANAGED)

// GET/POST /api/v1/metadata/schema-versions
export const SchemaVersionCreateRequestSchema = SchemaVersionObjectSchema.omit({
  ...OMIT_SERVER_MANAGED,
  status: true, rehearsed_against: true, promoted_at: true, promoted_by: true,
})
export const SchemaVersionListResponseSchema = cursorListResponse(SchemaVersionObjectSchema)

// GET /api/v1/metadata/diff
export const DiffRequestSchema = z.object({ from_version: uuid, to_version: uuid })
export const DiffResponseSchema = z.object({ from_version: uuid, to_version: uuid, changes: SchemaDiffSchema })
