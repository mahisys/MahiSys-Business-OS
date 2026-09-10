import { randomUUID } from 'node:crypto'
import type { Krn10Store } from './store.js'
import type { ActorRef, Source } from '@mahisys/shared'
import type { AccessLog } from '../contracts/access-log.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'

export interface LogAccessInput {
  tenant_id: string
  subject_type: string
  subject_id: string
  fields_viewed: string[]
  actor: ActorRef
  ip_address?: string | null
  source: Source
}

function now() {
  return new Date().toISOString()
}

/**
 * `KRN-10-FR-003`: written directly by the data-access layer at read time
 * (§17 item 2) — the caller (a KRN-04-aware module data-access layer)
 * decides *which* fields are `is_sensitive` (L3: that declaration is
 * KRN-04's, never KRN-10's to redefine); this function only records the
 * fact once told. Not persona-gated — same "system-generated only"
 * rationale as `recordAuditEntry`.
 */
export function logAccess(store: Krn10Store, input: LogAccessInput): AccessLog {
  const entry: AccessLog = {
    access_log_id: randomUUID(),
    tenant_id: input.tenant_id,
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    fields_viewed: input.fields_viewed,
    actor: input.actor,
    occurred_at: now(),
    ip_address: input.ip_address ?? null,
    source: input.source,
    trace_id: randomUUID(),
  }
  store.accessLogs.push(entry)
  return entry
}

export interface AccessLogFilter {
  subject_type?: string
  subject_id?: string
  actor_id?: string
}

/** `KRN-10.md §11`: `access_log.read` — PR-21 tenant-wide, PR-16/PR-17 scoped to their own domain's sensitive entities. `domainAllowList` is the pre-resolved scope (L3, same pattern as `AuditReadScope`). */
export function readAccessLog(store: Krn10Store, tenantId: string, filter: AccessLogFilter, domainAllowList: string[] | null, callerPersona: PersonaId): AccessLog[] {
  assertPermission(callerPersona, 'access_log.read')

  let results = store.accessLogs.filter((a) => a.tenant_id === tenantId)
  if (domainAllowList !== null) {
    results = results.filter((a) => domainAllowList.includes(a.subject_type))
  }
  if (filter.subject_type) results = results.filter((a) => a.subject_type === filter.subject_type)
  if (filter.subject_id) results = results.filter((a) => a.subject_id === filter.subject_id)
  if (filter.actor_id) results = results.filter((a) => a.actor.id === filter.actor_id)
  return results
}
