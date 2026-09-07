# KRN-06 · Event Bus & Event Store

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-01 (tenant scoping), KRN-02 (actor identity)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-06)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

The immutable spine of the platform (T3, P-08). Every state change anywhere
in the system is written here, within the same database transaction as the
write that caused it (the transactional outbox pattern), and never updated or
deleted afterward. Audit (KRN-10), analytics (KRN-17), automation (KRN-05,
STU-05), agents (INT-03), simulation (INT-05) and undo (KRN-18) all derive
from this one mechanism rather than from five bolted-on subsystems (Vol 0
§11 KRN-06 differentiating note). It is also the concrete, storable
implementation of primitive **P-08 Event** (Vol 2 §P-08).

Not bought directly — it is `included` platform-fee kernel substrate every
transacting module depends on (Vol 0 §11), and is largely invisible as a
product surface: almost nobody buys or is sold "the event bus." Its direct
human users are administrative and operational, not business-transactional:
PR-21 (System Administrator) manages subscriptions, dead-letter redrive and
retention; every other persona in the system consumes what this module
produces indirectly, through KRN-10's audit trail, INT-02's causal answers,
INS reports, or their own module's activity timeline — never by reading the
raw event stream directly (see §11).

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Manages subscriptions, diagnoses and redrives dead letters, configures retention above the statutory floor, executes replay for support/debugging |
| PR-29 Agent | Subscribes to events (via its INT-03 registration, never self-service) as its trigger substrate; every Watchdog, Forecaster, Reconciler and Guardian agent class (Vol 0 §27.1) is ultimately event-triggered here |
| PR-30 Integration Service Account | Subscribes to events on behalf of ITG-01 connectors and KRN-09 notification routing, for egress to external systems and channels |
| PR-25 External CA / Auditor | Consumes evidence *derived* from this module through SEC-06's scoped export, never the raw stream directly |
| PR-26 Regulator / Inspector | Same as PR-25 — scoped, derived, read-only, via SEC-06 |
| PR-28 Implementation Partner | Configures subscriptions for tenant-authored automations (STU-05) during onboarding, scoped to the tenant being provisioned |

Every other persona in the catalogue (PR-01..20, 22..24, 27) consumes KRN-06
only indirectly: every record they touch carries `trace_id`, `causation_id`
and `correlation_id` fields that make their own module's activity timeline,
KRN-10's audit trail, and INT-02's causal traversal possible — without any of
them ever opening an "event stream" screen themselves.

## 3. Scope in / scope out

**In scope:** the outbox-pattern write path; the append-only event store;
event schema registration and versioning; subscriptions (module, agent,
integration, webhook); at-least-once delivery with retry; per-subject
ordering guarantees; replay by subject, time range, correlation and event
type; dead-letter handling and administrator redrive; retention policy above
a statutory floor.

