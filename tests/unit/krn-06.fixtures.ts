/**
 * Shared test fixtures for KRN-06 acceptance/permission tests.
 */
import { createStore, type Krn06Store } from '@mahisys/krn-06'
import { createSubscription } from '@mahisys/krn-06'
import type { SubscriberType, DeliveryMode } from '@mahisys/krn-06'

export const sysActor = { type: 'service' as const, id: '00000000-0000-7000-8200-000000000001' }
export const userActor = { type: 'user' as const, id: '00000000-0000-7000-8200-000000000002' }
export const agentActor = { type: 'agent' as const, id: '00000000-0000-7000-8200-000000000009', version: 'v1' }

export const TENANT_ID = '00000000-0000-7000-8200-0000000000f0'
export const ENTITY_ID = '00000000-0000-7000-8200-0000000000e0'

// Stand-ins for KRN-02 subject ids — KRN-06 only ever references these by
// id (L3), it never creates them itself.
export const AGENT_SUBJECT_ID = '00000000-0000-7000-8200-0000000000a1'
export const INTEGRATION_SUBJECT_A = '00000000-0000-7000-8200-0000000000b1'
export const INTEGRATION_SUBJECT_B = '00000000-0000-7000-8200-0000000000b2'

export function newStore(): Krn06Store {
  return createStore()
}

export function makeSubscription(
  store: Krn06Store,
  overrides: Partial<{
    subscriber_type: SubscriberType
    subscriber_id: string
    event_pattern: string
    delivery_mode: DeliveryMode
    retry_ceiling: number
  }> = {},
) {
  return createSubscription(
    store,
    {
      tenant_id: TENANT_ID,
      subscriber_type: overrides.subscriber_type ?? 'integration',
      subscriber_id: overrides.subscriber_id ?? INTEGRATION_SUBJECT_A,
      event_pattern: overrides.event_pattern ?? 'mfg.job_work.*',
      filter_expression: null,
      delivery_mode: overrides.delivery_mode ?? 'push',
      idempotency_key_field: 'event_id',
      retry_ceiling: overrides.retry_ceiling,
    },
    sysActor,
    'PR-21',
  )
}
