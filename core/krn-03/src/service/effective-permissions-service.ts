import type { Krn03Store } from './store.js'
import type { PermissionAction } from '../contracts/permission-set.js'
import type { PermissionSubjectType } from '../contracts/permission-grant.js'
import type { DataScopeRule } from '../contracts/data-scope-rule.js'
import type { FieldPolicyKind } from '../contracts/field-policy.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'

export interface EffectiveGrant {
  entity_ref: string
  action: PermissionAction
  scope_rule_id: string | null
}

/**
 * KRN-03-DR-003: the single effective-permission resolution path every
 * consumer of tenant data calls — UI navigation, the API, exports, the
 * Copilot, scheduled analytics, agent queries, the semantic graph.
 * `KRN-03-FR-005`'s acceptance sample is literally "these consumers all
 * call this function and get the same answer" — proven in the acceptance
 * test by calling it multiple times, simulating distinct consumers, and
 * asserting identical results, since none of them exist yet to call it
 * for real.
 *
 * Merges every `active`, non-expired `permission_grant` for the subject:
 * a `role_id` grant resolves via that role's attached `permission_set`s
 * (KRN-03.md §4.1's `role.permission_set_ids`, added during
 * implementation); a `permission_set_id` grant resolves directly. For a
 * `user` subject, also merges every currently `active` `delegation` whose
 * `to_subject_id` is this subject (KRN-03-FR-004): the delegated
 * `permission_set`'s grants when `permission_set_id` is set, or — when
 * null — the delegator's *own* effective grants (§17 item 7's assumption,
 * recursing one level via `_depth`, capped, to stay safe against a
 * delegation cycle without needing a full cycle detector for a shape Vol
 * 1 never describes as chainable). A subject with no matching grant
 * anywhere gets an empty list — the literal mechanism behind
 * `KRN-03-DR-001`'s default-deny: no configured grant naming an entity
 * means zero visibility, not an error and not an implicit allow.
 */
export function resolveEffectivePermissions(store: Krn03Store, subjectType: PermissionSubjectType, subjectId: string, _depth = 0): EffectiveGrant[] {
  const nowMs = Date.now()
  const activeGrants = Array.from(store.permissionGrants.values()).filter(
    (g) => g.subject_type === subjectType && g.subject_id === subjectId && g.status === 'active' && (g.expires_at === null || new Date(g.expires_at).getTime() > nowMs),
  )

  const resolved: EffectiveGrant[] = []
  for (const grant of activeGrants) {
    const permissionSetIds: string[] = []
    if (grant.permission_set_id) permissionSetIds.push(grant.permission_set_id)
    if (grant.role_id) {
      const role = store.roles.get(grant.role_id)
      if (role && role.status === 'active') permissionSetIds.push(...role.permission_set_ids)
    }
    for (const psId of permissionSetIds) {
      const set = store.permissionSets.get(psId)
      if (!set) continue
      for (const entry of set.grants) {
        // scope_override_id narrows, never widens, the set's default scope for this grant instance (§4.1).
        const scopeRuleId = grant.scope_override_id ?? entry.scope_rule_id
        resolved.push({ entity_ref: entry.entity_ref, action: entry.action, scope_rule_id: scopeRuleId })
      }
    }
  }

  if (subjectType === 'user' && _depth < 2) {
    const activeDelegations = Array.from(store.delegations.values()).filter((d) => d.to_subject_id === subjectId && d.status === 'active')
    for (const delegation of activeDelegations) {
      if (delegation.permission_set_id) {
        const set = store.permissionSets.get(delegation.permission_set_id)
        if (set) {
          for (const entry of set.grants) {
            resolved.push({ entity_ref: entry.entity_ref, action: entry.action, scope_rule_id: entry.scope_rule_id })
          }
        }
      } else {
        resolved.push(...resolveEffectivePermissions(store, 'user', delegation.from_subject_id, _depth + 1))
      }
    }
  }

  return resolved
}

/** `KRN-03-FR-001`: can this subject ever perform `action` on `entityRef`? Used as the concrete default-deny/positive-grant check. */
export function hasEffectivePermission(store: Krn03Store, subjectType: PermissionSubjectType, subjectId: string, entityRef: string, action: PermissionAction): boolean {
  return resolveEffectivePermissions(store, subjectType, subjectId).some((g) => g.entity_ref === entityRef && g.action === action)
}

/**
 * `KRN-03-FR-002`: is `record` visible under `scopeRuleId`'s scope for
 * this subject? `record` carries only the scoping fields a `data_scope_rule`
 * might check against (`org_unit_id`, `legal_entity_id`, `owner_user_id`,
 * or arbitrary fields for `rule_based`). `orgUnitAndBelowIds`, when the
 * scope is `org_unit_and_below`, is the pre-resolved descendant set —
 * KRN-03 never calls into KRN-01 to compute this itself (L3); the real
 * API layer resolves it via KRN-01's own `resolveOrgUnitChain` (already
 * published from `@mahisys/krn-01`) before calling this function, exactly
 * mirroring how `isWithinProvisioningWindow` takes tenant status as a
 * parameter rather than reading KRN-01's store directly.
 */
