import { randomUUID } from 'node:crypto'
import type { Krn11Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { SeriesAssignment } from '../contracts/series-assignment.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateSeriesAssignmentInput {
  tenant_id: string
  entity_id: string
  namespace: 'sys' | 'tnt'
  series_id: string
  document_type_id: string
  location_id: string | null
  priority: number
  effective_from: string
}

function now() {
  return new Date().toISOString()
}

/** Configuring which series an assignment resolves to is the same `series.configure` grant as configuring the series itself. */
export function createSeriesAssignment(store: Krn11Store, input: CreateSeriesAssignmentInput, actor: ActorRef, callerPersona: PersonaId): SeriesAssignment {
  assertPermission(callerPersona, 'series.configure')

  const id = randomUUID()
  const timestamp = now()
  const assignment: SeriesAssignment = {
    id,
    tenant_id: input.tenant_id,
    entity_id: input.entity_id,
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
    series_id: input.series_id,
    document_type_id: input.document_type_id,
    location_id: input.location_id,
    priority: input.priority,
    effective_from: input.effective_from,
  }
  store.assignments.set(id, assignment)
  return assignment
}

/**
 * `KRN-11-FR-001`: resolves which series a document draws from —
 * location-specific assignments win over entity-wide (`location_id:
 * null`) ones; `priority` (higher wins) is the explicit tie-break when
 * more than one candidate at the same specificity could match.
 */
export function resolveSeriesForDocument(store: Krn11Store, entityId: string, documentTypeId: string, locationId: string | null): SeriesAssignment {
  const candidates = Array.from(store.assignments.values()).filter(
    (a) => a.entity_id === entityId && a.document_type_id === documentTypeId && (a.location_id === null || a.location_id === locationId),
  )
  if (candidates.length === 0) {
    throw new KernelError('NO_SERIES_ASSIGNMENT', `No series_assignment matches entity ${entityId}, document_type ${documentTypeId}, location ${locationId ?? '(none)'}.`, randomUUID())
  }

  const locationSpecific = candidates.filter((a) => a.location_id !== null)
  const pool = locationSpecific.length > 0 ? locationSpecific : candidates
  return [...pool].sort((a, b) => b.priority - a.priority)[0]
}
