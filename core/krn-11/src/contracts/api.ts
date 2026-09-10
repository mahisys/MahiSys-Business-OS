/**
 * KRN-11 API request/response contracts — KRN-11.md §10 (not given in
 * Vol 1 at all, §17 item 1, bulk-approved per D-31; proposed from scratch
 * per Vol 0 §42).
 */
import { z } from 'zod'
import { cursorListRequest, cursorListResponse, uuid } from '@mahisys/shared'
import { NumberSeriesObjectSchema, NumberSeriesSchema } from './number-series.js'
import { SeriesAssignmentObjectSchema } from './series-assignment.js'
import { CancelledNumberSchema, CancelledNumberReasonSchema } from './cancelled-number.js'

const OMIT_SERVER_MANAGED = {
  id: true, ext: true, created_at: true, created_by: true,
  updated_at: true, updated_by: true, version: true, deleted_at: true,
  deleted_by: true, source: true, trace_id: true,
} as const

// CRUD /api/v1/numbering/series
export const SeriesCreateRequestSchema = NumberSeriesObjectSchema.omit({ ...OMIT_SERVER_MANAGED, status: true })
export const SeriesListResponseSchema = cursorListResponse(NumberSeriesSchema)

// CRUD /api/v1/numbering/series-assignments
export const SeriesAssignmentCreateRequestSchema = SeriesAssignmentObjectSchema.omit(OMIT_SERVER_MANAGED)

// POST /api/v1/numbering/allocate
export const AllocateRequestSchema = z.object({
  entity_id: uuid,
  document_type_id: uuid,
  location_id: uuid.optional(),
  idempotency_key: z.string().uuid(),
})
export const AllocateResponseSchema = z.object({
  allocation_id: uuid,
  series_id: uuid,
  sequence_value: z.number().int().positive(),
  formatted_number: z.string(),
  status: z.enum(['reserved', 'allocated']),
})

// POST /api/v1/numbering/{allocation_id}/confirm
export const ConfirmResponseSchema = z.object({
  allocation_id: uuid,
  series_id: uuid,
  sequence_value: z.number().int().positive(),
  formatted_number: z.string(),
})

// POST /api/v1/numbering/{allocation_id}/cancel
export const CancelRequestSchema = z.object({ reason: CancelledNumberReasonSchema })

// GET /api/v1/numbering/cancelled-numbers
export const CancelledNumberListRequestSchema = cursorListRequest(z.object({ series_id: uuid.optional(), entity_id: uuid.optional() }))
export const CancelledNumberListResponseSchema = cursorListResponse(CancelledNumberSchema)
