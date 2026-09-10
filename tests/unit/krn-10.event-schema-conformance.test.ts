/**
 * KRN-10 event-schema conformance — same rationale as KRN-11's (D-39):
 * runs the real service functions and validates actual events recorded
 * in the real `Krn06Store` against the real Zod schemas. Unlike every
 * other module's conformance test, KRN-10's own `audit_entry`/
 * `access_log` writes are deliberately excluded from this sweep — §12's
 * explicit anti-circularity rule means they never reach KRN-06 at all;
 * only the three administrative events do.
 */
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import { sealChain, verifyChain } from '@mahisys/krn-10'
import { generateEvidencePack } from '@mahisys/krn-10'
import { ChainSealCompletedEventSchema, EvidencePackGeneratedEventSchema, ChainVerificationFailedEventSchema } from '@mahisys/krn-10'
import { newStores, makeMutationEntry, sysActor, userActor, TENANT_ID } from './krn-10.fixtures.js'

const SCHEMA_BY_EVENT_NAME: Record<string, z.ZodTypeAny> = {
  'audit.chain_seal.completed': ChainSealCompletedEventSchema,
  'audit.evidence_pack.generated': EvidencePackGeneratedEventSchema,
  'audit.chain.verification_failed': ChainVerificationFailedEventSchema,
}

describe('KRN-10 — every emitted administrative event validates against its declared Zod schema, recorded through the real KRN-06 store', () => {
  it('exercises chain sealing, evidence-pack generation and a failed verification', () => {
    const { krn06, krn10 } = newStores()

    for (let i = 0; i < 10; i++) makeMutationEntry(krn10, { subject_id: `00000000-0000-7000-8200-0000000002${String(i).padStart(2, '0')}` })
    sealChain(krn10, TENANT_ID, sysActor) // audit.chain_seal.completed

    generateEvidencePack(krn10, TENANT_ID, { date_range: { from: '2020-01-01T00:00:00.000Z', to: '2030-01-01T00:00:00.000Z' } }, { subject_type_allow_list: null }, userActor, 'PR-16') // audit.evidence_pack.generated

    krn10.auditEntries[0] = { ...krn10.auditEntries[0], after: { tampered: true } }
    verifyChain(krn10, TENANT_ID, sysActor, 'PR-21') // audit.chain.verification_failed

    const krn10Events = krn06.events.filter((e) => e.event_name.startsWith('audit.'))
    expect(krn10Events.length).toBeGreaterThanOrEqual(3)

    for (const event of krn10Events) {
      const schema = SCHEMA_BY_EVENT_NAME[event.event_name]
      expect(schema, `no schema registered for emitted event_name "${event.event_name}"`).toBeDefined()
      const result = schema.safeParse(event)
      if (!result.success) {
        throw new Error(`Event ${event.event_name} does not match its declared schema: ${JSON.stringify(result.error.issues, null, 2)}`)
      }
    }

    // audit_entry/access_log writes themselves never reach KRN-06 (§12's anti-circularity rule) — sanity-checked here.
    expect(krn06.events.some((e) => e.subject_type === 'audit_entry' || e.subject_type === 'access_log')).toBe(false)
  })
})