export interface ScopeCheckContext {
  callerOrgUnitId: string | null
  callerUserId: string | null
  callerLegalEntityId: string | null
  orgUnitAndBelowIds: string[] | null // pre-resolved by the caller for org_unit_and_below
  record: Record<string, unknown>
}

export function isRowInScope(store: Krn03Store, scopeRuleId: string | null, context: ScopeCheckContext): boolean {
  if (scopeRuleId === null) return false // no scope configured — default-deny (KRN-03-DR-001)

  const rule = store.dataScopeRules.get(scopeRuleId)
  if (!rule || rule.status !== 'active') return false

  switch (rule.scope_type) {
    case 'own':
      return context.callerUserId !== null && context.record.owner_user_id === context.callerUserId
    case 'org_unit':
      return context.callerOrgUnitId !== null && context.record.org_unit_id === context.callerOrgUnitId
    case 'org_unit_and_below':
      return context.orgUnitAndBelowIds !== null && context.orgUnitAndBelowIds.includes(String(context.record.org_unit_id))
    case 'entity':
      return context.callerLegalEntityId !== null && context.record.legal_entity_id === context.callerLegalEntityId
    case 'tenant':
      return true // scoped only by tenant_id, already enforced structurally (every store is single-tenant, Vol 2 §1.2)
    case 'rule_based':
      return rule.expression !== null && evaluateRuleCondition(rule.expression, context.record)
    default:
      return false
  }
}

function evaluateRuleCondition(condition: DataScopeRule['expression'], record: Record<string, unknown>): boolean {
  if (condition === null) return false
  if ('all' in condition) return condition.all.every((c) => evaluateRuleCondition(c, record))
  if ('any' in condition) return condition.any.some((c) => evaluateRuleCondition(c, record))
  const actual = record[condition.field]
  switch (condition.operator) {
    case 'eq': return actual === condition.value
    case 'ne': return actual !== condition.value
    case 'lt': return typeof actual === 'number' && typeof condition.value === 'number' && actual < condition.value
    case 'lte': return typeof actual === 'number' && typeof condition.value === 'number' && actual <= condition.value
    case 'gt': return typeof actual === 'number' && typeof condition.value === 'number' && actual > condition.value
    case 'gte': return typeof actual === 'number' && typeof condition.value === 'number' && actual >= condition.value
    case 'in': return Array.isArray(condition.value) && condition.value.includes(actual)
    case 'not_in': return Array.isArray(condition.value) && !condition.value.includes(actual)
    default: return false
  }
}

/** `KRN-03-FR-003`: the field-level policy (if any) an active grant for `roleId` declares on `entityRef.fieldRef`. */
export function resolveFieldPolicy(store: Krn03Store, roleId: string, entityRef: string, fieldRef: string): { policy: FieldPolicyKind; mask_strategy: string | null } | null {
  const match = Array.from(store.fieldPolicies.values()).find(
    (p) => p.role_id === roleId && p.entity_ref === entityRef && p.field_ref === fieldRef && p.status === 'active',
  )
  return match ? { policy: match.policy, mask_strategy: match.mask_strategy } : null
}

/**
 * `KRN-03-FR-006`: the grant-only half of the two-gate model. Per D-25
 * (KRN-02/KRN-03/KRN-15 are all trust-ceiling-*unaware*; INT-04 alone
 * enforces L9), this function answers only "can this agent ever perform
 * this action" — it does not check, approximate, or degrade a trust
 * ceiling, because that gate does not live in KRN-03 at all, not even in
 * a stubbed form. The caller (once INT-04 exists) is responsible for
 * calling both this function and INT-04's own ceiling check, in
 * sequence, before allowing an agent action to commit.
 */
export function checkAgentActionGrant(store: Krn03Store, agentIdentityId: string, entityRef: string, action: PermissionAction): boolean {
  return hasEffectivePermission(store, 'agent_identity', agentIdentityId, entityRef, action)
}

/** `KRN-03-DR-002`: same shape and vocabulary for a human `user` or an `agent_identity` — no agent-specific screen or terminology. */
export function getEffectivePermissionsViewer(
  store: Krn03Store,
  subjectType: PermissionSubjectType,
  subjectId: string,
  callerPersona: PersonaId,
  callerSubjectId: string,
): { subject_type: PermissionSubjectType; subject_id: string; grants: EffectiveGrant[] } {
  const isSelf = subjectId === callerSubjectId
  assertPermission(callerPersona, isSelf ? 'effective_permissions.read_self' : 'effective_permissions.read_others')

  return {
    subject_type: subjectType,
    subject_id: subjectId,
    grants: resolveEffectivePermissions(store, subjectType, subjectId),
  }
}
