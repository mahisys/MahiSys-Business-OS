/**
 * KRN-02 event-schema conformance — same rationale as KRN-01's: runs the
 * real service functions and validates actual emitted events against the
 * real Zod schemas, not just hand-built contract-test fixtures.
 */
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import { login, recordLoginAttempt } from '@mahisys/krn-02'
import { bulkRevokeUserSessions, startImpersonation, endImpersonation } from '@mahisys/krn-02'
import { registerDevice, revokeDevice } from '@mahisys/krn-02'
import { createServiceAccount, checkAndAutoRotateIfDue } from '@mahisys/krn-02'
import { registerAgentIdentity, upgradeAgentVersion } from '@mahisys/krn-02'
import {
  UserCreatedEventSchema,
  UserActivatedEventSchema,
  SessionStartedEventSchema,
  SessionRevokedEventSchema,
  LoginFailedEventSchema,
  LoginLockedOutEventSchema,
  AgentRegisteredEventSchema,
  AgentVersionChangedEventSchema,
  DeviceRegisteredEventSchema,
  DeviceRevokedEventSchema,
  ServiceAccountCredentialRotatedEventSchema,
  ImpersonationStartedEventSchema,
  ImpersonationEndedEventSchema,
} from '@mahisys/krn-02'
import { newStore, makeUser, sysActor, TENANT_ID, ENTITY_ID } from './krn-02.fixtures.js'

const SCHEMA_BY_EVENT_NAME: Record<string, z.ZodTypeAny> = {
  'identity.user.created': UserCreatedEventSchema,
  'identity.user.activated': UserActivatedEventSchema,
  'identity.session.started': SessionStartedEventSchema,
  'identity.session.revoked': SessionRevokedEventSchema,
  'identity.login.failed': LoginFailedEventSchema,
  'identity.login.locked_out': LoginLockedOutEventSchema,
  'identity.agent.registered': AgentRegisteredEventSchema,
  'identity.agent.version_changed': AgentVersionChangedEventSchema,
  'identity.device.registered': DeviceRegisteredEventSchema,
  'identity.device.revoked': DeviceRevokedEventSchema,
  'identity.service_account.credential_rotated': ServiceAccountCredentialRotatedEventSchema,
  'identity.impersonation.started': ImpersonationStartedEventSchema,
  'identity.impersonation.ended': ImpersonationEndedEventSchema,
}

describe('KRN-02 — every emitted event validates against its declared Zod schema', () => {
  it('exercises every KRN-02 mutation and checks each resulting event', () => {
    const store = newStore()

    const user = makeUser(store) // identity.user.created (+ .activated, covered by KRN-02.md but not in this schema map since it's identical shape to .created's sibling — see note below)
    login(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, login_id: user.login_id, method: 'otp', proof: '123456', device_id: 'd1', ip: '1.1.1.1' }) // identity.session.started
    recordLoginAttempt(store, TENANT_ID, ENTITY_ID, 'nonexistent@x.com', 'failed_credential', null, '1.1.1.1') // identity.login.failed
    for (let i = 0; i < 4; i++) recordLoginAttempt(store, TENANT_ID, ENTITY_ID, 'lockout-target@x.com', 'failed_credential', null, '1.1.1.1')
    recordLoginAttempt(store, TENANT_ID, ENTITY_ID, 'lockout-target@x.com', 'failed_credential', null, '1.1.1.1') // identity.login.locked_out (5th)

    const device = registerDevice(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, user_id: user.id, platform: 'android', device_fingerprint: 'fp', push_token: null }, sysActor) // identity.device.registered
    const s2 = login(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, login_id: user.login_id, method: 'otp', proof: '123456', device_id: device.id, ip: '1.1.1.1' })
    revokeDevice(store, device.id, sysActor, 'PR-21', user.id) // identity.device.revoked + identity.session.revoked (for s2)
    void s2

    bulkRevokeUserSessions(store, user.id, sysActor, 'PR-21', 'test') // identity.session.revoked (any remaining active)

    const target = makeUser(store, { login_id: 'target2@x.com' })
    const impSession = startImpersonation(store, user.id, target.id, 'reason', sysActor, 'PR-21') // identity.impersonation.started
    endImpersonation(store, impSession.id, sysActor, 'PR-21') // identity.impersonation.ended

    const sa = createServiceAccount(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, code: 'X', name: 'X', owning_integration: null, rate_limit: { requests_per_minute: 10 }, credential_rotation_policy_days: 90 }, sysActor, 'PR-21')
    checkAndAutoRotateIfDue(store, sa.id, new Date(Date.now() + 91 * 24 * 60 * 60_000).toISOString()) // identity.service_account.credential_rotated

    const agent = registerAgentIdentity(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, agent_code: 'MFG-AG-09', owning_module: 'MFG-05', credential_ref: '00000000-0000-7000-8000-000000000abc' }, sysActor) // identity.agent.registered
    upgradeAgentVersion(store, agent.id, 2, sysActor) // identity.agent.version_changed

    expect(store.events.length).toBeGreaterThanOrEqual(12)

    for (const event of store.events) {
      const schema = SCHEMA_BY_EVENT_NAME[event.event_name]
      expect(schema, `no schema registered for emitted event_name "${event.event_name}"`).toBeDefined()
      const result = schema.safeParse(event)
      if (!result.success) {
        throw new Error(`Event ${event.event_name} does not match its declared schema: ${JSON.stringify(result.error.issues, null, 2)}`)
      }
    }
  })
})
