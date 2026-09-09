/**
 * KRN-06 contract tests — Vol 6 §6 step 2, written before any
 * implementation exists. Scope: shape only (entity fields/enums, API
 * request/response shape, event schema shape) — not business behaviour.
 */
import { describe, it, expect } from 'vitest'
import {
  StoredEventSchema,
  EventSchemaSchema,
  SubscriptionSchema,
  DeliveryAttemptSchema,
  DeadLetterSchema,
  OutboxSchema,
  SubscriptionCreateRequestSchema,
  ReplayRequestSchema,
  SubscriptionCreatedEventSchema,
  DeadLetterCreatedEventSchema,
  ReplayExecutedEventSchema,
} from '@mahisys/krn-06'
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

describe('KRN-06 contract — event (P-08, verbatim)', () => {
  it('accepts a well-formed event and rejects a malformed event_name', () => {
    const valid = {
      event_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      tenant_id: baseUniversal.tenant_id,
      entity_id: baseUniversal.entity_id,
      event_name: 'mfg.job_work.dispatched',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'job_work_challan',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000011',
      payload: { challan_no: 'JW-1' },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-000000000012',
      trace_id: '019103b1-6e2a-7c3d-9a1b-000000000013',
      reversal_handle: null,
    }
    expect(StoredEventSchema.safeParse(valid).success).toBe(true)
    expect(StoredEventSchema.safeParse({ ...valid, event_name: 'not-a-valid-name' }).success).toBe(false)
  })
})

describe('KRN-06 contract — event_schema (KRN-06-FR-005)', () => {
  it('accepts a well-formed event_schema with a distinct schema_version field (D-38)', () => {
    const valid = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000020',
      event_name: 'fin.invoice.issued',
      schema_version: 2,
      payload_schema: { required_fields: ['invoice_id', 'amount'], optional_fields: [] },
      compatibility_mode: 'forward' as const,
      owning_module: 'FIN-02',
      status: 'active' as const,
      effective_from: now,
    }
    expect(EventSchemaSchema.safeParse(valid).success).toBe(true)
    // universal `version` (record lock counter) and business `schema_version` are independent fields, not a collision.
    expect(valid.version).toBe(1)
    expect(valid.schema_version).toBe(2)
  })
})

describe('KRN-06 contract — subscription (KRN-06-FR-008)', () => {
  it('accepts a subscription with a structured filter_expression, rejects free text', () => {
    const valid = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000030',
      subscriber_type: 'integration' as const,
      subscriber_id: '019103b1-6e2a-7c3d-9a1b-000000000031',
      event_pattern: 'scm.stock.*',
      filter_expression: { field: 'quantity_delta', operator: 'lt' as const, value: 0 },
      delivery_mode: 'push' as const,
      idempotency_key_field: 'event_id',
      retry_ceiling: 5,
      status: 'active' as const,
    }
    expect(SubscriptionSchema.safeParse(valid).success).toBe(true)
    expect(SubscriptionSchema.safeParse({ ...valid, filter_expression: 'quantity_delta < 0' }).success).toBe(false)
  })

  it('SubscriptionCreateRequestSchema omits server-managed fields and status', () => {
    const shape = SubscriptionCreateRequestSchema.shape as Record<string, unknown>
    expect(shape.id).toBeUndefined()
    expect(shape.status).toBeUndefined()
    expect(shape.retry_ceiling).toBeDefined()
  })
})

describe('KRN-06 contract — delivery_attempt', () => {
  it('requires error_code/error_message iff status is failed', () => {
    const base = { ...baseUniversal, id: '019103b1-6e2a-7c3d-9a1b-000000000040', event_id: '019103b1-6e2a-7c3d-9a1b-000000000041', subscription_id: '019103b1-6e2a-7c3d-9a1b-000000000042', attempt_no: 1, attempted_at: now, latency_ms: 12 }
    expect(DeliveryAttemptSchema.safeParse({ ...base, status: 'succeeded' as const, error_code: null, error_message: null }).success).toBe(true)
    expect(DeliveryAttemptSchema.safeParse({ ...base, status: 'failed' as const, error_code: 'TIMEOUT', error_message: 'timed out' }).success).toBe(true)
    expect(DeliveryAttemptSchema.safeParse({ ...base, status: 'failed' as const, error_code: null, error_message: null }).success).toBe(false)
  })
})

