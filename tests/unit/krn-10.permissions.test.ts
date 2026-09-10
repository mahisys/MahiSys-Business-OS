/**
 * KRN-10 permission tests — Vol 6 §6 step 4, from KRN-10.md §11.
 */
import { describe, it, expect } from 'vitest'
import { hasPermission } from '@mahisys/krn-10'
import { readAuditEntries } from '@mahisys/krn-10'
import { readAccessLog } from '@mahisys/krn-10'
import { verifyChain } from '@mahisys/krn-10'
import { generateEvidencePack } from '@mahisys/krn-10'
import { newStores, makeMutationEntry, sysActor, userActor, TENANT_ID } from './krn-10.fixtures.js'

describe('KRN-10 permission matrix (§11) — positive cases', () => {
  it('PR-21 holds every action', () => {
    expect(hasPermission('PR-21', 'audit_entry.read_own')).toBe(true)
    expect(hasPermission('PR-21', 'audit_entry.read_cross')).toBe(true)
    expect(hasPermission('PR-21', 'access_log.read')).toBe(true)
    expect(hasPermission('PR-21', 'evidence_pack.export')).toBe(true)
    expect(hasPermission('PR-21', 'chain.verify')).toBe(true)
  })

  it('PR-16/PR-17 read own+cross (own domain scope), read access_log, export, but never verify the chain', () => {
    for (const persona of ['PR-16', 'PR-17'] as const) {
      expect(hasPermission(persona, 'audit_entry.read_own'), persona).toBe(true)
      expect(hasPermission(persona, 'audit_entry.read_cross'), persona).toBe(true)
      expect(hasPermission(persona, 'access_log.read'), persona).toBe(true)
      expect(hasPermission(persona, 'evidence_pack.export'), persona).toBe(true)
      expect(hasPermission(persona, 'chain.verify'), persona).toBe(false)
    }
  })

  it('PR-01 reads own actions and agent-action summaries, nothing else', () => {
    expect(hasPermission('PR-01', 'audit_entry.read_own')).toBe(true)
    expect(hasPermission('PR-01', 'audit_entry.read_cross')).toBe(true)
    expect(hasPermission('PR-01', 'access_log.read')).toBe(false)
    expect(hasPermission('PR-01', 'evidence_pack.export')).toBe(false)
    expect(hasPermission('PR-01', 'chain.verify')).toBe(false)
  })

  it('OTHER (every other internal persona) reads only their own actions', () => {
    expect(hasPermission('OTHER', 'audit_entry.read_own')).toBe(true)
    expect(hasPermission('OTHER', 'audit_entry.read_cross')).toBe(false)
  })
})

describe('KRN-10 permission matrix (§11) — negative cases', () => {
  it('PR-25/PR-26 hold nothing at all — no direct query access, ever (KRN-10-FR-004)', () => {
    for (const persona of ['PR-25', 'PR-26'] as const) {
      expect(hasPermission(persona, 'audit_entry.read_own'), persona).toBe(false)
      expect(hasPermission(persona, 'audit_entry.read_cross'), persona).toBe(false)
      expect(hasPermission(persona, 'access_log.read'), persona).toBe(false)
      expect(hasPermission(persona, 'evidence_pack.export'), persona).toBe(false)
      expect(hasPermission(persona, 'chain.verify'), persona).toBe(false)
    }
  })

  it('PR-29 Agent holds nothing — subject, not user (§2)', () => {
    const actions = ['audit_entry.read_own', 'audit_entry.read_cross', 'access_log.read', 'evidence_pack.export', 'chain.verify'] as const
    for (const action of actions) {
      expect(hasPermission('PR-29', action), action).toBe(false)
    }
  })

  it('no persona other than PR-21 holds chain.verify', () => {
    const personas = ['PR-16', 'PR-17', 'PR-01', 'PR-25', 'PR-26', 'PR-29', 'OTHER'] as const
    for (const persona of personas) {
      expect(hasPermission(persona, 'chain.verify'), persona).toBe(false)
    }
  })
})

describe('KRN-10 write/read paths actually enforce the matrix, not just report it', () => {
  it('readAuditEntries: cross-persona read succeeds for PR-21, is rejected for OTHER', () => {
    const { krn10 } = newStores()
    makeMutationEntry(krn10, { actor: userActor })
    const scope = { tenant_id: TENANT_ID, subject_type_allow_list: null }
    expect(() => readAuditEntries(krn10, { actor_id: userActor.id }, scope, 'PR-21', 'someone-else', sysActor)).not.toThrow()
    expect(() => readAuditEntries(krn10, { actor_id: userActor.id }, scope, 'OTHER', 'someone-else', sysActor)).toThrow()
  })

  it('readAccessLog: PR-17 succeeds, PR-01 is rejected', () => {
    const { krn10 } = newStores()
    expect(() => readAccessLog(krn10, TENANT_ID, {}, null, 'PR-17')).not.toThrow()
    expect(() => readAccessLog(krn10, TENANT_ID, {}, null, 'PR-01')).toThrow()
  })

  it('verifyChain: PR-21 succeeds, PR-16 is rejected (CFO cannot verify the chain per §11)', () => {
    const { krn10 } = newStores()
    expect(() => verifyChain(krn10, TENANT_ID, sysActor, 'PR-21')).not.toThrow()
    expect(() => verifyChain(krn10, TENANT_ID, userActor, 'PR-16')).toThrow()
  })

  it('generateEvidencePack: PR-16 succeeds, PR-26 is rejected', () => {
    const { krn10 } = newStores()
    const filter = { date_range: { from: '2026-01-01T00:00:00.000Z', to: '2026-12-31T00:00:00.000Z' } }
    expect(() => generateEvidencePack(krn10, TENANT_ID, filter, { subject_type_allow_list: null }, userActor, 'PR-16')).not.toThrow()
    expect(() => generateEvidencePack(krn10, TENANT_ID, filter, { subject_type_allow_list: null }, userActor, 'PR-26')).toThrow()
  })
})
