/**
 * `audit_chain_seal` — KRN-10.md §4/§6 (KRN-10-FR-006). Vol 1 lists this
 * entity name but states no requirement describing its shape (§17 item
 * 5, bulk-approved per D-31); the fields below are the reasonable
 * minimum FR-006's own text implies ("a checkpoint... e.g. a Merkle root
 * over a time window").
 */
import { z } from 'zod'
import { uuid } from '@mahisys/shared'

export const AuditChainSealObjectSchema = z.object({
  seal_id: uuid,
  tenant_id: uuid,
  sealed_at: z.string().datetime(),
  from_sequence_no: z.number().int().positive(),
  to_sequence_no: z.number().int().positive(),
  entry_count: z.number().int().nonnegative(),
  merkle_root: z.string(),
})

export const AuditChainSealSchema = AuditChainSealObjectSchema.refine(
  (s) => s.to_sequence_no >= s.from_sequence_no,
  { message: 'to_sequence_no must be >= from_sequence_no (KRN-10.md §6)' },
).refine(
  (s) => s.entry_count === s.to_sequence_no - s.from_sequence_no + 1,
  { message: 'entry_count must equal the inclusive span from_sequence_no..to_sequence_no' },
)
export type AuditChainSeal = z.infer<typeof AuditChainSealSchema>
