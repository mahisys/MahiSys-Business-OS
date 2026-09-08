import { randomUUID } from 'node:crypto'
import type { Krn03Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { Role } from '../contracts/role.js'
import { ROLE_STATUS_TRANSITIONS } from '../contracts/role.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateRoleInput {
  tenant_id: string
  namespace: 'sys' | 'tnt'
  code: string
  name: string
  description: string
  is_assignable_to_agent: boolean
  permission_set_ids: string[]
}

function now() {
  return new Date().toISOString()
}

export function createRole(store: Krn03Store, input: CreateRoleInput, actor: ActorRef, callerPersona: PersonaId): Role {
  assertPermission(callerPersona, 'role.write')

  const existing = Array.from(store.roles.values()).find((r) => r.tenant_id === input.tenant_id && r.namespace === input.namespace && r.code === input.code)
  if (existing) {
    throw new KernelError('ROLE_CODE_ALREADY_EXISTS', `code ${input.code} already exists for (tenant_id, namespace) (KRN-03.md §4.1).`, randomUUID())
  }

  const id = randomUUID()
  const timestamp = now()
  const role: Role = {
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
    code: input.code,
    name: input.name,
    description: input.description,
    is_assignable_to_agent: input.is_assignable_to_agent,
    permission_set_ids: input.permission_set_ids,
    status: 'active',
  }
  store.roles.set(id, role)

  store.emit({
    event_name: 'access.role.created',
    tenant_id: role.tenant_id,
    entity_id: id,
    subject_type: 'role',
    subject_id: id,
    payload: { role_id: id, code: role.code },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return role
}

/** KRN-03.md §5: `active → deprecated`. Not deletion — a deprecated role simply stops appearing for new grants (L12). */
export function deprecateRole(store: Krn03Store, roleId: string, actor: ActorRef, callerPersona: PersonaId): Role {
  assertPermission(callerPersona, 'role.write')

  const role = store.roles.get(roleId)
  if (!role) {
    throw new KernelError('ROLE_NOT_FOUND', `No role with id ${roleId}`, randomUUID())
  }
  if (!isValidTransition(ROLE_STATUS_TRANSITIONS, role.status, 'deprecated')) {
    throw new KernelError('ILLEGAL_ROLE_STATUS_TRANSITION', `Cannot transition role from ${role.status} to deprecated (KRN-03.md §5).`, randomUUID(), { from: role.status, to: 'deprecated' })
  }

  const timestamp = now()
  const updated: Role = { ...role, status: 'deprecated', updated_at: timestamp, updated_by: actor, version: role.version + 1 }
  store.roles.set(roleId, updated)

  store.emit({
    event_name: 'access.role.deprecated',
    tenant_id: role.tenant_id,
    entity_id: roleId,
    subject_type: 'role',
    subject_id: roleId,
    payload: { role_id: roleId, code: role.code },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return updated
}

export function getRole(store: Krn03Store, id: string): Role | undefined {
  return store.roles.get(id)
}
