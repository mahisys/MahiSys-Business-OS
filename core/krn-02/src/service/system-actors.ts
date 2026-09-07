/**
 * Well-known service-actor identities for KRN-02's own internal,
 * system-driven mutations (session timeout sweeps, credential rotation
 * scheduling, login-attempt bookkeeping). `ActorRef.id` must be a real
 * UUID (`@mahisys/shared`'s `ActorRefSchema`) — found by the event-schema
 * conformance test, which caught these using human-readable string
 * literals instead. Fixed here as a single source of truth rather than
 * inline string literals scattered across service files.
 */
import type { ActorRef } from '@mahisys/shared'

export const SYSTEM_AUTH_ACTOR: ActorRef = { type: 'service', id: '00000000-0000-7000-9000-000000000001' }
export const SYSTEM_TIMEOUT_CHECKER_ACTOR: ActorRef = { type: 'service', id: '00000000-0000-7000-9000-000000000002' }
export const SYSTEM_ROTATION_SCHEDULER_ACTOR: ActorRef = { type: 'service', id: '00000000-0000-7000-9000-000000000003' }
