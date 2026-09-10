/**
 * KRN-10 API request/response contracts — KRN-10.md §10. Base path
 * `/api/v1/audit/{entity}` per Vol 0 §42. No POST/PATCH/DELETE exists for
 * `audit_entry` or `access_log` — system-generated only (§11), no
 * authorable path by design.
 */
import { z } from 'zod'
import { cursorListRequest, cursorListResponse, uuid } from '@mahisys/shared'
import { AuditEntrySchema } from './audit-entry.js'
import { AccessLogSchema } from './access-log.js'
import { AuditChainSealSchema } from './audit-chain-seal.js'

// GET /api/v1/audit/entries
export const AuditEntryFilterSchema = z.object({
  subject_type: z.string().optional(),
  subject_id: uuid.optional(),
  actor_id: uuid.optional(),
  action: z.string().optional(),
  occurred_from: z.string().datetime().optional(),
  occurred_to: z.string().datetime().optional(),
})
export const AuditEntryListRequestSchema = cursorListRequest(AuditEntryFilterSchema)
export const AuditEntryListResponseSchema = cursorListResponse(AuditEntrySchema)

// GET /api/v1/audit/access-logs
export const AccessLogListRequestSchema = cursorListRequest(AuditEntryFilterSchema)
export const AccessLogListResponseSchema = cursorListResponse(AccessLogSchema)

// GET /api/v1/audit/verify-chain
export const VerifyChainRequestSchema = z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() })
export const VerifyChainResponseSchema = z.object({
  ok: z.boolean(),
  broken_at_sequence_no: z.number().int().nullable(),
  checked_count: z.number().int().nonnegative(),
})

// POST /api/v1/audit/evidence-pack
export const EvidencePackRequestSchema = z.object({
  subject_type: z.string().optional(),
  date_range: z.object({ from: z.string().datetime(), to: z.string().datetime() }),
  format: z.enum(['json', 'csv']),
})
export const EvidencePackResponseSchema = z.object({
  entries: z.array(AuditEntrySchema),
  generated_at: z.string().datetime(),
  generated_by: uuid,
})

// GET /api/v1/audit/chain-seals
export const ChainSealListResponseSchema = cursorListResponse(AuditChainSealSchema)
