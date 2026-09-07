/**
 * Shared test fixtures for KRN-04 acceptance/permission tests.
 */
import { createStore, type Krn04Store } from '@mahisys/krn-04'
import { createEntityDefinition, activateEntityDefinition, type CreateEntityDefinitionInput } from '@mahisys/krn-04'

export const sysActor = { type: 'service' as const, id: '00000000-0000-7000-8100-000000000001' }
export const userActor = { type: 'user' as const, id: '00000000-0000-7000-8100-000000000002' }
export const agentActor = { type: 'agent' as const, id: '00000000-0000-7000-8100-000000000009', version: 'v1' }

export const TENANT_ID = '00000000-0000-7000-8100-0000000000f0'
export const TENANT_ID_2 = '00000000-0000-7000-8100-0000000000f1'

export function newStore(): Krn04Store {
  return createStore()
}

/** Creates and activates a `tnt` entity_definition — most tests need an active entity, the separate create/activate steps are tested in their own right elsewhere. */
export function makeEntity(
  store: Krn04Store,
  overrides: Partial<CreateEntityDefinitionInput> = {},
) {
  const entity = createEntityDefinition(
    store,
    {
      tenant_id: overrides.tenant_id ?? TENANT_ID,
      namespace: overrides.namespace ?? 'tnt',
      code: overrides.code ?? `Entity${Math.random().toString(36).slice(2, 8)}`,
      primitive_id: overrides.primitive_id ?? 'P-02',
      owning_module: overrides.owning_module ?? 'SLS-04',
      label_key: overrides.label_key ?? 'label.entity.generic',
      is_document: overrides.is_document ?? false,
      state_machine_id: overrides.state_machine_id ?? null,
      semantic_index_policy: overrides.semantic_index_policy ?? 'standard',
      offline_profile: overrides.offline_profile ?? 'online',
      schema_version_id: overrides.schema_version_id ?? null,
    },
    sysActor,
    'PR-21',
  )
  return activateEntityDefinition(store, entity.id, sysActor)
}
