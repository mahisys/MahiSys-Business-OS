/**
 * `event_schema` — KRN-06.md §4.1. Not field-detailed in Vol 1/2 (§17 item
 * 1, bulk-approved per D-31). `payload_schema` is implemented as a
 * reasonable minimum rather than a full JSON Schema document: only what
 * KRN-06-FR-005's forward-compatibility rule actually needs — which
 * payload fields are required vs optional at a given version. A full JSON
 * Schema evaluator is not this reference implementation's job (D-12 stack
 * decisions land later); this shape is enough to prove the compatibility
 * rule itself (see event-schema-service.ts's `isForwardCompatible`).
 *
 * Named `schema_version` rather than the bare `version` §4.1's field table
 * uses: every entity's universal fields (Vol 2 §1.2) already carry a
 * `version` (the record's own optimistic-concurrency counter), which
 * `event_schema`'s own schema-versioning field would silently collide
 * with and override. Renamed to match the terminology `event.schema_version`
 * already uses to reference this field ("Resolves against `event_schema`",
 * §4.1) — see decisions-taken.md D-38.
 */
import { z } from 'zod'
import { withUniversalFields, EventNameSchema } from '@mahisys/shared'

export const SchemaCompatibilityModeSchema = z.enum(['forward'])
export type SchemaCompatibilityMode = z.infer<typeof SchemaCompatibilityModeSchema>

export const EventSchemaStatusSchema = z.enum(['draft', 'active', 'deprecated'])
export type EventSchemaStatus = z.infer<typeof EventSchemaStatusSchema>

/** KRN-06.md §5 gives no explicit state machine for `event_schema` — inferred from its own `status` enum and §17 item 4's deployment-time framing: draft while being authored, active once effective, deprecated once superseded by a newer version (never deleted, L12/FR-002's append-only ethos applies here too). */
export const EVENT_SCHEMA_STATUS_TRANSITIONS: Record<EventSchemaStatus, EventSchemaStatus[]> = {
  draft: ['active'],
  active: ['deprecated'],
  deprecated: [],
}

export const PayloadSchemaDescriptorSchema = z.object({
  required_fields: z.array(z.string()),
  optional_fields: z.array(z.string()),
})
export type PayloadSchemaDescriptor = z.infer<typeof PayloadSchemaDescriptorSchema>

export const EventSchemaSchema = withUniversalFields({
  event_name: EventNameSchema,
  schema_version: z.number().int().positive(),
  payload_schema: PayloadSchemaDescriptorSchema,
  compatibility_mode: SchemaCompatibilityModeSchema,
  owning_module: z.string().min(1),
  status: EventSchemaStatusSchema,
  effective_from: z.string().datetime(),
})
export type EventSchemaRecord = z.infer<typeof EventSchemaSchema>
