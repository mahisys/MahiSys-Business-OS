/**
 * KRN-02 contract tests — Vol 6 §6 step 2, written before any
 * implementation exists. Scope: shape only (entity fields/enums, API
 * request/response shape, event schema shape) — not business behaviour.
 */
import { describe, it, expect } from 'vitest'
import {
  UserSchema,
  USER_STATUS_TRANSITIONS,
  CredentialSchema,
  SessionSchema,
  SESSION_STATUS_TRANSITIONS,
  ServiceAccountSchema,
  AgentIdentitySchema,
  AGENT_IDENTITY_STATUS_TRANSITIONS,
  DeviceSchema,
  DEVICE_TRUST_STATUS_TRANSITIONS,
  LoginAttemptSchema,
  LoginRequestSchema,
  UserCreateRequestSchema,
  SessionListRequestSchema,
  SessionListResponseSchema,
  ImpersonationStartRequestSchema,
  UserCreatedEventSchema,
  SessionStartedEventSchema,
  ImpersonationStartedEventSchema,
  AgentVersionChangedEventSchema,
} from '@mahisys/krn-02'
import { ErrorResponseSchema } from '@mahisys/shared'

const actor = { type: 'user' as const, id: '019103b1-6e2a-7c3d-9a1b-000000000001' }
const agentActor = { type: 'agent' as const, id: '019103b1-6e2a-7c3d-9a1b-000000000099', version: 'v3' }
const now = new Date().toISOString()

