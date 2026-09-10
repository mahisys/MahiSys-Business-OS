/**
 * KRN-11 event contracts — KRN-11.md §12 (not given in Vol 1 at all, §17
 * item 1, bulk-approved per D-31; proposed from scratch per Vol 0 §42).
 */
import { z } from 'zod'
import { eventEnvelope, uuid } from '@mahisys/shared'

export const SeriesCreatedPayloadSchema = z.object({ series_id: uuid, document_type_id: uuid })
export const SeriesCreatedEventSchema = eventEnvelope('numbering.series.created', SeriesCreatedPayloadSchema)

export const SeriesUpdatedPayloadSchema = z.object({ series_id: uuid })
export const SeriesUpdatedEventSchema = eventEnvelope('numbering.series.updated', SeriesUpdatedPayloadSchema)

export const SeriesClosedPayloadSchema = z.object({ series_id: uuid })
export const SeriesClosedEventSchema = eventEnvelope('numbering.series.closed', SeriesClosedPayloadSchema)

export const NumberReservedPayloadSchema = z.object({ series_id: uuid, allocation_id: uuid, sequence_value: z.number().int(), formatted_number: z.string() })
export const NumberReservedEventSchema = eventEnvelope('numbering.number.reserved', NumberReservedPayloadSchema)

export const NumberAllocatedPayloadSchema = z.object({ series_id: uuid, sequence_value: z.number().int(), formatted_number: z.string(), document_id: uuid.nullable() })
export const NumberAllocatedEventSchema = eventEnvelope('numbering.number.allocated', NumberAllocatedPayloadSchema)

export const NumberCancelledPayloadSchema = z.object({ series_id: uuid, sequence_value: z.number().int(), reason: z.string() })
export const NumberCancelledEventSchema = eventEnvelope('numbering.number.cancelled', NumberCancelledPayloadSchema)

export const SeriesRolledOverPayloadSchema = z.object({ prior_series_id: uuid, new_series_id: uuid, fiscal_year: z.string() })
export const SeriesRolledOverEventSchema = eventEnvelope('numbering.series.rolled_over', SeriesRolledOverPayloadSchema)
