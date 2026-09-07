import { randomUUID } from 'node:crypto'
import type { Krn02Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { User, UserType } from '../contracts/user.js'
import { USER_STATUS_TRANSITIONS } from '../contracts/user.js'
import type { PersonaId } from './permissions.js'
import { assertPermission, assertNotAgentActor } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateUserInput {
  tenant_id: string
  entity_id: string
  party_id: string | null
  user_type: UserType
  login_id: string
  locale: string
}

function now() {
  return new Date().toISOString()
}

export function createUser(store: Krn02Store, input: CreateUserInput, actor: ActorRef, callerPersona: PersonaId): User {
  assertNotAgentActor(actor.type, 'user.create')
  assertPermission(callerPersona, 'user.create')

  const existing = findUserByLoginId(store, input.login_id)
  if (existing) {
    throw new KernelError('LOGIN_ID_ALREADY_EXISTS', `login_id ${input.login_id} is already in use (tenant-unique, KRN-02.md §4.1).`, randomUUID())
  }

  const id = randomUUID()
  const timestamp = now()
  const user: User = {
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
    party_id: input.party_id,
    user_type: input.user_type,
    login_id: input.login_id,
    status: 'pending',
    locale: input.locale,
    mfa_enrolments: [],
    last_login_at: null,
  }
  store.users.set(id, user)

  store.emit({
    event_name: 'identity.user.created',
    tenant_id: user.tenant_id,
    entity_id: user.entity_id,
    subject_type: 'user',
    subject_id: id,
    payload: { user_id: id, user_type: user.user_type },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return user
}

/**
 * Explicit activation step, mirroring KRN-01's `createTenant` (starts
 * `trial`) / `transitionTenantLifecycle` (`activate`) pattern: creation
 * and activation are separate, auditable transitions, not one implicit
 * step — consistent with `pending` being a real, observable state in
 * KRN-02.md §5 (reserved for e.g. an invite-based self-registration flow
 * not yet built) rather than a state no created user ever occupies.
 */
export function activateUser(store: Krn02Store, userId: string, actor: ActorRef): User {
  const user = store.users.get(userId)
  if (!user) {
    throw new KernelError('USER_NOT_FOUND', `No user with id ${userId}`, randomUUID())
  }
  if (!isValidTransition(USER_STATUS_TRANSITIONS, user.status, 'active')) {
    throw new KernelError(
      'ILLEGAL_USER_STATUS_TRANSITION',
      `Cannot transition user from ${user.status} to active (KRN-02.md §5).`,
      randomUUID(),
      { from: user.status, to: 'active' },
    )
  }

  const timestamp = now()
  const updated: User = { ...user, status: 'active', updated_at: timestamp, updated_by: actor, version: user.version + 1 }
  store.users.set(userId, updated)

  store.emit({
    event_name: 'identity.user.activated',
    tenant_id: user.tenant_id,
    entity_id: user.entity_id,
    subject_type: 'user',
    subject_id: userId,
    payload: { user_id: userId },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return updated
}

/** active ⇄ suspended (KRN-02.md §5) — the step deactivateUser requires before deactivated is reachable. */
export function suspendUser(store: Krn02Store, userId: string, actor: ActorRef, callerPersona: PersonaId): User {
  assertPermission(callerPersona, 'user.deactivate') // same admin grant governs suspend and deactivate

  const user = store.users.get(userId)
  if (!user) {
    throw new KernelError('USER_NOT_FOUND', `No user with id ${userId}`, randomUUID())
  }
  if (!isValidTransition(USER_STATUS_TRANSITIONS, user.status, 'suspended')) {
    throw new KernelError(
      'ILLEGAL_USER_STATUS_TRANSITION',
      `Cannot transition user from ${user.status} to suspended (KRN-02.md §5).`,
      randomUUID(),
      { from: user.status, to: 'suspended' },
    )
  }
  const timestamp = now()
  const updated: User = { ...user, status: 'suspended', updated_at: timestamp, updated_by: actor, version: user.version + 1 }
  store.users.set(userId, updated)
  return updated
}

export function deactivateUser(store: Krn02Store, userId: string, actor: ActorRef, callerPersona: PersonaId): User {
  assertPermission(callerPersona, 'user.deactivate')

  const user = store.users.get(userId)
  if (!user) {
    throw new KernelError('USER_NOT_FOUND', `No user with id ${userId}`, randomUUID())
  }
  if (!isValidTransition(USER_STATUS_TRANSITIONS, user.status, 'deactivated')) {
    throw new KernelError(
      'ILLEGAL_USER_STATUS_TRANSITION',
      `Cannot transition user from ${user.status} to deactivated (KRN-02.md §5 — must be suspended first).`,
      randomUUID(),
      { from: user.status, to: 'deactivated' },
    )
  }

  const timestamp = now()
  const updated: User = { ...user, status: 'deactivated', updated_at: timestamp, updated_by: actor, version: user.version + 1 }
  store.users.set(userId, updated)

  store.emit({
    event_name: 'identity.user.deactivated',
    tenant_id: user.tenant_id,
    entity_id: user.entity_id,
    subject_type: 'user',
    subject_id: userId,
    payload: { user_id: userId },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return updated
}

export function getUser(store: Krn02Store, userId: string): User | undefined {
  return store.users.get(userId)
}

export function findUserByLoginId(store: Krn02Store, loginId: string): User | undefined {
  for (const user of store.users.values()) {
    if (user.login_id === loginId) return user
  }
  return undefined
}

/**
 * KRN-02-FR-001 (MFA enrolment). Self-enrolment (a user enrolling their
 * own MFA) is always allowed; enrolling MFA on *another* user's account
 * requires `mfa.reset_others` (KRN-02.md §11 — see /spec/decisions-taken.md
 * D-33). Mirrors `revokeSession`'s self-vs-others pattern.
 */
export function enrolMfa(
  store: Krn02Store,
  userId: string,
  method: 'totp' | 'sms_otp' | 'email_otp' | 'push' | 'hardware_key',
  actor: ActorRef,
  callerPersona: PersonaId,
  callerUserId: string,
): User {
  const user = store.users.get(userId)
  if (!user) {
    throw new KernelError('USER_NOT_FOUND', `No user with id ${userId}`, randomUUID())
  }

  const isSelfEnrol = userId === callerUserId
  if (!isSelfEnrol) {
    assertPermission(callerPersona, 'mfa.reset_others')
  }

  const timestamp = now()
  const updated: User = {
    ...user,
    mfa_enrolments: [...user.mfa_enrolments, { method, enrolled_at: timestamp, status: 'active' }],
    updated_at: timestamp,
    updated_by: actor,
    version: user.version + 1,
  }
  store.users.set(userId, updated)
  return updated
}
