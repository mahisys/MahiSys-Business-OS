/**
 * KRN-07 contract tests — Vol 6 §6 step 2, written before any
 * implementation exists. Scope: shape only.
 */
import { describe, it, expect } from 'vitest'
import {
  RuleSetSchema,
  RuleSchema,
  RuleVersionObjectSchema,
  EvaluationLogSchema,
  RuleConditionSchema,
  RuleSetCreateRequestSchema,
  EvaluateRequestSchema,
  RuleSetActivatedEventSchema,
  RuleVersionCreatedEventSchema,
  SimulationCompletedEventSchema,
} from '@mahisys/krn-07'
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

describe('KRN-07 contract — rule_condition (P-12, structured, never free text)', () => {
  it('accepts field/operator/value and nested all/any trees, rejects free text', () => {
    expect(RuleConditionSchema.safeParse({ field: 'item.hsn_sac', operator: 'eq', value: '7318' }).success).toBe(true)
    expect(RuleConditionSchema.safeParse({ all: [{ field: 'a', operator: 'eq', value: 1 }, { any: [{ field: 'b', operator: 'gt', value: 2 }] }] }).success).toBe(true)
    expect(RuleConditionSchema.safeParse('item.hsn_sac == 7318').success).toBe(false)
  })
})

describe('KRN-07 contract — rule_set (KRN-07-FR-006)', () => {
  it('accepts every declared rule_type, rejects tax', () => {
    const base = { ...baseUniversal, id: '019103b1-6e2a-7c3d-9a1b-000000000010', name: 'Set', owning_module: 'SLS-07', match_mode: 'first_match' as const, status: 'draft' as const, description: '' }
    for (const rt of ['pricing', 'credit', 'reorder', 'eligibility', 'approval_threshold', 'compliance_check'] as const) {
      expect(RuleSetSchema.safeParse({ ...base, rule_type: rt }).success, rt).toBe(true)
    }
    expect(RuleSetSchema.safeParse({ ...base, rule_type: 'tax' }).success).toBe(false)
  })

  it('RuleSetCreateRequestSchema omits server-managed fields and status', () => {
    const shape = RuleSetCreateRequestSchema.shape as Record<string, unknown>
    expect(shape.id).toBeUndefined()
    expect(shape.status).toBeUndefined()
    expect(shape.rule_type).toBeDefined()
  })
})

describe('KRN-07 contract — rule (Vol 2 §P-12 verbatim)', () => {
  const base = {
    ...baseUniversal,
    id: '019103b1-6e2a-7c3d-9a1b-000000000020',
    rule_set_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
    rule_type: 'pricing' as const,
    name: 'Distributor discount',
    priority: 1,
    conditions: { field: 'quote.value', operator: 'gt' as const, value: 200000 },
    actions: [{ type: 'apply_discount', params: { value: 0.05 } }],
    period: { from: '2026-01-01', to: null, is_open_ended: true },
    scope: { entity_id: '019103b1-6e2a-7c3d-9a1b-000000000030', location_id: null, party_segment: 'distributor', item_category: null },
    status: 'draft' as const,
    current_version_id: '019103b1-6e2a-7c3d-9a1b-000000000031',
    authored_by: actor,
  }

  it('requires natural_language_source iff authored_via is natural_language', () => {
    expect(RuleSchema.safeParse({ ...base, authored_via: 'ui' as const, natural_language_source: null }).success).toBe(true)
    expect(RuleSchema.safeParse({ ...base, authored_via: 'natural_language' as const, natural_language_source: 'give distributors 5% off orders above ₹2 lakh' }).success).toBe(true)
    expect(RuleSchema.safeParse({ ...base, authored_via: 'natural_language' as const, natural_language_source: null }).success).toBe(false)
    expect(RuleSchema.safeParse({ ...base, authored_via: 'ui' as const, natural_language_source: 'should not be here' }).success).toBe(false)
  })
})

