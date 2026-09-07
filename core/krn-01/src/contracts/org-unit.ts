/**
 * `org_unit` entity contract — KRN-01.md §4.1. Field-level detail was not
 * given in Vol 1 (extrapolated by the draft, flagged in KRN-01.md §17
 * item 1 — open, bulk-approved per D-31).
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const OrgUnitStatusSchema = z.enum(['active', 'inactive'])
export type OrgUnitStatus = z.infer<typeof OrgUnitStatusSchema>

export const OrgUnitSchema = withUniversalFields({
  entity_id: uuid,
  parent_org_unit_id: uuid.nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
  // Manifest-defined reference (division, branch, department, plant, line…)
  // per KRN-01.md §17 item 2 — a `tnt`/manifest-declared type, not a `sys`
  // enum, since different verticals need different vocabularies.
  org_unit_type: uuid,
  location_id: uuid.nullable(),
  status: OrgUnitStatusSchema,
})
export type OrgUnit = z.infer<typeof OrgUnitSchema>
