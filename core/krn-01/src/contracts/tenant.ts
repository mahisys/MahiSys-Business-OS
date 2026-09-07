/**
 * `tenant` entity contract — KRN-01.md §4.1, verbatim from Vol 1.
 *
 * Note: unlike every other entity in the platform, `tenant` carries no
 * `tenant_id` field of its own — it *is* the tenant root; `id` is the
 * identifier every other entity's `tenant_id` references (KRN-01.md §4.1
 * note). For the same reason it also carries no `entity_id`: `entity_id`
 * scopes a record to a legal entity *within* a tenant (KRN-01 §4.1's
 * `legal_entity`), and a tenant record sits above that — it is the
 * container legal entities live in, not itself scoped to one. So it
 * composes the universal fields minus both, rather than using
 * `withUniversalFields()` directly.
 */
import { z } from 'zod'
import { UniversalFieldsSchema, uuid } from '@mahisys/shared'

export const TenantStatusSchema = z.enum(['trial', 'active', 'suspended', 'closed'])
export type TenantStatus = z.infer<typeof TenantStatusSchema>

export const IsolationTierSchema = z.enum(['row', 'schema', 'dedicated'])
export type IsolationTier = z.infer<typeof IsolationTierSchema>

export const TenantSchema = UniversalFieldsSchema.omit({ tenant_id: true, entity_id: true }).extend({
  code: z.string().min(1),
  name: z.string().min(1),
  status: TenantStatusSchema,
  isolation_tier: IsolationTierSchema,
  region: z.string().min(1),
  manifest_id: uuid,
  plan_id: uuid,
  provisioned_at: z.string().datetime(),
})
export type Tenant = z.infer<typeof TenantSchema>

/**
 * `tenant.status` state machine (KRN-01.md §5):
 * trial → active → suspended → closed, with active ⇄ suspended permitted,
 * closed terminal.
 */
export const TENANT_STATUS_TRANSITIONS: Record<TenantStatus, TenantStatus[]> = {
  trial: ['active'],
  active: ['suspended'],
  suspended: ['active', 'closed'],
  closed: [],
}
