import { randomUUID } from 'node:crypto'
import type { Krn03Store } from './store.js'
import type { ActorRef, Period } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { Delegation } from '../contracts/delegation.js'
import { DELEGATION_STATUS_TRANSITIONS } from '../contracts/delegation.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateDelegationInput {
  tenant_id: string
  from_subject_id: string
  to_subject_id: string
  permission_set_id: string | null
  period: Period
  reason: string
}

function now() {
  return new Date().toISOString()
}

/**
 * KRN-03.md §11 negative case: a `permission_set_id` broader than any
 * `permission_set` the delegator (`from_subject_id`) themselves currently
 * holds an active grant for is rejected at write time — `KRN-03-FR-004`'s
 * "bounded" is enforced here, not merely documented. `null`
 * (permission_set_id) needs no check: the delegate then exercises the
 * delegator's own current scope wholesale, which cannot exceed it by
 * construction (§17 item 7).
 *
 * Checks both a direct `permission_set_id` grant and a `role_id` grant
 * whose role attaches the set (`role.permission_set_ids`, D-36) — found
 * missing during the throwaway demo's own walkthrough: the demo grants
 * roles, not bare permission sets, and every delegation was rejected as
 * "not held" even though the delegator plainly held it through their
 * role. The original acceptance/permission tests only exercised the
 * direct-grant path, so this gap passed unnoticed until real (if
 * throwaway) usage hit it — the same class of finding as D-32/33/35/36,
 * fixed the same way.
 */
function delegatorHoldsPermissionSet(store: Krn03Store, fromSubjectId: string, permissionSetId: string): boolean {
  const activeGrants = Array.from(store.permissionGrants.values()).filter(
    (g) => g.subject_type === 'user' && g.subject_id === fromSubjectId && g.status === 'active',
  )
  return activeGrants.some((g) => {
    if (g.permission_set_id === permissionSetId) return true
    if (g.role_id) {
      const role = store.roles.get(g.role_id)
      if (role && role.status === 'active' && role.permission_set_ids.includes(permissionSetId)) return true
    }
    return false
  })
}

