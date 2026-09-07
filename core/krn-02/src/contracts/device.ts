/**
 * `device` entity contract — KRN-02.md §4.1. Field-level detail
 * extrapolated (KRN-02.md §17 item 1, bulk-approved per D-31).
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const DevicePlatformSchema = z.enum(['ios', 'android', 'web', 'whatsapp'])
export type DevicePlatform = z.infer<typeof DevicePlatformSchema>
export const DeviceTrustStatusSchema = z.enum(['registered', 'trusted', 'revoked'])
export type DeviceTrustStatus = z.infer<typeof DeviceTrustStatusSchema>

export const DeviceSchema = withUniversalFields({
  user_id: uuid,
  platform: DevicePlatformSchema,
  device_fingerprint: z.string().min(1),
  registered_at: z.string().datetime(),
  last_seen_at: z.string().datetime(),
  push_token: z.string().nullable(),
  trust_status: DeviceTrustStatusSchema,
})
export type Device = z.infer<typeof DeviceSchema>

/**
 * `device.trust_status` state machine (KRN-02.md §5): registered →
 * trusted → revoked. `revoked` is terminal for that device instance; a
 * lost-and-recovered device re-registers as a new record.
 */
export const DEVICE_TRUST_STATUS_TRANSITIONS: Record<DeviceTrustStatus, DeviceTrustStatus[]> = {
  registered: ['trusted', 'revoked'],
  trusted: ['revoked'],
  revoked: [],
}
