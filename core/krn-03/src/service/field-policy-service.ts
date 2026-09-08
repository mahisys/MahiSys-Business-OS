import { randomUUID } from 'node:crypto'
import type { Krn03Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { FieldPolicy, FieldPolicyKind, MaskStrategy } from '../contracts/field-policy.js'
import { FIELD_POLICY_STATUS_TRANSITIONS } from '../contracts/field-policy.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateFieldPolicyInput {
  tenant_id: string
  namespace: 'sys' | 'tnt'
  entity_ref: string
  field_ref: string
  role_id: string
  policy: FieldPolicyKind
  mask_strategy: MaskStrategy | null
}

function now() {
  return new Date().toISOString()
}

/**
 * KRN-03.md §11 negative case: only PR-21/PR-16/PR-17 hold
 * `scope_and_field_policy.write` at all — the finer "finance-owned vs
 * HR-owned field" restriction on PR-16/PR-17 is coarse in this bootstrap
 * matrix (no KRN-04 field-level domain-owner metadata exists yet to
 * check against); flagged in `permissions.ts`'s module doc, not silently
 * ignored.
 */
export function createFieldPolicy(store: Krn03Store, input: CreateFieldPolicyInput, actor: ActorRef, callerPersona: PersonaId): FieldPolicy {
  assertPermission(callerPersona, 'scope_and_field_policy.write')

  if (input.policy === 'masked' && input.mask_strategy === null) {
    throw new KernelError('MASK_STRATEGY_REQUIRED', 'mask_strategy is required when policy is masked (KRN-03-FR-003).', randomUUID())
  }
  if (input.policy !== 'masked' && input.mask_strategy !== null) {
    throw new KernelError('MASK_STRATEGY_NOT_APPLICABLE', 'mask_strategy is only meaningful when policy is masked (KRN-03-FR-003).', randomUUID())
  }

  const id = randomUUID()
  const timestamp = now()
  const policy: FieldPolicy = {
    id,
    tenant_id: input.tenant_id,
    entity_id: id,
    namespace: input.namespace,
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
    entity_ref: input.entity_ref,
    field_ref: input.field_ref,
    role_id: input.role_id,
    policy: input.policy,
    mask_strategy: input.mask_strategy,
    status: 'active',
  }
  store.fieldPolicies.set(id, policy)
  emitChanged(store, policy, null, actor)
  return policy
}

/** KRN-03.md §5: versioned/effective-dated, same pattern as data_scope_rule. */
export function supersedeFieldPolicy(store: Krn03Store, fieldPolicyId: string, patch: Partial<Pick<CreateFieldPolicyInput, 'policy' | 'mask_strategy'>>, actor: ActorRef, callerPersona: PersonaId): FieldPolicy {
  assertPermission(callerPersona, 'scope_and_field_policy.write')

  const prior = store.fieldPolicies.get(fieldPolicyId)
  if (!prior) {
    throw new KernelError('FIELD_POLICY_NOT_FOUND', `No field_policy with id ${fieldPolicyId}`, randomUUID())
  }
  if (!isValidTransition(FIELD_POLICY_STATUS_TRANSITIONS, prior.status, 'superseded')) {
    throw new KernelError('ILLEGAL_FIELD_POLICY_STATUS_TRANSITION', `Cannot supersede a field_policy in status ${prior.status} (KRN-03.md §5).`, randomUUID())
  }

  const nextPolicy = patch.policy ?? prior.policy
  const nextMaskStrategy = patch.mask_strategy !== undefined ? patch.mask_strategy : prior.mask_strategy
  if (nextPolicy === 'masked' && nextMaskStrategy === null) {
    throw new KernelError('MASK_STRATEGY_REQUIRED', 'mask_strategy is required when policy is masked (KRN-03-FR-003).', randomUUID())
  }

  const timestamp = now()
  const supersededPrior: FieldPolicy = { ...prior, status: 'superseded', updated_at: timestamp, updated_by: actor, version: prior.version + 1 }
  store.fieldPolicies.set(fieldPolicyId, supersededPrior)

  const newId = randomUUID()
  const next: FieldPolicy = {
    ...prior,
    id: newId,
    entity_id: newId,
    created_at: timestamp,
    created_by: actor,
    updated_at: timestamp,
    updated_by: actor,
    version: 1,
    trace_id: randomUUID(),
    policy: nextPolicy,
    mask_strategy: nextMaskStrategy,
    status: 'active',
  }
  store.fieldPolicies.set(newId, next)
  emitChanged(store, next, fieldPolicyId, actor)
  return next
}

function emitChanged(store: Krn03Store, policy: FieldPolicy, supersededId: string | null, actor: ActorRef) {
  store.emit({
    event_name: 'access.field_policy.changed',
    tenant_id: policy.tenant_id,
    entity_id: policy.id,
    subject_type: 'field_policy',
    subject_id: policy.id,
    payload: { field_policy_id: policy.id, superseded_id: supersededId },
    occurred_at: policy.created_at,
    recorded_at: policy.created_at,
    actor,
  })
  store.emit({
    event_name: 'access.policy.changed',
    tenant_id: policy.tenant_id,
    entity_id: policy.id,
    subject_type: 'field_policy',
    subject_id: policy.id,
    payload: { policy_type: 'field_policy', policy_id: policy.id },
    occurred_at: policy.created_at,
    recorded_at: policy.created_at,
    actor,
  })
}

export function getFieldPolicy(store: Krn03Store, id: string): FieldPolicy | undefined {
  return store.fieldPolicies.get(id)
}
