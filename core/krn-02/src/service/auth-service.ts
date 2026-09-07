import { randomUUID } from 'node:crypto'
import type { Krn02Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { Session, SessionStatus, AuthMethod } from '../contracts/session.js'
import { SESSION_STATUS_TRANSITIONS } from '../contracts/session.js'
import type { LoginAttempt } from '../contracts/login-attempt.js'
import { findUserByLoginId } from './user-service.js'
import { verifyPassword } from './credential-service.js'
import { createSession } from './session-service.js'
import { KernelError } from './errors.js'
import { SYSTEM_AUTH_ACTOR } from './system-actors.js'

const LOCKOUT_THRESHOLD = 5
const DEFAULT_IDLE_TIMEOUT_MINUTES = 30
const DEFAULT_ABSOLUTE_TIMEOUT_MINUTES = 720

export interface LoginInput {
  tenant_id: string
  entity_id: string
  login_id: string
  method: AuthMethod
  proof: string
  device_id: string
  ip: string
}

function now() {
  return new Date().toISOString()
}

/**
 * Consecutive non-success attempts for `loginId` since the most recent
 * `success` (or since the beginning, if none) — the window `checkLockout`
 * and `recordLoginAttempt` both count against.
 */
function consecutiveFailures(store: Krn02Store, loginId: string): number {
  const attempts = Array.from(store.loginAttempts.values())
    .filter((a) => a.login_id === loginId)
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))

  let count = 0
  for (const a of attempts) {
    if (a.outcome === 'success') {
      count = 0
    } else {
      count += 1
    }
  }
  return count
}

export function checkLockout(store: Krn02Store, loginId: string, _nowIso: string): { locked: boolean; retryAfterSeconds?: number } {
  const failures = consecutiveFailures(store, loginId)
  if (failures >= LOCKOUT_THRESHOLD) {
    // Progressive delay per KRN-02-FR-004 — a simple exponential backoff
    // proportional to how far past the threshold, sufficient to prove the
    // mechanism without a full sliding-window rate limiter.
    return { locked: true, retryAfterSeconds: Math.min(2 ** (failures - LOCKOUT_THRESHOLD) * 30, 3600) }
  }
  return { locked: false }
}

/**
 * KRN-02-FR-004: 5th consecutive failure within the lockout window locks
 * the account, with progressive delay on each prior attempt (via
 * `checkLockout`'s backoff, evaluated by the caller before each retry).
 * Never records or logs credential material of any kind — `outcome` is
 * the only signal, never the submitted value.
 */
export function recordLoginAttempt(
  store: Krn02Store,
  tenantId: string,
  entityId: string,
  loginId: string,
  outcome: LoginAttempt['outcome'],
  deviceId: string | null,
  ip: string,
): LoginAttempt {
  const id = randomUUID()
  const timestamp = now()
  const systemActor: ActorRef = SYSTEM_AUTH_ACTOR
  const attempt: LoginAttempt = {
    id,
    tenant_id: tenantId,
    entity_id: entityId,
    namespace: 'sys',
    ext: {},
    created_at: timestamp,
    created_by: systemActor,
    updated_at: timestamp,
    updated_by: systemActor,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    source: 'api',
    trace_id: randomUUID(),
    login_id: loginId,
    outcome,
    device_id: deviceId,
    ip,
    occurred_at: timestamp,
  }
  store.loginAttempts.set(id, attempt)

  if (outcome !== 'success') {
    const failures = consecutiveFailures(store, loginId)
    if (failures === LOCKOUT_THRESHOLD) {
      store.emit({
        event_name: 'identity.login.locked_out',
        tenant_id: tenantId,
        entity_id: entityId,
        subject_type: 'login_attempt',
        subject_id: id,
        payload: { login_id: loginId, cooldown_seconds: 30 },
        occurred_at: timestamp,
        recorded_at: timestamp,
        actor: systemActor,
      })
    } else {
      store.emit({
        event_name: 'identity.login.failed',
        tenant_id: tenantId,
        entity_id: entityId,
        subject_type: 'login_attempt',
        subject_id: id,
        payload: { login_id: loginId, attempt_count: failures },
        occurred_at: timestamp,
        recorded_at: timestamp,
        actor: systemActor,
      })
    }
  }

  return attempt
}

/**
 * KRN-02-FR-001/004/005: orchestrates lockout check → credential/OTP/SSO
 * verification → session creation → login_attempt recording, uniformly
 * regardless of `user_type` (internal or `external`, KRN-02-FR-005/DR-002).
 * Throws on lockout or failed verification; the failure is still recorded
 * as a `login_attempt` before the throw.
 *
 * OTP/SSO verification is simplified in this reference implementation:
 * any non-empty `proof` is accepted for `otp`/`sso`/`google_workspace`
 * methods, since real OTP generation/expiry (KRN-09 delivery) and SAML/
 * OIDC assertion validation are out of KRN-02's own scope (§3) and not
 * built yet. `password` verification is real (via `verifyPassword`,
 * hash-compared, never plaintext-compared).
 */
export function login(store: Krn02Store, input: LoginInput): Session {
  const lockout = checkLockout(store, input.login_id, now())
  if (lockout.locked) {
    throw new KernelError('ACCOUNT_LOCKED', `login_id ${input.login_id} is locked out. Retry after ${lockout.retryAfterSeconds}s.`, randomUUID())
  }

  const user = findUserByLoginId(store, input.login_id)
  if (!user || user.status !== 'active') {
    recordLoginAttempt(store, input.tenant_id, input.entity_id, input.login_id, 'failed_credential', input.device_id, input.ip)
    throw new KernelError('LOGIN_FAILED', 'Invalid login_id or credential.', randomUUID())
  }

  const verified = input.method === 'password' ? verifyPassword(store, user.id, input.proof) : input.proof.length > 0

  if (!verified) {
    recordLoginAttempt(store, input.tenant_id, input.entity_id, input.login_id, 'failed_credential', input.device_id, input.ip)
    throw new KernelError('LOGIN_FAILED', 'Invalid login_id or credential.', randomUUID())
  }

  recordLoginAttempt(store, input.tenant_id, input.entity_id, input.login_id, 'success', input.device_id, input.ip)

  const session = createSession(
    store,
    {
      tenant_id: input.tenant_id,
      entity_id: input.entity_id,
      user_id: user.id,
      device_id: input.device_id,
      auth_method_used: input.method,
      idle_timeout_minutes: DEFAULT_IDLE_TIMEOUT_MINUTES,
      absolute_timeout_minutes: DEFAULT_ABSOLUTE_TIMEOUT_MINUTES,
    },
    { type: 'user', id: user.id },
  )

  const timestamp = now()
  store.users.set(user.id, { ...user, last_login_at: timestamp, updated_at: timestamp })

  return session
}

export function logout(store: Krn02Store, sessionId: string, actor: ActorRef): Session {
  const session = store.sessions.get(sessionId)
  if (!session) {
    throw new KernelError('SESSION_NOT_FOUND', `No session with id ${sessionId}`, randomUUID())
  }
  const target: SessionStatus = 'logged_out'
  if (!isValidTransition(SESSION_STATUS_TRANSITIONS, session.status, target)) {
    throw new KernelError('ILLEGAL_SESSION_STATUS_TRANSITION', `Cannot log out a session in status ${session.status}.`, randomUUID())
  }
  const timestamp = now()
  const updated: Session = { ...session, status: target, updated_at: timestamp, updated_by: actor, version: session.version + 1 }
  store.sessions.set(sessionId, updated)
  return updated
}
