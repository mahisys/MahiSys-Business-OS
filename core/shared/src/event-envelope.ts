/**
 * P-08 Event envelope (Vol 2 Part 2, P-08) — every event on the platform,
 * regardless of owning module, carries this shape. A module's own event
 * schemas (e.g. KRN-01's `core.tenant.provisioned`) define only `payload`;
 * this envelope wraps it.
 */
import { z } from 'zod'
import { uuid, ActorRefSchema } from './universal-fields.js'

/** Vol 0 §42 — event names follow `module.entity.verb_past`. */
export const EventNameSchema = z
  .string()
  .regex(/^[a-z0-9_]+\.[a-z0-9_]+\.[a-z0-9_]+$/, 'event name must be module.entity.verb_past')

export function eventEnvelope<P extends z.ZodTypeAny>(eventName: string, payloadSchema: P) {
  return z.object({
    event_id: uuid,
    tenant_id: uuid,
    entity_id: uuid,
    event_name: z.literal(eventName),
    schema_version: z.number().int().positive(),
    occurred_at: z.string().datetime(), // event time, Vol 2 §1.6
    recorded_at: z.string().datetime(), // transaction time, Vol 2 §1.6
    actor: ActorRefSchema,
    subject_type: z.string(),
    subject_id: uuid,
    payload: payloadSchema,
    causation_id: uuid.nullable(),
    correlation_id: uuid,
    trace_id: uuid,
    reversal_handle: uuid.nullable(), // KRN-18; null until KRN-18 ships or for a non-reversible event
  })
}
