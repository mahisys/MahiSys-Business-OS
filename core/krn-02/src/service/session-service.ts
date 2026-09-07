import { randomUUID } from 'node:crypto'
import type { Krn02Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { Session, SessionStatus, AuthMethod } from '../contracts/session.js'
import { SESSION_STATUS_TRANSITIONS } from '../contracts/session.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'
import { SYSTEM_TIMEOUT_CHECKER_ACTOR } from './system-actors.js'

export interface CreateSessionInput {
  tenant_id: string
  entity_id: string
  user_id: string
  device_id: string
  auth_method_used: AuthMethod
  idle_timeout_minutes: number
  absolute_timeout_minutes: number
}

function now() {
  return new Date().toISOString()
}

/** Internal — called by auth-service.login() on successful authentication, never called directly by an API caller. */
export function createSession(store: Krn02Store, input: CreateSessionInput, actor: ActorRef): Session {
  const id = randomUUID()
  const timestamp = now()
  const session: Session = {
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
    user_id: input.user_id,
    device_id: input.device_id,
    started_at: timestamp,
    last_active_at: timestamp,
    idle_timeout_minutes: input.idle_timeout_minutes,
    absolute_timeout_minutes: input.absolute_timeout_minutes,
    status: 'active',
    revoked_by: null,
    revoked_reason: null,
    auth_method_used: input.auth_method_used,
    is_impersonation: false,
    impersonated_by_user_id: null,
  }
  store.sessions.set(id, session)

  store.emit({
    event_name: 'identity.session.started',
    tenant_id: session.tenant_id,
    entity_id: session.entity_id,
    subject_type: 'session',
    subject_id: id,
    payload: { session_id: id, user_id: input.user_id, auth_method_used: input.auth_method_used },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return session
}

function transitionSession(store: Krn02Store, session: Session, target: SessionStatus, actor: ActorRef): Session {
  if (!isValidTransition(SESSION_STATUS_TRANSITIONS, session.status, target)) {
    throw new KernelError(
      'ILLEGAL_SESSION_STATUS_TRANSITION',
      `Cannot transition session from ${session.status} to ${target} (KRN-02.md §5).`,
      randomUUID(),
      { from: session.status, to: target },
    )
  }
  const timestamp = now()
  const updated: Session = { ...session, status: target, updated_at: timestamp, updated_by: actor, version: session.version + 1 }
  store.sessions.set(session.id, updated)
  return updated
}

/**
 * KRN-02-FR-002: individual revoke. Self-revoke (the caller revoking
 * their own session) is always allowed regardless of `callerPersona`;
 * revoking *another* user's session requires `session.revoke_any`.
 */
export function revokeSession(
  store: Krn02Store,
  sessionId: string,
  actor: ActorRef,
  callerPersona: PersonaId,
  callerUserId: string,
  reason?: string,
): Session {
  const session = store.sessions.get(sessionId)
  if (!session) {
    throw new KernelError('SESSION_NOT_FOUND', `No session with id ${sessionId}`, randomUUID())
  }

  const isSelfRevoke = session.user_id === callerUserId
  if (!isSelfRevoke) {
    assertPermission(callerPersona, 'session.revoke_any')
  }

  const updated = transitionSession(store, session, 'revoked', actor)
  const withReason: Session = { ...updated, revoked_by: actor.type === 'user' ? actor.id : null, revoked_reason: reason ?? null }
  store.sessions.set(sessionId, withReason)

  store.emit({
    event_name: 'identity.session.revoked',
    tenant_id: session.tenant_id,
    entity_id: session.entity_id,
    subject_type: 'session',
    subject_id: sessionId,
    payload: { session_id: sessionId, user_id: session.user_id, reason },
    occurred_at: withReason.updated_at,
    recorded_at: withReason.updated_at,
    actor,
  })

  return withReason
}

/** KRN-02-FR-002: bulk revoke — every session across every device for the target user ends immediately. */
export function bulkRevokeUserSessions(
  store: Krn02Store,
  targetUserId: string,
  actor: ActorRef,
  callerPersona: PersonaId,
  reason?: string,
): Session[] {
  assertPermission(callerPersona, 'session.revoke_any')

  const results: Session[] = []
  for (const session of store.sessions.values()) {
    if (session.user_id === targetUserId && session.status === 'active') {
      const updated = transitionSession(store, session, 'revoked', actor)
      const withReason: Session = { ...updated, revoked_by: actor.type === 'user' ? actor.id : null, revoked_reason: reason ?? null }
      store.sessions.set(session.id, withReason)
      store.emit({
        event_name: 'identity.session.revoked',
        tenant_id: session.tenant_id,
        entity_id: session.entity_id,
        subject_type: 'session',
        subject_id: session.id,
        payload: { session_id: session.id, user_id: targetUserId, reason },
        occurred_at: withReason.updated_at,
        recorded_at: withReason.updated_at,
        actor,
      })
      results.push(withReason)
    } else if (session.user_id === targetUserId) {
      results.push(session) // already inactive — included for completeness, untouched
    }
  }
  return results
}

/** KRN-02-FR-002: system-driven idle/absolute timeout check, evaluated against a supplied "now" for testability. */
export function checkSessionTimeout(store: Krn02Store, sessionId: string, nowIso: string): Session {
  const session = store.sessions.get(sessionId)
  if (!session) {
    throw new KernelError('SESSION_NOT_FOUND', `No session with id ${sessionId}`, randomUUID())
  }
  if (session.status !== 'active') return session

  const nowMs = new Date(nowIso).getTime()
  const idleDeadline = new Date(session.last_active_at).getTime() + session.idle_timeout_minutes * 60_000
  const absoluteDeadline = new Date(session.started_at).getTime() + session.absolute_timeout_minutes * 60_000

  let target: SessionStatus | null = null
  let reason: 'idle' | 'absolute' | null = null
  if (nowMs >= absoluteDeadline) {
    target = 'absolute_timed_out'
    reason = 'absolute'
  } else if (nowMs >= idleDeadline) {
    target = 'idle_timed_out'
    reason = 'idle'
  }
  if (!target) return session

  const updated = transitionSession(store, session, target, SYSTEM_TIMEOUT_CHECKER_ACTOR)
  store.emit({
    event_name: 'identity.session.timed_out',
    tenant_id: session.tenant_id,
    entity_id: session.entity_id,
    subject_type: 'session',
    subject_id: sessionId,
    payload: { session_id: sessionId, user_id: session.user_id, reason },
    occurred_at: nowIso,
    recorded_at: now(),
    actor: SYSTEM_TIMEOUT_CHECKER_ACTOR,
  })
  return updated
}

/** KRN-02-FR-003: impersonation start — PR-21 only. */
export function startImpersonation(
  store: Krn02Store,
  adminUserId: string,
  targetUserId: string,
  reason: string,
  actor: ActorRef,
  callerPersona: PersonaId,
): Session {
  assertPermission(callerPersona, 'impersonation.start')

  const targetUser = store.users.get(targetUserId)
  if (!targetUser) {
    throw new KernelError('USER_NOT_FOUND', `No user with id ${targetUserId}`, randomUUID())
  }

  const id = randomUUID()
  const timestamp = now()
  const session: Session = {
    id,
    // Resolved from the target user — user and session are both KRN-02-owned
    // (same store), not a cross-module reach (L3).
    tenant_id: targetUser.tenant_id,
    entity_id: targetUser.entity_id,
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
    user_id: targetUserId,
    device_id: 'impersonation-console',
    started_at: timestamp,
    last_active_at: timestamp,
    idle_timeout_minutes: 30,
    absolute_timeout_minutes: 120,
    status: 'active',
    revoked_by: null,
    revoked_reason: null,
    auth_method_used: 'sso',
    is_impersonation: true,
    impersonated_by_user_id: adminUserId,
  }
  store.sessions.set(id, session)

  store.emit({
    event_name: 'identity.impersonation.started',
    tenant_id: session.tenant_id,
    entity_id: session.entity_id,
    subject_type: 'session',
    subject_id: id,
    payload: { session_id: id, impersonating_user_id: adminUserId, impersonated_user_id: targetUserId, reason },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return session
}

/**
 * KRN-02.md §10: `POST /api/v1/identity/impersonation/start | /end` is
 * PR-21 only for both — `end` shares `impersonation.start`'s grant since
 * §11's matrix has no separate column for it (found alongside D-33, same
 * "no Krn02Action corresponds to this write path" sweep).
 */
export function endImpersonation(store: Krn02Store, sessionId: string, actor: ActorRef, callerPersona: PersonaId): Session {
  assertPermission(callerPersona, 'impersonation.start')

  const session = store.sessions.get(sessionId)
  if (!session) {
    throw new KernelError('SESSION_NOT_FOUND', `No session with id ${sessionId}`, randomUUID())
  }
  const updated = transitionSession(store, session, 'revoked', actor)

  store.emit({
    event_name: 'identity.impersonation.ended',
    tenant_id: session.tenant_id,
    entity_id: session.entity_id,
    subject_type: 'session',
    subject_id: sessionId,
    payload: { session_id: sessionId, impersonating_user_id: session.impersonated_by_user_id, impersonated_user_id: session.user_id },
    occurred_at: updated.updated_at,
    recorded_at: updated.updated_at,
    actor,
  })

  return updated
}

/**
 * KRN-02-FR-003: the guard every posting-capable module would call before
 * a financial write. Throws unconditionally if the session is an
 * impersonation session, regardless of the impersonated user's own
 * permissions.
 */
export function assertNotImpersonationForPosting(session: Session): void {
  if (session.is_impersonation) {
    throw new KernelError(
      'FORBIDDEN_IMPERSONATION_POSTING',
      'A financial posting action may never be performed during an impersonation session (KRN-02-FR-003).',
      randomUUID(),
    )
  }
}
