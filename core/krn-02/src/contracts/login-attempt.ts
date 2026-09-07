/**
 * `login_attempt` entity contract — KRN-02.md §4.1. Field-level detail
 * extrapolated (KRN-02.md §17 item 1, bulk-approved per D-31). Append-only
 * log entry, immutable once written (KRN-02.md §5) — no state machine.
 * Deliberately carries no credential-material field of any kind
 * (KRN-02-FR-004).
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const LoginOutcomeSchema = z.enum(['success', 'failed_credential', 'failed_mfa', 'locked_out'])
export type LoginOutcome = z.infer<typeof LoginOutcomeSchema>

export const LoginAttemptSchema = withUniversalFields({
  login_id: z.string().min(1), // the identifier attempted — not necessarily resolvable to a user
  outcome: LoginOutcomeSchema,
  device_id: uuid.nullable(),
  ip: z.string().min(1),
  occurred_at: z.string().datetime(),
})
export type LoginAttempt = z.infer<typeof LoginAttemptSchema>
