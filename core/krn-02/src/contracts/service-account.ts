/**
 * `service_account` entity contract — KRN-02.md §4.1. Field-level detail
 * extrapolated (KRN-02.md §17 item 1, bulk-approved per D-31).
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const ServiceAccountStatusSchema = z.enum(['active', 'suspended', 'retired'])
export type ServiceAccountStatus = z.infer<typeof ServiceAccountStatusSchema>

export const ServiceAccountSchema = withUniversalFields({
  code: z.string().min(1),
  name: z.string().min(1),
  owning_integration: uuid.nullable(),
  rate_limit: z.object({ requests_per_minute: z.number().int().positive() }),
  credential_rotation_policy_days: z.number().int().positive(),
  status: ServiceAccountStatusSchema,
})
export type ServiceAccount = z.infer<typeof ServiceAccountSchema>
