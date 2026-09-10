/**
 * KRN-10 contract tests — Vol 6 §6 step 2, written before any
 * implementation exists. Scope: shape only.
 */
import { describe, it, expect } from 'vitest'
import {
  AuditEntrySchema,
  AuditChainSealSchema,
  AccessLogSchema,
  VerifyChainResponseSchema,
  EvidencePackRequestSchema,
  ChainSealCompletedEventSchema,
  EvidencePackGeneratedEventSchema,
  ChainVerificationFailedEventSchema,
} from '@mahisys/krn-10'
import { ErrorResponseSchema } from '@mahisys/shared'

const actor = { type: 'service' as const, id: '019103b1-6e2a-7c3d-9a1b-000000000001' }
const agentActor = { type: 'agent' as const, id: '019103b1-6e2a-7c3d-9a1b-000000000002', version: 'v1' }
const now = new Date().toISOString()

describe('KRN-10 contract — audit_entry (KRN-10-FR-001/002/008, KRN-10-DR-001)', () => {
  const base = {
    audit_entry_id: '019103b1-6e2a-7c3d-9a1b-000000000010',
    tenant_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
    subject_type: 'stock_item',
    subject_id: '019103b1-6e2a-7c3d-9a1b-000000000011',
    action: 'update' as const,
    before: { quantity: 120 },
    after: { quantity: 95 },
    occurred_at: now,
    recorded_at: now,
    ip_address: '10.0.0.1',
    device_id: 'device-1',
    source: 'api' as const,
    trace_id: '019103b1-6e2a-7c3d-9a1b-000000000012',
    reversal_handle: null,
    sequence_no: 1,
    prev_hash: null,
    entry_hash: 'deadbeef',
  }

  it('accepts a well-formed human/service entry with no agent-only fields', () => {
    expect(AuditEntrySchema.safeParse({ ...base, actor, reasoning_trace: null, confidence_score: null, evidence_refs: null }).success).toBe(true)
  })

  it('rejects a human/service entry that carries agent-only fields', () => {
    expect(AuditEntrySchema.safeParse({ ...base, actor, reasoning_trace: 'why', confidence_score: 0.9, evidence_refs: [] }).success).toBe(false)
  })

  it('accepts an agent entry only when all four DR-001 fields are present', () => {
    const valid = { ...base, actor: agentActor, reasoning_trace: 'flagged per 180-day rule', confidence_score: 0.92, evidence_refs: ['019103b1-6e2a-7c3d-9a1b-000000000013'] }
    expect(AuditEntrySchema.safeParse(valid).success).toBe(true)
    expect(AuditEntrySchema.safeParse({ ...valid, confidence_score: null }).success).toBe(false)
  })

  it('rejects sequence_no 1 with a non-null prev_hash, and sequence_no > 1 with a null prev_hash', () => {
    expect(AuditEntrySchema.safeParse({ ...base, actor, reasoning_trace: null, confidence_score: null, evidence_refs: null, sequence_no: 1, prev_hash: 'x' }).success).toBe(false)
    expect(AuditEntrySchema.safeParse({ ...base, actor, reasoning_trace: null, confidence_score: null, evidence_refs: null, sequence_no: 2, prev_hash: null }).success).toBe(false)
  })

  it('reversal_handle applies identically to a human-authored entry (KRN-10-FR-008)', () => {
    const valid = { ...base, actor, reasoning_trace: null, confidence_score: null, evidence_refs: null, reversal_handle: '019103b1-6e2a-7c3d-9a1b-000000000014' }
    expect(AuditEntrySchema.safeParse(valid).success).toBe(true)
  })
})

describe('KRN-10 contract — audit_chain_seal (KRN-10-FR-006)', () => {
  it('requires entry_count to equal the inclusive sequence span', () => {
    const base = { seal_id: '019103b1-6e2a-7c3d-9a1b-000000000020', tenant_id: '019103b1-6e2a-7c3d-9a1b-000000000000', sealed_at: now, from_sequence_no: 1, to_sequence_no: 100, merkle_root: 'abc' }
    expect(AuditChainSealSchema.safeParse({ ...base, entry_count: 100 }).success).toBe(true)
    expect(AuditChainSealSchema.safeParse({ ...base, entry_count: 99 }).success).toBe(false)
  })
})

