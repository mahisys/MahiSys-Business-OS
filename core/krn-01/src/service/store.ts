/**
 * In-memory reference store for KRN-01. This is the current
 * implementation backend for the domain logic under test — it exists to
 * make the business rules in KRN-01.md provably correct via acceptance
 * tests before any real persistence layer is wired up. A Postgres-backed
 * adapter (per D-12) is separate, later infrastructure work; nothing in
 * `tenant-service.ts` etc. depends on this being in-memory specifically —
 * they only depend on the `Krn01Store` shape below, so a real adapter can
 * be swapped in without changing the service functions' logic.
 */
import { randomUUID } from 'node:crypto'
import type { Tenant } from '../contracts/tenant.js'
import type { LegalEntity } from '../contracts/legal-entity.js'
import type { OrgUnit } from '../contracts/org-unit.js'
import type { CostCentre } from '../contracts/cost-centre.js'
import type { FiscalCalendar, FiscalPeriod } from '../contracts/fiscal-period.js'
import type { IsolationAssignment } from '../contracts/isolation-assignment.js'

/**
 * Full P-08 Event envelope (Vol 2 Part 2, P-08), not a simplified subset —
 * so emitted events can be validated against the real Zod event schemas in
 * `../contracts/events.ts` ("events emitted match the declared schema
 * exactly," Vol 6 §5 Definition of Done), not just asserted informally.
 */
export interface EmittedEvent {
  event_id: string
  event_name: string
  tenant_id: string
  entity_id: string
  schema_version: number
  subject_type: string
  subject_id: string
  payload: Record<string, unknown>
  occurred_at: string
  recorded_at: string
  actor: { type: 'user' | 'agent' | 'service'; id: string; version?: string }
  causation_id: string | null
  correlation_id: string
  trace_id: string
  reversal_handle: string | null // KRN-18 doesn't exist yet (Phase 1) — always null until it ships, per D-21
}

/** What a service function actually has to decide when emitting — the envelope's structural boilerplate is filled in by `Krn01Store.emit()`. */
export type EmitInput = Omit<EmittedEvent, 'event_id' | 'schema_version' | 'causation_id' | 'correlation_id' | 'trace_id' | 'reversal_handle'>

export class Krn01Store {
  tenants = new Map<string, Tenant>()
  legalEntities = new Map<string, LegalEntity>()
  orgUnits = new Map<string, OrgUnit>()
  costCentres = new Map<string, CostCentre>()
  fiscalCalendars = new Map<string, FiscalCalendar>()
  fiscalPeriods = new Map<string, FiscalPeriod>()
  isolationAssignments = new Map<string, IsolationAssignment>()
  events: EmittedEvent[] = []

  emit(e: EmitInput) {
    this.events.push({
      ...e,
      event_id: randomUUID(),
      schema_version: 1,
      causation_id: null, // no causal-chain tracking yet — single top-level operations only, in this reference implementation
      correlation_id: randomUUID(),
      trace_id: randomUUID(),
      reversal_handle: null, // KRN-18 doesn't exist yet (Phase 1) — per D-21
    })
  }
}

export function createStore(): Krn01Store {
  return new Krn01Store()
}
