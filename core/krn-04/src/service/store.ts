/**
 * In-memory reference store for KRN-04. Same rationale as KRN-01/KRN-02's:
 * makes the business rules in KRN-04.md provably correct via acceptance
 * tests before any real persistence layer is wired up (D-12).
 */
import { randomUUID } from 'node:crypto'
import type { EntityDefinition } from '../contracts/entity-definition.js'
import type { FieldDefinition } from '../contracts/field-definition.js'
import type { RelationshipDefinition } from '../contracts/relationship-definition.js'
import type { ValidationRule } from '../contracts/validation-rule.js'
import type { ComputedField } from '../contracts/computed-field.js'
import type { SchemaVersion } from '../contracts/schema-version.js'
import type { ExtensionPoint } from '../contracts/extension-point.js'

/** Full P-08 Event envelope (Vol 2 Part 2, P-08) — see KRN-01/KRN-02's identical rationale. */
export interface EmittedEvent {
  event_id: string
  event_name: string
  tenant_id: string
  entity_id: string
  schema_version: number
  subject_type: string
  subject_id: string
  payload: Record<string, unknown>
  occurred_at: string
  recorded_at: string
  actor: { type: 'user' | 'agent' | 'service'; id: string; version?: string }
  causation_id: string | null
  correlation_id: string
  trace_id: string
  reversal_handle: string | null // KRN-18 doesn't exist yet (Phase 1) — always null until it ships, per D-21
}

export type EmitInput = Omit<EmittedEvent, 'event_id' | 'schema_version' | 'causation_id' | 'correlation_id' | 'trace_id' | 'reversal_handle'>

export class Krn04Store {
  entityDefinitions = new Map<string, EntityDefinition>()
  fieldDefinitions = new Map<string, FieldDefinition>()
  relationshipDefinitions = new Map<string, RelationshipDefinition>()
  validationRules = new Map<string, ValidationRule>()
  computedFields = new Map<string, ComputedField>()
  schemaVersions = new Map<string, SchemaVersion>()
  extensionPoints = new Map<string, ExtensionPoint>()
  events: EmittedEvent[] = []

  emit(e: EmitInput) {
    this.events.push({
      ...e,
      event_id: randomUUID(),
      schema_version: 1,
      causation_id: null,
      correlation_id: randomUUID(),
      trace_id: randomUUID(),
      reversal_handle: null,
    })
  }
}

export function createStore(): Krn04Store {
  return new Krn04Store()
}
