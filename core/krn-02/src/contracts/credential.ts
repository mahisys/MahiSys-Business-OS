/**
 * `credential` entity contract — KRN-02.md §4.1. Field-level detail
 * extrapolated (KRN-02.md §17 item 1, bulk-approved per D-31).
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const CredentialTypeSchema = z.enum(['password_hash', 'sso_link', 'api_key_hash', 'webauthn_key'])
export type CredentialType = z.infer<typeof CredentialTypeSchema>
export const CredentialStatusSchema = z.enum(['active', 'expired', 'revoked'])

// Plain object shape kept separate from the refined schema so derived
// request schemas can still call `.omit()` (zod's `.refine()` wrapper
// does not expose it) — same pattern as KRN-01's LegalEntitySchema.
export const CredentialObjectSchema = withUniversalFields({
  user_id: uuid.nullable(),
  service_account_id: uuid.nullable(),
  agent_identity_id: uuid.nullable(),
  credential_type: CredentialTypeSchema,
  value_hash: z.string().min(1), // never the plaintext or reversible value (KRN-02-FR-004)
  rotation_due_at: z.string().datetime().nullable(),
  status: CredentialStatusSchema,
  last_rotated_at: z.string().datetime(),
})

function exactlyOneSubject(c: { user_id: string | null; service_account_id: string | null; agent_identity_id: string | null }) {
  return [c.user_id, c.service_account_id, c.agent_identity_id].filter((v) => v !== null).length === 1
}

export const CredentialSchema = CredentialObjectSchema.refine(exactlyOneSubject, {
  message: 'exactly one of user_id, service_account_id, agent_identity_id must be set (KRN-02.md §4.1)',
})
export type Credential = z.infer<typeof CredentialSchema>
