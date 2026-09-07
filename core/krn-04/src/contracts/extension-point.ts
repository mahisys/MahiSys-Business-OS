/**
 * `extension_point` — KRN-04.md §4.1 (KRN-04-FR-005). `sys`-writable only
 * — a tenant may use a declared extension point, never declare a new one
 * (§10). Physically replicated per tenant like every other KRN-04 record
 * (D-34) — a platform release declares the same extension points into
 * every tenant's copy.
 */
import { withUniversalFields, uuid } from '@mahisys/shared'
import { z } from 'zod'

export const ExtensionPointKindSchema = z.enum(['hook_before', 'hook_after', 'computed_slot', 'custom_state', 'custom_field_group'])
export type ExtensionPointKind = z.infer<typeof ExtensionPointKindSchema>

export const ExtensionPointSchema = withUniversalFields({
  entity_id: uuid, // the sys entity this extension point is declared on
  code: z.string().min(1), // e.g. "before_save", "computed_slot_1"
  kind: ExtensionPointKindSchema,
  constraints: z.record(z.string(), z.unknown()),
})
export type ExtensionPoint = z.infer<typeof ExtensionPointSchema>
