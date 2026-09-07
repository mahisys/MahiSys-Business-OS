# KRN-05 · Process Engine

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:**
KRN-01 (tenant/legal-entity scoping), KRN-04 (the subject entities a process
instance governs are catalogued there — an `entity_definition` may reference
a `process_definition` via `state_machine_id`), KRN-06 (every state
transition emits an event within the same transaction, L4), KRN-07 (guard
expressions reference Rules Engine rule IDs — KRN-05-DR-002 below), KRN-12
(business calendars and holidays that SLA clocks read).

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-05)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

State machines, approval matrices, SLAs and escalation for every module. This
is the engine behind `P-07 Process` (Vol 0 §6, Vol 2 §P-07) — every pipeline,
ticket lifecycle, hiring flow, routing, discharge and file movement in the
system is a `process_definition` plus running `process_instance`s, not a
bespoke state machine written inside a module. It is also the reason routine
approvals can disappear: a transition may nominate an agent as approver at a
declared trust level (KRN-05-DR-001), with the ceiling itself enforced by
`INT-04`, never by the agent or by KRN-05 trusting the agent's own claim (L9).

Not bought directly — `included` platform substrate every module with a
lifecycle depends on (Vol 0 §11). The buyer is every tenant implicitly. The
direct "user" of its configuration surface is PR-21 (business calendars,
escalation policy) and, through STU-02 (Workflow Designer), any persona
authoring or adjusting a workflow; the far larger population of users
interacts with KRN-05 daily as approvers, through their module's own screens
(their "My Approvals" queue) rather than through anything KRN-05-branded.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Configures business calendars/holidays feeding SLA clocks (data owned by KRN-12, consumed here), escalation policy defaults, and reviews stuck/breached process instances platform-wide |
| PR-01 Owner / Director | Approves items routed to them above a threshold, from mobile, as an exception-only activity (Vol 0 §7.1) |
| PR-02 Functional Head (CXO) | Approves within their function's approval matrix; escalation target when an SLA breaches inside their function |
| PR-03 Plant / Production Head | Approves shop-floor exceptions (e.g. rework beyond a limit) routed through a `process_instance` on a `MFG` document |
| PR-06 Purchase Officer | Initiates and tracks process instances on purchase documents (PO approval, vendor onboarding) |
| PR-08 Sales Manager | Approves discount/credit exceptions routed by a `SLS` approval matrix |
| PR-16 Finance Controller / CFO | Approves financial thresholds; owns escalation policy for finance-routed approvals; the human backstop when an agent-approver escalates (KRN-05-DR-001) |
| PR-17 HR Manager | Owns approval matrices for `PPL` processes (leave, expense-adjacent HR cases) |
| PR-28 Implementation Partner | Authors `tnt` `process_definition`s via STU-02 during onboarding, scoped to the tenant/manifest being built |
| PR-29 Agent | Acts as a declared approver on a transition, within its registered trust ceiling, never above it and never self-promoting (L9, KRN-05-DR-001) |

Every internal persona in the system is a potential approver at some point —
KRN-05's "My Approvals" surface is universal, not role-specific, which is why
this table lists representative, not exhaustive, personas. Any persona named
in an `approval_matrix` for a given process participates identically.

## 3. Scope in / scope out

**In scope:** process definitions with versioned, effective-dated states and
transitions; guards, pre/post actions and role- or agent-based transition
authorisation; approval matrices (sequential, parallel, quorum, conditional)
with delegation and out-of-office handling; SLA clocks respecting business
calendars, with at-risk and breach events; append-only state history; the
declared mechanism by which a transition nominates an agent as approver at a
trust level and records its decision with confidence, evidence and a
rollback handle; reassignment and manual admin escalation of a stuck
approval.

