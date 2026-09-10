/**
 * In-memory reference store for KRN-10. Same rationale as the other
 * kernel modules': makes the business rules in KRN-10.md provably correct
 * via acceptance tests before any real persistence layer is wired up
 * (D-12).
 *
 * Like KRN-11 (D-39), `Krn10Store` takes a `Krn06Store` reference at
 * construction — but unlike KRN-11, `audit_entry`/`access_log` creation
 * itself never calls `recordEvent()` (KRN-10.md §12's explicit,
 * deliberate anti-circularity rule: auditing the audit log's own writes
 * would be circular, since `audit_entry` already derives conceptually
 * from the same mutation KRN-06 recorded). Only KRN-10's three genuinely
 * administrative actions — chain sealing, evidence-pack generation, and a
 * failed chain verification — emit through the real KRN-06 API.
 */
import { createHash, randomUUID } from 'node:crypto'
import type { Krn06Store } from '@mahisys/krn-06'
import { recordEvent } from '@mahisys/krn-06'
import type { AuditEntry } from '../contracts/audit-entry.js'
import type { AuditChainSeal } from '../contracts/audit-chain-seal.js'
import type { AccessLog } from '../contracts/access-log.js'

interface ChainCursor {
  lastSequenceNo: number
  lastHash: string | null
}

export class Krn10Store {
  auditEntries: AuditEntry[] = []
  chainSeals = new Map<string, AuditChainSeal>()
  accessLogs: AccessLog[] = []
  /** Not a KRN-10.md §4 owned entity — a minimal per-tenant setting backing KRN-10-FR-005, same pattern as KRN-06's retention-service.ts. */
  retentionByTenant = new Map<string, number>()

  private chainCursors = new Map<string, ChainCursor>()

  constructor(private readonly krn06Store: Krn06Store) {}

  /** `KRN-10-FR-002`: sequential, tenant-scoped hash chain — each entry's hash covers its own content plus the prior entry's hash, so altering any historical entry breaks every hash after it. */
  nextChainLink(tenantId: string): ChainCursor {
    return this.chainCursors.get(tenantId) ?? { lastSequenceNo: 0, lastHash: null }
  }

  advanceChain(tenantId: string, sequenceNo: number, hash: string) {
    this.chainCursors.set(tenantId, { lastSequenceNo: sequenceNo, lastHash: hash })
  }

  /** KRN-10's own administrative events (chain_seal.completed, evidence_pack.generated, chain.verification_failed) — never `audit_entry`/`access_log` writes themselves. Mirrors KRN-11's `emit` (D-39): calls the real, published `@mahisys/krn-06` API. */
  emitAdministrative(input: Omit<Parameters<typeof recordEvent>[1], 'tenant_id'> & { tenant_id: string }) {
    recordEvent(this.krn06Store, input)
  }
}

export function createStore(krn06Store: Krn06Store): Krn10Store {
  return new Krn10Store(krn06Store)
}

/**
 * Deterministic, order-independent JSON serialization — object keys
 * sorted recursively at every nesting level, arrays preserved in order.
 * `JSON.stringify(value, arrayOfKeys)` looks like it would do this but
 * does not: an array replacer is a single flat whitelist applied at
 * *every* level, so a nested `before`/`after` object's own field names
 * (e.g. `quantity`) silently get filtered out entirely unless they
 * happen to also appear at the top level — the hash would then be blind
 * to any change inside a mutation's actual before/after payload, which
 * is exactly what a tamper-evident audit hash cannot afford to miss.
 * Caught by this module's own unit and FR-002 acceptance tests before
 * commit; see decisions-taken.md D-40.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}

/**
 * Canonical hash for one audit_entry's content, chained to the prior
 * entry's hash. A reasonable-minimum SHA-256 chain (§17 item 5 flags the
 * actual hash-chain algorithm as a `[stack-bound]`-flavoured decision Vol
 * 1 leaves open) — not a Merkle tree itself (that's `audit_chain_seal`'s
 * job, see chain-service.ts), just the per-entry link.
 */
export function computeEntryHash(prevHash: string | null, canonical: Record<string, unknown>): string {
  const hash = createHash('sha256')
  hash.update(prevHash ?? '')
  hash.update(JSON.stringify(canonicalize(canonical)))
  return hash.digest('hex')
}

export function newId(): string {
  return randomUUID()
}
