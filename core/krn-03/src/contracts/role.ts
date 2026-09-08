/**
 * `role` — KRN-03.md §4.1. Vol 1 gives no field-level detail for any
 * KRN-03 entity (§17 item 1) — every field table in this module is this
 * draft's extrapolation, bulk-approved per D-31.
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const RoleStatusSchema = z.enum(['active', 'deprecated'])
export type RoleStatus = z.infer<typeof RoleStatusSchema>

/** KRN-03.md §5: `active → deprecated`. Not deletion — a deprecated role simply stops appearing for new grants (L12). */
export const ROLE_STATUS_TRANSITIONS: Record<RoleStatus, RoleStatus[]> = {
  active: ['deprecated'],
  deprecated: [],
}

export const RoleSchema = withUniversalFields({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  is_assignable_to_agent: z.boolean(),
  // Added during implementation — see KRN-03.md §4.1's note: without this,
  // a role-based permission_grant resolves to zero {entity,action,scope}
  // grants, since permission_set (not role) is where `grants` lives.
  permission_set_ids: z.array(uuid),
  status: RoleStatusSchema,
})
export type Role = z.infer<typeof RoleSchema>