describe('KRN-10 contract — access_log (KRN-10-FR-003)', () => {
  it('requires at least one field_viewed', () => {
    const base = { access_log_id: '019103b1-6e2a-7c3d-9a1b-000000000030', tenant_id: '019103b1-6e2a-7c3d-9a1b-000000000000', subject_type: 'payroll_record', subject_id: '019103b1-6e2a-7c3d-9a1b-000000000031', actor, occurred_at: now, ip_address: null, source: 'ui' as const, trace_id: '019103b1-6e2a-7c3d-9a1b-000000000032' }
    expect(AccessLogSchema.safeParse({ ...base, fields_viewed: ['salary'] }).success).toBe(true)
    expect(AccessLogSchema.safeParse({ ...base, fields_viewed: [] }).success).toBe(false)
  })
})

describe('KRN-10 contract — verify-chain response', () => {
  it('accepts ok:true with no break, and ok:false with a break location', () => {
    expect(VerifyChainResponseSchema.safeParse({ ok: true, broken_at_sequence_no: null, checked_count: 10000 }).success).toBe(true)
    expect(VerifyChainResponseSchema.safeParse({ ok: false, broken_at_sequence_no: 4821, checked_count: 4821 }).success).toBe(true)
  })
})

describe('KRN-10 contract — evidence pack request', () => {
  it('requires a date_range and format', () => {
    expect(EvidencePackRequestSchema.safeParse({ date_range: { from: now, to: now }, format: 'json' as const }).success).toBe(true)
    expect(EvidencePackRequestSchema.safeParse({ format: 'json' as const }).success).toBe(false)
  })
})

describe('KRN-10 contract — administrative events (P-08 envelope, §12)', () => {
  it('validates audit.chain_seal.completed', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-000000000040',
      tenant_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
      entity_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
      event_name: 'audit.chain_seal.completed',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'audit_chain_seal',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000041',
      payload: { seal_id: '019103b1-6e2a-7c3d-9a1b-000000000041', from_sequence_no: 1, to_sequence_no: 100 },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-000000000042',
      trace_id: '019103b1-6e2a-7c3d-9a1b-000000000043',
      reversal_handle: null,
    }
    expect(ChainSealCompletedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates audit.evidence_pack.generated', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-000000000050',
      tenant_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
      entity_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
      event_name: 'audit.evidence_pack.generated',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'evidence_pack',
      subject_id: actor.id,
      payload: { requested_by: actor.id, entry_count: 500 },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-000000000051',
      trace_id: '019103b1-6e2a-7c3d-9a1b-000000000052',
      reversal_handle: null,
    }
    expect(EvidencePackGeneratedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates audit.chain.verification_failed', () => {
    const event = {
      event_id: '019103b1-6e2a-7c3d-9a1b-000000000060',
      tenant_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
      entity_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
      event_name: 'audit.chain.verification_failed',
      schema_version: 1,
      occurred_at: now,
      recorded_at: now,
      actor,
      subject_type: 'audit_chain',
      subject_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
      payload: { broken_at_sequence_no: 4821 },
      causation_id: null,
      correlation_id: '019103b1-6e2a-7c3d-9a1b-000000000061',
      trace_id: '019103b1-6e2a-7c3d-9a1b-000000000062',
      reversal_handle: null,
    }
    expect(ChainVerificationFailedEventSchema.safeParse(event).success).toBe(true)
  })
})

describe('KRN-10 contract — error shape reused from @mahisys/shared', () => {
  it('is unchanged (sanity check for the shared import)', () => {
    expect(ErrorResponseSchema.safeParse({ error: { code: 'FORBIDDEN', message: 'x', trace_id: '019103b1-6e2a-7c3d-9a1b-000000000099' } }).success).toBe(true)
  })
})
