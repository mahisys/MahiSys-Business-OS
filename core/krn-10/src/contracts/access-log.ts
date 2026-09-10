/**
 * `access_log` — KRN-10.md §4/§6 (KRN-10-FR-003). Written directly by the
 * data-access layer at read time (§17 item 2) — a separate mechanism from
 * `audit_entry`'s mutation capture, since a read never emits a KRN-06
 * mutation event to derive from.
 */
import { z } from 'zod'
import { uuid, ActorRefSchema, SourceSchema } from '@mahisys/shared'

export const AccessLogObjectSchema = z.object({
  access_log_id: uuid,
  tenant_id: uuid,
  subject_type: z.string().min(1),
  subject_id: uuid,
  fields_viewed: z.array(z.string()).min(1), // precise, not "the whole record" — keeps the signal precise (KRN-10-FR-003's acceptance sample)
  actor: ActorRefSchema,
  occurred_at: z.string().datetime(),
  ip_address: z.string().nullable(),
  source: SourceSchema,
  trace_id: uuid,
})
export const AccessLogSchema = AccessLogObjectSchema
export type AccessLog = z.infer<typeof AccessLogSchema>