const baseUniversal = {
  tenant_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
  entity_id: '019103b1-6e2a-7c3d-9a1b-000000000000',
  namespace: 'sys' as const,
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

const validUser = {
  ...baseUniversal,
  id: '019103b1-6e2a-7c3d-9a1b-000000000010',
  party_id: null,
  user_type: 'full' as const,
  login_id: 'owner@acme.example',
  status: 'active' as const,
  locale: 'en-IN',
  mfa_enrolments: [{ method: 'totp' as const, enrolled_at: now, status: 'active' as const }],
  last_login_at: now,
}

describe('KRN-02 entity contracts', () => {
  it('accepts a well-formed user (KRN-02.md §4.1)', () => {
    expect(UserSchema.safeParse(validUser).success).toBe(true)
  })

  it('rejects an invalid user.user_type enum value', () => {
    expect(UserSchema.safeParse({ ...validUser, user_type: 'admin' }).success).toBe(false)
  })

  it('encodes the user.status state machine from KRN-02.md §5', () => {
    expect(USER_STATUS_TRANSITIONS.pending).toEqual(['active'])
    expect(USER_STATUS_TRANSITIONS.active).toEqual(['suspended'])
    expect(USER_STATUS_TRANSITIONS.suspended).toEqual(['active', 'deactivated'])
    expect(USER_STATUS_TRANSITIONS.deactivated).toEqual([]) // terminal
  })

  it('accepts a well-formed credential with exactly one subject set', () => {
    const cred = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000020',
      user_id: validUser.id,
      service_account_id: null,
      agent_identity_id: null,
      credential_type: 'password_hash' as const,
      value_hash: '$argon2id$...',
      rotation_due_at: null,
      status: 'active' as const,
      last_rotated_at: now,
    }
    expect(CredentialSchema.safeParse(cred).success).toBe(true)
  })

  it('rejects a credential with zero or multiple subjects set (KRN-02.md §4.1)', () => {
    const base = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000021',
      credential_type: 'password_hash' as const,
      value_hash: 'x',
      rotation_due_at: null,
      status: 'active' as const,
      last_rotated_at: now,
    }
    expect(CredentialSchema.safeParse({ ...base, user_id: null, service_account_id: null, agent_identity_id: null }).success).toBe(false)
    expect(CredentialSchema.safeParse({ ...base, user_id: validUser.id, service_account_id: '019103b1-6e2a-7c3d-9a1b-000000000030', agent_identity_id: null }).success).toBe(false)
  })

  it('accepts a well-formed session and rejects mismatched impersonation flags', () => {
    const session = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000040',
      user_id: validUser.id,
      device_id: '019103b1-6e2a-7c3d-9a1b-000000000050',
      started_at: now,
      last_active_at: now,
      idle_timeout_minutes: 30,
      absolute_timeout_minutes: 720,
      status: 'active' as const,
      revoked_by: null,
      revoked_reason: null,
      auth_method_used: 'password' as const,
      is_impersonation: false,
      impersonated_by_user_id: null,
    }
    expect(SessionSchema.safeParse(session).success).toBe(true)
    expect(SessionSchema.safeParse({ ...session, is_impersonation: true, impersonated_by_user_id: null }).success).toBe(false)
    expect(SessionSchema.safeParse({ ...session, is_impersonation: false, impersonated_by_user_id: validUser.id }).success).toBe(false)
  })

  it('encodes the session.status state machine from KRN-02.md §5 (all four end-states terminal)', () => {
    expect(SESSION_STATUS_TRANSITIONS.active.sort()).toEqual(['absolute_timed_out', 'idle_timed_out', 'logged_out', 'revoked'].sort())
    expect(SESSION_STATUS_TRANSITIONS.idle_timed_out).toEqual([])
    expect(SESSION_STATUS_TRANSITIONS.absolute_timed_out).toEqual([])
    expect(SESSION_STATUS_TRANSITIONS.revoked).toEqual([])
    expect(SESSION_STATUS_TRANSITIONS.logged_out).toEqual([])
  })

  it('accepts a well-formed service account', () => {
    const sa = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000060',
      code: 'ITG-TALLY-01',
      name: 'Tally Bridge Sync',
      owning_integration: null,
      rate_limit: { requests_per_minute: 60 },
      credential_rotation_policy_days: 90,
      status: 'active' as const,
    }
    expect(ServiceAccountSchema.safeParse(sa).success).toBe(true)
  })

  it('accepts a well-formed agent identity and validates agent_code shape (Vol 0 §42)', () => {
    const agent = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000070',
      agent_code: 'MFG-AG-05',
      agent_version: 3,
      owning_module: 'MFG-05',
      credential_ref: '019103b1-6e2a-7c3d-9a1b-000000000080',
      trust_ceiling: 'L3' as const,
      status: 'active' as const,
    }
    expect(AgentIdentitySchema.safeParse(agent).success).toBe(true)
    expect(AgentIdentitySchema.safeParse({ ...agent, agent_code: 'not-a-valid-code' }).success).toBe(false)
  })

  it('encodes the agent_identity.status state machine from KRN-02.md §5', () => {
    expect(AGENT_IDENTITY_STATUS_TRANSITIONS.registered).toEqual(['active'])
    expect(AGENT_IDENTITY_STATUS_TRANSITIONS.active.sort()).toEqual(['deprecated', 'retired'].sort())
    expect(AGENT_IDENTITY_STATUS_TRANSITIONS.deprecated).toEqual(['retired'])
    expect(AGENT_IDENTITY_STATUS_TRANSITIONS.retired).toEqual([]) // terminal
  })

  it('accepts a well-formed device', () => {
    const device = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-000000000090',
      user_id: validUser.id,
      platform: 'android' as const,
      device_fingerprint: 'abc123',
      registered_at: now,
      last_seen_at: now,
      push_token: null,
      trust_status: 'trusted' as const,
    }
    expect(DeviceSchema.safeParse(device).success).toBe(true)
  })

  it('encodes the device.trust_status state machine from KRN-02.md §5', () => {
    expect(DEVICE_TRUST_STATUS_TRANSITIONS.registered.sort()).toEqual(['revoked', 'trusted'].sort())
    expect(DEVICE_TRUST_STATUS_TRANSITIONS.trusted).toEqual(['revoked'])
    expect(DEVICE_TRUST_STATUS_TRANSITIONS.revoked).toEqual([]) // terminal
  })

  it('accepts a well-formed login_attempt with no credential material field at all (KRN-02-FR-004)', () => {
    const attempt = {
      ...baseUniversal,
      id: '019103b1-6e2a-7c3d-9a1b-0000000000a0',
      login_id: 'owner@acme.example',
      outcome: 'failed_credential' as const,
      device_id: null,
      ip: '203.0.113.7',
      occurred_at: now,
    }
    expect(LoginAttemptSchema.safeParse(attempt).success).toBe(true)
    // Structural guarantee: no field on the schema could ever carry a password/OTP value.
    const shapeKeys = Object.keys(LoginAttemptSchema.shape)
    expect(shapeKeys.some((k) => /password|credential|otp|secret/i.test(k))).toBe(false)
  })
})

