/**
 * `audit_entry` — KRN-10.md §4/§6/§7. Unlike every other kernel module
 * built so far, KRN-10.md has no §4.1 field-level table at all (not even
 * an extrapolated one) — only the acceptance criteria (§16) and running
 * prose name its fields. This is a step beyond KRN-06/KRN-11's "field
 * table extrapolated from an entity name" gap (§17 item 5, bulk-approved
 * per D-31); the shape below is assembled directly from FR-001
 * ("before/after, actor with agent version, timestamp, IP, device,
 * source, trace_id"), FR-002 (hash chain), FR-008 (reversal_handle for
 * every entry) and DR-001 (agent reasoning/confidence/evidence/rollback).
 *
 * Not wrapped in `withUniversalFields` — mirrors `@mahisys/krn-06`'s
 * `StoredEvent` exactly, and for the identical reason (KRN-06.md §4.1's
 * own words, equally true here): an audit_entry is not "an entity that
 * happens to record a mutation," it *is* the record of the mutation, and
 * per §5 has no state machine and no entity in this module is ever
 * updated after being written — giving it universal fields like
 * `updated_at`/`version`/`deleted_at` that could never meaningfully
 * change would misrepresent that guarantee.
 */
import { z } from 'zod'
import { uuid, ActorRefSchema, SourceSchema } from '@mahisys/shared'

export const AuditActionSchema = z.enum(['create', 'update', 'delete', 'approve', 'post', 'reverse', 'other'])
export type AuditAction = z.infer<typeof AuditActionSchema>

export const AuditEntryObjectSchema = z.object({
  audit_entry_id: uuid,
  tenant_id: uuid,
  subject_type: z.string().min(1),
  subject_id: uuid,
  action: AuditActionSchema,
  before: z.record(z.string(), z.unknown()).nullable(), // null for a create
  after: z.record(z.string(), z.unknown()).nullable(), // null for a delete
  actor: ActorRefSchema,
  occurred_at: z.string().datetime(), // event/mutation time (Vol 2 §1.6) — may precede recorded_at for offline-sync-originated mutations (§15)
  recorded_at: z.string().datetime(), // transaction time
  ip_address: z.string().nullable(),
  device_id: z.string().nullable(),
  source: SourceSchema,
  trace_id: uuid,
  reversal_handle: uuid.nullable(), // KRN-10-FR-008 — every entry, not only agent ones; null until KRN-18 exists or registers one (Phase 0, §17 item 3)
  // KRN-10-DR-001 — present if and only if actor.type === 'agent'.
  reasoning_trace: z.string().nullable(),
  confidence_score: z.number().min(0).max(1).nullable(),
  evidence_refs: z.array(uuid).nullable(),
  // KRN-10-FR-002 hash chain — sequential per tenant.
  sequence_no: z.number().int().positive(),
  prev_hash: z.string().nullable(), // null only for the first entry in a tenant's chain
  entry_hash: z.string(),
})

export const AuditEntrySchema = AuditEntryObjectSchema.refine(
  (e) => (e.actor.type === 'agent') === (e.reasoning_trace !== null && e.confidence_score !== null && e.evidence_refs !== null),
  { message: 'reasoning_trace/confidence_score/evidence_refs are present if and only if actor.type is agent (KRN-10-DR-001)' },
).refine(
  (e) => (e.sequence_no === 1) === (e.prev_hash === null),
  { message: 'prev_hash is null if and only if sequence_no is 1, the first entry in the chain (KRN-10-FR-002)' },
)
export type AuditEntry = z.infer<typeof AuditEntrySchema>
