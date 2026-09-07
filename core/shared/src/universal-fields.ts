/**
 * Universal fields every persisted entity carries, per Vol 2 §1.2.
 * No module redefines these — they are composed into every entity schema
 * across the platform via `withUniversalFields()` below.
 */
import { z } from 'zod'

export const uuid = z.string().uuid()

/** Vol 2 §1.2 — every entity carries a namespace: platform (`sys`) or tenant (`tnt`). */
export const NamespaceSchema = z.enum(['sys', 'tnt'])
export type Namespace = z.infer<typeof NamespaceSchema>

/**
 * Vol 2 §1.2 — actor reference: a composite identifying whoever performed
 * a mutation. Agent version is mandatory so an action is attributable to a
 * specific agent build, not to "the system" (Vol 0 §27.2).
 */
export const ActorRefSchema = z.object({
  type: z.enum(['user', 'agent', 'service']),
  id: uuid,
  version: z.string().optional(), // required when type === 'agent'; enforced by refine() below
}).refine(
  (actor) => actor.type !== 'agent' || typeof actor.version === 'string',
  { message: 'ActorRef.version is required when type is "agent" (Vol 0 §27.2)' },
)
export type ActorRef = z.infer<typeof ActorRefSchema>

/** Vol 2 §1.2 — where a mutation originated. */
export const SourceSchema = z.enum(['ui', 'api', 'import', 'agent', 'integration', 'offline_sync'])
export type Source = z.infer<typeof SourceSchema>

/**
 * Vol 2 §1.2 universal fields, verbatim. Composed into every entity via
 * `withUniversalFields()`. `tenant_id` is deliberately non-optional per
 * Vol 2 §1.2 ("never optional") — see D-18 in /spec/decisions-taken.md for
 * how this applies even to KRN-12's platform-shared reference data
 * (physically replicated per tenant, not a shared row).
 */
export const UniversalFieldsSchema = z.object({
  id: uuid,
  tenant_id: uuid,
  entity_id: uuid,
  namespace: NamespaceSchema,
  ext: z.record(z.string(), z.unknown()).default({}),
  created_at: z.string().datetime(),
  created_by: ActorRefSchema,
  updated_at: z.string().datetime(),
  updated_by: ActorRefSchema,
  version: z.number().int().positive(),
  deleted_at: z.string().datetime().nullable(),
  deleted_by: ActorRefSchema.nullable(),
  source: SourceSchema,
  trace_id: uuid,
})
export type UniversalFields = z.infer<typeof UniversalFieldsSchema>

/**
 * Composes an entity's own fields with the universal fields every
 * persisted entity carries (Vol 2 §1.2). Use this rather than repeating
 * the universal fields per module.
 */
export function withUniversalFields<T extends z.ZodRawShape>(shape: T) {
  return UniversalFieldsSchema.extend(shape)
}
