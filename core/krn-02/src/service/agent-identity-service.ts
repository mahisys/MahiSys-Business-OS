import { randomUUID } from 'node:crypto'
import type { Krn02Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { AgentIdentity } from '../contracts/agent-identity.js'
import { KernelError } from './errors.js'

export interface RegisterAgentIdentityInput {
  tenant_id: string
  entity_id: string
  agent_code: string
  owning_module: string
  credential_ref: string
}

function now() {
  return new Date().toISOString()
}

/**
 * §17 item 7: writes restricted to INT-03/STU-07 service accounts, never
 * a general user — enforced by requiring a `service` actor (mirrors
 * KRN-01's `createTenant` COM-04-only pattern). `trust_ceiling` starts at
 * `L0` (Vol 0 §27.3 — "Default on provisioning") and is never set by the
 * caller; only INT-04 (not built yet) writes it after this point.
 */
export function registerAgentIdentity(store: Krn02Store, input: RegisterAgentIdentityInput, actor: ActorRef): AgentIdentity {
  if (actor.type !== 'service') {
    throw new KernelError(
      'AGENT_IDENTITY_REGISTRATION_REQUIRES_SERVICE_ACTOR',
      'Agent identity registration is restricted to INT-03/STU-07 service accounts (KRN-02.md §17 item 7).',
      randomUUID(),
    )
  }

  const id = randomUUID()
  const timestamp = now()
  const agent: AgentIdentity = {
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
    agent_code: input.agent_code,
    agent_version: 1,
    owning_module: input.owning_module,
    credential_ref: input.credential_ref,
    trust_ceiling: 'L0',
    status: 'registered',
  }
  store.agentIdentities.set(id, agent)

  store.emit({
    event_name: 'identity.agent.registered',
    tenant_id: agent.tenant_id,
    entity_id: agent.entity_id,
    subject_type: 'agent_identity',
    subject_id: id,
    payload: { agent_identity_id: id, agent_code: agent.agent_code },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return agent
}

/**
 * KRN-02-DR-001: version upgrade. Does not alter any historical event's
 * actor-ref snapshot — those live on the events themselves (Vol 2 §1.2),
 * never re-derived from this record's current state. Restricted to
 * service actors on the same §17 item 7 / §10 basis as
 * `registerAgentIdentity` — found by the same sweep that produced D-33;
 * this was the one agent-identity write path missing the guard its
 * sibling function already had.
 */
export function upgradeAgentVersion(store: Krn02Store, agentIdentityId: string, newVersion: number, actor: ActorRef): AgentIdentity {
  if (actor.type !== 'service') {
    throw new KernelError(
      'AGENT_IDENTITY_WRITE_REQUIRES_SERVICE_ACTOR',
      'Agent identity writes (including version upgrades) are restricted to INT-03/STU-07 service accounts (KRN-02.md §17 item 7 / §10).',
      randomUUID(),
    )
  }

  const agent = store.agentIdentities.get(agentIdentityId)
  if (!agent) {
    throw new KernelError('AGENT_IDENTITY_NOT_FOUND', `No agent identity with id ${agentIdentityId}`, randomUUID())
  }
  if (newVersion <= agent.agent_version) {
    throw new KernelError('AGENT_VERSION_MUST_INCREASE', `New version ${newVersion} must exceed current version ${agent.agent_version}.`, randomUUID())
  }

  const previousVersion = agent.agent_version
  const timestamp = now()
  const updated: AgentIdentity = { ...agent, agent_version: newVersion, updated_at: timestamp, updated_by: actor, version: agent.version + 1 }
  store.agentIdentities.set(agentIdentityId, updated)

  store.emit({
    event_name: 'identity.agent.version_changed',
    tenant_id: agent.tenant_id,
    entity_id: agent.entity_id,
    subject_type: 'agent_identity',
    subject_id: agentIdentityId,
    payload: { agent_identity_id: agentIdentityId, agent_code: agent.agent_code, previous_version: previousVersion, new_version: newVersion },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return updated
}

export function getAgentIdentity(store: Krn02Store, agentIdentityId: string): AgentIdentity | undefined {
  return store.agentIdentities.get(agentIdentityId)
}
