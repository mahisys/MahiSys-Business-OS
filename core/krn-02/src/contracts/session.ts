/**
 * `session` entity contract — KRN-02.md §4.1. Field-level detail
 * extrapolated (KRN-02.md §17 item 1, bulk-approved per D-31).
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const SessionStatusSchema = z.enum(['active', 'idle_timed_out', 'absolute_timed_out', 'revoked', 'logged_out'])
export type SessionStatus = z.infer<typeof SessionStatusSchema>

export const AuthMethodSchema = z.enum(['password', 'otp', 'sso', 'google_workspace'])
export type AuthMethod = z.infer<typeof AuthMethodSchema>

export const SessionObjectSchema = withUniversalFields({
  user_id: uuid,
  device_id: uuid,
  started_at: z.string().datetime(),
  last_active_at: z.string().datetime(),
  idle_timeout_minutes: z.number().int().positive(),
  absolute_timeout_minutes: z.number().int().positive(),
  status: SessionStatusSchema,
  revoked_by: uuid.nullable(),
  revoked_reason: z.string().nullable(),
  auth_method_used: AuthMethodSchema,
  is_impersonation: z.boolean(),
  impersonated_by_user_id: uuid.nullable(),
})

export const SessionSchema = SessionObjectSchema.refine(
  (s) => s.is_impersonation === (s.impersonated_by_user_id !== null),
  { message: 'impersonated_by_user_id must be set iff is_impersonation is true (KRN-02.md §4.1)' },
)
export type Session = z.infer<typeof SessionSchema>

/**
 * `session.status` state machine (KRN-02.md §5): active → one of
 * {idle_timed_out, absolute_timed_out, revoked, logged_out}, all four
 * terminal for that session instance — reconnecting issues a new session.
 */
export const SESSION_STATUS_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  active: ['idle_timed_out', 'absolute_timed_out', 'revoked', 'logged_out'],
  idle_timed_out: [],
  absolute_timed_out: [],
  revoked: [],
  logged_out: [],
}
