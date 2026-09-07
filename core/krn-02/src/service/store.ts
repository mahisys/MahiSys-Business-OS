/**
 * In-memory reference store for KRN-02 — same rationale as KRN-01's
 * `Krn01Store`: decoupled from persistence via this shape, so a
 * Postgres-backed adapter (D-12) can be swapped in later without
 * touching business logic.
 */
import { randomUUID } from 'node:crypto'
import type { User } from '../contracts/user.js'
import type { Credential } from '../contracts/credential.js'
import type { Session } from '../contracts/session.js'
import type { ServiceAccount } from '../contracts/service-account.js'
import type { AgentIdentity } from '../contracts/agent-identity.js'
import type { Device } from '../contracts/device.js'
import type { LoginAttempt } from '../contracts/login-attempt.js'

/** Full P-08 Event envelope — see KRN-01's identical rationale. */
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
  reversal_handle: string | null
}

export type EmitInput = Omit<EmittedEvent, 'event_id' | 'schema_version' | 'causation_id' | 'correlation_id' | 'trace_id' | 'reversal_handle'>

export class Krn02Store {
  users = new Map<string, User>()
  credentials = new Map<string, Credential>()
  sessions = new Map<string, Session>()
  serviceAccounts = new Map<string, ServiceAccount>()
  agentIdentities = new Map<string, AgentIdentity>()
  devices = new Map<string, Device>()
  loginAttempts = new Map<string, LoginAttempt>()
  events: EmittedEvent[] = []

  emit(e: EmitInput) {
    this.events.push({
      ...e,
      event_id: randomUUID(),
      schema_version: 1,
      causation_id: null,
      correlation_id: randomUUID(),
      trace_id: randomUUID(),
      reversal_handle: null, // KRN-18 doesn't exist yet (Phase 1) — per D-21
    })
  }
}

export function createStore(): Krn02Store {
  return new Krn02Store()
}
