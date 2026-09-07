/**
 * KRN-02 acceptance tests — Vol 6 §6 step 3, directly from KRN-02.md §16's
 * Given/When/Then set. Written against the stub service functions
 * (NotImplementedError) and confirmed genuinely red before implementation.
 *
 * Scope limitation, flagged per D-21 (Phase-order degrade convention):
 * KRN-02-FR-003's audit attribution asserts against the in-memory event
 * log rather than a real KRN-10 (Audit & Immutable Log, not built yet).
 * KRN-02-DR-001's INT-04 trust-ladder baseline reset is not tested here —
 * INT-04 doesn't exist (Phase 2) — only the KRN-02-owned half (version
 * increments without retroactively altering historical attribution).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { type Krn02Store } from '@mahisys/krn-02'
import { login, recordLoginAttempt, checkLockout } from '@mahisys/krn-02'
import { checkSessionTimeout, bulkRevokeUserSessions, startImpersonation, assertNotImpersonationForPosting } from '@mahisys/krn-02'
import { registerDevice, revokeDevice } from '@mahisys/krn-02'
import { createServiceAccount, checkAndAutoRotateIfDue } from '@mahisys/krn-02'
import { registerAgentIdentity, upgradeAgentVersion } from '@mahisys/krn-02'
import { newStore, makeUser, makePasswordCredential, sysActor, userActor, TENANT_ID, ENTITY_ID } from './krn-02.fixtures.js'

let store: Krn02Store

beforeEach(() => {
  store = newStore()
})

describe('KRN-02-FR-001 — multi-method authentication', () => {
  it('authenticates via SSO, and separately via OTP, recording which method was used', () => {
    const user = makeUser(store, { login_id: 'owner@acme.example' })
    makePasswordCredential(store, user.id, 'irrelevant-for-sso') // password exists but SSO/OTP are separate credential types in a full system; simplified here

    const ssoSession = login(store, {
      tenant_id: TENANT_ID, entity_id: ENTITY_ID, login_id: user.login_id, method: 'sso', proof: 'valid-saml-assertion', device_id: 'device-1', ip: '203.0.113.1',
    })
    expect(ssoSession.auth_method_used).toBe('sso')

    const otpSession = login(store, {
      tenant_id: TENANT_ID, entity_id: ENTITY_ID, login_id: user.login_id, method: 'otp', proof: '123456', device_id: 'device-2', ip: '203.0.113.1',
    })
    expect(otpSession.auth_method_used).toBe('otp')
  })
})

describe('KRN-02-FR-002 — session device binding and timeouts', () => {
  it('times out an idle session at 31 minutes and bulk-revokes end every session for a user', () => {
    const user = makeUser(store)
    const s1 = login(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, login_id: user.login_id, method: 'otp', proof: '123456', device_id: 'device-1', ip: '203.0.113.1' })
    const s2 = login(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, login_id: user.login_id, method: 'otp', proof: '123456', device_id: 'device-2', ip: '203.0.113.1' })

    const past31Min = new Date(new Date(s1.started_at).getTime() + 31 * 60_000).toISOString()
    const timedOut = checkSessionTimeout(store, s1.id, past31Min)
    expect(timedOut.status).toBe('idle_timed_out')

    const revoked = bulkRevokeUserSessions(store, user.id, sysActor, 'PR-21', 'security incident')
    expect(revoked.every((s) => ['revoked'].includes(s.status) || s.id === s1.id)).toBe(true)
    expect(revoked.some((s) => s.id === s2.id && s.status === 'revoked')).toBe(true)
  })
})

describe('KRN-02-FR-003 — impersonation is audited, banner-marked, never for posting', () => {
  it('rejects a posting attempt during impersonation and attributes it to both actors', () => {
    const admin = makeUser(store, { login_id: 'admin@acme.example', user_type: 'full' })
    const target = makeUser(store, { login_id: 'support-target@acme.example' })

    const session = startImpersonation(store, admin.id, target.id, 'support ticket #4021', sysActor, 'PR-21')

    expect(session.is_impersonation).toBe(true)
    expect(session.impersonated_by_user_id).toBe(admin.id)
    expect(() => assertNotImpersonationForPosting(session)).toThrow()

    const startedEvents = store.events.filter((e) => e.event_name === 'identity.impersonation.started')
    expect(startedEvents).toHaveLength(1)
    expect(startedEvents[0].payload).toMatchObject({ impersonating_user_id: admin.id, impersonated_user_id: target.id })
  })
})

describe('KRN-02-FR-004 — lockout and credential hygiene', () => {
  it('locks the account on the 5th consecutive failure and stores no credential material', () => {
    const user = makeUser(store, { login_id: 'lockout-target@acme.example' })
    for (let i = 0; i < 4; i++) {
      recordLoginAttempt(store, TENANT_ID, ENTITY_ID, user.login_id, 'failed_credential', 'device-1', '203.0.113.1')
    }
    let lockout = checkLockout(store, user.login_id, new Date().toISOString())
    expect(lockout.locked).toBe(false)

    recordLoginAttempt(store, TENANT_ID, ENTITY_ID, user.login_id, 'failed_credential', 'device-1', '203.0.113.1')
    lockout = checkLockout(store, user.login_id, new Date().toISOString())
    expect(lockout.locked).toBe(true)

    const lockedEvents = store.events.filter((e) => e.event_name === 'identity.login.locked_out')
    expect(lockedEvents).toHaveLength(1)

    for (const attempt of store.loginAttempts.values()) {
      expect(JSON.stringify(attempt)).not.toMatch(/password|secret|otp.*code/i)
    }
  })
})

describe('KRN-02-FR-005 — external portal users, same mechanism', () => {
  it('resolves an external user through the identical login flow as an internal one', () => {
    const dealer = makeUser(store, { login_id: 'dealer@partner.example', user_type: 'external' })
    const session = login(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, login_id: dealer.login_id, method: 'otp', proof: '123456', device_id: 'device-1', ip: '203.0.113.1' })
    expect(session.user_id).toBe(dealer.id)
  })
})

describe('KRN-02-FR-006 — service accounts and devices', () => {
  it('auto-rotates a service account credential when the window elapses, and device revoke ends only that session', () => {
    const sa = createServiceAccount(
      store,
      { tenant_id: TENANT_ID, entity_id: ENTITY_ID, code: 'ITG-TALLY-01', name: 'Tally Bridge', owning_integration: null, rate_limit: { requests_per_minute: 60 }, credential_rotation_policy_days: 90 },
      sysActor,
      'PR-21',
    )
    const past91Days = new Date(Date.now() + 91 * 24 * 60 * 60_000).toISOString()
    const rotated = checkAndAutoRotateIfDue(store, sa.id, past91Days)
    expect(rotated).not.toBeNull()
    const rotatedEvents = store.events.filter((e) => e.event_name === 'identity.service_account.credential_rotated')
    expect(rotatedEvents).toHaveLength(1)

    const user = makeUser(store)
    const device1 = registerDevice(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, user_id: user.id, platform: 'android', device_fingerprint: 'fp-1', push_token: null }, sysActor)
    const device2 = registerDevice(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, user_id: user.id, platform: 'ios', device_fingerprint: 'fp-2', push_token: null }, sysActor)
    const s1 = login(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, login_id: user.login_id, method: 'otp', proof: '123456', device_id: device1.id, ip: '1.2.3.4' })
    const s2 = login(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, login_id: user.login_id, method: 'otp', proof: '123456', device_id: device2.id, ip: '1.2.3.4' })

    revokeDevice(store, device1.id, userActor, 'PR-02', user.id) // self-revoke — no admin grant needed

    const s1After = store.sessions.get(s1.id)!
    const s2After = store.sessions.get(s2.id)!
    expect(s1After.status).toBe('revoked')
    expect(s2After.status).toBe('active') // other device's session untouched
  })
})

describe('KRN-02-DR-001 — agent identity attribution across versions', () => {
  it('does not retroactively alter historical actor-ref attribution when the agent version increments', () => {
    const agent = registerAgentIdentity(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, agent_code: 'MFG-AG-05', owning_module: 'MFG-05', credential_ref: '00000000-0000-7000-8000-000000000abc' }, sysActor)
    expect(agent.agent_version).toBe(1)

    // Simulate 20 historical actions attributed to version 1 (event snapshots, per Vol 2 §1.2).
    for (let i = 0; i < 20; i++) {
      store.emit({
        event_name: 'mfg.job_work.ageing_escalated',
        tenant_id: TENANT_ID,
        entity_id: ENTITY_ID,
        subject_type: 'job_work_challan',
        subject_id: `00000000-0000-7000-8000-0000000001${i.toString().padStart(2, '0')}`,
        payload: {},
        occurred_at: new Date().toISOString(),
        recorded_at: new Date().toISOString(),
        actor: { type: 'agent', id: agent.agent_code, version: String(agent.agent_version) },
      })
    }

    const updated = upgradeAgentVersion(store, agent.id, 2, sysActor)
    expect(updated.agent_version).toBe(2)

    const historicalActions = store.events.filter((e) => e.event_name === 'mfg.job_work.ageing_escalated')
    expect(historicalActions).toHaveLength(20)
    expect(historicalActions.every((e) => e.actor.version === '1')).toBe(true)

    const versionChangedEvents = store.events.filter((e) => e.event_name === 'identity.agent.version_changed')
    expect(versionChangedEvents).toHaveLength(1)
    expect(versionChangedEvents[0].payload).toMatchObject({ previous_version: 1, new_version: 2 })
  })
})

describe('KRN-02-DR-002 — one identity substrate for external and internal actors', () => {
  it('lists an external and an internal user in the same collection, filterable by user_type', () => {
    const external = makeUser(store, { login_id: 'customer@external.example', user_type: 'external' })
    const internal = makeUser(store, { login_id: 'employee@acme.example', user_type: 'full' })

    const all = Array.from(store.users.values())
    expect(all.map((u) => u.id)).toEqual(expect.arrayContaining([external.id, internal.id]))
    expect(all.filter((u) => u.user_type === 'external').map((u) => u.id)).toEqual([external.id])
  })
})
