import { randomUUID, createHash } from 'node:crypto'
import type { Krn02Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { Credential, CredentialType } from '../contracts/credential.js'
import { KernelError } from './errors.js'

export interface CreateCredentialInput {
  tenant_id: string
  entity_id: string
  user_id: string | null
  service_account_id: string | null
  agent_identity_id: string | null
  credential_type: CredentialType
  plaintext: string // hashed internally; never stored as-is (KRN-02-FR-004)
  rotation_due_at: string | null
}

/**
 * SHA-256 for the reference implementation's own verify/compare flow —
 * sufficient to prove the *structural* guarantee KRN-02-FR-004 actually
 * cares about (plaintext is never stored, only ever compared via hash),
 * not a production-grade password hash. A real deployment would use
 * bcrypt/argon2 with per-credential salt; noted here as an implementation
 * detail to swap when wiring real persistence (D-12), not a spec gap.
 */
function hash(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

function now() {
  return new Date().toISOString()
}

function exactlyOneSubject(input: Pick<CreateCredentialInput, 'user_id' | 'service_account_id' | 'agent_identity_id'>) {
  return [input.user_id, input.service_account_id, input.agent_identity_id].filter((v) => v !== null).length === 1
}

export function createCredential(store: Krn02Store, input: CreateCredentialInput, actor: ActorRef): Credential {
  if (!exactlyOneSubject(input)) {
    throw new KernelError('CREDENTIAL_SUBJECT_AMBIGUOUS', 'Exactly one of user_id, service_account_id, agent_identity_id must be set (KRN-02.md §4.1).', randomUUID())
  }

  const id = randomUUID()
  const timestamp = now()
  const credential: Credential = {
    id,
    tenant_id: input.tenant_id,
    entity_id: input.entity_id,
    namespace: 'sys',
    ext: {},
    created_at: timestamp,
    created_by: actor,
    updated_at: timestamp,
    updated_by: actor,
    version: 1,
    deleted_at: null,
    deleted_by: null,
    source: 'api',
    trace_id: randomUUID(),
    user_id: input.user_id,
    service_account_id: input.service_account_id,
    agent_identity_id: input.agent_identity_id,
    credential_type: input.credential_type,
    value_hash: hash(input.plaintext),
    rotation_due_at: input.rotation_due_at,
    status: 'active',
    last_rotated_at: timestamp,
  }
  store.credentials.set(id, credential)
  return credential
}

/** Verifies a plaintext guess against the stored hash for a user's active credential. */
export function verifyPassword(store: Krn02Store, userId: string, plaintextGuess: string): boolean {
  for (const cred of store.credentials.values()) {
    if (cred.user_id === userId && cred.status === 'active') {
      return cred.value_hash === hash(plaintextGuess)
    }
  }
  return false
}

export function rotateUserCredential(store: Krn02Store, credentialId: string, newPlaintext: string, actor: ActorRef): Credential {
  const cred = store.credentials.get(credentialId)
  if (!cred) {
    throw new KernelError('CREDENTIAL_NOT_FOUND', `No credential with id ${credentialId}`, randomUUID())
  }
  const timestamp = now()
  const updated: Credential = { ...cred, value_hash: hash(newPlaintext), last_rotated_at: timestamp, updated_at: timestamp, updated_by: actor, version: cred.version + 1 }
  store.credentials.set(credentialId, updated)
  return updated
}
