/**
 * In-memory reference store for KRN-07. Same rationale as the other
 * kernel modules': makes the business rules in KRN-07.md provably correct
 * via acceptance tests before any real persistence layer is wired up
 * (D-12).
 *
 * Third module (after KRN-11, KRN-10) to take a `Krn06Store` reference at
 * construction and emit through its real `recordEvent()` (D-39's
 * pattern) — but, like KRN-10's `audit_entry`/`access_log`, `/evaluate`'s
 * `evaluation_log` writes deliberately never call it: `KRN-07-FR-005`
 * explicitly rules out a per-evaluation event for volume reasons. Only
 * rule-set/rule lifecycle changes (`activate`, `version_created`,
 * `deprecated`) and simulation completion emit.
 */
import { randomUUID } from 'node:crypto'
import type { Krn06Store } from '@mahisys/krn-06'
import { recordEvent } from '@mahisys/krn-06'
import type { RuleSet } from '../contracts/rule-set.js'
import type { Rule } from '../contracts/rule.js'
import type { RuleVersion } from '../contracts/rule-version.js'
import type { EvaluationLogEntry } from '../contracts/evaluation-log.js'

export class Krn07Store {
  ruleSets = new Map<string, RuleSet>()
  rules = new Map<string, Rule>()
  ruleVersions = new Map<string, RuleVersion>()
  evaluationLog: EvaluationLogEntry[] = []

  constructor(private readonly krn06Store: Krn06Store) {}

  emit(input: Omit<Parameters<typeof recordEvent>[1], 'tenant_id'> & { tenant_id: string }) {
    recordEvent(this.krn06Store, input)
  }
}

export function createStore(krn06Store: Krn06Store): Krn07Store {
  return new Krn07Store(krn06Store)
}

export function newId(): string {
  return randomUUID()
}
