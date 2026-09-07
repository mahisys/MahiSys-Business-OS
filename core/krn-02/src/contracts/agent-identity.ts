/**
 * `agent_identity` entity contract — KRN-02.md §4.1, verbatim from Vol 1.
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

/** Vol 0 §42: PREFIX-AG-NN, e.g. MFG-AG-05. */
export const AgentCodeSchema = z.string().regex(/^[A-Z]+-AG-\d{2}$/, 'PREFIX-AG-NN')

/** Vol 0 §27.3 Trust Ladder. */
export const TrustCeilingSchema = z.enum(['L0', 'L1', 'L2', 'L3', 'L4'])
export type TrustCeiling = z.infer<typeof TrustCeilingSchema>

// Proposed, not given in Vol 1 — flagged in KRN-02.md §17 item 2.
export const AgentIdentityStatusSchema = z.enum(['registered', 'active', 'deprecated', 'retired'])
export type AgentIdentityStatus = z.infer<typeof AgentIdentityStatusSchema>

export const AgentIdentitySchema = withUniversalFields({
  agent_code: AgentCodeSchema,
  agent_version: z.number().int().positive(),
  owning_module: z.string().min(1),
  credential_ref: uuid,
  // Written only by INT-04 (L9) — KRN-02 stores it, never writes it itself.
  trust_ceiling: TrustCeilingSchema,
  status: AgentIdentityStatusSchema,
})
export type AgentIdentity = z.infer<typeof AgentIdentitySchema>

/**
 * `agent_identity.status` state machine (KRN-02.md §5): registered →
 * active → {deprecated, retired}, deprecated → retired. `retired` is
 * terminal. Version upgrades (agent_version incrementing) do NOT change
 * status — modelled as a separate field update, not a transition here.
 */
export const AGENT_IDENTITY_STATUS_TRANSITIONS: Record<AgentIdentityStatus, AgentIdentityStatus[]> = {
  registered: ['active'],
  active: ['deprecated', 'retired'],
  deprecated: ['retired'],
  retired: [],
}
