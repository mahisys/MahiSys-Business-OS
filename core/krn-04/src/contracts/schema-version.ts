/**
 * `schema_version` — KRN-04.md §4.1/§5. `release_id` is D-34's addition:
 * correlates every tenant's own physical copy of "the same platform
 * release" without those copies sharing a row or a lifecycle gate — see
 * SCHEMA_VERSION_STATUS_TRANSITIONS below, evaluated per tenant copy.
 */
import { withUniversalFields, uuid, ActorRefSchema } from '@mahisys/shared'
import { z } from 'zod'

export const SchemaVersionStatusSchema = z.enum(['draft', 'validated', 'rehearsed', 'promoted', 'superseded', 'rolled_back'])
export type SchemaVersionStatus = z.infer<typeof SchemaVersionStatusSchema>

/**
 * KRN-04.md §5: `draft → validated → rehearsed → promoted`, with
 * `promoted → superseded` when a later version is promoted over it, and
 * `promoted → rolled_back` restoring the immediately prior promoted
 * version — which is *itself* expressed as `superseded → promoted`
 * (KRN-04-DR-002's acceptance criterion), reachable again only via a
 * rollback of the version that superseded it.
 */
export const SCHEMA_VERSION_STATUS_TRANSITIONS: Record<SchemaVersionStatus, SchemaVersionStatus[]> = {
  draft: ['validated'],
  validated: ['rehearsed'],
  rehearsed: ['promoted'],
  promoted: ['superseded', 'rolled_back'],
  superseded: ['promoted'],
  rolled_back: [],
}

/** KRN-04-DR-003: one entry in a schema_version's machine-readable diff, referenced by `code` path (D-34), not internal `id`. */
export const SchemaDiffEntrySchema = z.object({
  kind: z.enum(['entity_added', 'entity_changed', 'entity_deprecated', 'field_added', 'field_changed', 'field_deprecated']),
  code_path: z.string().min(1), // e.g. "SLS-04.Deal" or "SLS-04.Deal.margin_pct"
})
export type SchemaDiffEntry = z.infer<typeof SchemaDiffEntrySchema>
export const SchemaDiffSchema = z.array(SchemaDiffEntrySchema)

export const SchemaVersionObjectSchema = withUniversalFields({
  version_no: z.number().int().positive(), // monotonic within its scope (per tenant)
  release_id: uuid.nullable(), // D-34 — set only for namespace: sys versions
  status: SchemaVersionStatusSchema,
  diff: SchemaDiffSchema,
  rehearsed_against: uuid.nullable(), // the shadow tenant used for STU-10's rehearsal
  promoted_at: z.string().datetime().nullable(),
  promoted_by: ActorRefSchema.nullable(),
})

export const SchemaVersionSchema = SchemaVersionObjectSchema.refine(
  (v) => v.namespace !== 'tnt' || v.release_id === null,
  { message: 'release_id is only meaningful for namespace: sys versions (D-34) — a tnt version has no cross-tenant counterpart to correlate with' },
)
export type SchemaVersion = z.infer<typeof SchemaVersionSchema>
