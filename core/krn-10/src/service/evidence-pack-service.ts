import { randomUUID } from 'node:crypto'
import type { Krn10Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { AuditEntry } from '../contracts/audit-entry.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { recordAuditEntry } from './audit-entry-service.js'

export interface EvidencePackFilter {
  subject_type?: string
  date_range: { from: string; to: string }
}

export interface EvidencePackResult {
  entries: AuditEntry[]
  generated_at: string
  generated_by: string
}

/**
 * `KRN-10-FR-004`: PR-21/PR-16/PR-17 generate a bounded, scoped export —
 * never issuing PR-25/PR-26 (the eventual recipients) any system access
 * (§11's own note, see permissions.ts's header). `KRN-10-FR-007`: the
 * generation itself is logged, as a new `audit_entry` whose subject is
 * the evidence pack action itself — so "who examined the CFO's audit
 * trail via an export" is answerable the same way a direct query is.
 */
export function generateEvidencePack(store: Krn10Store, tenantId: string, filter: EvidencePackFilter, scope: { subject_type_allow_list: string[] | null }, actor: ActorRef, callerPersona: PersonaId): EvidencePackResult {
  assertPermission(callerPersona, 'evidence_pack.export')

  let entries = store.auditEntries.filter((e) => e.tenant_id === tenantId && e.occurred_at >= filter.date_range.from && e.occurred_at <= filter.date_range.to)
  if (scope.subject_type_allow_list !== null) {
    const allow = scope.subject_type_allow_list
    entries = entries.filter((e) => allow.includes(e.subject_type))
  }
  if (filter.subject_type) entries = entries.filter((e) => e.subject_type === filter.subject_type)

  const generatedAt = new Date().toISOString()

  recordAuditEntry(store, {
    tenant_id: tenantId,
    subject_type: 'evidence_pack',
    subject_id: randomUUID(),
    action: 'other',
    before: null,
    after: { entry_count: entries.length, date_range: filter.date_range, subject_type: filter.subject_type ?? null },
    actor,
    source: 'api',
    trace_id: randomUUID(),
  })

  store.emitAdministrative({
    tenant_id: tenantId,
    entity_id: tenantId,
    event_name: 'audit.evidence_pack.generated',
    actor,
    subject_type: 'evidence_pack',
    subject_id: actor.id,
    payload: { requested_by: actor.id, entry_count: entries.length },
  })

  return { entries, generated_at: generatedAt, generated_by: actor.id }
}