**Out of scope:** the condition-expression grammar a guard evaluates (`KRN-07
Rules Engine` owns the language; KRN-05 stores and evaluates a reference to
it, it does not define expression syntax — KRN-05-DR-002); the visual/
natural-language authoring surface for building a workflow (`STU-02
Workflow Designer` — KRN-05 is the API and runtime it targets); business
calendar and holiday master data itself (`KRN-12 Masters & Reference Data`
owns the calendar; KRN-05 reads `calendar_id` to compute SLA due dates);
enforcing an agent's trust ceiling (`INT-04 Trust Ladder & Governance` is the
enforcement point; KRN-05 only records that a transition *may* nominate an
agent and at what declared level — the ceiling check itself happens in
INT-04, mirroring L9's requirement that ceilings are enforced there, not in
agent or caller code); the content and lifecycle identity of the document or
record the process governs (owned by the respective module per L3 — KRN-05
knows only `subject_type`/`subject_id`); notification delivery of an
approval request (`KRN-09 Notification & Communication Hub` delivers it;
KRN-05 raises the event it delivers).

## 4. Entities owned; entities consumed

**Owned:** `process_definition`, `process_state`, `process_transition`,
`process_instance`, `approval_matrix`, `approval_request`, `sla_policy`,
`escalation_rule`, `state_history`.

**Consumed (by ID):** `KRN-07` rule definitions, referenced by ID from a
`process_transition.guard` (KRN-05-DR-002 below) and evaluated synchronously,
not subscribed to as events; `KRN-12` business calendars, referenced by ID
from an `sla_policy.calendar_id` and read synchronously to compute business-
day-aware SLA due dates; `KRN-04` entity definitions, referenced implicitly
whenever a `process_instance.subject_type` names an entity KRN-04 catalogues
— KRN-05 does not require the subject entity to declare `state_machine_id`
back to it (that reference is optional metadata on the KRN-04 side), it only
requires `subject_type`/`subject_id` to resolve to *some* record.

### 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every entity below and are not
repeated per field table.

**`process_definition`** (Vol 1 names the entity; field shape combines Vol 1
§KRN-05's requirement text with Vol 2 §P-07's "Definition entity" fields,
verbatim where Vol 2 gives them):

| Field | Type | Notes |
|---|---|---|
| `process_type_id` | ref | What kind of process this is (approval matrix template, ticket lifecycle, hiring flow, etc.) — manifest-declarable vocabulary |
| `name` | string | |
| `subject_entity_id` | ref | The `KRN-04 entity_definition` this process typically governs — advisory, not a hard constraint on `process_instance.subject_type` |
| `approval_matrix_id` | ref, nullable | |
| `escalation_rule_ids` | list<ref> | |
| `namespace` | enum | `sys` \| `tnt` |
| `version` | integer | Definitions are versioned (KRN-05-FR-001) |
| `effective_from` | date | |
| `status` | enum | Extrapolated — see §5 and §17.2 |

**`process_state`** (child of `process_definition`; realises Vol 2 §P-07's
`states` list field as a normalized table — extrapolated, flagged in §17.1):

| Field | Type | Notes |
|---|---|---|
| `process_definition_id` | ref | |
| `code`, `name` | string | |
| `is_initial` | boolean | Exactly one per definition |
| `is_terminal` | boolean | Zero or more per definition |
| `sla` | object, nullable | `{duration, calendar_id}` — the default `sla_policy` for time spent in this state |
| `namespace` | enum | `sys` \| `tnt` — a `tnt`-namespaced state must fit within the `sys` definition's declared transition set (KRN-05-FR-005) |

**`process_transition`** (child of `process_definition`; realises Vol 2
§P-07's `transitions` list field as a normalized table — extrapolated,
flagged in §17.1):

| Field | Type | Notes |
|---|---|---|
| `process_definition_id` | ref | |
| `from_state_id`, `to_state_id` | ref | |
| `guard_rule_id` | ref, nullable | `KRN-07` rule reference (KRN-05-DR-002) |
| `pre_actions`, `post_actions` | list | Declarative action references, not inline code |
| `allowed_roles` | list<ref> | `KRN-03` roles authorised to perform this transition |
| `allowed_agents` | list<ref> | `agent_identity` (`KRN-02`) entries, each with its own declared trust level for this transition |

**`process_instance`** (Vol 2 §P-07 "Instance entity", verbatim, plus a
`lifecycle_status` field — extrapolated, flagged in §17.2):

