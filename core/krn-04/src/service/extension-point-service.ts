import { randomUUID } from 'node:crypto'
import type { Krn04Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { ExtensionPoint, ExtensionPointKind } from '../contracts/extension-point.js'
import { assertServiceActorForSysWrite } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateExtensionPointInput {
  tenant_id: string
  entity_id: string
  code: string
  kind: ExtensionPointKind
  constraints: Record<string, unknown>
}

function now() {
  return new Date().toISOString()
}

/** KRN-04-FR-005: `sys`-writable only — no persona holds this grant, only the platform release pipeline service account (KRN-04.md §11). */
export function createExtensionPoint(store: Krn04Store, input: CreateExtensionPointInput, actor: ActorRef): ExtensionPoint {
  assertServiceActorForSysWrite(actor.type, 'extension_point.create')

  const entity = store.entityDefinitions.get(input.entity_id)
  if (!entity) {
    throw new KernelError('ENTITY_DEFINITION_NOT_FOUND', `No entity_definition with id ${input.entity_id}`, randomUUID())
  }

  const id = randomUUID()
  const timestamp = now()
  const point: ExtensionPoint = {
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
    code: input.code,
    kind: input.kind,
    constraints: input.constraints,
  }
  store.extensionPoints.set(id, point)

  store.emit({
    event_name: 'metadata.extension_point.created',
    tenant_id: point.tenant_id,
    entity_id: point.entity_id,
    subject_type: 'extension_point',
    subject_id: id,
    payload: { extension_point_id: id, entity_definition_id: input.entity_id, code: point.code },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return point
}

/**
 * KRN-04-FR-005: the enforcement primitive a consumer (STU-01, when a
 * tenant attempts to add a hook) calls before honouring an extension
 * attempt — rejected at the engine if no matching `extension_point` is
 * declared, not merely discouraged in review.
 */
export function assertExtensionAllowed(store: Krn04Store, entityId: string, code: string, kind: ExtensionPointKind): void {
  const declared = Array.from(store.extensionPoints.values()).some(
    (p) => p.entity_id === entityId && p.code === code && p.kind === kind,
  )
  if (!declared) {
    throw new KernelError(
      'EXTENSION_POINT_NOT_DECLARED',
      `No extension_point ${code} (${kind}) is declared on entity ${entityId} (KRN-04-FR-005).`,
      randomUUID(),
    )
  }
}
