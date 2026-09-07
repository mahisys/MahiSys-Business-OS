/**
 * `fiscal_calendar` and `fiscal_period` (child) entity contracts —
 * KRN-01.md §4.1. Field-level detail extrapolated from KRN-01-FR-003
 * (KRN-01.md §17 item 1, bulk-approved per D-31). `fiscal_period`'s
 * `fiscal_calendar_id` parent reference is implied by the "child" relation
 * in KRN-01.md's table but not given an explicit field name there — added
 * here as the obvious minimum for the child relationship to be queryable.
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const FiscalCalendarSchema = withUniversalFields({
  entity_id: uuid, // one calendar per legal entity
  fiscal_year: z.string().regex(/^FY\d{4}$/, 'e.g. FY2027'),
})
export type FiscalCalendar = z.infer<typeof FiscalCalendarSchema>

export const FiscalPeriodStatusSchema = z.enum(['open', 'closed', 'permanently_closed'])
export type FiscalPeriodStatus = z.infer<typeof FiscalPeriodStatusSchema>

export const FiscalPeriodSchema = withUniversalFields({
  fiscal_calendar_id: uuid,
  entity_id: uuid,
  period_no: z.number().int().min(1).max(12),
  from: z.string().date(),
  to: z.string().date(),
  status: FiscalPeriodStatusSchema,
}).refine((p) => p.from <= p.to, { message: 'from must not be after to' })
export type FiscalPeriod = z.infer<typeof FiscalPeriodSchema>

/**
 * `fiscal_period.status` state machine (KRN-01.md §5): open → closed →
 * permanently_closed; closed → open permitted (reopen for correction)
 * only while not permanently_closed; permanently_closed is terminal.
 */
export const FISCAL_PERIOD_STATUS_TRANSITIONS: Record<FiscalPeriodStatus, FiscalPeriodStatus[]> = {
  open: ['closed'],
  closed: ['open', 'permanently_closed'],
  permanently_closed: [],
}