export function createDelegation(
  store: Krn03Store,
  input: CreateDelegationInput,
  actor: ActorRef,
  callerPersona: PersonaId,
  callerSubjectId: string,
): Delegation {
  const isSelf = input.from_subject_id === callerSubjectId
  assertPermission(callerPersona, isSelf ? 'delegation.create_self' : 'delegation.create_others')

  if (input.permission_set_id !== null && !delegatorHoldsPermissionSet(store, input.from_subject_id, input.permission_set_id)) {
    throw new KernelError(
      'DELEGATION_EXCEEDS_DELEGATOR_SCOPE',
      `from_subject_id ${input.from_subject_id} holds no active grant for permission_set ${input.permission_set_id} — a delegate can never end up with more access than the delegator had (KRN-03-FR-004).`,
      randomUUID(),
    )
  }
  if (input.period.is_open_ended) {
    throw new KernelError('DELEGATION_MUST_BE_BOUNDED', 'A delegation is always a bounded period (KRN-03-FR-004).', randomUUID())
  }

  const id = randomUUID()
  const timestamp = now()
  const delegation: Delegation = {
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
    from_subject_id: input.from_subject_id,
    to_subject_id: input.to_subject_id,
    permission_set_id: input.permission_set_id,
    period: input.period,
    reason: input.reason,
    status: 'pending',
  }
  store.delegations.set(id, delegation)

  store.emit({
    event_name: 'access.delegation.created',
    tenant_id: delegation.tenant_id,
    entity_id: id,
    subject_type: 'delegation',
    subject_id: id,
    payload: { delegation_id: id, from_subject_id: input.from_subject_id, to_subject_id: input.to_subject_id },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return delegation
}

function transition(store: Krn03Store, delegation: Delegation, target: Delegation['status'], actor: ActorRef): Delegation {
  if (!isValidTransition(DELEGATION_STATUS_TRANSITIONS, delegation.status, target)) {
    throw new KernelError('ILLEGAL_DELEGATION_STATUS_TRANSITION', `Cannot transition delegation from ${delegation.status} to ${target} (KRN-03.md §5).`, randomUUID(), { from: delegation.status, to: target })
  }
  const timestamp = now()
  const updated: Delegation = { ...delegation, status: target, updated_at: timestamp, updated_by: actor, version: delegation.version + 1 }
  store.delegations.set(delegation.id, updated)
  return updated
}

/** KRN-03.md §5: `pending → active`, driven by `period.from` arriving — evaluated against a supplied "now" for testability, mirroring KRN-02's `checkSessionTimeout`. */
export function checkDelegationStart(store: Krn03Store, delegationId: string, nowIso: string, systemActor: ActorRef): Delegation {
  const delegation = store.delegations.get(delegationId)
  if (!delegation) {
    throw new KernelError('DELEGATION_NOT_FOUND', `No delegation with id ${delegationId}`, randomUUID())
  }
  if (delegation.status !== 'pending' || new Date(nowIso).getTime() < new Date(delegation.period.from).getTime()) {
    return delegation
  }
  const updated = transition(store, delegation, 'active', systemActor)

  store.emit({
    event_name: 'access.delegation.started',
    tenant_id: delegation.tenant_id,
    entity_id: delegationId,
    subject_type: 'delegation',
    subject_id: delegationId,
    payload: { delegation_id: delegationId, from_subject_id: delegation.from_subject_id, to_subject_id: delegation.to_subject_id },
    occurred_at: nowIso,
    recorded_at: now(),
    actor: systemActor,
  })

  return updated
}

/** KRN-03-FR-004: "expires automatically" — no human action required, unlike `revokeDelegation`. */
export function checkDelegationExpiry(store: Krn03Store, delegationId: string, nowIso: string, systemActor: ActorRef): Delegation {
  const delegation = store.delegations.get(delegationId)
  if (!delegation) {
    throw new KernelError('DELEGATION_NOT_FOUND', `No delegation with id ${delegationId}`, randomUUID())
  }
  if (delegation.status !== 'active' || delegation.period.to === null || new Date(nowIso).getTime() < new Date(delegation.period.to).getTime()) {
    return delegation
  }
  const updated = transition(store, delegation, 'expired', systemActor)

  store.emit({
    event_name: 'access.delegation.expired',
    tenant_id: delegation.tenant_id,
    entity_id: delegationId,
    subject_type: 'delegation',
    subject_id: delegationId,
    payload: { delegation_id: delegationId, from_subject_id: delegation.from_subject_id, to_subject_id: delegation.to_subject_id },
    occurred_at: nowIso,
    recorded_at: now(),
    actor: systemActor,
  })

  return updated
}

export function revokeDelegation(store: Krn03Store, delegationId: string, actor: ActorRef, callerPersona: PersonaId, callerSubjectId: string): Delegation {
  const delegation = store.delegations.get(delegationId)
  if (!delegation) {
    throw new KernelError('DELEGATION_NOT_FOUND', `No delegation with id ${delegationId}`, randomUUID())
  }
  const isSelf = delegation.from_subject_id === callerSubjectId
  assertPermission(callerPersona, isSelf ? 'delegation.create_self' : 'delegation.create_others')

  const updated = transition(store, delegation, 'revoked', actor)

  store.emit({
    event_name: 'access.delegation.revoked',
    tenant_id: delegation.tenant_id,
    entity_id: delegationId,
    subject_type: 'delegation',
    subject_id: delegationId,
    payload: { delegation_id: delegationId, from_subject_id: delegation.from_subject_id, to_subject_id: delegation.to_subject_id },
    occurred_at: updated.updated_at,
    recorded_at: updated.updated_at,
    actor,
  })

  return updated
}

export function getDelegation(store: Krn03Store, id: string): Delegation | undefined {
  return store.delegations.get(id)
}
