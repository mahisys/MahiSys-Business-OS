import { randomUUID } from 'node:crypto'
import type { Krn03Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { PermissionSet, PermissionGrantEntry } from '../contracts/permission-set.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreatePermissionSetInput {
  tenant_id: string
  namespace: 'sys' | 'tnt'
  code: string
  name: string
  grants: PermissionGrantEntry[]
}

function now() {
  return new Date().toISOString()
}

export function createPermissionSet(store: Krn03Store, input: CreatePermissionSetInput, actor: ActorRef, callerPersona: PersonaId): PermissionSet {
  assertPermission(callerPersona, 'permission_set.write')

  const id = randomUUID()
  const timestamp = now()
  const set: PermissionSet = {
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
    grants: input.grants,
  }
  store.permissionSets.set(id, set)

  store.emit({
    event_name: 'access.permission_set.created',
    tenant_id: set.tenant_id,
    entity_id: id,
    subject_type: 'permission_set',
    subject_id: id,
    payload: { permission_set_id: id, code: set.code },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return set
}

export function updatePermissionSetGrants(store: Krn03Store, permissionSetId: string, grants: PermissionGrantEntry[], actor: ActorRef, callerPersona: PersonaId): PermissionSet {
  assertPermission(callerPersona, 'permission_set.write')

  const set = store.permissionSets.get(permissionSetId)
  if (!set) {
    throw new KernelError('PERMISSION_SET_NOT_FOUND', `No permission_set with id ${permissionSetId}`, randomUUID())
  }

  const timestamp = now()
  const updated: PermissionSet = { ...set, grants, updated_at: timestamp, updated_by: actor, version: set.version + 1 }
  store.permissionSets.set(permissionSetId, updated)

  store.emit({
    event_name: 'access.permission_set.updated',
    tenant_id: set.tenant_id,
    entity_id: permissionSetId,
    subject_type: 'permission_set',
    subject_id: permissionSetId,
    payload: { permission_set_id: permissionSetId, code: set.code },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return updated
}

export function getPermissionSet(store: Krn03Store, id: string): PermissionSet | undefined {
  return store.permissionSets.get(id)
}
