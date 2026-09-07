/**
 * `cost_centre` entity contract — KRN-01.md §4.1. Field-level detail
 * extrapolated (KRN-01.md §17 item 1, bulk-approved per D-31).
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const CostCentreStatusSchema = z.enum(['active', 'inactive'])
export type CostCentreStatus = z.infer<typeof CostCentreStatusSchema>

export const CostCentreSchema = withUniversalFields({
  entity_id: uuid,
  parent_cost_centre_id: uuid.nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
  org_unit_id: uuid.nullable(),
  status: CostCentreStatusSchema,
})
export type CostCentre = z.infer<typeof CostCentreSchema>
