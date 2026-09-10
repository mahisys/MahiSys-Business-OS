/**
 * KRN-10's own bootstrap permission matrix — KRN-10.md §11, transcribed
 * directly. Unlike every other kernel module's matrix so far, `OTHER`
 * (every other internal persona) is *not* uniformly denied here — §11's
 * own table grants them `audit_entry.read_own` ("their own actions, e.g.
 * a 'history' tab on a record they own, scoped by KRN-03 record
 * permission").
 *
 * `evidence_pack.export` in this matrix answers "may this persona *call*
 * `generateEvidencePack`," not "may this persona ever possess a pack." §11's
 * PR-25/PR-26 rows are both marked ✓ but the parenthetical is explicit:
 * "received evidence pack only, generated on their behalf by PR-21/16" —
 * PR-25/PR-26 never call the generation action themselves (the negative
 * case is explicit: "external auditors never get raw system query
 * access"). So this matrix grants `evidence_pack.export: false` to
 * PR-25/PR-26 — the scenario where they end up holding a pack is modelled
 * as PR-21/PR-16 calling `generateEvidencePack` and handing the result to
 * them out of band, not PR-25/PR-26 being the caller.
 */
import { randomUUID } from 'node:crypto'
import { KernelError } from './errors.js'

export type PersonaId = 'PR-21' | 'PR-16' | 'PR-17' | 'PR-01' | 'PR-25' | 'PR-26' | 'PR-29' | 'OTHER'

export type Krn10Action =
  | 'audit_entry.read_own'
  | 'audit_entry.read_cross'
  | 'access_log.read'
  | 'evidence_pack.export'
  | 'chain.verify'

const MATRIX: Record<PersonaId, Record<Krn10Action, boolean>> = {
  'PR-21': {
    'audit_entry.read_own': true,
    'audit_entry.read_cross': true, // tenant-wide
    'access_log.read': true, // tenant-wide
    'evidence_pack.export': true,
    'chain.verify': true,
  },
  'PR-16': {
    'audit_entry.read_own': true,
    'audit_entry.read_cross': true, // financial-mutation scope — enforced via a pre-resolved domain allow-list, see audit-entry-service.ts
    'access_log.read': true, // financial-sensitive entities only
    'evidence_pack.export': true, // financial scope only
    'chain.verify': false,
  },
  'PR-17': {
    'audit_entry.read_own': true,
    'audit_entry.read_cross': true, // HR-mutation scope
    'access_log.read': true, // HR-sensitive entities only (payroll, medical)
    'evidence_pack.export': true, // HR scope only
    'chain.verify': false,
  },
  'PR-01': {
    'audit_entry.read_own': true,
    'audit_entry.read_cross': true, // agent-action summary only — "what did an agent do today" (Vol 0 §28 item 11)
    'access_log.read': false,
    'evidence_pack.export': false,
    'chain.verify': false,
  },
  'PR-25': {
    'audit_entry.read_own': false, // no direct query access at all (KRN-10-FR-004)
    'audit_entry.read_cross': false,
    'access_log.read': false,
    'evidence_pack.export': false, // receives a pack PR-21/16 generated on their behalf — see module doc above
    'chain.verify': false,
  },
  'PR-26': {
    'audit_entry.read_own': false,
    'audit_entry.read_cross': false,
    'access_log.read': false,
    'evidence_pack.export': false,
    'chain.verify': false,
  },
  'PR-29': {
    // Subject, not user (§2) — every action generates entries about the agent; the agent never reads its own audit history through this module.
    'audit_entry.read_own': false,
    'audit_entry.read_cross': false,
    'access_log.read': false,
    'evidence_pack.export': false,
    'chain.verify': false,
  },
  OTHER: {
    // Representative of every other internal persona — their own actions only, e.g. a "history" tab on a record they own.
    'audit_entry.read_own': true,
    'audit_entry.read_cross': false,
    'access_log.read': false,
    'evidence_pack.export': false,
    'chain.verify': false,
  },
}

export function hasPermission(persona: PersonaId, action: Krn10Action): boolean {
  return MATRIX[persona][action]
}

/** Shared enforcement helper — throws on denial. */
export function assertPermission(persona: PersonaId, action: Krn10Action) {
  if (!hasPermission(persona, action)) {
    throw new KernelError('FORBIDDEN', `Persona ${persona} does not hold ${action} (KRN-10.md §11).`, randomUUID())
  }
}
