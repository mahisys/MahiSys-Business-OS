import { randomUUID } from 'node:crypto'
import type { Krn04Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import { isValidTransition } from '@mahisys/shared'
import type { SchemaVersion, SchemaVersionStatus, SchemaDiffEntry } from '../contracts/schema-version.js'
import { SCHEMA_VERSION_STATUS_TRANSITIONS } from '../contracts/schema-version.js'
import type { PersonaId } from './permissions.js'
import { assertPermission, assertServiceActorForSysWrite } from './permissions.js'
import { KernelError } from './errors.js'

export interface CreateSchemaVersionInput {
  tenant_id: string
  namespace: 'sys' | 'tnt'
  release_id: string | null // D-34 — set only for namespace: sys, correlating this tenant's copy with every other tenant's copy of the same platform release
  version_no: number
  diff: SchemaDiffEntry[]
}

function now() {
  return new Date().toISOString()
}

function assertNamespaceWriteAllowed(namespace: 'sys' | 'tnt', actor: ActorRef, callerPersona: PersonaId, action: 'schema_version.promote_tnt' | 'schema_version.rollback_tnt' | 'entity.create_tnt') {
  if (namespace === 'sys') {
    assertServiceActorForSysWrite(actor.type, action)
  } else {
    assertPermission(callerPersona, action)
  }
}

/**
 * POST /api/v1/metadata/schema-versions — always tenant-scoped (D-34);
 * creates a `draft`. §11 names dedicated actions only for `promote`/
 * `rollback`, not for draft creation, validation or rehearsal — this and
 * `validateSchemaVersion`/`rehearseSchemaVersion` below reuse
 * `entity.create_tnt` as the closest-named grant for those three earlier
 * lifecycle steps (flagged per Vol 6 §4/L13, same as the other
 * not-separately-named actions in `relationship-service.ts` etc.).
 */
export function createSchemaVersionDraft(store: Krn04Store, input: CreateSchemaVersionInput, actor: ActorRef, callerPersona: PersonaId): SchemaVersion {
  assertNamespaceWriteAllowed(input.namespace, actor, callerPersona, 'entity.create_tnt')

  if (input.namespace === 'tnt' && input.release_id !== null) {
    throw new KernelError('RELEASE_ID_NOT_APPLICABLE', 'release_id is only meaningful for namespace: sys versions (D-34).', randomUUID())
  }

  const id = randomUUID()
  const timestamp = now()
  const version: SchemaVersion = {
    id,
    tenant_id: input.tenant_id,
    entity_id: id,
    namespace: input.namespace,
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
    version_no: input.version_no,
    release_id: input.release_id,
    status: 'draft',
    diff: input.diff,
    rehearsed_against: null,
    promoted_at: null,
    promoted_by: null,
  }
  store.schemaVersions.set(id, version)
  return version
}

function transition(store: Krn04Store, sv: SchemaVersion, target: SchemaVersionStatus, actor: ActorRef): SchemaVersion {
  if (!isValidTransition(SCHEMA_VERSION_STATUS_TRANSITIONS, sv.status, target)) {
    throw new KernelError(
      'ILLEGAL_SCHEMA_VERSION_STATUS_TRANSITION',
      `Cannot transition schema_version from ${sv.status} to ${target} (KRN-04.md §5).`,
      randomUUID(),
      { from: sv.status, to: target },
    )
  }
  const timestamp = now()
  const updated: SchemaVersion = { ...sv, status: target, updated_at: timestamp, updated_by: actor, version: sv.version + 1 }
  store.schemaVersions.set(sv.id, updated)
  return updated
}

function mustGet(store: Krn04Store, id: string): SchemaVersion {
  const sv = store.schemaVersions.get(id)
  if (!sv) {
    throw new KernelError('SCHEMA_VERSION_NOT_FOUND', `No schema_version with id ${id}`, randomUUID())
  }
  return sv
}

/** draft → validated. Added during implementation — this transition had no event (L4). See KRN-04.md §12. */
export function validateSchemaVersion(store: Krn04Store, schemaVersionId: string, actor: ActorRef, callerPersona: PersonaId): SchemaVersion {
  const sv = mustGet(store, schemaVersionId)
  assertNamespaceWriteAllowed(sv.namespace, actor, callerPersona, 'entity.create_tnt')
  const updated = transition(store, sv, 'validated', actor)

  store.emit({
    event_name: 'metadata.schema.version_validated',
    tenant_id: sv.tenant_id,
    entity_id: schemaVersionId,
    subject_type: 'schema_version',
    subject_id: schemaVersionId,
    payload: { schema_version_id: schemaVersionId, version_no: sv.version_no, release_id: sv.release_id },
    occurred_at: updated.updated_at,
    recorded_at: updated.updated_at,
    actor,
  })

  return updated
}

/**
 * validated → rehearsed; invokes STU-10's shadow-tenant apply (not built
 * — `shadowTenantRef` is recorded, not dereferenced, per D-21's degrade
 * convention). Added during implementation — this transition had no
 * event (L4). See KRN-04.md §12.
 */
export function rehearseSchemaVersion(store: Krn04Store, schemaVersionId: string, shadowTenantRef: string, actor: ActorRef, callerPersona: PersonaId): SchemaVersion {
  const sv = mustGet(store, schemaVersionId)
  assertNamespaceWriteAllowed(sv.namespace, actor, callerPersona, 'entity.create_tnt')
  const updated = transition(store, sv, 'rehearsed', actor)
  const withShadow: SchemaVersion = { ...updated, rehearsed_against: shadowTenantRef }
  store.schemaVersions.set(schemaVersionId, withShadow)

  store.emit({
    event_name: 'metadata.schema.version_rehearsed',
    tenant_id: sv.tenant_id,
    entity_id: schemaVersionId,
    subject_type: 'schema_version',
    subject_id: schemaVersionId,
    payload: { schema_version_id: schemaVersionId, version_no: sv.version_no, release_id: sv.release_id, rehearsed_against: shadowTenantRef },
    occurred_at: withShadow.updated_at,
    recorded_at: withShadow.updated_at,
    actor,
  })

  return withShadow
}

/**
 * rehearsed → promoted; rejected if not rehearsed (§11 negative case).
 * Also transitions this tenant's own currently-`promoted` version (same
 * `tenant_id`+`namespace` scope) to `superseded` — one tenant's promotion
 * never gates or is gated by another tenant's copy of the same `sys`
 * release (D-34; mirrors `KRN-12-DR-003`).
 */
export function promoteSchemaVersion(store: Krn04Store, schemaVersionId: string, actor: ActorRef, callerPersona: PersonaId): SchemaVersion {
  const sv = mustGet(store, schemaVersionId)
  if (sv.namespace === 'sys') {
    assertServiceActorForSysWrite(actor.type, 'schema_version.promote')
  } else {
    assertPermission(callerPersona, 'schema_version.promote_tnt')
  }

  const currentlyPromoted = Array.from(store.schemaVersions.values()).find(
    (v) => v.tenant_id === sv.tenant_id && v.namespace === sv.namespace && v.id !== sv.id && v.status === 'promoted',
  )
  if (currentlyPromoted) {
    const superseded = transition(store, currentlyPromoted, 'superseded', actor)
    // Added during implementation — the version a new promotion replaces
    // had no event of its own (L4); mirrors KRN-02's `revokeDevice`
    // precedent of one event per affected row in a cascading mutation.
    store.emit({
      event_name: 'metadata.schema.version_superseded',
      tenant_id: currentlyPromoted.tenant_id,
      entity_id: currentlyPromoted.id,
      subject_type: 'schema_version',
      subject_id: currentlyPromoted.id,
      payload: { schema_version_id: currentlyPromoted.id, version_no: currentlyPromoted.version_no, release_id: currentlyPromoted.release_id, superseded_by_version_id: sv.id },
      occurred_at: superseded.updated_at,
      recorded_at: superseded.updated_at,
      actor,
    })
  }

  const promoted = transition(store, sv, 'promoted', actor)
  const timestamp = now()
  const withPromotion: SchemaVersion = { ...promoted, promoted_at: timestamp, promoted_by: actor }
  store.schemaVersions.set(schemaVersionId, withPromotion)

  store.emit({
    event_name: 'metadata.schema.version_promoted',
    tenant_id: sv.tenant_id,
    entity_id: schemaVersionId,
    subject_type: 'schema_version',
    subject_id: schemaVersionId,
    payload: { schema_version_id: schemaVersionId, version_no: sv.version_no, release_id: sv.release_id },
    occurred_at: timestamp,
    recorded_at: timestamp,
    actor,
  })

  return withPromotion
}

/**
 * promoted → rolled_back, restoring the immediately prior `promoted`
 * version (the one this version superseded) to `promoted` again
 * (KRN-04-DR-002's acceptance criterion).
 */
export function rollbackSchemaVersion(store: Krn04Store, schemaVersionId: string, actor: ActorRef, callerPersona: PersonaId): SchemaVersion {
  const sv = mustGet(store, schemaVersionId)
  if (sv.namespace === 'sys') {
    assertServiceActorForSysWrite(actor.type, 'schema_version.rollback')
  } else {
    assertPermission(callerPersona, 'schema_version.rollback_tnt')
  }

  const priorSuperseded = Array.from(store.schemaVersions.values())
    .filter((v) => v.tenant_id === sv.tenant_id && v.namespace === sv.namespace && v.status === 'superseded' && v.version_no < sv.version_no)
    .sort((a, b) => b.version_no - a.version_no)[0]

  const rolledBack = transition(store, sv, 'rolled_back', actor)

  if (priorSuperseded) {
    const timestamp = now()
    const restored: SchemaVersion = { ...transition(store, priorSuperseded, 'promoted', actor), promoted_at: timestamp, promoted_by: actor }
    store.schemaVersions.set(priorSuperseded.id, restored)
    // Restoring a version to `promoted` is, semantically, a promotion of
    // that version — reuses `metadata.schema.version_promoted` rather
    // than inventing a new event name (KRN-04.md §12).
    store.emit({
      event_name: 'metadata.schema.version_promoted',
      tenant_id: restored.tenant_id,
      entity_id: restored.id,
      subject_type: 'schema_version',
      subject_id: restored.id,
      payload: { schema_version_id: restored.id, version_no: restored.version_no, release_id: restored.release_id },
      occurred_at: timestamp,
      recorded_at: timestamp,
      actor,
    })
  }

  store.emit({
    event_name: 'metadata.schema.version_rolled_back',
    tenant_id: sv.tenant_id,
    entity_id: schemaVersionId,
    subject_type: 'schema_version',
    subject_id: schemaVersionId,
    payload: {
      schema_version_id: schemaVersionId,
      version_no: sv.version_no,
      release_id: sv.release_id,
      restored_version_id: priorSuperseded?.id ?? schemaVersionId,
    },
    occurred_at: rolledBack.updated_at,
    recorded_at: rolledBack.updated_at,
    actor,
  })

  return rolledBack
}

/**
 * KRN-04-DR-003: `GET /diff?from_version=&to_version=` — concatenates
 * every intervening version's own `diff` entries (each version already
 * records what changed since its predecessor), referenced by `code` path
 * (D-34), not internal `id`.
 */
export function computeDiff(store: Krn04Store, fromVersionId: string, toVersionId: string): SchemaDiffEntry[] {
  const from = mustGet(store, fromVersionId)
  const to = mustGet(store, toVersionId)
  if (from.tenant_id !== to.tenant_id || from.namespace !== to.namespace) {
    throw new KernelError('DIFF_SCOPE_MISMATCH', 'from_version and to_version must belong to the same tenant and namespace.', randomUUID())
  }
  const between = Array.from(store.schemaVersions.values())
    .filter((v) => v.tenant_id === from.tenant_id && v.namespace === from.namespace && v.version_no > from.version_no && v.version_no <= to.version_no)
    .sort((a, b) => a.version_no - b.version_no)
  return between.flatMap((v) => v.diff)
}

export function getSchemaVersion(store: Krn04Store, id: string): SchemaVersion | undefined {
  return store.schemaVersions.get(id)
}
