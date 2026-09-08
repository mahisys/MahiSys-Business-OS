import { randomUUID } from 'node:crypto'
import type { Krn03Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { PermissionGrant, PermissionSubjectType } from '../contracts/permission-grant.js'
import { PERMISSION_GRANT_STATUS_TRANSITIONS } from '../contracts/permission-grant.js'
import type { PersonaId } from './permissions.js'
import { assertPermission, assertNotAgentActor } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreatePermissionGrantInput {
  tenant_id: string
  subject_type: PermissionSubjectType
  subject_id: string
  role_id: string | null
  permission_set_id: string | null
  scope_override_id: string | null
  expires_at: string | null
}

function now() {
  return new Date().toISOString()
}

/**
 * KRN-03.md §11 negative case: an agent identity is never a valid actor
 * on this write endpoint, unconditionally (L9) — checked via
 * `assertNotAgentActor` before the persona-matrix check, mirroring
 * KRN-02's `createUser` pattern (agent-actor check first, permission
 * check second).
 */
export function grantPermission(store: Krn03Store, input: CreatePermissionGrantInput, actor: ActorRef, callerPersona: PersonaId): PermissionGrant {
  assertNotAgentActor(actor.type, 'permission_grant.grant')
  assertPermission(callerPersona, 'permission_grant.write')

  if (input.role_id === null && input.permission_set_id === null) {
    throw new KernelError('GRANT_TARGET_REQUIRED', 'At least one of role_id/permission_set_id is required (KRN-03.md §4.1).', randomUUID())
  }

  const id = randomUUID()
  const timestamp = now()
  const grant: PermissionGrant = {
    id,
    tenant_id: input.tenant_id,
    entity_id: id,
    namespace: 'tnt',
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
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    role_id: input.role_id,
    permission_set_id: input.permission_set_id,
    scope_override_id: input.scope_override_id,
    granted_at: timestamp,
    granted_by: actor,
    expires_at: input.expires_at,
    status: 'active',
  }
  store.permissionGrants.set(id, grant)

  store.emit({
    event_name: 'access.role.granted',
    tenant_id: grant.tenant_id,
    entity_id: id,
    subject_type: 'permission_grant',
    subject_id: id,
    payload: { permission_grant_id: id, subject_type: input.subject_type, subject_id: input.subject_id },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return grant
}

function transition(store: Krn03Store, grant: PermissionGrant, target: PermissionGrant['status'], actor: ActorRef): PermissionGrant {
  if (!isValidTransition(PERMISSION_GRANT_STATUS_TRANSITIONS, grant.status, target)) {
    throw new KernelError('ILLEGAL_PERMISSION_GRANT_STATUS_TRANSITION', `Cannot transition permission_grant from ${grant.status} to ${target} (KRN-03.md §5).`, randomUUID(), { from: grant.status, to: target })
  }
  const timestamp = now()
  const updated: PermissionGrant = { ...grant, status: target, updated_at: timestamp, updated_by: actor, version: grant.version + 1 }
  store.permissionGrants.set(grant.id, updated)
  return updated
}

export function revokePermission(store: Krn03Store, permissionGrantId: string, actor: ActorRef, callerPersona: PersonaId): PermissionGrant {
  assertPermission(callerPersona, 'permission_grant.write')

  const grant = store.permissionGrants.get(permissionGrantId)
  if (!grant) {
    throw new KernelError('PERMISSION_GRANT_NOT_FOUND', `No permission_grant with id ${permissionGrantId}`, randomUUID())
  }
  const updated = transition(store, grant, 'revoked', actor)

  store.emit({
    event_name: 'access.role.revoked',
    tenant_id: grant.tenant_id,
    entity_id: permissionGrantId,
    subject_type: 'permission_grant',
    subject_id: permissionGrantId,
    payload: { permission_grant_id: permissionGrantId, subject_type: grant.subject_type, subject_id: grant.subject_id },
    occurred_at: updated.updated_at,
    recorded_at: updated.updated_at,
    actor,
  })

  return updated
}

/** KRN-03.md §5: `expires_at`-driven system transition. Evaluated against a supplied "now" for testability, mirroring KRN-02's `checkSessionTimeout`. */
export function checkPermissionGrantExpiry(store: Krn03Store, permissionGrantId: string, nowIso: string, systemActor: ActorRef): PermissionGrant {
  const grant = store.permissionGrants.get(permissionGrantId)
  if (!grant) {
    throw new KernelError('PERMISSION_GRANT_NOT_FOUND', `No permission_grant with id ${permissionGrantId}`, randomUUID())
  }
  if (grant.status !== 'active' || grant.expires_at === null || new Date(nowIso).getTime() < new Date(grant.expires_at).getTime()) {
    return grant
  }
  const updated = transition(store, grant, 'expired', systemActor)

  store.emit({
    event_name: 'access.permission_grant.expired',
    tenant_id: grant.tenant_id,
    entity_id: permissionGrantId,
    subject_type: 'permission_grant',
    subject_id: permissionGrantId,
    payload: { permission_grant_id: permissionGrantId, subject_type: grant.subject_type, subject_id: grant.subject_id },
    occurred_at: nowIso,
    recorded_at: now(),
    actor: systemActor,
  })

  return updated
}

/**
 * KRN-03.md §12 consumed events: `identity.user.deactivated` /
 * `identity.agent.*` → `retired` (KRN-02). Represents the handler that
 * subscribing to those events would invoke — every active
 * `permission_grant` for the deactivated/retired subject transitions to
 * `revoked`, closing access without a separate manual step.
 */
export function revokeGrantsForSubject(store: Krn03Store, subjectType: PermissionSubjectType, subjectId: string, systemActor: ActorRef): PermissionGrant[] {
  const affected = Array.from(store.permissionGrants.values()).filter((g) => g.subject_type === subjectType && g.subject_id === subjectId && g.status === 'active')
  return affected.map((grant) => {
    const updated = transition(store, grant, 'revoked', systemActor)
    store.emit({
      event_name: 'access.role.revoked',
      tenant_id: grant.tenant_id,
      entity_id: grant.id,
      subject_type: 'permission_grant',
      subject_id: grant.id,
      payload: { permission_grant_id: grant.id, subject_type: grant.subject_type, subject_id: grant.subject_id },
      occurred_at: updated.updated_at,
      recorded_at: updated.updated_at,
      actor: systemActor,
    })
    return updated
  })
}

export function getPermissionGrant(store: Krn03Store, id: string): PermissionGrant | undefined {
  return store.permissionGrants.get(id)
}
