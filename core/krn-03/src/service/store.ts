/**
 * In-memory reference store for KRN-03. Same rationale as KRN-01/02/04's:
 * makes the business rules in KRN-03.md provably correct via acceptance
 * tests before any real persistence layer is wired up (D-12).
 */
import { randomUUID } from 'node:crypto'
import type { Role } from '../contracts/role.js'
import type { PermissionSet } from '../contracts/permission-set.js'
import type { PermissionGrant } from '../contracts/permission-grant.js'
import type { DataScopeRule } from '../contracts/data-scope-rule.js'
import type { FieldPolicy } from '../contracts/field-policy.js'
import type { Delegation } from '../contracts/delegation.js'

/** Full P-08 Event envelope (Vol 2 Part 2, P-08) — see KRN-01/02/04's identical rationale. */
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

export type EmitInput = Omit<EmittedEvent, 'event_id' | 'schema_version' | 'causation_id' | 'correlation_id' | 'trace_id' | 'reversal_handle'>

export class Krn03Store {
  roles = new Map<string, Role>()
  permissionSets = new Map<string, PermissionSet>()
  permissionGrants = new Map<string, PermissionGrant>()
  dataScopeRules = new Map<string, DataScopeRule>()
  fieldPolicies = new Map<string, FieldPolicy>()
  delegations = new Map<string, Delegation>()
  events: EmittedEvent[] = []

  emit(e: EmitInput) {
    this.events.push({
      ...e,
      event_id: randomUUID(),
      schema_version: 1,
      causation_id: null,
      correlation_id: randomUUID(),
      trace_id: randomUUID(),
      reversal_handle: null,
    })
  }
}

export function createStore(): Krn03Store {
  return new Krn03Store()
}
