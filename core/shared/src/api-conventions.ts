/**
 * Kernel-wide API conventions, Vol 1 §1.2:
 * "Every endpoint accepts an idempotency key on writes. Every list endpoint
 * supports cursor pagination, declared filters and field selection. Errors
 * carry a stable machine code, a human message, and a `trace_id`."
 */
import { z } from 'zod'

/** Every write request (POST/PATCH/DELETE) carries this header. */
export const IdempotencyKeyHeaderSchema = z.object({
  'idempotency-key': z.string().uuid(),
})

export function cursorListRequest<F extends z.ZodTypeAny>(filterSchema: F) {
  return z.object({
    cursor: z.string().optional(),
    limit: z.number().int().positive().max(200).default(50),
    fields: z.array(z.string()).optional(), // field selection
    filter: filterSchema.optional(),
  })
}

export function cursorListResponse<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    next_cursor: z.string().nullable(),
  })
}

/** Vol 1 §1.2 — every error carries a stable machine code, a human message, and a trace_id. */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().regex(/^[A-Z0-9_]+$/, 'stable machine code, SCREAMING_SNAKE_CASE'),
    message: z.string().min(1),
    trace_id: z.string().uuid(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
})
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
