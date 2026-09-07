/**
 * `user` entity contract — KRN-02.md §4.1, verbatim from Vol 1.
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const UserTypeSchema = z.enum(['full', 'light', 'self_service', 'external'])
export type UserType = z.infer<typeof UserTypeSchema>

// Proposed, not given in Vol 1 — flagged in KRN-02.md §17 item 2.
export const UserStatusSchema = z.enum(['pending', 'active', 'suspended', 'deactivated'])
export type UserStatus = z.infer<typeof UserStatusSchema>

export const MfaMethodSchema = z.enum(['totp', 'sms_otp', 'email_otp', 'push', 'hardware_key'])

export const MfaEnrolmentSchema = z.object({
  method: MfaMethodSchema,
  enrolled_at: z.string().datetime(),
  status: z.enum(['active', 'revoked']),
})

export const UserSchema = withUniversalFields({
  party_id: uuid.nullable(),
  user_type: UserTypeSchema,
  login_id: z.string().min(1),
  status: UserStatusSchema,
  locale: z.string().min(1),
  mfa_enrolments: z.array(MfaEnrolmentSchema),
  last_login_at: z.string().datetime().nullable(),
})
export type User = z.infer<typeof UserSchema>

/**
 * `user.status` state machine (KRN-02.md §5): pending → active →
 * suspended → deactivated, active ⇄ suspended permitted, deactivated
 * terminal (L12 — a returning employee gets a new user record, never a
 * resurrected login_id).
 */
export const USER_STATUS_TRANSITIONS: Record<UserStatus, UserStatus[]> = {
  pending: ['active'],
  active: ['suspended'],
  suspended: ['active', 'deactivated'],
  deactivated: [],
}
