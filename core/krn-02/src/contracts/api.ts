/**
 * KRN-02 API surface contract — KRN-02.md §10.
 */
import { z } from 'zod'
import { cursorListRequest, cursorListResponse, uuid } from '@mahisys/shared'
import { UserSchema, UserTypeSchema } from './user.js'
import { SessionSchema } from './session.js'
import { ServiceAccountSchema } from './service-account.js'
import { AgentIdentitySchema } from './agent-identity.js'
import { DeviceSchema, DevicePlatformSchema } from './device.js'
import { LoginAttemptSchema, LoginOutcomeSchema } from './login-attempt.js'

// POST /api/v1/identity/auth/login
export const LoginMethodSchema = z.enum(['password', 'otp', 'sso'])
export const LoginRequestSchema = z.object({
  login_id: z.string().min(1),
  method: LoginMethodSchema,
})
export const LoginResponseSchema = z.object({
  session: SessionSchema,
})

// POST /api/v1/identity/auth/otp/request | /verify
export const OtpRequestSchema = z.object({ login_id: z.string().min(1) })
export const OtpVerifyRequestSchema = z.object({ login_id: z.string().min(1), code: z.string().min(1) })

// CRUD /api/v1/identity/users
export const UserCreateRequestSchema = UserSchema.omit({
  id: true, namespace: true, ext: true, created_at: true, created_by: true,
  updated_at: true, updated_by: true, version: true, deleted_at: true,
  deleted_by: true, source: true, trace_id: true,
})
export const UserListFilterSchema = z.object({
  user_type: UserTypeSchema.optional(),
  status: z.string().optional(),
})
export const UserListRequestSchema = cursorListRequest(UserListFilterSchema)
export const UserListResponseSchema = cursorListResponse(UserSchema)

// POST /api/v1/identity/users/{id}/mfa/enrol | /revoke
export const MfaEnrolRequestSchema = z.object({
  method: z.enum(['totp', 'sms_otp', 'email_otp', 'push', 'hardware_key']),
})

// GET /api/v1/identity/sessions
export const SessionListFilterSchema = z.object({
  user_id: uuid.optional(),
  status: z.string().optional(),
})
export const SessionListRequestSchema = cursorListRequest(SessionListFilterSchema)
export const SessionListResponseSchema = cursorListResponse(SessionSchema)

// POST /api/v1/identity/sessions/{id}/revoke
export const SessionRevokeRequestSchema = z.object({
  reason: z.string().optional(),
})

// CRUD /api/v1/identity/service-accounts
export const ServiceAccountCreateRequestSchema = ServiceAccountSchema.omit({
  id: true, namespace: true, ext: true, created_at: true, created_by: true,
  updated_at: true, updated_by: true, version: true, deleted_at: true,
  deleted_by: true, source: true, trace_id: true,
})

// GET, POST (restricted) /api/v1/identity/agent-identities
export const AgentIdentityCreateRequestSchema = AgentIdentitySchema.omit({
  id: true, namespace: true, ext: true, created_at: true, created_by: true,
  updated_at: true, updated_by: true, version: true, deleted_at: true,
  deleted_by: true, source: true, trace_id: true,
})
export const AgentIdentityListResponseSchema = cursorListResponse(AgentIdentitySchema)

// CRUD /api/v1/identity/devices
export const DeviceRegisterRequestSchema = z.object({
  user_id: uuid,
  platform: DevicePlatformSchema,
  device_fingerprint: z.string().min(1),
  push_token: z.string().nullable().optional(),
})
export const DeviceListResponseSchema = cursorListResponse(DeviceSchema)

// GET /api/v1/identity/login-attempts
export const LoginAttemptListFilterSchema = z.object({
  login_id: z.string().optional(),
  outcome: LoginOutcomeSchema.optional(),
})
export const LoginAttemptListRequestSchema = cursorListRequest(LoginAttemptListFilterSchema)
export const LoginAttemptListResponseSchema = cursorListResponse(LoginAttemptSchema)

// POST /api/v1/identity/impersonation/start | /end
export const ImpersonationStartRequestSchema = z.object({
  target_user_id: uuid,
  reason: z.string().min(1),
})
export const ImpersonationStartResponseSchema = z.object({
  session: SessionSchema,
})
export const ImpersonationEndRequestSchema = z.object({
  session_id: uuid,
})
