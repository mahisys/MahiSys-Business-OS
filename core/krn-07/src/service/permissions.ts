/**
 * KRN-07's own bootstrap permission matrix — KRN-07.md §11, transcribed
 * directly. Unlike every other kernel module's matrix so far, access is
 * scoped per `rule_type` *domain* (pricing/credit/reorder/eligibility/
 * approval_threshold/compliance_check), not a flat per-action boolean —
 * §11's own table is genuinely two-dimensional (persona × domain), so
 * `DomainGrant` models that directly rather than collapsing it.
 *
 * `PR-02`'s domain ("own function's rule types") is caller-context-
 * dependent — a functional head's own function varies per instance, not
 * a fixed list this bootstrap matrix can hardcode. Read/activate calls
 * for PR-02 take an explicit `callerDomainOverride: RuleType[]`
 * (pre-resolved by the caller, e.g. from KRN-01 org-unit/function data —
 * L3, same pre-resolved-parameter pattern used throughout this project)
 * rather than a static entry in `GRANTS`.
 */
import { randomUUID } from 'node:crypto'
import type { RuleType } from '../contracts/rule-set.js'
import { KernelError } from './errors.js'

export type PersonaId = 'PR-21' | 'PR-08' | 'PR-16' | 'PR-06' | 'PR-02' | 'PR-15' | 'PR-01' | 'PR-28' | 'PR-29' | 'OTHER'

export type DomainAction = 'read' | 'edit_draft' | 'activate' | 'simulate' | 'log_read'

type DomainGrant = RuleType[] | 'all' | 'none'

interface PersonaGrants {
  read: DomainGrant
  edit_draft: DomainGrant
  activate: DomainGrant
  simulate: DomainGrant
  log_read: DomainGrant
}

const ALL_TYPES: RuleType[] = ['pricing', 'credit', 'reorder', 'eligibility', 'approval_threshold', 'compliance_check']

const GRANTS: Record<PersonaId, PersonaGrants> = {
  'PR-21': { read: 'all', edit_draft: 'all', activate: 'all', simulate: 'all', log_read: 'all' },
  'PR-08': { read: ['pricing', 'eligibility'], edit_draft: ['pricing', 'eligibility'], activate: ['pricing', 'eligibility'], simulate: ['pricing', 'eligibility'], log_read: ['pricing', 'eligibility'] },
  'PR-16': { read: 'all', edit_draft: ['credit', 'approval_threshold'], activate: ['credit', 'approval_threshold'], simulate: ['credit', 'approval_threshold'], log_read: 'all' }, // "cross-domain read for controller visibility" (§11)
  'PR-06': { read: ['reorder'], edit_draft: ['reorder'], activate: ['reorder'], simulate: ['reorder'], log_read: ['reorder'] },
  'PR-02': { read: 'none', edit_draft: 'none', activate: 'none', simulate: 'none', log_read: 'none' }, // read/activate resolved via callerDomainOverride, see module doc above; edit_draft/simulate are hard ✗ per §11
  'PR-15': { read: 'none', edit_draft: 'none', activate: 'none', simulate: 'none', log_read: 'all' }, // explainability only
  'PR-01': { read: 'all', edit_draft: 'none', activate: 'all', simulate: 'none', log_read: 'all' }, // "highest-impact activations only" is a governance nuance this bootstrap matrix does not further restrict — flagged, not silently narrowed
  'PR-28': { read: 'all', edit_draft: 'all', activate: 'none', simulate: 'all', log_read: 'none' }, // own tenant, provisioning window — window itself not enforced here, same caveat as every other module's PR-28 row this session
  'PR-29': { read: 'all', edit_draft: 'none', activate: 'none', simulate: 'none', log_read: 'all' }, // further scoped to its own declared data scope by the caller (subject-level, not rule_type domain) — see rule-service.ts
  OTHER: { read: 'none', edit_draft: 'none', activate: 'none', simulate: 'none', log_read: 'none' },
}

function grantIncludes(grant: DomainGrant, ruleType: RuleType): boolean {
  if (grant === 'all') return true
  if (grant === 'none') return false
  return grant.includes(ruleType)
}

export function hasDomainAccess(persona: PersonaId, action: DomainAction, ruleType: RuleType, callerDomainOverride?: RuleType[]): boolean {
  if (persona === 'PR-02' && (action === 'read' || action === 'activate') && callerDomainOverride) {
    return callerDomainOverride.includes(ruleType)
  }
  return grantIncludes(GRANTS[persona][action], ruleType)
}

export function assertDomainAccess(persona: PersonaId, action: DomainAction, ruleType: RuleType, callerDomainOverride?: RuleType[]) {
  if (!hasDomainAccess(persona, action, ruleType, callerDomainOverride)) {
    throw new KernelError('FORBIDDEN', `Persona ${persona} does not hold ${action} for rule_type ${ruleType} (KRN-07.md §11).`, randomUUID())
  }
}

export { ALL_TYPES }
