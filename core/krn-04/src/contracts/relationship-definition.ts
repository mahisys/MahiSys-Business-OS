/**
 * `relationship_definition` — KRN-04.md §4.1 (KRN-04-FR-006). Whether
 * `target_entity_id` shares `owning_module` with `entity_id` is a
 * cross-record invariant this schema cannot check on its own (it would
 * require looking up both entity_definition rows) — enforced in the
 * service layer, mirroring how KRN-02's `exactlyOneSubject` and KRN-01's
 * `canProposeOrgUnit` handle equivalent cross-record checks.
 */
import { withUniversalFields, uuid } from '@mahisys/shared'
import { z } from 'zod'

export const CardinalitySchema = z.enum(['one_to_one', 'one_to_many', 'many_to_many'])
export type Cardinality = z.infer<typeof CardinalitySchema>
export const CascadeBehaviourSchema = z.enum(['restrict', 'cascade_soft_delete', 'set_null'])
export type CascadeBehaviour = z.infer<typeof CascadeBehaviourSchema>

export const RelationshipDefinitionSchema = withUniversalFields({
  entity_id: uuid, // owning (source) entity
  target_entity_id: uuid,
  code: z.string().min(1),
  name: z.string().min(1),
  cardinality: CardinalitySchema,
  cascade_behaviour: CascadeBehaviourSchema,
})
export type RelationshipDefinition = z.infer<typeof RelationshipDefinitionSchema>
