import { randomUUID } from 'node:crypto'
import type { Krn06Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { EventSchemaRecord, PayloadSchemaDescriptor } from '../contracts/event-schema.js'
import { EVENT_SCHEMA_STATUS_TRANSITIONS } from '../contracts/event-schema.js'
import { recordEvent } from './event-service.js'
import { KernelError } from './errors.js'

export interface RegisterEventSchemaInput {
  tenant_id: string
  event_name: string
  schema_version: number
  payload_schema: PayloadSchemaDescriptor
  owning_module: string
  effective_from: string
}

function now() {
  return new Date().toISOString()
}

/**
 * `KRN-06-FR-005`: forward compatibility — a version N+1 payload_schema
 * may add optional fields but must never remove or retype a version-N
 * field. This reference implementation tracks required/optional field
 * *names* only (event-schema.ts's header note), so "retype" is not
 * literally checkable; "never remove a version-N field, never demote a
 * required field to absent" is what this function enforces.
 */
export function isForwardCompatible(prior: PayloadSchemaDescriptor, next: PayloadSchemaDescriptor): boolean {
  const priorFields = new Set([...prior.required_fields, ...prior.optional_fields])
  const nextFields = new Set([...next.required_fields, ...next.optional_fields])
  for (const f of priorFields) if (!nextFields.has(f)) return false
  for (const f of prior.required_fields) if (!next.required_fields.includes(f)) return false
  return true
}

/**
 * §17 item 4 / §11: `event_schema.register` is ✗ for every persona,
 * including PR-21 — this draft treats schema registration as a
 * deployment-time/system action, never a runtime persona grant, matching
 * how KRN-04 treats `sys` writes as service-actor-only rather than
 * matrix-gated (D-34's precedent). No `callerPersona` parameter exists
 * here for that reason; `actor.type` must be `service`.
 */
export function registerEventSchema(store: Krn06Store, input: RegisterEventSchemaInput, actor: ActorRef): EventSchemaRecord {
  if (actor.type !== 'service') {
    throw new KernelError('EVENT_SCHEMA_REGISTRATION_NOT_A_RUNTIME_GRANT', 'event_schema.register has no persona grant at any privilege level (KRN-06.md §11, §17 item 4) — only a service/deployment-time actor may register a schema version.', randomUUID())
  }

  const priorVersions = Array.from(store.eventSchemas.values())
    .filter((s) => s.tenant_id === input.tenant_id && s.event_name === input.event_name)
    .sort((a, b) => b.schema_version - a.schema_version)
  const prior = priorVersions[0]

  if (prior) {
    if (input.schema_version <= prior.schema_version) {
      throw new KernelError('EVENT_SCHEMA_VERSION_NOT_MONOTONIC', `schema_version ${input.schema_version} must be greater than the current version ${prior.schema_version} for ${input.event_name}.`, randomUUID())
    }
    if (!isForwardCompatible(prior.payload_schema, input.payload_schema)) {
      throw new KernelError('EVENT_SCHEMA_NOT_FORWARD_COMPATIBLE', `schema_version ${input.schema_version} of ${input.event_name} removes or demotes a field version ${prior.schema_version} required (KRN-06-FR-005).`, randomUUID())
    }
  }

  const id = randomUUID()
  const timestamp = now()
  const record: EventSchemaRecord = {
    id,
    tenant_id: input.tenant_id,
    entity_id: id,
    namespace: 'sys',
    ext: {},
    created_at: timestamp,
    created_by: actor,
    updated_at: timestamp,
    updated_by: actor,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    source: 'api',
    trace_id: randomUUID(),
    event_name: input.event_name,
    schema_version: input.schema_version,
    payload_schema: input.payload_schema,
    compatibility_mode: 'forward',
    owning_module: input.owning_module,
    status: 'active',
    effective_from: input.effective_from,
  }
  store.eventSchemas.set(id, record)

  if (prior) {
    deprecateEventSchema(store, prior.id, actor)
  }

  recordEvent(store, {
    tenant_id: input.tenant_id,
    entity_id: id,
    event_name: 'core.event_bus.schema_registered',
    actor,
    subject_type: 'event_schema',
    subject_id: id,
    payload: { event_schema_id: id, event_name: input.event_name, version: input.schema_version },
  })

  return record
}

export function deprecateEventSchema(store: Krn06Store, eventSchemaId: string, actor: ActorRef): EventSchemaRecord {
  const record = store.eventSchemas.get(eventSchemaId)
  if (!record) {
    throw new KernelError('EVENT_SCHEMA_NOT_FOUND', `No event_schema with id ${eventSchemaId}`, randomUUID())
  }
  if (!isValidTransition(EVENT_SCHEMA_STATUS_TRANSITIONS, record.status, 'deprecated')) {
    throw new KernelError('ILLEGAL_EVENT_SCHEMA_STATUS_TRANSITION', `Cannot transition event_schema from ${record.status} to deprecated (KRN-06.md §5).`, randomUUID())
  }
  const timestamp = now()
  const updated: EventSchemaRecord = { ...record, status: 'deprecated', updated_at: timestamp, updated_by: actor, version: record.version + 1 }
  store.eventSchemas.set(eventSchemaId, updated)

  recordEvent(store, {
    tenant_id: record.tenant_id,
    entity_id: eventSchemaId,
    event_name: 'core.event_bus.schema_deprecated',
    actor,
    subject_type: 'event_schema',
    subject_id: eventSchemaId,
    payload: { event_schema_id: eventSchemaId, event_name: record.event_name, version: record.schema_version },
  })

  return updated
}

/** `KRN-06-FR-005`'s literal acceptance sample: does `payload` satisfy `schema`'s required fields, ignoring any extra fields a later version might have added? A version-N subscriber checking a version-N+1 payload against its own (older) schema simply never looks at the new optional field. */
export function isPayloadValidForSchema(schema: EventSchemaRecord, payload: Record<string, unknown>): boolean {
  return schema.payload_schema.required_fields.every((f) => Object.prototype.hasOwnProperty.call(payload, f))
}

export function getEventSchema(store: Krn06Store, id: string): EventSchemaRecord | undefined {
  return store.eventSchemas.get(id)
}
