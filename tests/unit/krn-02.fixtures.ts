/**
 * Shared test fixtures for KRN-02 acceptance/permission tests.
 */
import { createStore, type Krn02Store } from '@mahisys/krn-02'
import { createUser, activateUser, type CreateUserInput } from '@mahisys/krn-02'
import { createCredential } from '@mahisys/krn-02'

export const sysActor = { type: 'service' as const, id: '00000000-0000-7000-8000-000000000001' }
export const userActor = { type: 'user' as const, id: '00000000-0000-7000-8000-000000000002' }
export const agentActor = { type: 'agent' as const, id: '00000000-0000-7000-8000-000000000009', version: 'v1' }

export const TENANT_ID = '00000000-0000-7000-8000-0000000000f0'
export const ENTITY_ID = '00000000-0000-7000-8000-0000000000f0'

export function newStore(): Krn02Store {
  return createStore()
}

/** Creates and activates a user in one step — most tests need a login-ready user; the separate create/activate steps are tested in their own right elsewhere. */
export function makeUser(
  store: Krn02Store,
  overrides: Partial<Omit<CreateUserInput, 'tenant_id' | 'entity_id'>> = {},
) {
  const user = createUser(
    store,
    {
      tenant_id: TENANT_ID,
      entity_id: ENTITY_ID,
      party_id: overrides.party_id ?? null,
      user_type: overrides.user_type ?? 'full',
      login_id: overrides.login_id ?? `user-${Math.random().toString(36).slice(2, 8)}@acme.example`,
      locale: overrides.locale ?? 'en-IN',
    },
    sysActor,
    'PR-21',
  )
  return activateUser(store, user.id, sysActor)
}

export function makePasswordCredential(store: Krn02Store, userId: string, plaintext: string) {
  return createCredential(
    store,
    {
      tenant_id: TENANT_ID,
      entity_id: ENTITY_ID,
      user_id: userId,
      service_account_id: null,
      agent_identity_id: null,
      credential_type: 'password_hash',
      plaintext,
      rotation_due_at: null,
    },
    sysActor,
  )
}
