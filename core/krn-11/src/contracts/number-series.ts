/**
 * `number_series` — KRN-11.md §4.1. Not field-detailed in Vol 1 (§17 item
 * 2, bulk-approved per D-31). The universal `entity_id` field (Vol 2
 * §1.2) doubles as "the KRN-01 legal entity the series belongs to" —
 * exactly the same convention KRN-01's own `cost_centre` uses for a
 * legal-entity-scoped record, not a separately-named business field.
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const ResetPolicySchema = z.enum(['fiscal_year', 'calendar_year', 'never'])
export type ResetPolicy = z.infer<typeof ResetPolicySchema>

export const AllocationModeSchema = z.enum(['on_issue', 'on_draft_with_reservation'])
export type AllocationMode = z.infer<typeof AllocationModeSchema>

export const NumberSeriesStatusSchema = z.enum(['active', 'closed'])
export type NumberSeriesStatus = z.infer<typeof NumberSeriesStatusSchema>

/** KRN-11.md §5: `active → closed` only — no reversal, a series that must resume issuing requires a new series (mirrors KRN-01's one-directional isolation-tier pattern). */
export const NUMBER_SERIES_STATUS_TRANSITIONS: Record<NumberSeriesStatus, NumberSeriesStatus[]> = {
  active: ['closed'],
  closed: [],
}

export const NumberSeriesObjectSchema = withUniversalFields({
  document_type_id: uuid, // KRN-04 entity_definition
  location_id: uuid.nullable(), // P-04 — null means entity-wide (KRN-11-FR-001)
  fiscal_year: z.string().nullable(), // null iff reset_policy is 'never'
  prefix: z.string(),
  suffix: z.string(),
  width: z.number().int().positive(),
  separator: z.string().nullable(),
  is_gapless: z.boolean(),
  reset_policy: ResetPolicySchema,
  allocation_mode: AllocationModeSchema,
  status: NumberSeriesStatusSchema,
})

export const NumberSeriesSchema = NumberSeriesObjectSchema.refine(
  (s) => (s.reset_policy === 'never') === (s.fiscal_year === null),
  { message: 'fiscal_year is null if and only if reset_policy is never (KRN-11.md §4.1)' },
)
export type NumberSeries = z.infer<typeof NumberSeriesSchema>

/** Renders the full human-facing number — prefix + zero-padded(width) sequence value + suffix, separator between segments when declared. */
export function formatNumber(series: Pick<NumberSeries, 'prefix' | 'suffix' | 'width' | 'separator'>, sequenceValue: number): string {
  const padded = String(sequenceValue).padStart(series.width, '0')
  const sep = series.separator ?? ''
  return `${series.prefix}${sep}${padded}${sep}${series.suffix}`
}
