/**
 * In-memory reference store for KRN-06. Same rationale as KRN-01/02/03/04's:
 * makes the business rules in KRN-06.md provably correct via acceptance
 * tests before any real persistence layer (Postgres outbox + relay worker,
 * D-12 stack-bound) is wired up.
 *
 * `events` is simultaneously the owned `event` entity table AND the log
 * every conformance test loops over — deliberately unified, because
 * KRN-06.md §12 says its own administrative events (subscription
 * created/paused/disabled, etc.) "flow through the same outbox pattern as
 * any other module's mutations... recursive, but consistent." There is no
 * separate side-channel: `recordEvent()` below is the one FR-001 atomic
 * write path, called both by simulated "producing module" test scenarios
 * and by every other function in this module for its own mutations.
 */
import { randomUUID } from 'node:crypto'
import type { ActorRef } from '@mahisys/shared'
import { EventNameSchema, isValidTransition } from '@mahisys/shared'
import { OUTBOX_STATUS_TRANSITIONS } from '../contracts/outbox.js'
import type { StoredEvent } from '../contracts/event.js'
import type { OutboxEntry } from '../contracts/outbox.js'
import type { EventSchemaRecord } from '../contracts/event-schema.js'
import type { Subscription } from '../contracts/subscription.js'
import type { DeliveryAttempt } from '../contracts/delivery-attempt.js'
import type { DeadLetter } from '../contracts/dead-letter.js'
import { KernelError } from './errors.js'

export interface RecordEventInput {
  tenant_id: string
  entity_id: string
  event_name: string
  actor: ActorRef
  subject_type: string
  subject_id: string
  payload: Record<string, unknown>
  /** Event time — defaults to now. Set explicitly for offline-sync-originated events (KRN-06-FR-011), where it precedes `recorded_at` by hours. */
  occurred_at?: string
  causation_id?: string | null
  correlation_id?: string
  reversal_handle?: string | null
}

export class Krn06Store {
  events: StoredEvent[] = []
  outbox = new Map<string, OutboxEntry>()
  eventSchemas = new Map<string, EventSchemaRecord>()
  subscriptions = new Map<string, Subscription>()
  deliveryAttempts = new Map<string, DeliveryAttempt>()
  deadLetters = new Map<string, DeadLetter>()
  /** Not a KRN-06.md §4.1 owned entity — a minimal per-tenant setting backing KRN-06-FR-009, see event-schema-service.ts sibling `retention-service.ts`. */
  retentionByTenant = new Map<string, number>()

  /**
   * `KRN-06-FR-001`: writes the `event` row and its `outbox` entry
   * together, with no code path that can produce one without the other —
   * the in-memory analogue of "same database transaction as the write
   * that caused it." Validates first; on any validation failure nothing
   * is pushed to either collection (the rollback the acceptance criterion
   * describes). Immediately "publishes" the outbox entry (no separate
   * worker/process boundary exists in this reference implementation, see
   * outbox.ts's header note) but keeps the two collections distinct so
   * `outbox.status` remains independently observable, matching §5's state
   * machine.
   */
  emit(input: RecordEventInput): StoredEvent {
    if (!EventNameSchema.safeParse(input.event_name).success) {
      throw new KernelError('INVALID_EVENT_NAME', `"${input.event_name}" is not a valid module.entity.verb_past event name (Vol 0 §42).`, randomUUID())
    }
    const recordedAt = new Date().toISOString()
    const event: StoredEvent = {
      event_id: randomUUID(),
      tenant_id: input.tenant_id,
      entity_id: input.entity_id,
      event_name: input.event_name,
      schema_version: 1,
      occurred_at: input.occurred_at ?? recordedAt,
      recorded_at: recordedAt,
      actor: input.actor,
      subject_type: input.subject_type,
      subject_id: input.subject_id,
      payload: input.payload,
      causation_id: input.causation_id ?? null,
      correlation_id: input.correlation_id ?? randomUUID(),
      trace_id: randomUUID(),
      reversal_handle: input.reversal_handle ?? null,
    }
    this.events.push(event)
    const outboxEntry: OutboxEntry = {
      id: randomUUID(),
      tenant_id: event.tenant_id,
      entity_id: event.event_id,
      namespace: 'tnt',
      ext: {},
      created_at: recordedAt,
      created_by: input.actor,
      updated_at: recordedAt,
      updated_by: input.actor,
      version: 1,
      deleted_at: null,
      deleted_by: null,
      source: 'api',
      trace_id: event.trace_id,
      event_id: event.event_id,
      status: 'pending',
      published_at: null,
    }
    this.outbox.set(event.event_id, outboxEntry)
    // The relay worker's job (§5) — run synchronously here since this
    // reference implementation has no separate process boundary to poll
    // across (outbox.ts header note). Still a distinct, transition-checked
    // step so `OUTBOX_STATUS_TRANSITIONS` is a real state machine, not a
    // hardcoded literal.
    this.publishOutboxEntry(event.event_id)
    return event
  }

  publishOutboxEntry(eventId: string): OutboxEntry {
    const entry = this.outbox.get(eventId)
    if (!entry) {
      throw new KernelError('OUTBOX_ENTRY_NOT_FOUND', `No outbox entry for event ${eventId}`, randomUUID())
    }
    if (!isValidTransition(OUTBOX_STATUS_TRANSITIONS, entry.status, 'published')) {
      throw new KernelError('ILLEGAL_OUTBOX_STATUS_TRANSITION', `Cannot transition outbox entry from ${entry.status} to published (KRN-06.md §5).`, randomUUID())
    }
    const publishedAt = new Date().toISOString()
    const updated: OutboxEntry = { ...entry, status: 'published', published_at: publishedAt, updated_at: publishedAt, version: entry.version + 1 }
    this.outbox.set(eventId, updated)
    return updated
  }
}

export function createStore(): Krn06Store {
  return new Krn06Store()
}
