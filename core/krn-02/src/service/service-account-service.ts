import { randomUUID } from 'node:crypto'
import type { Krn02Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { ServiceAccount } from '../contracts/service-account.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'
import { SYSTEM_ROTATION_SCHEDULER_ACTOR } from './system-actors.js'

export interface CreateServiceAccountInput {
  tenant_id: string
  entity_id: string
  code: string
  name: string
  owning_integration: string | null
  rate_limit: { requests_per_minute: number }
  credential_rotation_policy_days: number
}

function now() {
  return new Date().toISOString()
}

export function createServiceAccount(store: Krn02Store, input: CreateServiceAccountInput, actor: ActorRef, callerPersona: PersonaId): ServiceAccount {
  assertPermission(callerPersona, 'service_account.manage')

  const id = randomUUID()
  const timestamp = now()
  const sa: ServiceAccount = {
    id,
    tenant_id: input.tenant_id,
    entity_id: input.entity_id,
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
    code: input.code,
    name: input.name,
    owning_integration: input.owning_integration,
    rate_limit: input.rate_limit,
    credential_rotation_policy_days: input.credential_rotation_policy_days,
    status: 'active',
  }
  store.serviceAccounts.set(id, sa)
  return sa
}

function emitRotated(store: Krn02Store, sa: ServiceAccount, actor: ActorRef, rotatedAt: string) {
  store.emit({
    event_name: 'identity.service_account.credential_rotated',
    tenant_id: sa.tenant_id,
    entity_id: sa.entity_id,
    subject_type: 'service_account',
    subject_id: sa.id,
    payload: { service_account_id: sa.id, rotated_at: rotatedAt },
    occurred_at: rotatedAt,
    recorded_at: rotatedAt,
    actor,
  })
}

export function rotateServiceAccountCredential(store: Krn02Store, serviceAccountId: string, actor: ActorRef, callerPersona: PersonaId): ServiceAccount {
  assertPermission(callerPersona, 'service_account.manage')

  const sa = store.serviceAccounts.get(serviceAccountId)
  if (!sa) {
    throw new KernelError('SERVICE_ACCOUNT_NOT_FOUND', `No service account with id ${serviceAccountId}`, randomUUID())
  }
  const timestamp = now()
  const updated: ServiceAccount = { ...sa, updated_at: timestamp, updated_by: actor, version: sa.version + 1 }
  store.serviceAccounts.set(serviceAccountId, updated)
  emitRotated(store, updated, actor, timestamp)
  return updated
}

/**
 * KRN-02-FR-006: automatic rotation when the rotation window elapses
 * without manual rotation. Evaluated against a supplied "now" for
 * testability; returns null if no rotation was due.
 */
export function checkAndAutoRotateIfDue(store: Krn02Store, serviceAccountId: string, nowIso: string): ServiceAccount | null {
  const sa = store.serviceAccounts.get(serviceAccountId)
  if (!sa) {
    throw new KernelError('SERVICE_ACCOUNT_NOT_FOUND', `No service account with id ${serviceAccountId}`, randomUUID())
  }
  const rotationDueAtMs = new Date(sa.updated_at).getTime() + sa.credential_rotation_policy_days * 24 * 60 * 60_000
  if (new Date(nowIso).getTime() < rotationDueAtMs) {
    return null // not due yet
  }
  const updated: ServiceAccount = { ...sa, updated_at: nowIso, updated_by: SYSTEM_ROTATION_SCHEDULER_ACTOR, version: sa.version + 1 }
  store.serviceAccounts.set(serviceAccountId, updated)
  emitRotated(store, updated, SYSTEM_ROTATION_SCHEDULER_ACTOR, nowIso)
  return updated
}
