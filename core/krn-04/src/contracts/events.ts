/**
 * KRN-04 event contracts — KRN-04.md §12. Every event carries a real
 * `tenant_id` (via the envelope) and is emitted per tenant (D-34) — for a
 * `sys` release fanned out across tenants, one event is emitted per
 * tenant's own copy, each payload carrying `release_id` where relevant
 * for cross-tenant correlation.
 */
import { z } from 'zod'
import { eventEnvelope, uuid } from '@mahisys/shared'

export const EntityCreatedPayloadSchema = z.object({ entity_definition_id: uuid, code: z.string() })
export const EntityCreatedEventSchema = eventEnvelope('metadata.entity.created', EntityCreatedPayloadSchema)

export const EntityDeprecatedPayloadSchema = z.object({ entity_definition_id: uuid, code: z.string(), sunset_at: z.string().date() })
export const EntityDeprecatedEventSchema = eventEnvelope('metadata.entity.deprecated', EntityDeprecatedPayloadSchema)

export const FieldAddedPayloadSchema = z.object({ field_definition_id: uuid, entity_definition_id: uuid, code: z.string() })
export const FieldAddedEventSchema = eventEnvelope('metadata.field.added', FieldAddedPayloadSchema)

export const FieldDeprecatedPayloadSchema = z.object({ field_definition_id: uuid, entity_definition_id: uuid, code: z.string(), sunset_at: z.string().date() })
export const FieldDeprecatedEventSchema = eventEnvelope('metadata.field.deprecated', FieldDeprecatedPayloadSchema)

export const FieldUpdatedPayloadSchema = z.object({ field_definition_id: uuid, entity_definition_id: uuid, code: z.string() })
export const FieldUpdatedEventSchema = eventEnvelope('metadata.field.updated', FieldUpdatedPayloadSchema)

export const SchemaVersionPromotedPayloadSchema = z.object({ schema_version_id: uuid, version_no: z.number().int().positive(), release_id: uuid.nullable() })
export const SchemaVersionPromotedEventSchema = eventEnvelope('metadata.schema.version_promoted', SchemaVersionPromotedPayloadSchema)

export const SchemaVersionRolledBackPayloadSchema = z.object({ schema_version_id: uuid, version_no: z.number().int().positive(), release_id: uuid.nullable(), restored_version_id: uuid })
export const SchemaVersionRolledBackEventSchema = eventEnvelope('metadata.schema.version_rolled_back', SchemaVersionRolledBackPayloadSchema)

// Added during implementation — see KRN-04.md §12: Vol 1's event list (and
// this draft's first pass) named events for only 3 of the 7 owned
// entities' mutations. L4 applies to all seven.
export const RelationshipCreatedPayloadSchema = z.object({ relationship_definition_id: uuid, entity_definition_id: uuid, target_entity_definition_id: uuid, code: z.string() })
export const RelationshipCreatedEventSchema = eventEnvelope('metadata.relationship.created', RelationshipCreatedPayloadSchema)

export const ValidationRuleCreatedPayloadSchema = z.object({ validation_rule_id: uuid, entity_definition_id: uuid })
export const ValidationRuleCreatedEventSchema = eventEnvelope('metadata.validation_rule.created', ValidationRuleCreatedPayloadSchema)

export const ComputedFieldCreatedPayloadSchema = z.object({ computed_field_id: uuid, field_definition_id: uuid })
export const ComputedFieldCreatedEventSchema = eventEnvelope('metadata.computed_field.created', ComputedFieldCreatedPayloadSchema)

export const ExtensionPointCreatedPayloadSchema = z.object({ extension_point_id: uuid, entity_definition_id: uuid, code: z.string() })
export const ExtensionPointCreatedEventSchema = eventEnvelope('metadata.extension_point.created', ExtensionPointCreatedPayloadSchema)

// Added during implementation — a second pass over §5's state machines
// found five more state transitions with no corresponding event. See
// KRN-04.md §12.
export const EntityActivatedPayloadSchema = z.object({ entity_definition_id: uuid, code: z.string() })
export const EntityActivatedEventSchema = eventEnvelope('metadata.entity.activated', EntityActivatedPayloadSchema)

export const EntityRetiredPayloadSchema = z.object({ entity_definition_id: uuid, code: z.string() })
export const EntityRetiredEventSchema = eventEnvelope('metadata.entity.retired', EntityRetiredPayloadSchema)

export const FieldRetiredPayloadSchema = z.object({ field_definition_id: uuid, entity_definition_id: uuid, code: z.string() })
export const FieldRetiredEventSchema = eventEnvelope('metadata.field.retired', FieldRetiredPayloadSchema)

export const SchemaVersionValidatedPayloadSchema = z.object({ schema_version_id: uuid, version_no: z.number().int().positive(), release_id: uuid.nullable() })
export const SchemaVersionValidatedEventSchema = eventEnvelope('metadata.schema.version_validated', SchemaVersionValidatedPayloadSchema)

export const SchemaVersionRehearsedPayloadSchema = z.object({ schema_version_id: uuid, version_no: z.number().int().positive(), release_id: uuid.nullable(), rehearsed_against: z.string() })
export const SchemaVersionRehearsedEventSchema = eventEnvelope('metadata.schema.version_rehearsed', SchemaVersionRehearsedPayloadSchema)

export const SchemaVersionSupersededPayloadSchema = z.object({ schema_version_id: uuid, version_no: z.number().int().positive(), release_id: uuid.nullable(), superseded_by_version_id: uuid })
export const SchemaVersionSupersededEventSchema = eventEnvelope('metadata.schema.version_superseded', SchemaVersionSupersededPayloadSchema)
