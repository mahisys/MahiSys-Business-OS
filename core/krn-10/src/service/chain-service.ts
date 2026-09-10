import { randomUUID, createHash } from 'node:crypto'
import { computeEntryHash, type Krn10Store } from './store.js'
import type { ActorRef } from '@mahisys/shared'
import type { AuditChainSeal } from '../contracts/audit-chain-seal.js'
import type { PersonaId } from './permissions.js'
import { assertPermission } from './permissions.js'
import { KernelError } from './errors.js'

export interface ChainVerificationResult {
  ok: boolean
  broken_at_sequence_no: number | null
  checked_count: number
}

/**
 * `KRN-10-FR-002`: recomputes each entry's hash in sequence order and
 * checks it matches the stored `entry_hash`, and that each entry's
 * `prev_hash` equals the previous entry's `entry_hash` — a tamper (e.g. a
 * hypothetical direct-database edit to a historical `after` value) is
 * caught at the exact entry where the recomputed hash first diverges,
 * since every entry after it was built on top of the now-wrong hash.
 */
export function verifyChain(store: Krn10Store, tenantId: string, actor: ActorRef, callerPersona: PersonaId): ChainVerificationResult {
  assertPermission(callerPersona, 'chain.verify')

  const entries = store.auditEntries
    .filter((e) => e.tenant_id === tenantId)
    .sort((a, b) => a.sequence_no - b.sequence_no)

  let prevHash: string | null = null
  for (const entry of entries) {
    const canonical = {
      subject_type: entry.subject_type,
      subject_id: entry.subject_id,
      action: entry.action,
      before: entry.before,
      after: entry.after,
      actor: entry.actor,
      occurred_at: entry.occurred_at,
      sequence_no: entry.sequence_no,
    }
    const recomputed = computeEntryHash(prevHash, canonical)
    if (entry.prev_hash !== prevHash || entry.entry_hash !== recomputed) {
      store.emitAdministrative({
        tenant_id: tenantId,
        entity_id: tenantId,
        event_name: 'audit.chain.verification_failed',
        actor,
        subject_type: 'audit_chain',
        subject_id: tenantId,
        payload: { broken_at_sequence_no: entry.sequence_no },
      })
      return { ok: false, broken_at_sequence_no: entry.sequence_no, checked_count: entries.indexOf(entry) + 1 }
    }
    prevHash = entry.entry_hash
  }

  return { ok: true, broken_at_sequence_no: null, checked_count: entries.length }
}

/**
 * `KRN-10-FR-006`: checkpoints the hash chain since the last seal. The
 * "Merkle root" is a reasonable-minimum single hash over the ordered
 * `entry_hash` values in the window (§17 item 5 flags the actual
 * algorithm as unconfirmed) — sufficient to make FR-006's own acceptance
 * criterion true (verification against the seal without needing to
 * re-derive the whole chain from entry #1), without building a full
 * Merkle tree with proof paths this reference implementation has no
 * consumer for yet.
 */
export function sealChain(store: Krn10Store, tenantId: string, actor: ActorRef): AuditChainSeal {
  const entries = store.auditEntries
    .filter((e) => e.tenant_id === tenantId)
    .sort((a, b) => a.sequence_no - b.sequence_no)

  const lastSeal = Array.from(store.chainSeals.values())
    .filter((s) => s.tenant_id === tenantId)
    .sort((a, b) => b.to_sequence_no - a.to_sequence_no)[0]
  const fromSequenceNo = (lastSeal?.to_sequence_no ?? 0) + 1
  const windowEntries = entries.filter((e) => e.sequence_no >= fromSequenceNo)

  if (windowEntries.length === 0) {
    throw new KernelError('NOTHING_TO_SEAL', `No new audit_entry rows since the last seal for tenant ${tenantId}.`, randomUUID())
  }

  const toSequenceNo = windowEntries[windowEntries.length - 1].sequence_no
  const merkleRoot = createHash('sha256').update(windowEntries.map((e) => e.entry_hash).join('')).digest('hex')

  const seal: AuditChainSeal = {
    seal_id: randomUUID(),
    tenant_id: tenantId,
    sealed_at: new Date().toISOString(),
    from_sequence_no: fromSequenceNo,
    to_sequence_no: toSequenceNo,
    entry_count: windowEntries.length,
    merkle_root: merkleRoot,
  }
  store.chainSeals.set(seal.seal_id, seal)

  store.emitAdministrative({
    tenant_id: tenantId,
    entity_id: tenantId,
    event_name: 'audit.chain_seal.completed',
    actor,
    subject_type: 'audit_chain_seal',
    subject_id: seal.seal_id,
    payload: { seal_id: seal.seal_id, from_sequence_no: fromSequenceNo, to_sequence_no: toSequenceNo },
  })

  return seal
}

export function listChainSeals(store: Krn10Store, tenantId: string): AuditChainSeal[] {
  return Array.from(store.chainSeals.values()).filter((s) => s.tenant_id === tenantId)
}
