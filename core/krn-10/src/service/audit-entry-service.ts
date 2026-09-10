import { randomUUID } from 'node:crypto'
import { computeEntryHash, type Krn10Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { AuditEntry, AuditAction } from '../contracts/audit-entry.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { logAccess } from './access-log-service.js'
import { KernelError } from './errors.js'

export interface RecordAuditEntryInput {
  tenant_id: string
  subject_type: string
  subject_id: string
  action: AuditAction
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  actor: ActorRef
  occurred_at?: string
  ip_address?: string | null
  device_id?: string | null
  source: 'ui' | 'api' | 'import' | 'agent' | 'integration' | 'offline_sync'
  trace_id: string
  reversal_handle?: string | null
  reasoning_trace?: string | null
  confidence_score?: number | null
  evidence_refs?: string[] | null
}

function now() {
  return new Date().toISOString()
}

/**
 * `KRN-10-FR-001`: the single atomic capture function — called
 * synchronously by a producing module's own data-access layer within the
 * same transaction as its mutation (§17 item 2's resolved assumption),
 * exactly as `@mahisys/krn-06`'s `recordEvent()` is. Not persona-gated
 * (§11: system-generated only, no authorable path exists at all — the
 * entire point of an audit log). `KRN-10-FR-008` requires
 * `reversal_handle` on every entry, human or agent; `KRN-10-DR-001`
 * requires the four agent-only fields present if and only if the actor is
 * an agent — both enforced here, not left to the caller's discipline.
 */
export function recordAuditEntry(store: Krn10Store, input: RecordAuditEntryInput): AuditEntry {
  const isAgent = input.actor.type === 'agent'
  if (isAgent && (input.reasoning_trace == null || input.confidence_score == null || input.evidence_refs == null)) {
    throw new KernelError('AGENT_AUDIT_FIELDS_REQUIRED', 'An agent-authored audit_entry must carry reasoning_trace, confidence_score and evidence_refs (KRN-10-DR-001).', randomUUID())
  }
  if (!isAgent && (input.reasoning_trace != null || input.confidence_score != null || input.evidence_refs != null)) {
    throw new KernelError('AGENT_AUDIT_FIELDS_NOT_APPLICABLE', 'reasoning_trace/confidence_score/evidence_refs are only meaningful for an agent actor (KRN-10-DR-001).', randomUUID())
  }

  const cursor = store.nextChainLink(input.tenant_id)
  const sequenceNo = cursor.lastSequenceNo + 1
  const timestamp = now()
  const occurredAt = input.occurred_at ?? timestamp

  const canonical = {
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    action: input.action,
    before: input.before,
    after: input.after,
    actor: input.actor,
    occurred_at: occurredAt,
    sequence_no: sequenceNo,
  }
  const entryHash = computeEntryHash(cursor.lastHash, canonical)

  const entry: AuditEntry = {
    audit_entry_id: randomUUID(),
    tenant_id: input.tenant_id,
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    action: input.action,
    before: input.before,
    after: input.after,
    actor: input.actor,
    occurred_at: occurredAt,
    recorded_at: timestamp,
    ip_address: input.ip_address ?? null,
    device_id: input.device_id ?? null,
    source: input.source,
    trace_id: input.trace_id,
    reversal_handle: input.reversal_handle ?? null,
    reasoning_trace: isAgent ? (input.reasoning_trace ?? null) : null,
    confidence_score: isAgent ? (input.confidence_score ?? null) : null,
    evidence_refs: isAgent ? (input.evidence_refs ?? null) : null,
    sequence_no: sequenceNo,
    prev_hash: cursor.lastHash,
    entry_hash: entryHash,
  }

  store.auditEntries.push(entry)
  store.advanceChain(input.tenant_id, sequenceNo, entryHash)

  return entry
}

export interface AuditEntryFilter {
  subject_type?: string
  subject_id?: string
  actor_id?: string
  action?: AuditAction
}

/**
 * `KRN-10.md §11`: self-scope is always readable (`audit_entry.read_own`);
 * reading someone else's actions needs `audit_entry.read_cross`, gated by
 * a pre-resolved domain scope (financial/HR/agent-summary — never
 * computed by KRN-10 itself, L3, mirrors KRN-06's `EventReadScope`
 * pattern) — and per `KRN-10-FR-007`, a cross-persona read is itself
 * logged to `access_log`, closing the loop on "who examined whose audit
 * trail."
 */
export interface AuditReadScope {
  tenant_id: string
  subject_type_allow_list: string[] | null
}

export function readAuditEntries(
  store: Krn10Store,
  filter: AuditEntryFilter,
  scope: AuditReadScope,
  callerPersona: PersonaId,
  callerActorId: string,
  callerActor: ActorRef,
): AuditEntry[] {
  const isOwnOnly = filter.actor_id === callerActorId
  assertPermission(callerPersona, isOwnOnly ? 'audit_entry.read_own' : 'audit_entry.read_cross')

  let results = store.auditEntries.filter((e) => e.tenant_id === scope.tenant_id)
  if (scope.subject_type_allow_list !== null) {
    const allow = scope.subject_type_allow_list
    results = results.filter((e) => allow.includes(e.subject_type))
  }
  if (filter.subject_type) results = results.filter((e) => e.subject_type === filter.subject_type)
  if (filter.subject_id) results = results.filter((e) => e.subject_id === filter.subject_id)
  if (filter.actor_id) results = results.filter((e) => e.actor.id === filter.actor_id)
  if (filter.action) results = results.filter((e) => e.action === filter.action)

  if (!isOwnOnly) {
    // KRN-10-FR-007: examining another actor's audit history is itself logged.
    logAccess(store, {
      tenant_id: scope.tenant_id,
      subject_type: 'audit_entry',
      subject_id: filter.actor_id ?? filter.subject_id ?? scope.tenant_id,
      fields_viewed: ['audit_entry.*'],
      actor: callerActor,
      source: 'api',
    })
  }

  return results
}
