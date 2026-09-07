/**
 * `entity_definition` — KRN-04.md §4.1. `namespace` and `tenant_id` come
 * from `withUniversalFields()`; per D-34 (extending D-18), `tenant_id` is
 * never null, including for `namespace: sys` rows — a `sys` definition is
 * physically replicated per tenant, not a single platform-wide row.
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'
import { PrimitiveIdSchema } from './primitive.js'

export const EntityDefinitionStatusSchema = z.enum(['draft', 'active', 'deprecated', 'retired'])
export type EntityDefinitionStatus = z.infer<typeof EntityDefinitionStatusSchema>

/** KRN-04.md §5: `draft → active → deprecated → retired`. `active → deprecated` requires `sunset_at` in the same write (enforced by the refine below, not by this map). */
export const ENTITY_DEFINITION_STATUS_TRANSITIONS: Record<EntityDefinitionStatus, EntityDefinitionStatus[]> = {
  draft: ['active'],
  active: ['deprecated'],
  deprecated: ['retired'],
  retired: [],
}

export const SemanticIndexPolicySchema = z.enum(['none', 'standard', 'restricted'])
export const OfflineProfileSchema = z.enum(['full', 'read', 'online']) // Vol 0 §9.2

// Plain object shape, kept separate from the refined schema below so
// derived request schemas can still call `.omit()` (Zod's `.refine()`
// returns a ZodEffects wrapper that does not expose `.omit()`/`.pick()`).
export const EntityDefinitionObjectSchema = withUniversalFields({
  code: z.string().min(1), // unique within (tenant_id, namespace, owning_module) — D-34
  primitive_id: PrimitiveIdSchema, // mandatory, KRN-04-FR-001
  owning_module: z.string().min(1),
  label_key: z.string().min(1), // localisation key (KRN-19) — never a hard-coded label (L6)
  is_document: z.boolean(),
  state_machine_id: uuid.nullable(), // KRN-05 process_definition, when this entity has a lifecycle
  semantic_index_policy: SemanticIndexPolicySchema,
  offline_profile: OfflineProfileSchema,
  // Renamed from KRN-04.md §4.1's literal `version` — see that file's
  // implementation note: a bare `version` here would collide with the
  // universal `version` field (Vol 2 §1.2's per-row optimistic-lock
  // counter), which means something different.
  schema_version_id: uuid.nullable(),
  // Added during implementation — §5's state machine requires these;
  // the original field table never declared them. See KRN-04.md §4.1.
  deprecated_at: z.string().datetime().nullable(),
  sunset_at: z.string().date().nullable(),
  status: EntityDefinitionStatusSchema,
})

export const EntityDefinitionSchema = EntityDefinitionObjectSchema.refine(
  (e) => e.status !== 'deprecated' || e.sunset_at !== null,
  { message: 'sunset_at is required when status is "deprecated" (KRN-04.md §5, KRN-04-FR-003 at entity granularity)' },
)
export type EntityDefinition = z.infer<typeof EntityDefinitionSchema>
