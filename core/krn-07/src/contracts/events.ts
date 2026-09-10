/**
 * KRN-07's own event contracts — KRN-07.md §12. `rules.set.activated` and
 * `rules.rule.version_created` are Vol 1 verbatim; `rules.set.deprecated`
 * and `rules.simulation.completed` are additions (§12's own notes). No
 * per-evaluation event exists (KRN-07-FR-005, a deliberate scope
 * decision — §17 item 3) — these flow through `@mahisys/krn-06`'s real
 * `recordEvent()`, the D-39 pattern, third module to use it.
 */
import { z } from 'zod'
import { eventEnvelope, uuid } from '@mahisys/shared'

export const RuleSetActivatedPayloadSchema = z.object({ rule_set_id: uuid, rule_type: z.string() })
export const RuleSetActivatedEventSchema = eventEnvelope('rules.set.activated', RuleSetActivatedPayloadSchema)

export const RuleVersionCreatedPayloadSchema = z.object({ rule_id: uuid, rule_version_id: uuid, version_no: z.number().int() })
export const RuleVersionCreatedEventSchema = eventEnvelope('rules.rule.version_created', RuleVersionCreatedPayloadSchema)

export const RuleSetDeprecatedPayloadSchema = z.object({ rule_set_id: uuid, status: z.enum(['superseded', 'retired']) })
export const RuleSetDeprecatedEventSchema = eventEnvelope('rules.set.deprecated', RuleSetDeprecatedPayloadSchema)

export const SimulationCompletedPayloadSchema = z.object({ rule_set_id: uuid, simulation_id: uuid, changed_count: z.number().int().nonnegative(), sample_count: z.number().int().nonnegative() })
export const SimulationCompletedEventSchema = eventEnvelope('rules.simulation.completed', SimulationCompletedPayloadSchema)