**Out of scope:** what audit evidence looks like to a human or how it is
exported (KRN-10 owns the audit trail UI and export; SEC-06 owns evidence
packs — both are *consumers* of KRN-06, not part of it); rule evaluation
triggered by an event (KRN-07 owns rule logic; it may subscribe here, but the
condition-action semantics are entirely KRN-07's); notification delivery to
a human (KRN-09 owns channel routing and subscribes here as a consumer, same
as any other module); business validation and authorisation on the write
that produces an event (owned by the producing module plus KRN-03 — KRN-06
never authorises a mutation, it only durably records that an already-
authorised one happened); reversal/compensation logic itself (KRN-18 owns
compensating transactions; an event's `reversal_handle` field points at
KRN-18, KRN-06 does not interpret it).

## 4. Entities owned; entities consumed

**Owned:** `event`, `event_schema`, `subscription`, `delivery_attempt`,
`dead_letter`, `outbox` (Vol 1, verbatim).

**Consumed (by ID):** `P-08 Event` — KRN-06 is the primitive's concrete
storage and delivery mechanism, not a consumer of it in the usual sense.
Consumes `tenant_id` scoping from **KRN-01** and the actor-reference shape
(`{type, id, version}`) from **KRN-02** on every event, but owns no data in
either module and never reads their tables directly (L3) — both are
resolved the same way every other module resolves them, through the
universal fields (Vol 2 §1.2).

### 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every entity below except `event`
itself, which is a primitive with its own complete field set (Vol 2 §P-08)
distinct from the universal envelope — an event is not "an entity that
happens to record a mutation," it *is* the record of the mutation, so it
carries its own `tenant_id`, `actor` and timestamps rather than inheriting
them generically.

**`event`** (Vol 2 §P-08, verbatim):

| Field | Type | Notes |
|---|---|---|
| `event_id` | UUIDv7 | |
| `tenant_id` | UUID | |
| `entity_id` | UUID | Legal entity (KRN-01) the event occurred within |
| `event_name` | string | `module.entity.verb_past` (Vol 0 §42) |
| `schema_version` | integer | Resolves against `event_schema` |
| `occurred_at` | timestamptz | Event time — when it happened in the world (Vol 2 §1.6) |
| `recorded_at` | timestamptz | Transaction time — when this store recorded it |
| `actor` | actor ref | `{type: user\|agent\|service, id, version}` |
| `subject_type` | string | The entity type the event is about |
| `subject_id` | UUID | The specific record |
| `payload` | JSONB | Schema-validated against `event_schema` |
| `causation_id` | UUID, nullable | The event that caused this one |
| `correlation_id` | UUID | The journey instance (Vol 0 §8, J-01..J-14) |
| `trace_id` | UUID | |
| `reversal_handle` | ref, nullable | KRN-18 compensating-transaction handle |

**`event_schema`** (extrapolated; not field-detailed in Vol 1/2 — flagged in
§17):

| Field | Type | Notes |
|---|---|---|
| `event_name` | string | |
| `version` | integer | Monotonic per `event_name` |
| `payload_schema` | JSONB | JSON Schema for `payload` validation |
| `compatibility_mode` | enum | `forward` — a version-N subscriber must tolerate version-N+1 payloads (KRN-06-FR-005) |
| `owning_module` | ref | The module authorised to publish this event name |
| `status` | enum | `draft` \| `active` \| `deprecated` |
| `effective_from` | timestamptz | |

**`subscription`** (extrapolated; not field-detailed in Vol 1/2 — flagged in
§17):

| Field | Type | Notes |
|---|---|---|
| `subscriber_type` | enum | `module` \| `agent` \| `integration` \| `webhook` |
| `subscriber_id` | ref | Resolves per `subscriber_type` (e.g. an `agent_identity` from KRN-02) |
| `event_pattern` | string | Exact name or wildcard, e.g. `mfg.job_work.*` |
| `filter_expression` | expression, nullable | Structured, evaluated against `payload` before delivery (same expression-tree shape as P-12, not free text) |
| `delivery_mode` | enum | `push` \| `pull` |
| `idempotency_key_field` | string | Which payload field the subscriber uses to de-duplicate at-least-once delivery (KRN-06-FR-004) |
| `status` | enum | `active` \| `paused` \| `disabled` |

**`delivery_attempt`** (extrapolated; not field-detailed in Vol 1/2 — flagged
in §17):

| Field | Type | Notes |
|---|---|---|
| `event_id` | ref | |
| `subscription_id` | ref | |
| `attempt_no` | integer | |
| `status` | enum | `pending` \| `succeeded` \| `failed` |
| `attempted_at` | timestamptz | |
| `latency_ms` | integer | |
| `error_code`, `error_message` | string, nullable | |

**`dead_letter`** (extrapolated; not field-detailed in Vol 1/2 — flagged in
§17):

| Field | Type | Notes |
|---|---|---|
| `event_id` | ref | |
| `subscription_id` | ref | |
| `failure_reason` | string | |
| `first_failed_at`, `last_attempted_at` | timestamptz | |
| `attempt_count` | integer | |
| `status` | enum | `open` \| `redriven` \| `discarded` |
| `redriven_by` | actor ref, nullable | **Human only — see §11** |
| `redriven_at` | timestamptz, nullable | |

**`outbox`** **[stack-bound: Postgres, polled/streamed by a pgmq- or
River-backed worker in the same transaction as the domain write per D-12]**
(extrapolated; not field-detailed in Vol 1/2 — flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `event_id` | ref | The `event` row this outbox entry publishes |
| `status` | enum | `pending` \| `published` |
| `published_at` | timestamptz, nullable | |

## 5. State machines

**`outbox.status`:** `pending → published`. Written in the same transaction
as the domain mutation and the `event` row (KRN-06-FR-001); a relay worker
publishes it to subscribers and marks it `published`. No other transition
exists — an outbox entry that fails to publish stays `pending` and is
retried by the worker, never rolled back, since the underlying mutation has
already committed.

**`delivery_attempt.status`:** `pending → succeeded | failed`, terminal per
attempt. A failed attempt does not mutate itself; a new `delivery_attempt`
row is created for the retry with an incremented `attempt_no`, preserving
full delivery history per subscription (consistent with the append-only
ethos of P-08).

**`dead_letter.status`:** created `open` once `attempt_count` exceeds the
subscription's configured retry ceiling (KRN-06-FR-007) → `redriven` (a new
`delivery_attempt` sequence starts against the same event/subscription; on
success the dead letter is not deleted, it stays a permanent record of the
failure and its resolution) or → `discarded` (terminal — an administrator
has decided the event will never be delivered to that subscriber). Both
`redriven` and `discarded` are terminal for that dead-letter record; a
subsequent failure of the same event/subscription pair creates a *new*
`dead_letter` row rather than reopening the old one, preserving history.

**`subscription.status`:** `active ↔ paused` (reversible, self-service by
the owning module/administrator), `active → disabled` (administrative,
requires explicit re-creation to resume — treated as end-of-life rather than
a pause, since a disabled subscription's un-delivered backlog is not
retained indefinitely).

## 6. Standard functional requirements

- `KRN-06-FR-001` Every mutation writes its event to the outbox within the same database transaction as the write. A mutation whose event is not durably recorded must not commit. *(Vol 1, verbatim)* — this is the mechanism behind L4; it is enforced at the data-access layer **[stack-bound: a single Postgres transaction covering the domain write and the `event`/`outbox` insert]**, not by application-level discipline, so a producing module cannot accidentally commit a mutation without its event.
- `KRN-06-FR-002` Events are append-only. No update or delete path exists in code. *(Vol 1, verbatim)* — no API, admin tool or migration path may modify or remove an `event` row once written; correction of a mistaken event is a new, compensating event (via KRN-18), never an edit.
- `KRN-06-FR-003` Ordering is guaranteed per subject; global ordering is not required. *(Vol 1, verbatim)* — events sharing a `subject_id` are delivered and replayable in `occurred_at` order (with a monotonic tie-break, see KRN-06-FR-011 addition); no ordering guarantee is made or needed across unrelated subjects.
- `KRN-06-FR-004` Delivery is at-least-once; subscribers declare idempotency keys. *(Vol 1, verbatim)* — a subscriber may receive the same event more than once (retry after an ack is lost, worker restart) and must de-duplicate on `subscription.idempotency_key_field`; KRN-06 does not guarantee exactly-once delivery.
- `KRN-06-FR-005` Schemas are versioned with forward compatibility; a subscriber on version N tolerates events at version N+1. *(Vol 1, verbatim)* — `event_schema.compatibility_mode: forward` means version N+1 may add optional fields but never remove or retype a version-N field; a breaking payload change requires a new `event_name`, not a version bump.
- `KRN-06-FR-006` Replay is supported by subject, time range, correlation and event type, without side effects on non-targeted subscribers. *(Vol 1, verbatim)* — replay re-delivers matching `event` rows to a nominated subscription only; it never re-triggers every live subscriber of that event type, and it never re-executes the original mutation (only its already-recorded event is redelivered).
- `KRN-06-DR-001` `causation_id` and `correlation_id` allow any journey (J-01..J-14) to be reconstructed end to end. This is what makes causal answers and journey testing possible. *(Vol 1, verbatim)*
- `KRN-06-FR-007` Dead letters are visible, diagnosable and re-drivable by an administrator. *(Vol 1, verbatim)* — "by an administrator" is read strictly: no other persona, and no agent regardless of trust ceiling, may redrive or discard a dead letter (see §11).

**Additions** (beyond Vol 1's abbreviated form, minimal, per Vol 6 §4):

- `KRN-06-FR-008` Subscriptions declare an exact or wildcard `event_pattern` and an optional structured `filter_expression` (same expression-tree discipline as P-12 — never free text, never executable code) evaluated against `payload` before a delivery attempt is created.
- `KRN-06-FR-009` Event retention is tenant-configurable above a statutory floor (Vol 2 §P-08). The floor value itself is not given anywhere in Vol 0/1/2 and must be confirmed before this requirement can be implemented precisely (flagged in §17).
- `KRN-06-FR-010` Every event read — including by an agent or an integration service account — resolves tenant, role and row scope before returning results (L11); no unscoped read path over the event store exists at any privilege level, including PR-21.
- `KRN-06-FR-011` Events accepted from offline sync (KRN-16, per Vol 0 §9.2) preserve `occurred_at` as event time distinct from `recorded_at` as transaction time, which may differ by hours; per-subject replay ordering (KRN-06-FR-003) uses `occurred_at` plus a sync-assigned monotonic sequence, not `recorded_at`, so a batch of offline-captured events sorts correctly even when it arrives out of capture order relative to other devices. Flagged in §17 pending confirmation against KRN-16's conflict-resolution design.

## 7. Differentiating requirements

- `KRN-06-DR-001` `causation_id` and `correlation_id` allow any journey (J-01..J-14) to be reconstructed end to end. This is what makes causal answers and journey testing possible. *(Vol 1, verbatim — repeated here per the Vol 0 §1 template's separation of §6 standard and §7 differentiating; it is the same requirement, classified as differentiating in Vol 1's own text.)*
- `KRN-06-DR-002` (addition, drawn from Vol 0 §11's KRN-06 catalogue entry) The event store is the single source consumed simultaneously by audit (KRN-10), analytics (KRN-17), agent triggers (INT-03), simulation (INT-05) and undo (KRN-18) — no module maintains a parallel changelog of its own mutations. A competitor without one data model needs five separate mechanisms for these five capabilities; here they are five subscribers to one store.

## 8. Agents

None. KRN-06 is structural kernel infrastructure with no autonomous
behaviour of its own, consistent with the pattern in KRN-01. It is however
the trigger substrate for every agent class in the catalogue (Vol 0 §27.1):
a Watchdog reacts to an event stream, a Reconciler to data arrival, a
Guardian continuously to a filtered subscription — all of that registration
and execution lives in INT-03, not here. Per `KRN-06-FR-007`, no agent —
regardless of registered trust ceiling (L9) — may redrive or discard a dead
letter; that action has no corresponding tool in any agent's declared tool
set (Vol 0 §27.2), it is not merely permission-denied at evaluation time.

## 9. Screens and flows

All screens are KRN-13-generated from KRN-04 metadata (L6), including the
administrative surfaces below despite their infrastructural nature:

- **Event Explorer** (list + detail, filterable by `subject_type`,
  `subject_id`, `event_name`, `correlation_id`, `causation_id`, time range)
  — PR-21 and PR-30 (own subscription's relevant events only).
- **Subscriptions** (list + form) — PR-21 full; PR-30 restricted to its own
  integration's subscriptions.
- **Dead-letter queue** (list + detail, redrive/discard actions) — PR-21
  only.
- **Replay tool** (form: subject / time range / correlation / event type →
  target subscription) — PR-21 only, always logged.
- **Event schema registry** (read-only list; see §17 on whether registration
  itself is ever a runtime screen action versus a deployment-time artefact).

A timeline/causal-chain visualisation (replaying `causation_id` links as a
graph, the way KRN-06-DR-001's acceptance criterion describes) is not a
standard KRN-13 view type in the catalogue as read; flagged in §17 as a
possible extension point KRN-13 needs for this module specifically.

## 10. API surface

Base per Vol 0 §42: `/api/v1/core/{entity}`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/core/events` | Filtered, tenant/role/row-scoped (KRN-06-FR-010); cursor-paginated |
| GET | `/api/v1/core/events/{id}` | |
| — | *(no POST/PATCH/DELETE on `events`)* | No direct write path exists. The only route to a new event is a mutation in a producing module's own transaction (KRN-06-FR-001) — this is a deliberate absence, not an oversight |
| CRUD | `/api/v1/core/subscriptions` | Create/pause/disable; scoped per §11 |
| GET | `/api/v1/core/event-schemas` | Read-only at runtime; see §17 on whether registration is ever exposed here versus being a deployment-time/STU-10 artefact |
| POST | `/api/v1/core/replay` | `{subject_id?, time_range?, correlation_id?, event_type?, target_subscription_id}` — PR-21 only, async (KRN-15) |
| GET | `/api/v1/core/dead-letters` | |
| POST | `/api/v1/core/dead-letters/{id}/redrive` | PR-21 only (KRN-06-FR-007) |
| POST | `/api/v1/core/dead-letters/{id}/discard` | PR-21 only |

All list endpoints: cursor pagination, declared filters, field selection
(Vol 1 §1.2). All writes: idempotency key required.

## 11. Permission matrix by persona

Per the hard constraint that this module is unusually integrity-critical
(P-08 is append-only and immutable, the spine of T3): read access is broad
enough that every module and integration can trace its own events, but
write, replay and dead-letter actions are tightly scoped — there is no
human write path at all for normal event creation (only the transactional
outbox pattern, invoked by a producing module's own mutation), and redrive/
discard is PR-21-only with no exceptions.

| Persona | event.read (raw, own scope) | subscription.create/manage | replay.execute | dead_letter.read | dead_letter.redrive/discard | event_schema.register |
|---|---|---|---|---|---|---|
| PR-21 System Admin | ✓ tenant-wide | ✓ | ✓ | ✓ | ✓ | ✗ *(see §17 — likely deployment-time, not a runtime grant to anyone)* |
| PR-29 Agent | ✓ own declared data scope only, via its registered subscription — never ad hoc query | ✗ (registered through INT-03/STU-07, never self-service) | ✗ | ✗ | ✗ | ✗ |
| PR-30 Integration Service Account | ✓ own subscription scope | ✓ own integration's subscriptions only | ✗ | ✓ own subscription's dead letters | ✗ | ✗ |
| PR-25 External CA / Auditor | ✗ no raw stream — reads via SEC-06 scoped evidence export | ✗ | ✗ | ✗ | ✗ | ✗ |
| PR-26 Regulator / Inspector | ✗ same as PR-25, via SEC-06 | ✗ | ✗ | ✗ | ✗ | ✗ |
| PR-28 Implementation Partner | ✓ own tenant, provisioning window only | ✓ own tenant, provisioning window only | ✗ | ✗ | ✗ | ✗ |
| All other internal/external personas (PR-01..20, 22..24, 27) | ✗ no direct raw-stream screen — consume indirectly via KRN-10 audit trail, module timelines, INT-02 Copilot, and reports, each independently scope-checked (L11) | ✗ | ✗ | ✗ | ✗ | ✗ |

**Negative cases:**
- Any persona other than PR-21 calling `POST /dead-letters/{id}/redrive` or `/discard` → 403, audited (KRN-10), dead-letter state unchanged.
- Any actor attempting a "create event" API call (none is exposed) → 404, since no such endpoint exists; the only path to a new event is a mutation within a producing module's own transaction (L4).
- PR-29 Agent attempting to read events outside its registered `data_scope` (KRN-03-DR-002) → 403; the attempt itself is recorded as an event, closing the loop on L9's requirement that an agent never act above its trust ceiling.
- PR-30 Integration Service Account attempting to manage a subscription belonging to a different service account → 403.
- Any actor attempting to bypass replay's `target_subscription_id` to broadcast to every live subscriber of an event type → rejected at the API layer (KRN-06-FR-006's "without side effects on non-targeted subscribers").

## 12. Events emitted / consumed

**Emitted:** Vol 1 gives no explicit **Events:** line for KRN-06 — unusual,
since every other kernel module section in Part 2 has one, and is flagged in
§17. This draft proposes a minimal set of *administrative* events for
KRN-06's own lifecycle actions (subscription and dead-letter management,
replay, schema changes), on the reasoning that L4 ("never emit a state
change without an event") applies to KRN-06's own mutations exactly as it
applies to every other module's — KRN-06 is not exempt from the law it
enforces on everyone else:

- `core.event_bus.subscription_created`, `.paused`, `.disabled`
- `core.event_bus.dead_letter_created` (when a delivery permanently exceeds its retry ceiling)
- `core.event_bus.dead_letter_redriven`, `.discarded`
- `core.event_bus.replay_executed`
- `core.event_bus.schema_registered`, `.deprecated`

These events themselves flow through the same outbox pattern as any other
module's mutations (KRN-06-FR-001) — recursive, but consistent.

**Consumed:** none. KRN-06 distributes events; it does not subscribe to
other modules' streams. Every module's mutation reaches the event store
through the outbox pattern inside that module's own transaction, which is
not the same as KRN-06 "consuming" that module's events — it is the
recording mechanism, not a subscriber.

## 13. Reports and KPIs

- Event volume by module and `event_name` (platform-operational, PR-21).
- Delivery success rate and p95 delivery latency per subscription.
- Dead-letter count and age (time in `open` status) — an ops health
  indicator; a growing dead-letter backlog for a given subscriber signals a
  broken downstream consumer before it is discovered any other way.
- Replay operations log (who, when, what scope) — feeds SEC-06 evidence.
- Schema version adoption — how many subscribers remain on an older, still
  forward-compatible schema version.
- Event-time-to-recorded-time lag distribution, specifically for
  offline-sync-originated events (KRN-06-FR-011), surfaced to help
  administrators judge whether field connectivity is degrading.

Not tenant-facing business KPIs in the ordinary sense (unlike e.g. MFG-08's
margin reporting); this is platform/tenant-ops health, visible to PR-21.

## 14. Compliance touchpoints

- KRN-10 (Audit & Immutable Log) reads KRN-06 as its primary and sole
  source of truth for the mutation trail — KRN-06 does not itself present
  audit evidence, but every guarantee KRN-10 makes (tamper-evident,
  complete, attributable) rests on KRN-06-FR-001 and FR-002 holding exactly.
- CMP-06 (Regulated Records) — the append-only, immutable guarantee this
  module provides (KRN-06-FR-002) is the load-bearing foundation CMP-06's
  validated-audit-trail requirement is built on for VRT-05..08. Any weakening
  of KRN-06's immutability guarantee is a Phase III go/no-go risk, not merely
  a Phase 0 concern (Vol 0 §31 regulated-verticals note).
- SEC-06 (Audit & Evidence) exports scoped evidence packs for PR-25/PR-26,
  sourced entirely from this module's `event` table filtered through KRN-03
  row scope.
- CMP-05 (Statutory Filings) reconstructs GST-relevant transaction history
  for reconciliation by querying events, not by reading FIN/SCM tables
  directly (L3).
- Retention floor (KRN-06-FR-009) must meet whatever statutory record-
  retention period applies (GST records, Companies Act books of account) —
  the specific number is not given anywhere in Vol 0/1/2 and is flagged in
  §17.

## 15. Offline behaviour

**Profile: `online`.** No persona interacts with KRN-06 directly while
disconnected — it has no field-capture surface of its own, and none of the
offline-first personas (PR-04, 05, 07, 09, 13, 19, 20 — Vol 0 §7.3) open an
"event" screen. However, KRN-06 is the mandatory downstream target every
offline-`full` module's sync (KRN-16) writes into once connectivity returns,
and it must behave correctly under that load specifically:

- Accept events whose `occurred_at` precedes `recorded_at` by hours, per Vol
  2 §1.6's own worked example ("production logged offline at 14:05, synced
  at 19:30").
- Preserve correct per-subject ordering across devices that synced at
  different times, using `occurred_at` plus a sync-assigned sequence rather
  than arrival order (KRN-06-FR-011).
- Never reject a late-arriving offline event solely because the gap between
  `occurred_at` and `recorded_at` is large — a large gap is expected
  behaviour for this profile, not an anomaly to police here (anomaly
  detection on unreasonable gaps, if wanted, is INT-09's job, not KRN-06's).

The actual conflict-resolution policy (last-writer-wins vs
server-authoritative vs queued-for-review, Vol 0 §9.2) is owned by KRN-16
and by each offline-capable module's own declared policy — KRN-06 only
guarantees it will durably and correctly order whatever KRN-16 hands it.

## 16. Acceptance criteria (Given/When/Then)

**KRN-06-FR-001 — outbox pattern, atomic with the domain write**
> Given a producing module (e.g. MFG-05) commits a job-work challan dispatch
> When the database transaction for that write is committed
> Then exactly one `event` row (`mfg.job_work.dispatched`) and its `outbox` entry exist in the same transaction, and if the transaction were to roll back for any reason, neither the challan write nor the event would exist.

**KRN-06-FR-002 — append-only, no update/delete path**
> Given an existing `event` row
> When any actor, including PR-21, attempts an UPDATE or DELETE against it through any exposed path
> Then the attempt is rejected at the data-access layer with no code path capable of succeeding, and the rejection itself is logged.

**KRN-06-FR-003 — per-subject ordering**
> Given three events on `subject_id = WO-1042` with `occurred_at` at 09:00, 09:05 and 09:10
> When they are replayed for that subject
> Then they are returned in that exact order regardless of `recorded_at`, and no ordering guarantee is asserted or needed relative to events on a different subject.

**KRN-06-FR-004 — at-least-once delivery, subscriber idempotency**
> Given a subscription with `idempotency_key_field: event_id`
> When a delivery attempt succeeds but the acknowledgement is lost, causing a redelivery of the same event
> Then the subscriber receives the event twice, de-duplicates on `event_id`, and processes the side effect exactly once.

**KRN-06-FR-005 — forward-compatible schema versioning**
> Given a subscriber built against `event_schema` version 2 of `fin.invoice.issued`
> When the schema is promoted to version 3 adding one optional field
> Then the version-2 subscriber continues to process version-3 events without modification, ignoring the new field.

**KRN-06-FR-006 — scoped replay without side effects**
> Given 500 events on `correlation_id = J10-8842` and 10 live subscriptions to `mfg.job_work.*`
> When PR-21 replays that correlation to one nominated subscription for diagnosis
> Then only the nominated subscription receives redelivered events, the other 9 subscriptions receive nothing, and no original mutation is re-executed.

**KRN-06-DR-001 — journey reconstruction (Vol 1's sample, in full)**
> Given order O-1042 that moved through quote, order, production, dispatch and invoice across five modules
> When the journey is reconstructed by `correlation_id`
> Then every event appears in causal order, each with its actor and `causation_id` pointing to its immediate predecessor, the chain is complete with no orphan events, and the reconstruction matches exactly what INT-02's causal traversal and the journey test suite (J-01..J-14) both independently produce from the same `correlation_id`.

**KRN-06-FR-007 — dead letters visible, diagnosable, PR-21-redrivable only**
> Given a subscription whose delivery attempts have exceeded the configured retry ceiling for a given event
> When the event moves to `dead_letter.status: open`
> Then it is visible in the Dead-letter queue with `failure_reason` and full attempt history, PR-21 can redrive or discard it, and no other persona or agent can perform either action (§11 negative cases).

**KRN-06-FR-008 (addition) — subscription filtering**
> Given a subscription with `event_pattern: scm.stock.*` and `filter_expression: quantity_delta < 0`
> When a `scm.stock.adjusted` event with a positive `quantity_delta` is published
> Then no delivery attempt is created for that subscription, while a matching negative-`quantity_delta` event does create one.

**KRN-06-FR-009 (addition) — retention above statutory floor**
> Given a tenant configures event retention at 10 years, above whatever statutory floor is confirmed per §17
> When a query requests events older than the statutory floor but within the tenant's configured 10 years
> Then they remain readable; a request for retention below the statutory floor is rejected at configuration time, not silently capped.

**KRN-06-FR-010 (addition) — scoped read enforced universally**
> Given PR-29 Agent `MFG-AG-05` with a declared data scope limited to job-work subjects
> When it queries `/api/v1/core/events` for a `fin.invoice.issued` event outside that scope
> Then the query returns no result for that event (L11), identically to how a human user's KRN-03 scope would be enforced.

**KRN-06-FR-011 (addition) — offline event-time ordering**
> Given a shop-floor tablet (MFG-04, offline-`full`) captures three production confirmations at 10:00, 10:15 and 10:30 while disconnected, then syncs at 14:00
> When those three events are written to the event store
> Then their `occurred_at` values remain 10:00/10:15/10:30, their `recorded_at` values are all near 14:00, and replay for that subject orders them by `occurred_at` (10:00, 10:15, 10:30), not by arrival.

**KRN-06-DR-002 (addition) — one store, five consumers**
> Given a single `mfg.job_work.dispatched` event
> When KRN-10 (audit), KRN-17 (analytics), INT-03 (an agent trigger), INT-05 (simulation) and KRN-18 (undo eligibility) each independently query it
> Then all five read the identical, unmodified event record, and none of the five maintains its own parallel copy of "what happened."

## 17. Open questions

Flagged per Vol 6 §4/L13 — gaps in Vol 1/2's field-level and behavioural
detail that this draft filled by reasonable extrapolation. They should be
confirmed or corrected by the human before this Vol 3 file is treated as
binding:

1. **`event_schema`, `subscription`, `delivery_attempt`, `dead_letter`,
   `outbox` field tables** (§4.1) are not given at field level anywhere in
   Vol 1/2 — only the entity names and their role are stated. The fields
   proposed here are a reasonable minimum consistent with the stated FR set,
   not a verbatim source. Please confirm or amend.
2. **Vol 1's KRN-06 section has no explicit `Events:` line**, unlike every
   other kernel module in Part 2 (including KRN-07, which has one but no
   acceptance sample — see that file's §17). This draft proposes a minimal
   set of administrative events for KRN-06's own subscription/dead-letter/
   replay/schema actions (§12) on the reasoning that L4 applies to KRN-06's
   own mutations too. Confirm this is the intended scope, or whether KRN-06
   is deliberately meant to emit nothing about itself.
3. **Statutory retention floor value** (KRN-06-FR-009) — Vol 2 §P-08 states
   only "above a statutory floor" without a number. Needs the actual
   applicable period(s) (e.g. GST record retention, Companies Act books-of-
   account retention) before this requirement can be implemented precisely.
4. **Whether `event_schema` registration is ever a runtime API action** for
   any actor, or purely a deployment-time/STU-10 change-control artefact
   alongside KRN-04's own schema versioning. This draft assumes the latter
   (§10, §11 — `event_schema.register` is ✗ for every persona including
   PR-21) since allowing a runtime schema registration path looks
   inconsistent with L6/L10's spirit even for platform-owned event names.
   Confirm.
5. **Ordering mechanism for offline-synced events across devices**
   (KRN-06-FR-011) is inferred from Vol 0 §9.2's general offline contract
   and Vol 2 §1.6's temporality model, not specified for KRN-06 itself.
   Confirm this reconciles with KRN-16's actual conflict-resolution design
   once KRN-16 is drafted.
6. **Dead-letter threshold** — the retry-attempt count after which a failed
   `delivery_attempt` sequence becomes a `dead_letter` is not specified
   anywhere in Vol 1/2. A default (proposed: configurable per subscription,
   platform default 5 attempts with exponential backoff) needs confirmation.
7. **KRN-13 view-type coverage for a causal-chain/timeline visualisation**
   (§9) — the Event Explorer's most valuable use case (walking
   `causation_id` links as a graph, per KRN-06-DR-001) may not be expressible
   in KRN-13's current standard view catalogue (list, form, kanban, calendar,
   timeline, dashboard — Vol 0 §11 KRN-13). Confirm whether "timeline" as
   listed there already covers this or whether a new declared view type is
   needed.