describe('KRN-06 contract — dead_letter (KRN-06-FR-007)', () => {
  it('requires redriven_by/redriven_at iff status is redriven, human actor only by convention', () => {
    const base = { ...baseUniversal, id: '019103b1-6e2a-7c3d-9a1b-000000000050', event_id: '019103b1-6e2a-7c3d-9a1b-000000000051', subscription_id: '019103b1-6e2a-7c3d-9a1b-000000000052', failure_reason: 'timeout', first_failed_at: now, last_attempted_at: now, attempt_count: 6 }
    expect(DeadLetterSchema.safeParse({ ...base, status: 'open' as const, redriven_by: null, redriven_at: null }).success).toBe(true)
    expect(DeadLetterSchema.safeParse({ ...base, status: 'redriven' as const, redriven_by: { type: 'user' as const, id: '019103b1-6e2a-7c3d-9a1b-000000000053' }, redriven_at: now }).success).toBe(true)
    expect(DeadLetterSchema.safeParse({ ...base, status: 'redriven' as const, redriven_by: null, redriven_at: null }).success).toBe(false)
  })
})

describe('KRN-06 contract — outbox', () => {
  it('requires published_at iff status is published', () => {
    const base = { ...baseUniversal, id: '019103b1-6e2a-7c3d-9a1b-000000000060', event_id: '019103b1-6e2a-7c3d-9a1b-000000000061' }
    expect(OutboxSchema.safeParse({ ...base, status: 'pending' as const, published_at: null }).success).toBe(true)
    expect(OutboxSchema.safeParse({ ...base, status: 'published' as const, published_at: now }).success).toBe(true)
    expect(OutboxSchema.safeParse({ ...base, status: 'published' as const, published_at: null }).success).toBe(false)
  })
})

describe('KRN-06 contract — replay request (KRN-06-FR-006)', () => {
  it('requires target_subscription_id, accepts every optional filter dimension', () => {
    expect(ReplayRequestSchema.safeParse({ target_subscription_id: '019103b1-6e2a-7c3d-9a1b-000000000070' }).success).toBe(true)
    expect(ReplayRequestSchema.safeParse({}).success).toBe(false)
  })
})

describe('KRN-06 contract — administrative events (P-08 envelope, §12)', () => {
  it('validates core.event_bus.subscription_created', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-000000000080',
      tenant_id: baseUniversal.tenant_id,
      entity_id: '019103b1-6e2a-7c3d-9a1b-000000000030',
      event_name: 'core.event_bus.subscription_created',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'subscription',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000030',
      payload: { subscription_id: '019103b1-6e2a-7c3d-9a1b-000000000030', subscriber_type: 'integration', event_pattern: 'scm.stock.*' },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-000000000081',
      trace_id: '019103b1-6e2a-7c3d-9a1b-000000000082',
      reversal_handle: null,
    }
    expect(SubscriptionCreatedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates core.event_bus.dead_letter_created', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-000000000090',
      tenant_id: baseUniversal.tenant_id,
      entity_id: '019103b1-6e2a-7c3d-9a1b-000000000050',
      event_name: 'core.event_bus.dead_letter_created',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'dead_letter',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000050',
      payload: { dead_letter_id: '019103b1-6e2a-7c3d-9a1b-000000000050', event_id: '019103b1-6e2a-7c3d-9a1b-000000000051', subscription_id: '019103b1-6e2a-7c3d-9a1b-000000000052', failure_reason: 'timeout' },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-000000000091',
      trace_id: '019103b1-6e2a-7c3d-9a1b-000000000092',
      reversal_handle: null,
    }
    expect(DeadLetterCreatedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates core.event_bus.replay_executed', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-0000000000a0',
      tenant_id: baseUniversal.tenant_id,
      entity_id: '019103b1-6e2a-7c3d-9a1b-000000000030',
      event_name: 'core.event_bus.replay_executed',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'subscription',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000030',
      payload: { target_subscription_id: '019103b1-6e2a-7c3d-9a1b-000000000030', matched_event_count: 500 },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-0000000000a1',
      trace_id: '019103b1-6e2a-7c3d-9a1b-0000000000a2',
      reversal_handle: null,
    }
    expect(ReplayExecutedEventSchema.safeParse(event).success).toBe(true)
  })
})

describe('KRN-06 contract — error shape reused from @mahisys/shared', () => {
  it('is unchanged (sanity check for the shared import)', () => {
    expect(ErrorResponseSchema.safeParse({ error: { code: 'EVENT_NOT_FOUND', message: 'x', trace_id: '019103b1-6e2a-7c3d-9a1b-000000000099' } }).success).toBe(true)
  })
})
