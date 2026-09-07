import { randomUUID } from 'node:crypto'
import type { Krn02Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { Device, DevicePlatform } from '../contracts/device.js'
import { DEVICE_TRUST_STATUS_TRANSITIONS } from '../contracts/device.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

export interface RegisterDeviceInput {
  tenant_id: string
  entity_id: string
  user_id: string
  platform: DevicePlatform
  device_fingerprint: string
  push_token: string | null
}

function now() {
  return new Date().toISOString()
}

export function registerDevice(store: Krn02Store, input: RegisterDeviceInput, actor: ActorRef): Device {
  const id = randomUUID()
  const timestamp = now()
  const device: Device = {
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
    platform: input.platform,
    device_fingerprint: input.device_fingerprint,
    registered_at: timestamp,
    last_seen_at: timestamp,
    push_token: input.push_token,
    trust_status: 'registered',
  }
  store.devices.set(id, device)

  store.emit({
    event_name: 'identity.device.registered',
    tenant_id: device.tenant_id,
    entity_id: device.entity_id,
    subject_type: 'device',
    subject_id: id,
    payload: { device_id: id, user_id: input.user_id },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return device
}

/**
 * KRN-02-FR-006: revoking a device ends only the session bound to it —
 * the user's other active sessions and credentials remain valid.
 *
 * Self-revoke (the caller revoking their own device) is always allowed,
 * matching `revokeSession`'s pattern; revoking *another* user's device
 * requires `device.revoke_others` (KRN-02.md §11, added post-draft — see
 * /spec/decisions-taken.md D-33).
 */
export function revokeDevice(store: Krn02Store, deviceId: string, actor: ActorRef, callerPersona: PersonaId, callerUserId: string): Device {
  const device = store.devices.get(deviceId)
  if (!device) {
    throw new KernelError('DEVICE_NOT_FOUND', `No device with id ${deviceId}`, randomUUID())
  }

  const isSelfRevoke = device.user_id === callerUserId
  if (!isSelfRevoke) {
    assertPermission(callerPersona, 'device.revoke_others')
  }

  if (!isValidTransition(DEVICE_TRUST_STATUS_TRANSITIONS, device.trust_status, 'revoked')) {
    throw new KernelError(
      'ILLEGAL_DEVICE_TRUST_STATUS_TRANSITION',
      `Cannot transition device from ${device.trust_status} to revoked (KRN-02.md §5).`,
      randomUUID(),
      { from: device.trust_status, to: 'revoked' },
    )
  }

  const timestamp = now()
  const updated: Device = { ...device, trust_status: 'revoked', updated_at: timestamp, updated_by: actor, version: device.version + 1 }
  store.devices.set(deviceId, updated)

  // Only the session(s) bound to this exact device end — every other
  // active session for the same user is left untouched (KRN-02-FR-006).
  for (const session of store.sessions.values()) {
    if (session.device_id === deviceId && session.status === 'active') {
      const revokedSession = { ...session, status: 'revoked' as const, revoked_by: actor.type === 'user' ? actor.id : null, revoked_reason: 'device revoked', updated_at: timestamp, updated_by: actor, version: session.version + 1 }
      store.sessions.set(session.id, revokedSession)
      store.emit({
        event_name: 'identity.session.revoked',
        tenant_id: session.tenant_id,
        entity_id: session.entity_id,
        subject_type: 'session',
        subject_id: session.id,
        payload: { session_id: session.id, user_id: session.user_id, reason: 'device revoked' },
        occurred_at: timestamp,
        recorded_at: timestamp,
        actor,
      })
    }
  }

  store.emit({
    event_name: 'identity.device.revoked',
    tenant_id: device.tenant_id,
    entity_id: device.entity_id,
    subject_type: 'device',
    subject_id: deviceId,
    payload: { device_id: deviceId, user_id: device.user_id },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return updated
}
