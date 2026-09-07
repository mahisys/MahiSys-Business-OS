/**
 * `isolation_assignment` entity contract — KRN-01.md §4.1.
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'
import { IsolationTierSchema } from './tenant.js'

export const MigrationStatusSchema = z.enum([
  'none',
  'scheduled',
  'in_progress',
  'completed',
  'failed',
])
export type MigrationStatus = z.infer<typeof MigrationStatusSchema>

export const IsolationAssignmentSchema = withUniversalFields({
  tenant_id: uuid,
  isolation_tier: IsolationTierSchema,
  effective_from: z.string().datetime(),
  migration_status: MigrationStatusSchema,
  previous_tier: IsolationTierSchema.nullable(),
})
export type IsolationAssignment = z.infer<typeof IsolationAssignmentSchema>

/**
 * `isolation_assignment.migration_status` state machine (KRN-01.md §5):
 * none → scheduled → in_progress → completed, with in_progress → failed →
 * scheduled as a retry path.
 */
export const MIGRATION_STATUS_TRANSITIONS: Record<MigrationStatus, MigrationStatus[]> = {
  none: ['scheduled'],
  scheduled: ['in_progress'],
  in_progress: ['completed', 'failed'],
  failed: ['scheduled'],
  completed: [],
}

/**
 * KRN-01-DR-001: isolation tier promotion is monotonic — row → schema →
 * dedicated. No downgrade path is defined at this layer (KRN-01.md §17
 * item 3).
 */
const TIER_ORDER = ['row', 'schema', 'dedicated'] as const
export function isValidTierPromotion(from: (typeof TIER_ORDER)[number], to: (typeof TIER_ORDER)[number]): boolean {
  return TIER_ORDER.indexOf(to) > TIER_ORDER.indexOf(from)
}
