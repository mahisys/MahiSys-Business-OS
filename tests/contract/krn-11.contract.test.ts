/**
 * KRN-11 contract tests — Vol 6 §6 step 2, written before any
 * implementation exists. Scope: shape only.
 */
import { describe, it, expect } from 'vitest'
import {
  NumberSeriesSchema,
  formatNumber,
  SeriesAssignmentObjectSchema,
  SequenceStateSchema,
  CancelledNumberSchema,
  SeriesCreateRequestSchema,
  AllocateRequestSchema,
  SeriesCreatedEventSchema,
  NumberAllocatedEventSchema,
  NumberCancelledEventSchema,
} from '@mahisys/krn-11'
import { ErrorResponseSchema } from '@mahisys/shared'

const actor = { type: 'service' as const, id: '019103b1-6e2a-7c3d-9a1b-000000000001' }
const now = new Date().toISOString()

const baseUniversal = {
  tenant_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
  entity_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
  namespace: 'tnt' as const,
  ext: {},
  created_at: now,
  created_by: actor,
  updated_at: now,
  updated_by: actor,
  version: 1,
  deleted_at: null,
  deleted_by: null,
  source: 'api' as const,
  trace_id: '019103b1-6e2a-7c3d-9a1b-000000000002',
}

describe('KRN-11 contract — number_series', () => {
  const valid = {
    ...baseUniversal,
    id: '019103b1-6e2a-7c3d-9a1b-000000000010',
    document_type_id: '019103b1-6e2a-7c3d-9a1b-000000000011',
    location_id: null,
    fiscal_year: 'FY2027',
    prefix: 'INV/',
    suffix: '',
    width: 4,
    separator: null,
    is_gapless: true,
    reset_policy: 'fiscal_year' as const,
    allocation_mode: 'on_issue' as const,
    status: 'active' as const,
  }

  it('accepts a well-formed series', () => {
    expect(NumberSeriesSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects fiscal_year set when reset_policy is never, and null when it is not never', () => {
    expect(NumberSeriesSchema.safeParse({ ...valid, reset_policy: 'never' as const, fiscal_year: 'FY2027' }).success).toBe(false)
    expect(NumberSeriesSchema.safeParse({ ...valid, reset_policy: 'never' as const, fiscal_year: null }).success).toBe(true)
    expect(NumberSeriesSchema.safeParse({ ...valid, reset_policy: 'fiscal_year' as const, fiscal_year: null }).success).toBe(false)
  })

  it('formatNumber renders prefix + zero-padded value + suffix', () => {
    expect(formatNumber({ prefix: 'INV/', suffix: '', width: 4, separator: null }, 42)).toBe('INV/0042')
    expect(formatNumber({ prefix: 'PUN', suffix: 'A', width: 3, separator: '/' }, 7).length).toBeGreaterThan(0)
  })

  it('SeriesCreateRequestSchema omits server-managed fields and status', () => {
    const shape = SeriesCreateRequestSchema.shape as Record<string, unknown>
    expect(shape.id).toBeUndefined()
    expect(shape.status).toBeUndefined()
    expect(shape.is_gapless).toBeDefined()
  })
})

describe('KRN-11 contract — series_assignment', () => {
  it('accepts a well-formed assignment, location_id nullable for entity-wide', () => {
    const valid = { ...baseUniversal, id: '019103b1-6e2a-7c3d-9a1b-000000000020', series_id: '019103b1-6e2a-7c3d-9a1b-000000000010', document_type_id: '019103b1-6e2a-7c3d-9a1b-000000000011', location_id: null, priority: 0, effective_from: now }
    expect(SeriesAssignmentObjectSchema.safeParse(valid).success).toBe(true)
  })
})

describe('KRN-11 contract — sequence_state (KRN-11-FR-005/006)', () => {
  it('requires current_value <= reserved_high_watermark', () => {
    const base = { ...baseUniversal, id: '019103b1-6e2a-7c3d-9a1b-000000000030', series_id: '019103b1-6e2a-7c3d-9a1b-000000000010', locked_at: null, open_reservations: [] }
    expect(SequenceStateSchema.safeParse({ ...base, current_value: 50, reserved_high_watermark: 51 }).success).toBe(true)
    expect(SequenceStateSchema.safeParse({ ...base, current_value: 51, reserved_high_watermark: 50 }).success).toBe(false)
  })

  it('accepts an open reservation entry', () => {
    const base = { ...baseUniversal, id: '019103b1-6e2a-7c3d-9a1b-000000000031', series_id: '019103b1-6e2a-7c3d-9a1b-000000000010', current_value: 50, reserved_high_watermark: 51, locked_at: null }
    const withReservation = { ...base, open_reservations: [{ allocation_id: '019103b1-6e2a-7c3d-9a1b-000000000040', sequence_value: 51, reserved_at: now, expires_at: null, idempotency_key: 'k1' }] }
    expect(SequenceStateSchema.safeParse(withReservation).success).toBe(true)
  })
})

describe('KRN-11 contract — cancelled_number (KRN-11-FR-002)', () => {
  it('accepts every declared cancellation reason', () => {
    const base = { ...baseUniversal, id: '019103b1-6e2a-7c3d-9a1b-000000000050', series_id: '019103b1-6e2a-7c3d-9a1b-000000000010', sequence_value: 119, formatted_number: 'INV/0119', document_id: null, cancelled_at: now, cancelled_by: actor }
    for (const reason of ['document_failed_validation', 'reservation_expired', 'document_voided', 'manual_correction'] as const) {
      expect(CancelledNumberSchema.safeParse({ ...base, reason }).success, reason).toBe(true)
    }
  })
})

describe('KRN-11 contract — allocate request (KRN-11-FR-007)', () => {
  it('requires entity_id, document_type_id and idempotency_key', () => {
    expect(AllocateRequestSchema.safeParse({ entity_id: '019103b1-6e2a-7c3d-9a1b-000000000060', document_type_id: '019103b1-6e2a-7c3d-9a1b-000000000061', idempotency_key: '019103b1-6e2a-7c3d-9a1b-000000000062' }).success).toBe(true)
    expect(AllocateRequestSchema.safeParse({}).success).toBe(false)
  })
})

describe('KRN-11 contract — events (P-08 envelope, §12)', () => {
  it('validates numbering.series.created', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-000000000070',
      tenant_id: baseUniversal.tenant_id,
      entity_id: baseUniversal.entity_id,
      event_name: 'numbering.series.created',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'number_series',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      payload: { series_id: '019103b1-6e2a-7c3d-9a1b-000000000010', document_type_id: '019103b1-6e2a-7c3d-9a1b-000000000011' },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-000000000071',
      trace_id: '019103b1-6e2a-7c3d-9a1b-000000000072',
      reversal_handle: null,
    }
    expect(SeriesCreatedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates numbering.number.allocated', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-000000000080',
      tenant_id: baseUniversal.tenant_id,
      entity_id: baseUniversal.entity_id,
      event_name: 'numbering.number.allocated',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'number_series',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      payload: { series_id: '019103b1-6e2a-7c3d-9a1b-000000000010', sequence_value: 119, formatted_number: 'INV/0119', document_id: null },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-000000000081',
      trace_id: '019103b1-6e2a-7c3d-9a1b-000000000082',
      reversal_handle: null,
    }
    expect(NumberAllocatedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates numbering.number.cancelled', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-000000000090',
      tenant_id: baseUniversal.tenant_id,
      entity_id: baseUniversal.entity_id,
      event_name: 'numbering.number.cancelled',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'number_series',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      payload: { series_id: '019103b1-6e2a-7c3d-9a1b-000000000010', sequence_value: 119, reason: 'document_voided' },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-000000000091',
      trace_id: '019103b1-6e2a-7c3d-9a1b-000000000092',
      reversal_handle: null,
    }
    expect(NumberCancelledEventSchema.safeParse(event).success).toBe(true)
  })
})

describe('KRN-11 contract — error shape reused from @mahisys/shared', () => {
  it('is unchanged (sanity check for the shared import)', () => {
    expect(ErrorResponseSchema.safeParse({ error: { code: 'SERIES_NOT_FOUND', message: 'x', trace_id: '019103b1-6e2a-7c3d-9a1b-000000000099' } }).success).toBe(true)
  })
})
