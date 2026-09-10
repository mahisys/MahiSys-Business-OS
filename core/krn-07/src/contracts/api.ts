/**
 * KRN-07 API request/response contracts — KRN-07.md §10.
 */
import { z } from 'zod'
import { cursorListRequest, cursorListResponse, uuid } from '@mahisys/shared'
import { RuleSetSchema } from './rule-set.js'
import { RuleObjectSchema, RuleSchema } from './rule.js'
import { RuleVersionObjectSchema } from './rule-version.js'
import { EvaluationLogEntrySchema } from './evaluation-log.js'

const OMIT_SERVER_MANAGED = {
  id: true, ext: true, created_at: true, created_by: true,
  updated_at: true, updated_by: true, version: true, deleted_at: true,
  deleted_by: true, source: true, trace_id: true,
} as const

// CRUD /api/v1/core/rule-sets
export const RuleSetCreateRequestSchema = RuleSetSchema.omit({ ...OMIT_SERVER_MANAGED, status: true })
export const RuleSetListResponseSchema = cursorListResponse(RuleSetSchema)

// CRUD /api/v1/core/rules
export const RuleCreateRequestSchema = RuleObjectSchema.omit({ ...OMIT_SERVER_MANAGED, status: true, current_version_id: true })
export const RuleListResponseSchema = cursorListResponse(RuleSchema)

// GET /api/v1/core/rule-versions
export const RuleVersionListResponseSchema = cursorListResponse(RuleVersionObjectSchema)

// POST /api/v1/core/rules/evaluate
export const EvaluateRequestSchema = z.object({
  rule_set_id: uuid.optional(),
  rule_type: z.string().optional(),
  subject_type: z.string(),
  subject_id: uuid,
  context: z.record(z.string(), z.unknown()),
})
export const EvaluateResponseSchema = z.object({
  matched: z.boolean(),
  outcome: z.record(z.string(), z.unknown()).nullable(),
  rule_id: uuid.nullable(),
  rule_version_id: uuid.nullable(),
  evaluated_at: z.string().datetime(),
})

// POST /api/v1/core/rules/simulate
export const SimulateRequestSchema = z.object({
  rule_set_id: uuid,
  historical_scope: z.object({ from: z.string().datetime(), to: z.string().datetime() }),
})

// GET /api/v1/core/evaluation-log
export const EvaluationLogListRequestSchema = cursorListRequest(z.object({ subject_type: z.string().optional(), rule_set_id: uuid.optional() }))
export const EvaluationLogListResponseSchema = cursorListResponse(EvaluationLogEntrySchema)

// POST /api/v1/core/rule-sets/{id}/activate — no body beyond the path id
