/**
 * `evaluation_log` — KRN-07.md §4.1. Not field-detailed in Vol 1/2 (§17
 * item 1, bulk-approved per D-31). Append-only, no transitions (§5) —
 * mirrors `@mahisys/krn-06`'s `StoredEvent` and `@mahisys/krn-10`'s
 * `AuditEntry` for the same reason: not wrapped in `withUniversalFields`,
 * since it is the record of an evaluation, not an entity that happens to
 * have one.
 */
import { z } from 'zod'
import { uuid, ActorRefSchema } from '@mahisys/shared'

export const EvaluationLogEntrySchema = z.object({
  evaluation_log_id: uuid,
  tenant_id: uuid,
  rule_set_id: uuid,
  rule_id: uuid.nullable(), // null when no rule matched
  rule_version_id: uuid.nullable(), // the exact version that fired (KRN-07-FR-004) — never just rule_id
  subject_type: z.string().min(1),
  subject_id: uuid,
  input_snapshot: z.record(z.string(), z.unknown()),
  matched: z.boolean(),
  outcome: z.record(z.string(), z.unknown()).nullable(), // null when matched is false
  evaluated_at: z.string().datetime(),
  evaluated_for: ActorRefSchema,
  correlation_id: uuid.nullable(),
  latency_ms: z.number().int().nonnegative(),
})

export const EvaluationLogSchema = EvaluationLogEntrySchema.refine(
  (e) => e.matched === (e.rule_id !== null && e.rule_version_id !== null),
  { message: 'rule_id/rule_version_id are set if and only if matched is true (KRN-07-FR-004)' },
)
export type EvaluationLogEntry = z.infer<typeof EvaluationLogSchema>
