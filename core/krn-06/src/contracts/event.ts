/**
 * `event` — KRN-06.md §4.1, verbatim from Vol 2 §P-08. The one entity in
 * this module that does NOT take universal fields (Vol 2 §1.2): an event
 * is not "an entity that happens to record a mutation," it *is* the record
 * of the mutation, carrying its own tenant/actor/timestamp fields per
 * KRN-06.md §4.1's own note. This is the generic, storage-side shape KRN-06
 * physically persists for every event on the platform — distinct from
 * `@mahisys/shared`'s `eventEnvelope()`, which a *producing* module (like
 * KRN-01 or KRN-03) uses to define one specific, literally-named event
 * with a specific payload schema. KRN-06 stores events of every such
 * shape, so `event_name` here is the general Vol 0 §42 pattern and
 * `payload` is unconstrained JSON, validated against whatever
 * `event_schema` applies only at ingestion time (see event-schema.ts).
 */
import { z } from 'zod'
import { uuid, ActorRefSchema, EventNameSchema } from '@mahisys/shared'

export const StoredEventSchema = z.object({
  event_id: uuid,
  tenant_id: uuid,
  entity_id: uuid,
  event_name: EventNameSchema,
  schema_version: z.number().int().positive(),
  occurred_at: z.string().datetime(), // event time, Vol 2 §1.6 — may precede recorded_at by hours (offline sync, KRN-06-FR-011)
  recorded_at: z.string().datetime(), // transaction time
  actor: ActorRefSchema,
  subject_type: z.string().min(1),
  subject_id: uuid,
  payload: z.record(z.string(), z.unknown()),
  causation_id: uuid.nullable(),
  correlation_id: uuid,
  trace_id: uuid,
  reversal_handle: uuid.nullable(), // KRN-18 doesn't exist yet (Phase 1) — always null until it ships, per D-21
})
export type StoredEvent = z.infer<typeof StoredEventSchema>
