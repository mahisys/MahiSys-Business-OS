/**
 * `permission_grant` — KRN-03.md §4.1/§17 item 2 (this draft allows a
 * subject to hold either a `role_id` or a bare `permission_set_id`
 * without a role wrapper — bulk-approved per D-31).
 */
import { z } from 'zod'
import { withUniversalFields, uuid, ActorRefSchema } from '@mahisys/shared'

export const PermissionSubjectTypeSchema = z.enum(['user', 'agent_identity', 'service_account'])
export type PermissionSubjectType = z.infer<typeof PermissionSubjectTypeSchema>

export const PermissionGrantStatusSchema = z.enum(['active', 'revoked', 'expired'])
export type PermissionGrantStatus = z.infer<typeof PermissionGrantStatusSchema>

/** KRN-03.md §5: `active → (expired | revoked)`, both terminal — re-granting creates a new record (append-only audit trail, mirrors KRN-01's philosophy). */
export const PERMISSION_GRANT_STATUS_TRANSITIONS: Record<PermissionGrantStatus, PermissionGrantStatus[]> = {
  active: ['expired', 'revoked'],
  expired: [],
  revoked: [],
}

export const PermissionGrantObjectSchema = withUniversalFields({
  subject_type: PermissionSubjectTypeSchema,
  subject_id: uuid, // into the KRN-02 entity matching subject_type
  role_id: uuid.nullable(),
  permission_set_id: uuid.nullable(),
  scope_override_id: uuid.nullable(), // narrows, never widens, the role/permission-set's default scope
  granted_at: z.string().datetime(),
  granted_by: ActorRefSchema,
  expires_at: z.string().datetime().nullable(),
  status: PermissionGrantStatusSchema,
})

export const PermissionGrantSchema = PermissionGrantObjectSchema.refine(
  (g) => g.role_id !== null || g.permission_set_id !== null,
  { message: 'At least one of role_id/permission_set_id is required (KRN-03.md §4.1)' },
)
export type PermissionGrant = z.infer<typeof PermissionGrantSchema>
