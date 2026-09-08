/**
 * `delegation` — KRN-03.md §4.1 (KRN-03-FR-004, verbatim shape). §17 item
 * 7: when `permission_set_id` is null, the delegate temporarily exercises
 * the delegator's own *current* effective scope rather than a scope
 * stored on the delegation record itself — bulk-approved per D-31.
 */
import { z } from 'zod'
import { withUniversalFields, uuid, PeriodSchema } from '@mahisys/shared'

export const DelegationStatusSchema = z.enum(['pending', 'active', 'expired', 'revoked'])
export type DelegationStatus = z.infer<typeof DelegationStatusSchema>

/** KRN-03.md §5: `pending → active → (expired | revoked)`. `expired` fires automatically at `period.to` — no human action required, unlike `revoked`. */
export const DELEGATION_STATUS_TRANSITIONS: Record<DelegationStatus, DelegationStatus[]> = {
  pending: ['active'],
  active: ['expired', 'revoked'],
  expired: [],
  revoked: [],
}

export const DelegationObjectSchema = withUniversalFields({
  from_subject_id: uuid, // KRN-02 user
  to_subject_id: uuid, // KRN-02 user
  permission_set_id: uuid.nullable(),
  period: PeriodSchema,
  reason: z.string().min(1),
  status: DelegationStatusSchema,
})

export const DelegationSchema = DelegationObjectSchema.refine(
  (d) => d.period.is_open_ended === false,
  { message: 'A delegation is always a bounded period (KRN-03-FR-004) — period.is_open_ended must be false' },
)
export type Delegation = z.infer<typeof DelegationSchema>