describe('KRN-02 API contracts (§10)', () => {
  it('accepts a valid login request', () => {
    expect(LoginRequestSchema.safeParse({ login_id: 'x@y.com', method: 'password' }).success).toBe(true)
  })

  it('rejects a login request with an undeclared method', () => {
    expect(LoginRequestSchema.safeParse({ login_id: 'x@y.com', method: 'magic_link' }).success).toBe(false)
  })

  it('accepts a user-create request without server-assigned fields', () => {
    const { id, namespace, ext, created_at, created_by, updated_at, updated_by, version, deleted_at, deleted_by, source, trace_id, ...createBody } = validUser
    void id; void namespace; void ext; void created_at; void created_by; void updated_at; void updated_by; void version; void deleted_at; void deleted_by; void source; void trace_id
    expect(UserCreateRequestSchema.safeParse(createBody).success).toBe(true)
  })

  it('supports cursor pagination and filters on session list', () => {
    const req = { cursor: 'abc', limit: 25, filter: { user_id: validUser.id } }
    expect(SessionListRequestSchema.safeParse(req).success).toBe(true)
  })

  it('shapes a session list response', () => {
    expect(SessionListResponseSchema.safeParse({ items: [], next_cursor: null }).success).toBe(true)
  })

  it('accepts a valid impersonation start request', () => {
    expect(ImpersonationStartRequestSchema.safeParse({ target_user_id: validUser.id, reason: 'support ticket #4021' }).success).toBe(true)
  })

  it('shapes a stable error response (Vol 1 §1.2)', () => {
    const err = { error: { code: 'FORBIDDEN', message: 'x', trace_id: '019103b1-6e2a-7c3d-9a1b-0000000000b0' } }
    expect(ErrorResponseSchema.safeParse(err).success).toBe(true)
  })
})

describe('KRN-02 event contracts (§12)', () => {
  const envelopeBase = {
    event_id: '019103b1-6e2a-7c3d-9a1b-0000000000c0',
    tenant_id: baseUniversal.tenant_id,
    entity_id: baseUniversal.entity_id,
    schema_version: 1,
    occurred_at: now,
    recorded_at: now,
    actor,
    subject_type: 'user',
    subject_id: validUser.id,
    causation_id: null,
    correlation_id: '019103b1-6e2a-7c3d-9a1b-0000000000d0',
    trace_id: '019103b1-6e2a-7c3d-9a1b-0000000000e0',
    reversal_handle: null,
  }

  it('validates identity.user.created', () => {
    const event = { ...envelopeBase, event_name: 'identity.user.created', payload: { user_id: validUser.id, user_type: 'full' } }
    expect(UserCreatedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates identity.session.started', () => {
    const event = {
      ...envelopeBase,
      event_name: 'identity.session.started',
      subject_type: 'session',
      payload: { session_id: '019103b1-6e2a-7c3d-9a1b-000000000040', user_id: validUser.id, auth_method_used: 'password' },
    }
    expect(SessionStartedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates identity.impersonation.started carrying both actor ids (KRN-02-FR-003)', () => {
    const event = {
      ...envelopeBase,
      event_name: 'identity.impersonation.started',
      payload: {
        session_id: '019103b1-6e2a-7c3d-9a1b-000000000040',
        impersonating_user_id: actor.id,
        impersonated_user_id: validUser.id,
      },
    }
    expect(ImpersonationStartedEventSchema.safeParse(event).success).toBe(true)
  })

  it('validates identity.agent.version_changed carrying both version numbers (KRN-02-DR-001 acceptance sample)', () => {
    const event = {
      ...envelopeBase,
      event_name: 'identity.agent.version_changed',
      subject_type: 'agent_identity',
      payload: { agent_identity_id: '019103b1-6e2a-7c3d-9a1b-000000000070', agent_code: 'MFG-AG-05', previous_version: 3, new_version: 4 },
    }
    expect(AgentVersionChangedEventSchema.safeParse(event).success).toBe(true)
  })

  it('requires agent actors to carry a version (Vol 0 §27.2)', () => {
    const event = { ...envelopeBase, actor: agentActor, event_name: 'identity.session.started', subject_type: 'session', payload: { session_id: '019103b1-6e2a-7c3d-9a1b-000000000040', user_id: validUser.id, auth_method_used: 'password' } }
    expect(SessionStartedEventSchema.safeParse(event).success).toBe(true)
    const { version: _v, ...agentWithoutVersion } = agentActor
    void _v
    expect(SessionStartedEventSchema.safeParse({ ...event, actor: agentWithoutVersion }).success).toBe(false)
  })

  it('rejects an event whose event_name does not match its schema', () => {
    const event = { ...envelopeBase, event_name: 'identity.user.activated', payload: { user_id: validUser.id, user_type: 'full' } }
    expect(UserCreatedEventSchema.safeParse(event).success).toBe(false)
  })
})