| Field | Type | Notes |
|---|---|---|
| `process_definition_id` | ref | Pinned to the version the instance started under (KRN-05-FR-001) |
| `subject_type`, `subject_id` | ref | The document/record this instance governs |
| `current_state` | ref | Points into `process_state` for the pinned definition version |
| `entered_state_at` | timestamptz | |
| `sla_due_at` | timestamptz, nullable | Computed from `sla_policy` + `KRN-12` calendar |
| `assigned_to` | actor ref, nullable | |
| `approval_state` | enum | Rolls up the instance's current `approval_request`(s) |
| `lifecycle_status` | enum | Extrapolated — see §5 and §17.2 |
| `history` | — | Realised as the append-only `state_history` child, not an inline field |

**`approval_matrix`** (extrapolated; Vol 1 states the routing types it must
support, not its field shape — flagged in §17.1):

| Field | Type | Notes |
|---|---|---|
| `process_definition_id` | ref | |
| `routing_type` | enum | `sequential` \| `parallel` \| `quorum` \| `conditional` (KRN-05-FR-003) |
| `steps` | list | `{step_no, approver_rule, quorum_count, condition}` — `approver_rule` resolves to a role, an org-unit-relative role ("reporting manager"), or a specific agent |
| `delegation_policy_ref` | ref | References `KRN-03 delegation` semantics rather than reimplementing them |

**`approval_request`** (extrapolated; flagged in §17.1):

| Field | Type | Notes |
|---|---|---|
| `process_instance_id` | ref | |
| `step_no` | integer | Position within the `approval_matrix` |
| `assigned_to` | actor ref | User, agent or a resolved role-holder |
| `status` | enum | `pending` \| `approved` \| `rejected` \| `delegated` \| `reassigned` \| `expired` |
| `decided_at` | timestamptz, nullable | |
| `decision_note` | string, nullable | |
| `confidence` | decimal, nullable | Populated only when `assigned_to` is an agent (KRN-05-DR-001) |
| `evidence` | JSONB, nullable | Agent decisions only — the input evidence behind the decision |
| `reversal_handle` | ref | `KRN-18` compensating-transaction reference (L5) |

**`sla_policy`** (extrapolated; flagged in §17.1):

| Field | Type | Notes |
|---|---|---|
| `process_state_id` or `process_definition_id` | ref | Scope of the policy |
| `duration` | interval | |
| `calendar_id` | ref | `KRN-12` business calendar |
| `at_risk_threshold_pct` | decimal | When `process.sla.at_risk` fires, ahead of breach |

**`escalation_rule`** (extrapolated; flagged in §17.1):

| Field | Type | Notes |
|---|---|---|
| `sla_policy_id` | ref | |
| `trigger` | enum | `at_risk` \| `breached` |
| `escalate_to` | actor ref or role | |
| `action` | enum | `notify` \| `reassign` \| `escalate_to_next_level` |

**`state_history`** (Vol 1, verbatim fields):

| Field | Type | Notes |
|---|---|---|
| `process_instance_id` | ref | |
| `from_state_id`, `to_state_id` | ref | |
| `actor` | actor ref | User, agent or service account (Vol 2 §1.2) |
| `occurred_at` | timestamptz | |
| `duration_in_prior_state` | interval | |
| `reason` | string, nullable | |

## 5. State machines

KRN-05 *is* the generic state-machine engine, so its own entities carry two
distinct layers of state that must not be conflated:

**The state a `process_instance` is *in*** (`current_state`) is entirely
defined by whichever `process_definition` version the instance was started
under (KRN-05-FR-001) — KRN-05 imposes no fixed vocabulary here, since every
module defines its own states and transitions.

