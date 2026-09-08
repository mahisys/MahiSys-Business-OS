/**
 * `permission_set` — KRN-03.md §4.1 (KRN-03-FR-001, verbatim shape:
 * `{entity, action, scope}`). `grants[].entity_ref` points at a KRN-04
 * `entity_definition.id` — this tenant's own physical copy (D-34), the
 * same tenant `permission_set` itself belongs to.
 */
import { z } from 'zod'
import { withUniversalFields, uuid } from '@mahisys/shared'

export const PermissionActionSchema = z.enum(['create', 'read', 'update', 'delete', 'approve', 'export', 'post', 'reverse'])
export type PermissionAction = z.infer<typeof PermissionActionSchema>

export const PermissionGrantEntrySchema = z.object({
  entity_ref: uuid, // KRN-04 entity_definition.id
  action: PermissionActionSchema,
  scope_rule_id: uuid.nullable(),
})
export type PermissionGrantEntry = z.infer<typeof PermissionGrantEntrySchema>

export const PermissionSetSchema = withUniversalFields({
  code: z.string().min(1),
  name: z.string().min(1),
  grants: z.array(PermissionGrantEntrySchema),
})
export type PermissionSet = z.infer<typeof PermissionSetSchema>
