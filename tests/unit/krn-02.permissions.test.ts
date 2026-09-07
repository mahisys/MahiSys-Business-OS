/**
 * KRN-02 permission tests — Vol 6 §6 step 4, from KRN-02.md §11.
 *
 * Scope note: same as KRN-01's — this exercises KRN-02's own bootstrap
 * matrix, not a real KRN-03 layer (doesn't exist yet).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { hasPermission, isWithinProvisioningWindow } from '@mahisys/krn-02'
import { type Krn02Store } from '@mahisys/krn-02'
import { createUser } from '@mahisys/krn-02'
import { revokeSession, startImpersonation, endImpersonation } from '@mahisys/krn-02'
import { login } from '@mahisys/krn-02'
import { registerAgentIdentity, upgradeAgentVersion } from '@mahisys/krn-02'
import { registerDevice, revokeDevice } from '@mahisys/krn-02'
import { enrolMfa } from '@mahisys/krn-02'
import { newStore, makeUser, sysActor, userActor, agentActor, TENANT_ID, ENTITY_ID } from './krn-02.fixtures.js'

describe('KRN-02 permission matrix (§11) — positive cases', () => {
  it('PR-21 holds every admin-reach grant', () => {
    expect(hasPermission('PR-21', 'user.create')).toBe(true)
    expect(hasPermission('PR-21', 'user.deactivate')).toBe(true)
    expect(hasPermission('PR-21', 'mfa.reset_others')).toBe(true)
    expect(hasPermission('PR-21', 'session.revoke_any')).toBe(true)
    expect(hasPermission('PR-21', 'service_account.manage')).toBe(true)
    expect(hasPermission('PR-21', 'agent_identity.read')).toBe(true)
    expect(hasPermission('PR-21', 'login_attempt.read')).toBe(true)
    expect(hasPermission('PR-21', 'impersonation.start')).toBe(true)
  })

  it('PR-01 (Owner) can read agent identities and login-attempt summaries but nothing admin-reach', () => {
    expect(hasPermission('PR-01', 'agent_identity.read')).toBe(true)
    expect(hasPermission('PR-01', 'login_attempt.read')).toBe(true)
    expect(hasPermission('PR-01', 'impersonation.start')).toBe(false)
    expect(hasPermission('PR-01', 'user.create')).toBe(false)
  })

  it('PR-25 (External CA/Auditor) can read login attempts (evidence scope) only', () => {
    expect(hasPermission('PR-25', 'login_attempt.read')).toBe(true)
    expect(hasPermission('PR-25', 'agent_identity.read')).toBe(false)
  })

  it('PR-29 (Agent) can read only its own agent-identity record', () => {
    expect(hasPermission('PR-29', 'agent_identity.read')).toBe(true)
    expect(hasPermission('PR-29', 'user.create')).toBe(false)
  })
})

describe('KRN-02 permission matrix (§11) — negative cases', () => {
  it('PR-16 (CFO) cannot revoke another user\'s session', () => {
    expect(hasPermission('PR-16', 'session.revoke_any')).toBe(false)
  })

  it('every non-PR-21 persona lacks impersonation.start, unconditionally', () => {
    const personas = ['PR-01', 'PR-02', 'PR-16', 'PR-25', 'PR-28', 'PR-29', 'PR-22', 'OTHER'] as const
    for (const persona of personas) {
      expect(hasPermission(persona, 'impersonation.start'), persona).toBe(false)
    }
  })

  it('no persona other than PR-21 holds service_account.manage', () => {
    const personas = ['PR-01', 'PR-02', 'PR-16', 'PR-25', 'PR-28', 'PR-29', 'PR-22', 'OTHER'] as const
    for (const persona of personas) {
      expect(hasPermission(persona, 'service_account.manage'), persona).toBe(false)
    }
  })
})

describe('KRN-02 write paths actually enforce the matrix, not just report it', () => {
  let store: Krn02Store
  beforeEach(() => {
    store = newStore()
  })

  it('createUser: PR-21 (or COM-04 service actor) succeeds, PR-02 is rejected', () => {
    expect(() => createUser(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, party_id: null, user_type: 'full', login_id: 'a@x.com', locale: 'en-IN' }, sysActor, 'PR-21')).not.toThrow()
    expect(() => createUser(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, party_id: null, user_type: 'full', login_id: 'b@x.com', locale: 'en-IN' }, userActor, 'PR-02')).toThrow()
  })

  it('createUser: an agent actor is rejected even nominally holding PR-21 (corrected per §11 fix — service allowed, agent never)', () => {
    expect(() => createUser(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, party_id: null, user_type: 'full', login_id: 'c@x.com', locale: 'en-IN' }, agentActor, 'PR-21')).toThrow()
  })

  it('startImpersonation: PR-21 succeeds, PR-01 (Owner) is rejected despite being able to read agent identities elsewhere', () => {
    const admin = makeUser(store, { login_id: 'admin@acme.example' })
    const target = makeUser(store, { login_id: 'target@acme.example' })
    expect(() => startImpersonation(store, admin.id, target.id, 'reason', sysActor, 'PR-21')).not.toThrow()
    expect(() => startImpersonation(store, admin.id, target.id, 'reason', sysActor, 'PR-01')).toThrow()
  })

  it('revokeSession: PR-21 can revoke another user\'s session, PR-16 cannot', () => {
    const user = makeUser(store)
    const s1 = login(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, login_id: user.login_id, method: 'otp', proof: '123456', device_id: 'd1', ip: '1.1.1.1' })
    const s2 = login(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, login_id: user.login_id, method: 'otp', proof: '123456', device_id: 'd2', ip: '1.1.1.1' })
    // A different caller (not the session's own user) revoking requires session.revoke_any.
    expect(() => revokeSession(store, s1.id, sysActor, 'PR-21', 'someone-else-id')).not.toThrow()
    expect(() => revokeSession(store, s2.id, sysActor, 'PR-16', 'someone-else-id')).toThrow()
  })

  it('revokeSession: the session\'s own user can always revoke it (self-service, not matrix-gated)', () => {
    const user = makeUser(store)
    const s1 = login(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, login_id: user.login_id, method: 'otp', proof: '123456', device_id: 'd1', ip: '1.1.1.1' })
    expect(() => revokeSession(store, s1.id, userActor, 'PR-02', user.id)).not.toThrow()
  })

  it('revokeDevice: the device owner can always revoke their own device (self-service, not matrix-gated)', () => {
    const user = makeUser(store)
    const device = registerDevice(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, user_id: user.id, platform: 'android', device_fingerprint: 'fp', push_token: null }, userActor)
    expect(() => revokeDevice(store, device.id, userActor, 'PR-02', user.id)).not.toThrow()
  })

  it('revokeDevice: PR-21 can revoke another user\'s device, PR-16 cannot (D-33)', () => {
    const user1 = makeUser(store, { login_id: 'dev-owner-1@x.com' })
    const user2 = makeUser(store, { login_id: 'dev-owner-2@x.com' })
    const device1 = registerDevice(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, user_id: user1.id, platform: 'android', device_fingerprint: 'fp1', push_token: null }, sysActor)
    const device2 = registerDevice(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, user_id: user2.id, platform: 'ios', device_fingerprint: 'fp2', push_token: null }, sysActor)
    expect(() => revokeDevice(store, device1.id, sysActor, 'PR-21', 'someone-else-id')).not.toThrow()
    expect(() => revokeDevice(store, device2.id, sysActor, 'PR-16', 'someone-else-id')).toThrow()
  })

  it('enrolMfa: a user can always enrol their own MFA (self-service, not matrix-gated)', () => {
    const user = makeUser(store)
    expect(() => enrolMfa(store, user.id, 'totp', userActor, 'PR-02', user.id)).not.toThrow()
  })

  it('enrolMfa: PR-21 can enrol MFA for another user, PR-16 cannot (D-33)', () => {
    const user = makeUser(store)
    expect(() => enrolMfa(store, user.id, 'totp', sysActor, 'PR-21', 'someone-else-id')).not.toThrow()
    expect(() => enrolMfa(store, user.id, 'sms_otp', sysActor, 'PR-16', 'someone-else-id')).toThrow()
  })

  it('endImpersonation: PR-21 can end an impersonation session, PR-01 cannot (KRN-02.md §10 — start|end both PR-21 only)', () => {
    const admin = makeUser(store, { login_id: 'admin2@acme.example' })
    const target = makeUser(store, { login_id: 'target3@acme.example' })
    const session1 = startImpersonation(store, admin.id, target.id, 'reason', sysActor, 'PR-21')
    expect(() => endImpersonation(store, session1.id, sysActor, 'PR-01')).toThrow()
    expect(() => endImpersonation(store, session1.id, sysActor, 'PR-21')).not.toThrow()
  })

  it('upgradeAgentVersion: a service actor can upgrade an agent identity version, a user actor cannot (§17 item 7 / §10)', () => {
    const agent = registerAgentIdentity(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, agent_code: 'MFG-AG-07', owning_module: 'MFG-05', credential_ref: '00000000-0000-7000-8000-000000000abe' }, sysActor)
    expect(() => upgradeAgentVersion(store, agent.id, 2, userActor)).toThrow()
    expect(() => upgradeAgentVersion(store, agent.id, 2, sysActor)).not.toThrow()
  })
})

describe('KRN-02 §11 negative case — PR-28 outside the provisioning window', () => {
  it('is within the window only while the tenant is trial', () => {
    expect(isWithinProvisioningWindow('trial')).toBe(true)
    expect(isWithinProvisioningWindow('active')).toBe(false)
    expect(isWithinProvisioningWindow('suspended')).toBe(false)
    expect(isWithinProvisioningWindow('closed')).toBe(false)
  })
})

describe('KRN-02 §11 negative case — agent registration restricted to service actors (§17 item 7)', () => {
  let store: Krn02Store
  beforeEach(() => {
    store = newStore()
  })

  it('rejects a user actor registering an agent identity, accepts a service actor', () => {
    expect(() => registerAgentIdentity(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, agent_code: 'MFG-AG-05', owning_module: 'MFG-05', credential_ref: '00000000-0000-7000-8000-000000000abc' }, userActor)).toThrow()
    expect(() => registerAgentIdentity(store, { tenant_id: TENANT_ID, entity_id: ENTITY_ID, agent_code: 'MFG-AG-06', owning_module: 'MFG-05', credential_ref: '00000000-0000-7000-8000-000000000abd' }, sysActor)).not.toThrow()
  })
})
