import { randomUUID } from 'node:crypto'
import type { Krn06Store, RecordEventInput } from './store.js'
import type { StoredEvent } from '../contracts/event.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

/**
 * `KRN-06-FR-001`: the atomic outbox-write path every producing module's
 * data-access layer calls (never a persona-gated API — §11's negative
 * case "no such endpoint exists" for creating an event directly; KRN-06
 * never authorises the mutation that causes an event, it only durably
 * records that an already-authorised one happened, per §3). No
 * `callerPersona` parameter exists here for exactly that reason.
 */
export function recordEvent(store: Krn06Store, input: RecordEventInput): StoredEvent {
  return store.emit(input)
}

/**
 * `KRN-06-FR-002`: append-only, no update/delete path exists. This
 * function exists only so the guarantee is testable — every branch
 * throws, for every actor including PR-21, with no code path capable of
 * succeeding. A corrected event is a new, compensating event via KRN-18
 * (not built yet, Phase 1), never an edit to this one.
 */
export function attemptEventMutation(_store: Krn06Store, _eventId: string, kind: 'update' | 'delete'): never {
  throw new KernelError('EVENT_IMMUTABLE', `Events are append-only (KRN-06-FR-002) — no ${kind} path exists for any actor, including PR-21.`, randomUUID())
}

export interface EventQueryFilter {
  subject_type?: string
  subject_id?: string
  event_name?: string
  correlation_id?: string
  causation_id?: string
  occurred_from?: string
  occurred_to?: string
}

/**
 * `KRN-06-FR-010`: every read resolves tenant, role and row scope before
 * returning results (L11) — `subjectTypeAllowList` is the pre-resolved
 * scope KRN-06 itself never computes (mirrors KRN-03's `isRowInScope`
 * pattern: the caller, e.g. INT-03 for a PR-29 agent, resolves the
 * agent's declared `data_scope` via KRN-03-DR-002 before calling this
 * function). `null` means unrestricted within the tenant (PR-21 only, per
 * §11's "tenant-wide"); a non-null list silently filters rather than
 * erroring — this is list-query semantics (a WHERE clause), the same
 * "no configured grant means zero visibility, not an error" default-deny
 * KRN-03-DR-001 describes for row scope generally.
 */
export interface EventReadScope {
  tenant_id: string
  subject_type_allow_list: string[] | null
}

/** `KRN-06-FR-003`: per-subject ordering by `occurred_at`, tie-broken by insertion order (stable sort — the effective "sync-assigned monotonic sequence" KRN-06-FR-011 requires, since insertion order already reflects ingestion order). */
export function queryEvents(store: Krn06Store, filter: EventQueryFilter, scope: EventReadScope, callerPersona: PersonaId): StoredEvent[] {
  assertPermission(callerPersona, 'event.read')

  let results = store.events.filter((e) => e.tenant_id === scope.tenant_id)
  if (scope.subject_type_allow_list !== null) {
    const allow = scope.subject_type_allow_list
    results = results.filter((e) => allow.includes(e.subject_type))
  }
  if (filter.subject_type) results = results.filter((e) => e.subject_type === filter.subject_type)
  if (filter.subject_id) results = results.filter((e) => e.subject_id === filter.subject_id)
  if (filter.event_name) results = results.filter((e) => e.event_name === filter.event_name)
  if (filter.correlation_id) results = results.filter((e) => e.correlation_id === filter.correlation_id)
  if (filter.causation_id) results = results.filter((e) => e.causation_id === filter.causation_id)
  if (filter.occurred_from) results = results.filter((e) => e.occurred_at >= filter.occurred_from!)
  if (filter.occurred_to) results = results.filter((e) => e.occurred_at <= filter.occurred_to!)

  return [...results].sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0))
}

/** `KRN-06-FR-003` for one subject specifically — the literal shape of that FR's acceptance sample. */
export function getEventsForSubject(store: Krn06Store, subjectId: string, scope: EventReadScope, callerPersona: PersonaId): StoredEvent[] {
  return queryEvents(store, { subject_id: subjectId }, scope, callerPersona)
}

/**
 * §11 negative case: a specific-event fetch outside the caller's declared
 * scope is a 403, not a silently filtered empty list (unlike the list-query
 * semantics of `queryEvents` above) — closing the loop on L9's "an agent
 * never acts above its trust ceiling" by making the denial explicit and
 * attributable. ("The attempt itself is recorded as an event" per §11 is
 * read as a KRN-10 audit-log concern over denied-access attempts generally,
 * not a new P-08 event type — §12 names no such event, and inventing one
 * unlisted there would be exactly the kind of ID invention L15 forbids.)
 */
export function getEventById(store: Krn06Store, eventId: string, scope: EventReadScope, callerPersona: PersonaId): StoredEvent {
  assertPermission(callerPersona, 'event.read')
  const event = store.events.find((e) => e.event_id === eventId && e.tenant_id === scope.tenant_id)
  if (!event) {
    throw new KernelError('EVENT_NOT_FOUND', `No event with id ${eventId}`, randomUUID())
  }
  if (scope.subject_type_allow_list !== null && !scope.subject_type_allow_list.includes(event.subject_type)) {
    throw new KernelError('FORBIDDEN_OUTSIDE_SCOPE', `Event ${eventId} (subject_type ${event.subject_type}) is outside the caller's declared scope (KRN-06.md §11, L9).`, randomUUID())
  }
  return event
}

/**
 * `KRN-06-DR-001`: reconstructs a journey by `correlation_id` in causal
 * order, and proves the chain has no orphans — every non-root event's
 * `causation_id` must point at another event present in the same
 * correlation set.
 */
export interface JourneyReconstruction {
  correlation_id: string
  events: StoredEvent[]
  orphan_event_ids: string[]
}

export function reconstructJourney(store: Krn06Store, correlationId: string): JourneyReconstruction {
  const events = store.events
    .filter((e) => e.correlation_id === correlationId)
    .sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0))

  const idsInSet = new Set(events.map((e) => e.event_id))
  const orphanEventIds = events
    .filter((e) => e.causation_id !== null && !idsInSet.has(e.causation_id))
    .map((e) => e.event_id)

  return { correlation_id: correlationId, events, orphan_event_ids: orphanEventIds }
}
