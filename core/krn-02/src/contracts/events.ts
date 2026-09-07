/**
 * KRN-02 event contracts — KRN-02.md §12.
 */
import { z } from 'zod'
import { eventEnvelope, uuid } from '@mahisys/shared'
import { UserTypeSchema } from './user.js'

export const UserCreatedPayloadSchema = z.object({ user_id: uuid, user_type: UserTypeSchema })
export const UserCreatedEventSchema = eventEnvelope('identity.user.created', UserCreatedPayloadSchema)

export const UserActivatedPayloadSchema = z.object({ user_id: uuid })
export const UserActivatedEventSchema = eventEnvelope('identity.user.activated', UserActivatedPayloadSchema)

export const UserDeactivatedPayloadSchema = z.object({ user_id: uuid })
export const UserDeactivatedEventSchema = eventEnvelope('identity.user.deactivated', UserDeactivatedPayloadSchema)

export const SessionStartedPayloadSchema = z.object({ session_id: uuid, user_id: uuid, auth_method_used: z.string() })
export const SessionStartedEventSchema = eventEnvelope('identity.session.started', SessionStartedPayloadSchema)

export const SessionRevokedPayloadSchema = z.object({ session_id: uuid, user_id: uuid, reason: z.string().optional() })
export const SessionRevokedEventSchema = eventEnvelope('identity.session.revoked', SessionRevokedPayloadSchema)

export const SessionTimedOutPayloadSchema = z.object({ session_id: uuid, user_id: uuid, reason: z.enum(['idle', 'absolute']) })
export const SessionTimedOutEventSchema = eventEnvelope('identity.session.timed_out', SessionTimedOutPayloadSchema)

export const LoginFailedPayloadSchema = z.object({ login_id: z.string(), attempt_count: z.number().int().positive() })
export const LoginFailedEventSchema = eventEnvelope('identity.login.failed', LoginFailedPayloadSchema)

export const LoginLockedOutPayloadSchema = z.object({ login_id: z.string(), cooldown_seconds: z.number().int().positive() })
export const LoginLockedOutEventSchema = eventEnvelope('identity.login.locked_out', LoginLockedOutPayloadSchema)

export const AgentRegisteredPayloadSchema = z.object({ agent_identity_id: uuid, agent_code: z.string() })
export const AgentRegisteredEventSchema = eventEnvelope('identity.agent.registered', AgentRegisteredPayloadSchema)

export const AgentVersionChangedPayloadSchema = z.object({
  agent_identity_id: uuid,
  agent_code: z.string(),
  previous_version: z.number().int().positive(),
  new_version: z.number().int().positive(),
})
export const AgentVersionChangedEventSchema = eventEnvelope('identity.agent.version_changed', AgentVersionChangedPayloadSchema)

export const DeviceRegisteredPayloadSchema = z.object({ device_id: uuid, user_id: uuid })
export const DeviceRegisteredEventSchema = eventEnvelope('identity.device.registered', DeviceRegisteredPayloadSchema)

export const DeviceRevokedPayloadSchema = z.object({ device_id: uuid, user_id: uuid })
export const DeviceRevokedEventSchema = eventEnvelope('identity.device.revoked', DeviceRevokedPayloadSchema)

export const ServiceAccountCredentialRotatedPayloadSchema = z.object({ service_account_id: uuid, rotated_at: z.string().datetime() })
export const ServiceAccountCredentialRotatedEventSchema = eventEnvelope(
  'identity.service_account.credential_rotated',
  ServiceAccountCredentialRotatedPayloadSchema,
)

export const ImpersonationStartedPayloadSchema = z.object({
  session_id: uuid,
  impersonating_user_id: uuid,
  impersonated_user_id: uuid,
})
export const ImpersonationStartedEventSchema = eventEnvelope('identity.impersonation.started', ImpersonationStartedPayloadSchema)

export const ImpersonationEndedPayloadSchema = z.object({
  session_id: uuid,
  impersonating_user_id: uuid,
  impersonated_user_id: uuid,
})
export const ImpersonationEndedEventSchema = eventEnvelope('identity.impersonation.ended', ImpersonationEndedPayloadSchema)
