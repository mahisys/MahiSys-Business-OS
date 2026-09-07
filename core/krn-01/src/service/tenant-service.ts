import { randomUUID } from 'node:crypto'
import type { Krn01Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { Tenant, IsolationTier } from '../contracts/tenant.js'
import { TENANT_STATUS_TRANSITIONS } from '../contracts/tenant.js'
import type { IsolationAssignment } from '../contracts/isolation-assignment.js'
import { isValidTierPromotion } from '../contracts/isolation-assignment.js'
import { KernelError } from './errors.js'
import { hasPermission, type PersonaId } from './permissions.js'

export interface CreateTenantInput {
  code: string
  name: string
  region: string
  manifest_id: string
  plan_id: string
}

function now() {
  return new Date().toISOString()
}

/**
 * Provisioning-time creation. Real system: COM-04 service account only
 * (KRN-01.md §11's negative case — any actor attempting tenant.create via
 * API directly, not via COM-04, gets 403 regardless of role). This shim
 * enforces that by actor type: only `service` actors may call it.
 */
export function createTenant(store: Krn01Store, input: CreateTenantInput, actor: ActorRef): Tenant {
  if (actor.type !== 'service') {
    throw new KernelError(
      'TENANT_CREATE_REQUIRES_SERVICE_ACCOUNT',
      'Tenant creation is a provisioning-process action (COM-04), not directly callable by a user or agent.',
      randomUUID(),
    )
  }

  const id = randomUUID()
  const timestamp = now()
  const tenant: Tenant = {
    id,
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
    status: 'trial',
    isolation_tier: 'row',
    region: input.region,
    manifest_id: input.manifest_id,
    plan_id: input.plan_id,
    provisioned_at: timestamp,
  }
  store.tenants.set(id, tenant)

  const initialAssignment: IsolationAssignment = {
    id: randomUUID(),
    tenant_id: id,
    entity_id: id,
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
    isolation_tier: 'row',
    effective_from: timestamp,
    migration_status: 'none',
    previous_tier: null,
  }
  store.isolationAssignments.set(initialAssignment.id, initialAssignment)

  store.emit({
    event_name: 'core.tenant.provisioned',
    tenant_id: id,
    entity_id: id,
    subject_type: 'tenant',
    subject_id: id,
    payload: { tenant_id: id, manifest_id: input.manifest_id, plan_id: input.plan_id },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return tenant
}

const LIFECYCLE_ACTION_TO_STATUS: Record<'activate' | 'suspend' | 'close', Tenant['status']> = {
  activate: 'active',
  suspend: 'suspended',
  close: 'closed',
}
const LIFECYCLE_ACTION_TO_EVENT: Record<'activate' | 'suspend' | 'close', string> = {
  activate: 'core.tenant.activated',
  suspend: 'core.tenant.suspended',
  close: 'core.tenant.closed',
}

/**
 * KRN-01-FR-004: process-governed lifecycle transition. KRN-05 (Process
 * Engine) doesn't exist yet (Phase 1) — per D-21's standing convention,
 * this degrades to direct transition-legality enforcement (via
 * TENANT_STATUS_TRANSITIONS) without a real KRN-05 approval instance,
 * until KRN-05 ships. The event is still emitted "in the same
 * transaction" in spirit: synchronously, before this function returns.
 */
export function transitionTenantLifecycle(
  store: Krn01Store,
  tenantId: string,
  action: 'activate' | 'suspend' | 'close',
  actor: ActorRef,
  callerPersona: PersonaId,
): Tenant {
  if (!hasPermission(callerPersona, 'tenant.lifecycle')) {
    throw new KernelError(
      'FORBIDDEN',
      `Persona ${callerPersona} does not hold tenant.lifecycle (KRN-01.md §11).`,
      randomUUID(),
    )
  }

  const tenant = store.tenants.get(tenantId)
  if (!tenant) {
    throw new KernelError('TENANT_NOT_FOUND', `No tenant with id ${tenantId}`, randomUUID())
  }

  const targetStatus = LIFECYCLE_ACTION_TO_STATUS[action]
  if (!isValidTransition(TENANT_STATUS_TRANSITIONS, tenant.status, targetStatus)) {
    throw new KernelError(
      'ILLEGAL_TENANT_STATUS_TRANSITION',
      `Cannot transition tenant from ${tenant.status} to ${targetStatus} via action "${action}" (KRN-01.md §5).`,
      randomUUID(),
      { from: tenant.status, to: targetStatus },
    )
  }

  const timestamp = now()
  const updated: Tenant = { ...tenant, status: targetStatus, updated_at: timestamp, updated_by: actor, version: tenant.version + 1 }
  store.tenants.set(tenantId, updated)

  store.emit({
    event_name: LIFECYCLE_ACTION_TO_EVENT[action],
    tenant_id: tenantId,
    entity_id: tenantId,
    subject_type: 'tenant',
    subject_id: tenantId,
    payload: { tenant_id: tenantId },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return updated
}

/**
 * KRN-01-DR-001: monotonic isolation-tier promotion. Permission-gated per
 * the `isolation_tier.promote` action added to KRN-01.md §11 (D-32) —
 * this gate did not exist in the original matrix, found missing during
 * implementation.
 */
export function promoteIsolationTier(
  store: Krn01Store,
  tenantId: string,
  targetTier: IsolationTier,
  actor: ActorRef,
  callerPersona: PersonaId,
): IsolationAssignment {
  if (!hasPermission(callerPersona, 'isolation_tier.promote')) {
    throw new KernelError(
      'FORBIDDEN',
      `Persona ${callerPersona} does not hold isolation_tier.promote (KRN-01.md §11, D-32).`,
      randomUUID(),
    )
  }

  const tenant = store.tenants.get(tenantId)
  if (!tenant) {
    throw new KernelError('TENANT_NOT_FOUND', `No tenant with id ${tenantId}`, randomUUID())
  }
  if (!isValidTierPromotion(tenant.isolation_tier, targetTier)) {
    throw new KernelError(
      'ILLEGAL_ISOLATION_TIER_PROMOTION',
      `Cannot promote isolation tier from ${tenant.isolation_tier} to ${targetTier} (KRN-01-DR-001: monotonic only).`,
      randomUUID(),
      { from: tenant.isolation_tier, to: targetTier },
    )
  }

  const timestamp = now()
  const previousTier = tenant.isolation_tier

  // Migration is treated as completing synchronously in this in-memory
  // reference implementation. A real Postgres-backed adapter would run
  // none → scheduled → in_progress → completed asynchronously via KRN-15;
  // the state machine itself (MIGRATION_STATUS_TRANSITIONS) already
  // supports that, this function just doesn't model async completion yet.
  const assignment: IsolationAssignment = {
    id: randomUUID(),
    tenant_id: tenantId,
    entity_id: tenantId,
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
    isolation_tier: targetTier,
    effective_from: timestamp,
    migration_status: 'completed',
    previous_tier: previousTier,
  }
  store.isolationAssignments.set(assignment.id, assignment)

  const updatedTenant: Tenant = { ...tenant, isolation_tier: targetTier, updated_at: timestamp, updated_by: actor, version: tenant.version + 1 }
  store.tenants.set(tenantId, updatedTenant)

  store.emit({
    event_name: 'core.tenant.isolation_changed',
    tenant_id: tenantId,
    entity_id: tenantId,
    subject_type: 'tenant',
    subject_id: tenantId,
    payload: { tenant_id: tenantId, previous_tier: previousTier, new_tier: targetTier },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return assignment
}

export function getTenant(store: Krn01Store, tenantId: string): Tenant | undefined {
  return store.tenants.get(tenantId)
}
