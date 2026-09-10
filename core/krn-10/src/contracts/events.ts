/**
 * KRN-10's own administrative event contracts — KRN-10.md §12. Vol 1 has
 * no `Events:` line for KRN-10 at all (§17 item 4); this draft's read is
 * that `audit_entry` creation itself does *not* emit a domain event
 * (avoiding the circularity of auditing the audit log's own writes) but
 * three meaningful administrative actions do. These flow through
 * `@mahisys/krn-06`'s real `recordEvent()`, same integration pattern
 * KRN-11 established (D-39) — `audit_entry`/`access_log` writes
 * themselves deliberately do not.
 */
import { z } from 'zod'
import { eventEnvelope, uuid } from '@mahisys/shared'

export const ChainSealCompletedPayloadSchema = z.object({ seal_id: uuid, from_sequence_no: z.number().int(), to_sequence_no: z.number().int() })
export const ChainSealCompletedEventSchema = eventEnvelope('audit.chain_seal.completed', ChainSealCompletedPayloadSchema)

export const EvidencePackGeneratedPayloadSchema = z.object({ requested_by: uuid, entry_count: z.number().int().nonnegative() })
export const EvidencePackGeneratedEventSchema = eventEnvelope('audit.evidence_pack.generated', EvidencePackGeneratedPayloadSchema)

export const ChainVerificationFailedPayloadSchema = z.object({ broken_at_sequence_no: z.number().int() })
export const ChainVerificationFailedEventSchema = eventEnvelope('audit.chain.verification_failed', ChainVerificationFailedPayloadSchema)
