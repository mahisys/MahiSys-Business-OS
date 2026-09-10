import type { Krn11Store } from './store.js'
import type { CancelledNumber } from '../contracts/cancelled-number.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'

export interface CancelledNumberFilter {
  series_id?: string
  entity_id?: string
}

/** `KRN-11-FR-002`/§13/§14: the audit-facing register — the primary GST-audit evidence artefact for the gapless guarantee. */
export function listCancelledNumbers(store: Krn11Store, tenantId: string, filter: CancelledNumberFilter, callerPersona: PersonaId): CancelledNumber[] {
  assertPermission(callerPersona, 'cancelled_numbers.read')
  let results = Array.from(store.cancelledNumbers.values()).filter((c) => c.tenant_id === tenantId)
  if (filter.series_id) results = results.filter((c) => c.series_id === filter.series_id)
  if (filter.entity_id) results = results.filter((c) => c.entity_id === filter.entity_id)
  return results
}