describe('KRN-07 contract — rule_version (append-only history)', () => {
  it('accepts a version with a nullable superseded_by_version_id', () => {
    const valid = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000040',
      rule_id: '019103b1-6e2a-7c3d-9a1b-000000000020',
      version_no: 1,
      conditions: { field: 'quote.value', operator: 'gt' as const, value: 200000 },
      actions: [{ type: 'apply_discount', params: { value: 0.05 } }],
      priority: 1,
      period: { from: '2026-01-01', to: null, is_open_ended: true },
      change_reason: null,
      superseded_by_version_id: null,
    }
    expect(RuleVersionObjectSchema.safeParse(valid).success).toBe(true)
  })
})

describe('KRN-07 contract — evaluation_log (KRN-07-FR-004)', () => {
  it('requires rule_id/rule_version_id iff matched is true', () => {
    const base = {
      evaluation_log_id: '019103b1-6e2a-7c3d-9a1b-000000000050',
      tenant_id: baseUniversal.tenant_id,
      rule_set_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      subject_type: 'quote_line',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000051',
      input_snapshot: { 'quote.value': 250000 },
      evaluated_at: now,
      evaluated_for: actor,
      correlation_id: null,
      latency_ms: 2,
    }
    expect(EvaluationLogSchema.safeParse({ ...base, matched: true, rule_id: '019103b1-6e2a-7c3d-9a1b-000000000020', rule_version_id: '019103b1-6e2a-7c3d-9a1b-000000000031', outcome: { actions: [] } }).success).toBe(true)
    expect(EvaluationLogSchema.safeParse({ ...base, matched: false, rule_id: null, rule_version_id: null, outcome: null }).success).toBe(true)
    expect(EvaluationLogSchema.safeParse({ ...base, matched: true, rule_id: null, rule_version_id: null, outcome: null }).success).toBe(false)
  })
})

describe('KRN-07 contract — evaluate request', () => {
  it('requires subject_type, subject_id, context', () => {
    expect(EvaluateRequestSchema.safeParse({ subject_type: 'quote_line', subject_id: '019103b1-6e2a-7c3d-9a1b-000000000060', context: {} }).success).toBe(true)
    expect(EvaluateRequestSchema.safeParse({ subject_type: 'quote_line' }).success).toBe(false)
  })
})

describe('KRN-07 contract — events (P-08 envelope, §12)', () => {
  it('validates rules.set.activated', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-000000000070',
      tenant_id: baseUniversal.tenant_id,
      entity_id: baseUniversal.entity_id,
      event_name: 'rules.set.activated',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'rule_set',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      payload: { rule_set_id: '019103b1-6e2a-7c3d-9a1b-000000000010', rule_type: 'pricing' },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-000000000071',
      trace_id: '019103b1-6e2a-7c3d-9a1b-000000000072',
      reversal_handle: null,
    }
    expect(RuleSetActivatedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates rules.rule.version_created', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-000000000080',
      tenant_id: baseUniversal.tenant_id,
      entity_id: baseUniversal.entity_id,
      event_name: 'rules.rule.version_created',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'rule',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000020',
      payload: { rule_id: '019103b1-6e2a-7c3d-9a1b-000000000020', rule_version_id: '019103b1-6e2a-7c3d-9a1b-000000000031', version_no: 1 },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-000000000081',
      trace_id: '019103b1-6e2a-7c3d-9a1b-000000000082',
      reversal_handle: null,
    }
    expect(RuleVersionCreatedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates rules.simulation.completed', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-000000000090',
      tenant_id: baseUniversal.tenant_id,
      entity_id: baseUniversal.entity_id,
      event_name: 'rules.simulation.completed',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'rule_set',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
      payload: { rule_set_id: '019103b1-6e2a-7c3d-9a1b-000000000010', simulation_id: '019103b1-6e2a-7c3d-9a1b-000000000091', changed_count: 4, sample_count: 90 },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-000000000092',
      trace_id: '019103b1-6e2a-7c3d-9a1b-000000000093',
      reversal_handle: null,
    }
    expect(SimulationCompletedEventSchema.safeParse(event).success).toBe(true)
  })
})

describe('KRN-07 contract — error shape reused from @mahisys/shared', () => {
  it('is unchanged (sanity check for the shared import)', () => {
    expect(ErrorResponseSchema.safeParse({ error: { code: 'RULE_SET_NOT_FOUND', message: 'x', trace_id: '019103b1-6e2a-7c3d-9a1b-000000000099' } }).success).toBe(true)
  })
})
