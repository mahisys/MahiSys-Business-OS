/**
 * KRN-04's own bootstrap permission matrix — KRN-04.md §11, transcribed
 * directly. Same rationale as KRN-01/KRN-02's: KRN-03 (Access Control)
 * doesn't exist yet — and here it matters doubly, since KRN-03 itself
 * *depends on* KRN-04 (its permission_set.grants[].entity_ref points at
 * KRN-04's entity_definition records), so KRN-04 cannot defer its own
 * bootstrap check to KRN-03 even provisionally. This is a minimal,
 * self-contained check for KRN-04's own actions only, superseded by real
 * KRN-03 integration once KRN-03 is built (tracked in /spec/state.md).
 *
 * §11's table visually collapses `entity.create_tnt/update_tnt` and
 * `field.create_tnt/update_tnt` into one `entity/field.*_tnt` column —
 * this matrix keeps them as the four distinct actions §11's own prose
 * ("Actions: ...") names, since no persona in the current draft actually
 * differentiates between them; collapsing was a display simplification,
 * not a semantic one.
 *
 * `sys.write` and `extension_point` writes hold no human-role grant at
 * all (KRN-04-DR-001, KRN-04-FR-005) — enforced by requiring
 * `actor.type === 'service'` directly in the service functions that need
 * it, the same pattern KRN-02 uses for `registerAgentIdentity`, not by a
 * matrix entry (no PersonaId represents the platform release pipeline
 * meaningfully as a "human persona" choice).
 */

export type PersonaId = 'PR-21' | 'PR-28' | 'PR-01' | 'PR-02' | 'OTHER'

export type Krn04Action =
  | 'entity.read'
  | 'entity.create_tnt'
  | 'entity.update_tnt'
  | 'field.create_tnt'
  | 'field.update_tnt'
  | 'schema_version.promote_tnt'
  | 'schema_version.rollback_tnt'
  | 'diff.read'

const MATRIX: Record<PersonaId, Record<Krn04Action, boolean>> = {
  'PR-21': {
    'entity.read': true,
    'entity.create_tnt': true,
    'entity.update_tnt': true,
    'field.create_tnt': true,
    'field.update_tnt': true,
    'schema_version.promote_tnt': true, // own tenant tnt versions only — sys promotion is platform-pipeline-only, never matrix-gated
    'schema_version.rollback_tnt': true,
    'diff.read': true,
  },
  'PR-28': {
    'entity.read': true, // own tenant, provisioning window
    'entity.create_tnt': true, // same window restriction — see isWithinProvisioningWindow()
    'entity.update_tnt': true,
    'field.create_tnt': true,
    'field.update_tnt': true,
    'schema_version.promote_tnt': false,
    'schema_version.rollback_tnt': false,
    'diff.read': true, // own tenant
  },
  'PR-01': {
    'entity.read': true, // summary view only
    'entity.create_tnt': false,
    'entity.update_tnt': false,
    'field.create_tnt': false,
    'field.update_tnt': false,
    'schema_version.promote_tnt': false,
    'schema_version.rollback_tnt': false,
    'diff.read': true, // own tenant, summary
  },
  'PR-02': {
    'entity.read': true, // own function's entities — row/scope nuance not captured in this coarse matrix, see module doc above
    'entity.create_tnt': false, // proposes via STU-01, does not call the API directly
    'entity.update_tnt': false,
    'field.create_tnt': false,
    'field.update_tnt': false,
    'schema_version.promote_tnt': false,
    'schema_version.rollback_tnt': false,
    'diff.read': false,
  },
  OTHER: {
    'entity.read': true, // implicit, resolved through KRN-13-rendered screens — not a direct API grant
    'entity.create_tnt': false,
    'entity.update_tnt': false,
    'field.create_tnt': false,
    'field.update_tnt': false,
    'schema_version.promote_tnt': false,
    'schema_version.rollback_tnt': false,
    'diff.read': false,
  },
}

export function hasPermission(persona: PersonaId, action: Krn04Action): boolean {
  return MATRIX[persona][action]
}

import { randomUUID } from 'node:crypto'
import { KernelError } from './errors.js'

/**
 * KRN-04.md §11 negative case: PR-28 (Implementation Partner) may only act
 * within the provisioning window — mirrors KRN-01/KRN-02's identical
 * pattern. KRN-04 does not own tenant status itself, so this takes it as
 * a parameter rather than reaching into KRN-01's store (L3).
 */
export function isWithinProvisioningWindow(tenantStatus: 'trial' | 'active' | 'suspended' | 'closed'): boolean {
  return tenantStatus === 'trial'
}

/** Shared enforcement helper — throws on denial. */
export function assertPermission(persona: PersonaId, action: Krn04Action) {
  if (!hasPermission(persona, action)) {
    throw new KernelError('FORBIDDEN', `Persona ${persona} does not hold ${action} (KRN-04.md §11).`, randomUUID())
  }
}

/**
 * KRN-04-DR-001 / KRN-04-FR-005: `sys` writes (including extension points)
 * hold no human-role grant at all — only the platform release pipeline
 * service account may perform them, independent of any persona a caller
 * otherwise claims (mirrors KRN-02's `assertNotAgentActor`/service-actor
 * guards).
 */
export function assertServiceActorForSysWrite(actorType: 'user' | 'agent' | 'service', action: string) {
  if (actorType !== 'service') {
    throw new KernelError(
      'SYS_WRITE_REQUIRES_SERVICE_ACTOR',
      `${action} on a sys-namespace record is restricted to the platform release pipeline service account (KRN-04.md §11, KRN-04-DR-001).`,
      randomUUID(),
    )
  }
}