**`process_instance.lifecycle_status`** (extrapolated — a meta-status layered
over `current_state`, flagged in §17.2): `running → completed | cancelled`,
with `completed` reached automatically the moment `current_state` becomes a
`process_state` with `is_terminal: true`, and `cancelled` reachable only
through an explicit admin action (§10, §11) distinct from any declared
transition — cancellation is not itself a business transition and is always
audited and reversible (L4, L5). Both `completed` and `cancelled` are
terminal; a finished instance is never resumed, a new instance is started
instead (mirroring KRN-01's stance on `tenant.status: closed`).

**`process_definition.status`** (extrapolated, flagged in §17.2): `draft →
published → effective → superseded | retired`. `effective` is reached at
`effective_from`; `published → effective` requires no further action beyond
the date passing. `superseded` occurs when a later version becomes
`effective` for the same `process_type_id` within the same namespace scope;
already-running instances remain pinned to the version they started under
and complete on it (KRN-05-FR-001) — a superseded definition is never
retroactively applied to a running instance.

**`approval_request.status`**: `pending → approved | rejected | delegated |
reassigned | expired`. `delegated` and `reassigned` both re-spawn a new
`pending` request for the delegate/new assignee while the original closes in
that terminal state, preserving a complete `state_history`-equivalent trail
for approvals specifically (via `decided_at`/`decision_note` on the closed
request).

**SLA state** (not a persisted status field but the behaviour `sla_policy`
and `escalation_rule` together produce): `on_track → at_risk → breached`,
computed continuously against `sla_due_at` and the governing business
calendar; `at_risk` and `breached` both fire exactly once per crossing
(KRN-05-FR-004) and both are eligible for `escalation_rule` triggers.

## 6. Standard functional requirements

- `KRN-05-FR-001` Definitions are versioned and effective-dated; running instances complete on the version they started under. *(Vol 1, verbatim)*
- `KRN-05-FR-002` Transitions support guards (rule expressions), pre/post actions, and role or agent authorisation. *(Vol 1, verbatim)*
- `KRN-05-FR-003` Approval matrices support sequential, parallel, quorum and conditional routing, with delegation and out-of-office handling. *(Vol 1, verbatim)*
- `KRN-05-FR-004` SLA clocks respect business calendars, holidays and pauses; breach and near-breach both emit events. *(Vol 1, verbatim)*
- `KRN-05-FR-005` Tenant-added states carry `namespace: tnt` and must fit the declared transition set, keeping customised workflows upgrade-safe. *(Vol 1, verbatim)*
- `KRN-05-FR-006` State history is append-only and includes actor, timestamp, duration in prior state, and reason. *(Vol 1, verbatim)*
- `KRN-05-FR-007` **Addition, not in Vol 1's requirement list**, but explicitly promised in Vol 0 §11's KRN-05 "Standard" line ("...delegation, escalation timers, SLA clocks with business calendars, **reassignment**"): an `approval_request` may be reassigned — either by the current assignee to a named colleague, or by an administrator when an assignee is unreachable — fully audited via `state_history`-equivalent tracking on the request, distinct from out-of-office delegation (KRN-05-FR-003) and from automatic SLA-driven escalation (KRN-05-FR-004).

## 7. Differentiating requirements

- `KRN-05-DR-001` A transition may nominate an agent as approver at a declared trust level; the agent's decision is recorded with confidence and evidence, and is reversible. *(Vol 1, verbatim)*
- `KRN-05-DR-002` **Addition, not in Vol 1.** A transition's guard is a reference to a `KRN-07` rule ID, never an inline expression owned by KRN-05 — this is what makes a guard inspectable and reusable across `process_definition`s in the same way KRN-04-FR-004 makes a computed field inspectable, and keeps the boundary in §3 (KRN-07 owns the expression grammar) real rather than aspirational.

## 8. Agents

None registered by KRN-05 itself. KRN-05 is the runtime *through* which
module-owned agents act as approvers (`SLS-AG-*`, `MFG-AG-*`, `FIN-AG-*`,
`CMP-AG-01`, etc., Vol 0 §27.4, and tenant-authored agents via `STU-07`) —
each such agent is registered in `INT-03`, governed by `INT-04`, and
attributed via `KRN-02 agent_identity`. KRN-05 records the decision
(`approval_request.confidence`/`evidence`) but declares no agent of its own,
the same structural pattern KRN-01 and KRN-04 follow.

## 9. Screens and flows

All screens are KRN-13-generated from KRN-04 metadata (L6). Standard views:

- **My Approvals** (list, personal queue) — every persona with a routed
  `approval_request`: approve, reject, delegate, request more information,
  all in one tap where the request is simple (Vol 0 §9.3's WhatsApp
  approval-in-thread pattern targets exactly this screen's underlying API).
- **Process instance timeline** (embedded widget on the governing document's
  own screen, not a standalone KRN-05 screen) — renders `state_history` as an
  activity trail; visible to any persona who can read the subject document,
  scoped by the document's own permission, not a separate KRN-05 grant.
- **SLA dashboard** (list, at-risk/breached instances) — PR-02, PR-16, PR-21:
  cross-process visibility into what is about to breach or has breached.
- **Escalation & business-calendar configuration** (form) — PR-21 only:
  default `sla_policy`/`escalation_rule` templates; the calendar data itself
  is edited in `KRN-12`, referenced here by ID.
- **Process definition & version history** (read-only inspector, mirroring
  KRN-04's own entity catalogue pattern) — PR-21, PR-28; authoring happens in
  `STU-02`, not here.

## 10. API surface

Base per Vol 0 §42: `/api/v1/process/{entity}`.

| Method | Path | Notes |
|---|---|---|
| CRUD | `/api/v1/process/definitions` | `tnt` writes via STU-02 on the tenant's behalf; `sys` writes platform-release-pipeline only |
| POST | `/api/v1/process/definitions/{id}/publish` | `draft → published` |
| GET | `/api/v1/process/instances` | Filterable by `subject_type`, `current_state`, `lifecycle_status`, `assigned_to` |
| POST | `/api/v1/process/instances` | Starts an instance against the currently `effective` definition for the given `process_type_id` |
| POST | `/api/v1/process/instances/{id}/transitions` | `{transition_code}` — evaluates guard, checks `allowed_roles`/`allowed_agents`, applies pre/post actions, appends `state_history` |
| POST | `/api/v1/process/instances/{id}/cancel` | Admin override outside the declared transition set; always audited (§5) |
| GET | `/api/v1/process/approvals` | All approval requests within the caller's scope |
| GET | `/api/v1/process/my-approvals` | The caller's own pending queue — the endpoint `KRN-09` and the WhatsApp client (Vol 0 §9.3) act against |
| POST | `/api/v1/process/approvals/{id}/decide` | `{decision: approve\|reject, note}` |
| POST | `/api/v1/process/approvals/{id}/reassign` | KRN-05-FR-007 |
| CRUD | `/api/v1/process/sla-policies` | |
| CRUD | `/api/v1/process/escalation-rules` | |

All list endpoints: cursor pagination, declared filters, field selection
(Vol 1 §1.2). All writes: idempotency key required.

## 11. Permission matrix by persona

Actions: `definition.author` (`tnt`, via STU-02), `instance.read`,
`instance.cancel` (admin override), `approval.decide` (own queue only),
`approval.reassign`, `sla_policy.configure`, `escalation.configure`.

| Persona | definition.author | instance.read | instance.cancel | approval.decide (own queue) | approval.reassign | sla/escalation.configure |
|---|---|---|---|---|---|---|
| PR-21 System Admin | ✓ (`tnt`, via STU-02) | ✓ (all, own tenant) | ✓ | ✓ (if routed to them) | ✓ (any request, admin override) | ✓ |
| PR-01 Owner | ✗ | ✓ (own scope) | ✗ | ✓ (if routed to them) | ✗ | ✗ |
| PR-02 Functional Head | ✗ | ✓ (own function) | ✗ | ✓ (if routed to them, own function) | ✓ (own function's requests) | ✗ |
| PR-16 CFO | ✗ | ✓ (finance-routed) | ✗ | ✓ (if routed to them) | ✗ | ✓ (finance-routed policies) |
| PR-28 Implementation Partner | ✓ (`tnt`, provisioning window) | ✓ (own tenant, provisioning window) | ✗ | ✗ | ✗ | ✗ |
| PR-29 Agent | ✗ | ✓ (own scope, per `INT-04` ceiling) | ✗ | ✓ (own queue, within declared trust level, per `allowed_agents`) | ✗ | ✗ |
| All other internal personas | ✗ | ✓ (own scope) | ✗ | ✓ (if routed to them) | ✗ | ✗ |

**Negative cases:**
- Any persona attempting `approval.decide` on a request not assigned to them
  (and not a valid current delegate) → 403, audited, request status
  unchanged.
- An agent attempting to decide an approval above its registered trust
  ceiling → rejected at `INT-04` before KRN-05 ever records a decision; the
  request remains `pending` and routes to a human, since KRN-05 never trusts
  an agent's own claim of its ceiling (L9).
- PR-21 attempting `instance.cancel` is always audited and always emits
  `process.instance.cancelled`; attempting to instead force
  `current_state` directly (bypassing both a declared transition and the
  `cancel` action) → 403 — state only ever changes through a declared
  transition or the explicit, audited cancel path (L4, L5).
- A tenant `process_definition` author attempting to add a `process_state`
  outside the `sys` definition's declared transition set → rejected at the
  engine (KRN-05-FR-005), not merely flagged in review.
- PR-02 attempting `approval.reassign` on a request outside their own
  function's approval matrix → 403.

## 12. Events emitted / consumed

**Emitted** (Vol 1, verbatim, plus additions):
- `process.instance.started`
- `process.instance.state_changed`
- `process.instance.completed`
- `process.approval.requested`
- `process.approval.granted`
- `process.approval.rejected`
- `process.sla.at_risk`
- `process.sla.breached`
- `process.instance.cancelled` *(addition, not in Vol 1 — the event
  counterpart of the admin-override `cancel` action in §10, required by L4)*
- `process.approval.reassigned` *(addition, not in Vol 1 — the event
  counterpart of KRN-05-FR-007)*

**Consumed:** none as event subscriptions — KRN-05 is Layer 0 and initiates
process state rather than reacting to another module's event stream. It
*reads* synchronously, via direct call rather than subscription: `KRN-07`
rule definitions to evaluate a transition's guard (KRN-05-DR-002), and
`KRN-12` business calendars to compute `sla_due_at` and detect pauses
(holidays, declared non-working periods) for KRN-05-FR-004.

## 13. Reports and KPIs

- Approval cycle time by `approval_matrix`/persona — where bottlenecks sit.
- SLA breach rate by `process_definition` and by `process_state` — which
  stage of which workflow chronically breaches.
- Escalation frequency and resolution path (auto-reassigned vs. human
  intervention) — feeds process-design review, not a statutory report.
- Agent-approver decision volume and outcome, by agent and trust level — the
  raw `approval_request` records that `INT-04`'s trust-ladder promotion
  evidence is computed from; KRN-05 is the source of record, `INT-04` owns
  the aggregated agreement-rate metric itself.

No statutory reports originate in KRN-05 (statutory filings are CMP-05).

## 14. Compliance touchpoints

- `state_history`'s append-only trail (KRN-05-FR-006) feeds `KRN-10` Audit &
  Immutable Log directly and is the raw change-control evidence `CMP-06`
  (Regulated Records) requires for a validated process — "who moved this
  from Draft to Approved, when, and why" is answerable from this table alone.
- `approval_request.confidence`/`evidence`/`reversal_handle`
  (KRN-05-DR-001) is exactly what `CMP-06`'s "electronic records with
  meaning" requirement needs when an agent, not a human, approves a step in
  a regulated process — the decision is not just logged, its basis and its
  undo path are.
- SLA breach events (`process.sla.breached`) feed statutory-deadline-adjacent
  processes elsewhere (e.g. `CMP-05`'s filing calendar, `J-12` Compliance
  Calendar) by subscription on the consuming side; KRN-05 computes no
  statutory deadline itself (L7's spirit — no module reimplements a
  compliance calculation KRN-05 has no business owning).

## 15. Offline behaviour

**Profile: `full`** for transitions whose governing document belongs to a
declared offline-`full` module (Vol 0 §9.2 list: SCM-02, SCM-03, MFG-04,
MFG-06, SLS-10, DLV-05, DLV-07, PPL-05, OPS-10) — a field service technician
closing a job card, or a shop-floor supervisor confirming a production step,
routinely advances a `process_instance` with no connectivity, and the
`process_instance`'s state must be capturable and later synced like any other
offline write.

**Conflict policy** (extrapolated beyond Vol 1's text, flagged in §17.3): a
`process_instance.current_state` is not an independently mergeable field —
unlike two unrelated fields on the same record, two devices proposing
different next-states from what each believed was the current state is
exactly the "conflict a machine should not resolve" case Vol 0 §9.2 reserves
for queued-with-review, not last-writer-wins. Concretely: an offline-captured
transition carries the `from_state_id` the device believed it was leaving,
stamped at event time. On sync, if the server's `current_state` still
matches that `from_state_id`, the transition applies normally, with
`state_history.occurred_at` set to the original event time (not the sync
time) per Vol 2 §1.6's event-time/transaction-time distinction. If the
server has since moved to a different state — another device, or an online
actor, got there first — the offline transition is rejected from
auto-applying and is queued for human review with both the device's intended
transition and the server's actual current state shown side by side, exactly
matching KRN-16's mandate that stock and financial quantities be
server-authoritative while a genuine conflict is queued rather than
silently resolved.

## 16. Acceptance criteria (Given/When/Then)

**KRN-05-FR-001 — versioned, effective-dated, running instances pinned**
> Given `process_definition` `PD-7` version 3 becomes `effective` on 2026-10-01, superseding version 2
> When instance `PI-501` started on 2026-09-20 under version 2 is still `running` on 2026-10-05
> Then `PI-501` continues to evaluate all guards, transitions and approval routing against version 2, and only instances started on or after 2026-10-01 use version 3.

**KRN-05-FR-002 — guards, actions, role/agent authorisation on a transition**
> Given a transition from `Draft` to `Submitted` guarded by a rule requiring `total_value < 500000`, with `allowed_roles: [PR-06]` and no `allowed_agents`
> When a user without the `PR-06` role attempts the transition on a document with `total_value = 300000`
> Then the transition is rejected for lack of role authorisation even though the guard would have passed, and no `state_history` entry is written.

**KRN-05-FR-003 — approval matrix routing types with delegation**
> Given a `quorum` approval matrix requiring 2 of 3 named approvers, one of whom has an active out-of-office delegation to a colleague
> When the delegate approves and one of the remaining two named approvers also approves
> Then the quorum of 2 is satisfied, `process.approval.granted` is emitted once the quorum threshold is met (not per individual approval), and the delegated approver's original request closes as `delegated` referencing the delegate's decision.

**KRN-05-FR-004 — SLA clocks respect business calendars; both thresholds fire**
> Given an `sla_policy` of 2 business days on a state entered at 4pm on a Friday, with Saturday/Sunday marked non-working on the referenced `KRN-12` calendar
> When the clock is evaluated
> Then `sla_due_at` falls on the following Tuesday (not Sunday), a `process.sla.at_risk` event fires once the `at_risk_threshold_pct` is crossed, and a separate `process.sla.breached` event fires only if `sla_due_at` passes with the instance still in that state — each fires exactly once per crossing.

**KRN-05-FR-005 — tenant-added states are `tnt` and bounded**
> Given a `sys` `process_definition` with a declared transition set `Draft → Submitted → Approved → Closed`
> When a tenant, via STU-02, adds a `tnt`-namespaced state `Submitted → Pending Legal Review → Approved`
> Then the new state is accepted because it fits within the declared transition set (it sits between two `sys` states without altering them), and a platform upgrade that adds a `sys` state elsewhere leaves the tenant's `Pending Legal Review` state and its transitions untouched.

**KRN-05-FR-006 — state history is append-only with full detail**
> Given instance `PI-900` moves `Draft → Submitted → Approved` over two days
> When the full `state_history` for `PI-900` is read
> Then it contains exactly two append-only entries, each with `actor`, `occurred_at`, `duration_in_prior_state` and an optional `reason`, and no update or delete operation exists on any entry (mirrors KRN-06-FR-002's append-only guarantee at the process layer).

**KRN-05-FR-007 — reassignment (addition)**
> Given an `approval_request` assigned to a user who has gone on unplanned leave with no delegation configured
> When PR-21 reassigns the request to another qualified approver
> Then the original request closes as `reassigned`, a new `pending` request is created for the new assignee, `process.approval.reassigned` is emitted, and the action is visible in the instance's audit trail as an administrative action distinct from a decision.

**KRN-05-DR-001 — agent as approver at a declared trust level**
> Given an approval matrix routing discounts above 15% to the sales head, with a transition additionally listing `SLS-AG-03` in `allowed_agents` for discounts up to 15% at trust level L3
> When `SLS-AG-03` approves a 12% discount and a human must approve an 18% one
> Then the 12% approval is recorded on `approval_request` with the agent's identity, version, `confidence`, `evidence` and `reversal_handle`, the 18% request appears in the sales head's `my-approvals` queue with full context, and neither approval is possible without the underlying transition explicitly listing that agent at that level.

**KRN-05-DR-002 — guard is a KRN-07 rule reference (addition)**
> Given a transition guard stored as `guard_rule_id` referencing a `KRN-07` rule `credit-limit-check-v3`
> When `credit-limit-check-v3` is updated in KRN-07 (a new effective-dated version) and separately inspected via KRN-07's own API
> Then every `process_transition` referencing that guard picks up the new rule version at its next evaluation with no change to the `process_definition` itself, and the guard's logic is fully visible via KRN-07's inspection API rather than embedded, opaque expression text inside KRN-05.

## 17. Open questions

Flagged per Vol 6 §4/L13 — these are gaps in Vol 1's field-level detail that
this draft filled by reasonable extrapolation from the stated purpose and
requirements. They should be confirmed or corrected by the human before this
Vol 3 file is treated as binding:

1. **Field tables for `process_state`, `process_transition`,
   `approval_matrix`, `approval_request`, `sla_policy` and
   `escalation_rule`** (§4.1) are not given at field level in Vol 1 — Vol 2
   §P-07 gives `states` and `transitions` only as inline list fields on a
   single "Definition entity," while Vol 1 names `process_state` and
   `process_transition` as separate owned entities. This draft treats the
   Vol 1 entities as the normalized child-table realisation of Vol 2's list
   fields and proposes field shapes for the remaining four entities from
   their stated requirements only. Please confirm or amend, and confirm the
   Vol 1/Vol 2 reconciliation is correct rather than a genuine discrepancy
   between the two documents.
2. **`process_definition.status`, `process_instance.lifecycle_status`**
   (§5) are invented — Vol 1 states only that definitions are "versioned and
   effective-dated" (KRN-05-FR-001) and says nothing about an instance-level
   status layered over `current_state`. This draft proposes
   `lifecycle_status: running → completed | cancelled` as the minimum needed
   to represent an admin-cancelled instance distinctly from one that reached
   a terminal business state, since Vol 1 gives no other mechanism for
   representing cancellation. Confirm this is needed, or whether
   cancellation should instead be modelled as a `tnt` terminal state on the
   definition itself.
3. **Offline conflict policy for process transitions** (§15) is inferred
   from Vol 0 §9.2's general offline contract and the offline-`full` module
   list, since Vol 0 §9.2 does not name KRN-05 itself among the modules
   declaring an offline profile — only application modules are listed. This
   draft assumes KRN-05 must nonetheless support offline transition capture
   as a kernel capability (since the listed offline-`full` modules cannot
   themselves complete a lifecycle offline without it), with a
   `from_state_id`-must-match-on-sync conflict rule. Confirm this is the
   intended design rather than, e.g., always-queue-for-review regardless of
   match, or a different resolution entirely.
4. **`KRN-05-DR-002`** (guard as a `KRN-07` rule reference rather than an
   inline expression) is an addition beyond Vol 1's literal text, which
   describes guards only as "rule expressions" without stating whether the
   expression is owned inline by KRN-05 or referenced from KRN-07. Confirm
   this is the intended architecture, since it is the basis for this draft's
   §3 scope boundary between the two modules.
5. **`KRN-05-FR-007`** (reassignment) is an addition assembled from Vol 0
   §11's KRN-05 catalogue entry, which lists "reassignment" as a Standard
   capability, but Vol 1's own KRN-05 requirement list omits it entirely.
   Confirm the scope proposed here (self-initiated reassignment to a named
   colleague, plus an administrator's forced reassignment when an assignee
   is unreachable) matches intent, and confirm it is meant to be distinct
   from KRN-03-FR-004's general delegation mechanism rather than a
   duplicate of it.
