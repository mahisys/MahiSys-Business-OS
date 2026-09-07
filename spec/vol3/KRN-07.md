# KRN-07 · Rules Engine

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-01 (tenant scoping), KRN-04 (declared entity fields conditions reference), KRN-06 (event bus, for rule-set lifecycle events)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-07)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

Declarative condition-action policies — the concrete, storable
implementation of primitive **P-12 Rule** (Vol 2 §P-12) — consumed by
pricing, credit, reorder, eligibility, approval-threshold and compliance
logic across every transacting module. A rule's conditions are always a
structured expression tree over fields declared in KRN-04, never free text
and never executable code, so that an owner can read exactly why a price, a
credit block or a reorder point fired the way it did (Vol 2 §P-12 design
note).

Not bought directly — `included` platform-fee kernel substrate (Vol 0 §11).
The direct authors and buyers of *policy content* are domain owners inside a
tenant — a sales manager sets discount rules, a CFO sets credit-limit rules —
while KRN-07 itself is the shared engine every one of those domains
evaluates against, exactly as no module computes its own tax logic outside
CMP-01 (L7), no module should be evaluating its own ad hoc condition logic
outside KRN-07. Its Phase 1 natural-language authoring surface is STU-05
(Automation Builder); KRN-07 exists independently of STU-05 and must be
usable through a plain structured editor from Phase 0, since STU-05 does not
ship until Phase 1 (Vol 0 §39) but pricing, credit and reorder rules are
needed from Phase 3 (FIN, SCM) onward.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-08 Sales Manager | Authors and maintains pricing and discount rule sets consumed by SLS-07 CPQ |
| PR-16 Finance Controller / CFO | Authors and activates credit-limit, payment-terms and collections-risk rule sets consumed by FIN-02/FIN-13 |
| PR-06 Purchase Officer | Authors reorder-level and vendor-eligibility rule sets consumed by SCM-02/SCM-04 |
| PR-02 Functional Head (CXO) | Reviews simulation results and approves activation within their own function |
| PR-15 Accountant | Reads `evaluation_log` to explain a computed outcome (e.g. why a credit block fired on a specific invoice) |
| PR-01 Owner / Director | Approves activation of the highest-impact policy changes (e.g. margin-floor rules) via delegated authority; reads outcomes through reports and INT-02, not the raw editor |
| PR-21 System Administrator | Platform-level governance of rule types, retention and cross-tenant health, not day-to-day rule content |
| PR-28 Implementation Partner | Authors initial rule sets during tenant onboarding, scoped to the tenant being provisioned |
| PR-29 Agent | Reads active rule sets and `evaluation_log` within its declared data scope as evidence for its own decisions (e.g. `SLS-AG-05` Margin Watchdog reads pricing-rule evaluation results); never authors, edits or activates a rule (§8, KRN-07-FR-007) |

Every other persona (floor, field and self-service roles in particular)
never sees a rule directly — they see its *computed effect*: a discounted
price on a quote, a blocked order, a reorder PO drafted. This mirrors Vol 0
§7's design rule that mobile-first, floor and field personas must not be
asked to operate machinery meant for a desk role.

## 3. Scope in / scope out

**In scope:** rule set / rule / rule version data model and lifecycle;
structured expression-tree condition and action authoring and storage;
priority ordering, effective dating and scoping (entity, location, party
segment, item category — Vol 2 §P-12 verbatim); a synchronous `/evaluate`
API any producing module calls; simulation against historical records before
activation; evaluation logging sufficient to explain any outcome after the
fact.

**Out of scope:** the business *meaning* of a rule's action to the calling
module — KRN-07 stores and evaluates `{type: apply_discount, value: 12%}`,
it does not know what "discount" means to SLS-07 or how SLS-07 applies it to
a quote line; that semantic belongs entirely to the consuming module. Also
out of scope: the natural-language authoring *experience* itself (STU-05
owns the conversational UI; KRN-07 owns only the compiled, inspectable
result it produces — KRN-07-DR-001); all GST/tax determination, which
remains CMP-01's exclusive responsibility under L7 regardless of whether
CMP-01 happens to be internally implemented on KRN-07's primitives
(KRN-07-FR-006); approval routing itself, which is KRN-05's Process Engine —
KRN-07 may supply the condition a KRN-05 approval matrix branches on (e.g.
"is this discount above the rule-computed floor"), but does not itself route
or record the approval.

## 4. Entities owned; entities consumed

**Owned:** `rule_set`, `rule`, `rule_version`, `evaluation_log` (Vol 1,
verbatim).

**Consumed (by ID):** `P-12 Rule` — KRN-07 is the primitive's concrete
implementation, not a consumer of it. Consumes **KRN-04**'s
`field_definition` registry: every condition expression tree must reference
only fields that exist and are declared there (KRN-07-FR-001), and a
condition referencing a field KRN-04 has deprecated is flagged (see §12,
addition). Consumes `tenant_id`/`entity_id` scoping from **KRN-01**. Does
not read any consuming module's own tables (L3) — a module calls
`/evaluate` and passes the field values it already has; KRN-07 never reaches
into SLS-07's or FIN-02's tables to fetch them itself.

### 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every entity below. Vol 2 §P-12 gives
one flat field list for "Rule"; Vol 1 separately declares four owned
entities (`rule_set`, `rule`, `rule_version`, `evaluation_log`). This draft
reconciles the two by treating Vol 2's flat list as describing the `rule`
entity's business fields, with `rule_set` as the named policy grouping above
it and `rule_version` as the append-only historical snapshot beneath it —
flagged as an interpretation, not a given, in §17.

**`rule_set`** (extrapolated; not field-detailed in Vol 1/2 — flagged in
§17):

| Field | Type | Notes |
|---|---|---|
| `name` | string | e.g. "Standard Distributor Pricing FY27" |
| `rule_type` | enum | `pricing` \| `credit` \| `reorder` \| `eligibility` \| `approval_threshold` \| `compliance_check` — per Vol 2 §P-12's absorption list; never `tax` (KRN-07-FR-006) |
| `owning_module` | ref | The module authorised to consume this rule type, e.g. `SLS-07`, `FIN-02`, `SCM-02` |
| `match_mode` | enum | `first_match` \| `accumulate` — declared per set since semantics differ by `rule_type` (flagged in §17) |
| `status` | enum | `draft` \| `active` \| `superseded` \| `retired` |
| `description` | string | |

**`rule`** (Vol 2 §P-12, verbatim, as child of `rule_set`):

| Field | Type | Notes |
|---|---|---|
| `rule_set_id` | ref | |
| `rule_type` | ref | Inherited from `rule_set` |
| `name` | string | |
| `priority` | integer | Lower evaluates first within `first_match` sets |
| `conditions` | expression tree | Structured, never free text (KRN-07-FR-001) |
| `actions` | structured | Module-declared action vocabulary |
| `period` | Period | Effective dating (Vol 2 §1.4) |
| `scope` | object | `{entity_id, location_id, party_segment, item_category}` (Vol 2, verbatim) |
| `status` | enum | `draft` \| `active` \| `expired` \| `retired` |
| `current_version_id` | ref | Points at the current `rule_version` |
| `authored_by` | actor ref | |
| `authored_via` | enum | `ui` \| `natural_language` \| `manifest` (Vol 2, verbatim) |
| `natural_language_source` | text, nullable | Original phrasing when `authored_via: natural_language` (Vol 2, verbatim; see KRN-07-DR-002) |

**`rule_version`** (extrapolated; not field-detailed in Vol 1/2 — flagged in
§17): an append-only snapshot created every time a rule's `conditions`,
`actions`, `priority` or `period` changes, so that `evaluation_log` can
reference the *exact* version that produced a given historical outcome even
after the rule is later edited.

| Field | Type | Notes |
|---|---|---|
| `rule_id` | ref | |
| `version_no` | integer | Monotonic per `rule` |
| `conditions`, `actions`, `priority`, `period` | (snapshot) | Values at the time this version became current |
| `change_reason` | text, nullable | |
| `superseded_by_version_id` | ref, nullable | |

**`evaluation_log`** (extrapolated; not field-detailed in Vol 1/2 — flagged
in §17):

| Field | Type | Notes |
|---|---|---|
| `rule_set_id`, `rule_id`, `rule_version_id` | ref | The exact version that fired (KRN-07-FR-004) |
| `subject_type`, `subject_id` | | What was evaluated |
| `input_snapshot` | JSONB | Field values evaluated against |
| `matched` | boolean | |
| `outcome` | JSONB | Computed action result |
| `evaluated_at` | timestamptz | |
| `evaluated_for` | actor ref | Who/what triggered the evaluation |
| `correlation_id` | UUID, nullable | Links to the KRN-06 event chain when the evaluation was part of a larger journey |
| `latency_ms` | integer | |

## 5. State machines

**`rule_set.status`:** `draft → active → (superseded | retired)`.
`superseded` when a replacement `rule_set` takes over the same `rule_type`
and scope; `retired` when deliberately deactivated with no replacement.
Both are terminal.

**`rule.status`:** `draft → active → (expired | retired)`. `expired` occurs
automatically once `period.to` passes; `retired` is a deliberate
deactivation. Editing an active rule's conditions/actions/priority/period
does not change `rule.status` — it creates a new `rule_version` and advances
`current_version_id`, leaving the rule itself `active` throughout.

**`rule_version`:** append-only. `created` (immutable from that point) →
`superseded` when a newer version becomes current. Versions are never
deleted, mirroring P-08 Event and P-09 Record's append-only design — history
must remain queryable for KRN-18 reversal context and for `evaluation_log`
entries that reference an old version to keep resolving correctly.

**`evaluation_log`:** append-only, no transitions — recorded once, like an
event, never updated.

## 6. Standard functional requirements

- `KRN-07-FR-001` Conditions are structured expression trees over declared entity fields — never free text, never executable code. *(Vol 1, verbatim)* — every field reference in a condition tree is validated at save time against KRN-04's `field_definition` registry; a condition referencing an undeclared field is rejected, and a condition referencing a field the authoring actor cannot read under KRN-03's field-level policy (e.g. a masked salary field) is rejected even if the field exists.
- `KRN-07-FR-002` Rules are priority-ordered, effective-dated and scoped by entity, location, party segment and item category. *(Vol 1, verbatim)* — scope filtering (does this rule apply to this subject at all) happens before priority ordering (which applicable rule wins); `period` exclusion happens alongside scope filtering — a rule whose `period` does not cover the evaluation instant is never considered a candidate, regardless of priority.
- `KRN-07-FR-003` A rule set can be simulated against historical records before activation, reporting which records would change outcome. *(Vol 1, verbatim)* — simulation takes a bounded historical sample (declared date range and/or subject set), runs read-only against it, and reports a per-record diff (prior outcome vs proposed outcome); it does not write to the live `evaluation_log` (see §17 on where simulation results are persisted instead).
- `KRN-07-FR-004` Every evaluation that affects a business outcome is logged with inputs, matched rule, and result, so a price or a credit block is always explainable. *(Vol 1, verbatim)* — the log entry records `rule_version_id` specifically, not just `rule_id`, so a later edit to the live rule can never retroactively change the explanation of a past decision — this mirrors the immutability guarantee KRN-06 gives P-08 Event, applied here to P-12 Rule's explainability promise.

**Additions** (beyond Vol 1's abbreviated form, minimal, per Vol 6 §4):

- `KRN-07-FR-005` The `/evaluate` API is synchronous, callable by any producing module within the same request that needs a rule outcome (e.g. SLS-07 pricing a quote line, SCM-02 checking a reorder point, FIN-02 checking a credit limit). It does not itself emit a KRN-06 event per evaluation — only rule-set/rule lifecycle changes do (§12) — since per-evaluation event volume on a live pricing engine would flood the event store for no journey-reconstruction benefit. This is flagged in §17 as a live tension against a strict reading of L4, since it is a deliberate, reasoned exception rather than an oversight.
- `KRN-07-FR-006` No module computes tax logic through a KRN-07 rule set to route around CMP-01 (L7). No `rule_set` may declare `rule_type: tax`; this is enforced at creation time. CMP-01 may internally be implemented using KRN-07's primitives, but no other module may declare a tax-purposed rule set here.
- `KRN-07-FR-007` An agent (PR-29) may read `evaluation_log` entries and active `rule_set`/`rule` definitions within its declared data scope, but may never create, edit or activate a rule directly — rule authorship is always a human action, or a STU-05-mediated one with an explicit human approval step. A rule is a governance artefact an owner must be able to read the meaning of (Vol 2 §P-12 design note); per L9 an agent may never grant itself the capability to shape pricing, credit or eligibility policy by editing the rules that govern it.

## 7. Differentiating requirements

- `KRN-07-DR-001` Rules authored in natural language (STU-05) compile to an inspectable expression tree and retain their original phrasing. They never execute as opaque model behaviour. *(Vol 1, verbatim)*
- `KRN-07-DR-002` (addition, drawn from Vol 2 §P-12's design note — "an owner must be able to read why a price was what it was") Every `evaluation_log` entry is explainable to a non-technical owner without reading the raw expression tree: when `authored_via: natural_language`, the matched rule's `natural_language_source` is surfaced alongside the computed outcome, so INT-02's causal traversal ("why did Nashik margin drop") can answer in the phrasing the rule was actually written in, not just a structured log line.

## 8. Agents

None owned. KRN-07 is kernel infrastructure with no autonomous behaviour of
its own, matching the pattern in KRN-01 and KRN-06. Several catalogue
agents consume its outcomes as evidence — `SLS-AG-05` Margin Watchdog reads
pricing-rule evaluation results before holding a below-floor quote,
`SCM-AG-01` Stockout Forecaster reads reorder-rule outcomes, `FIN-AG-03`
Credit Deterioration Detector reads credit-rule outcomes — but per
`KRN-07-FR-007`, none of them, nor any other agent regardless of registered
trust ceiling, may author, edit or activate a rule. That action is simply
not in any agent's declared tool set (Vol 0 §27.2); it is not a
permission-denied outcome at evaluation time, it does not exist as a callable
tool at all.

## 9. Screens and flows

All screens are KRN-13-generated from KRN-04 metadata (L6):

- **Rule sets** (list + form) — scoped per persona and `rule_type` (§11).
- **Rule builder** — structured condition/action editor (available from
  Phase 0, before STU-05 ships in Phase 1); a rule authored here has the
  identical stored shape as one authored later through STU-05's natural-
  language flow (T7 composition, not two data models).
- **Rule version history** — read-only diff view across `rule_version`
  snapshots for a given rule.
- **Simulation runner** — select a rule set (draft or a proposed edit to an
  active one) and a historical scope, run, review the diff report before
  activating.
- **Evaluation log explorer** — filterable by subject, rule set, date range;
  the screen PR-15 uses to answer "why was this customer blocked."

## 10. API surface

Base per Vol 0 §42: `/api/v1/core/{entity}`.

| Method | Path | Notes |
|---|---|---|
| CRUD | `/api/v1/core/rule-sets` | Scoped per §11 |
| CRUD | `/api/v1/core/rules` | Nested under `rule_set` or flat with `rule_set_id` filter |
| GET | `/api/v1/core/rule-versions` | Read-only history |
| POST | `/api/v1/core/rules/evaluate` | `{rule_set_id \| rule_type, subject_type, subject_id, context}` → `{matched, outcome, rule_id, rule_version_id, evaluated_at}`, synchronous (KRN-07-FR-005) |
| POST | `/api/v1/core/rules/simulate` | `{rule_set_id, historical_scope}` → async (KRN-15), returns a diff report job |
| GET | `/api/v1/core/evaluation-log` | Filtered by subject, rule set, date range |
| POST | `/api/v1/core/rule-sets/{id}/activate` | Guarded — may route through a KRN-05 approval matrix for high-impact `rule_type`s (credit, pricing) per §11 |

All list endpoints: cursor pagination, declared filters, field selection
(Vol 1 §1.2). All writes: idempotency key required.

## 11. Permission matrix by persona

Read access to a rule's *own domain* is granted to the persona who owns that
business function; authoring is scoped the same way; activation of
higher-impact rule types (credit, pricing) is gated more tightly than
lower-impact ones (reorder), consistent with the financial-risk profile of
each `rule_type`. No agent may write at any level (KRN-07-FR-007).

| Persona | rule_set.read (own domain) | rule/rule_set.create-edit (draft, own domain) | rule_set.activate | simulation.run | evaluation_log.read (own domain) |
|---|---|---|---|---|---|
| PR-21 System Admin | ✓ all | ✓ all (platform-owned rule types, e.g. `compliance_check` defaults) | ✓ all | ✓ all | ✓ all |
| PR-08 Sales Manager | ✓ `pricing`, `eligibility` | ✓ `pricing`, `eligibility` | ✓ within delegated authority band; escalates via KRN-05 above a declared threshold (mirroring KRN-05's own discount-approval sample) | ✓ own domain | ✓ own domain |
| PR-16 CFO | ✓ `credit`, `approval_threshold`, cross-domain read for controller visibility | ✓ `credit`, `approval_threshold` | ✓ `credit`, `approval_threshold` | ✓ own domain | ✓ finance domain + cross-domain |
| PR-06 Purchase Officer | ✓ `reorder` | ✓ `reorder` (draft) | ✓ within delegated authority band | ✓ own domain | ✓ own domain |
| PR-02 Functional Head | ✓ own function's rule types | ✗ (reviews/proposes via process, not direct edit) | ✓ approves escalated activations within own function | ✗ | ✓ own function |
| PR-15 Accountant | ✗ (no editor access) | ✗ | ✗ | ✗ | ✓ (explainability only) |
| PR-01 Owner | ✓ all, via reports/Copilot rather than the raw editor | ✗ | ✓ highest-impact activations only (e.g. margin-floor policy) | ✗ (reads reports, does not run simulations) | ✓ (summary, via reports) |
| PR-28 Implementation Partner | ✓ own tenant, provisioning window | ✓ own tenant, provisioning window, draft only | ✗ (tenant must go live on its own financial policy, not the partner) | ✓ own tenant | ✗ |
| PR-29 Agent | ✓ own declared data scope only | ✗ | ✗ | ✗ | ✓ own declared data scope only |
| All other personas | ✗ | ✗ | ✗ | ✗ | ✗ — consume computed effects only (e.g. a beat-rep sees the discounted price on a quote, never the rule) |

**Negative cases:**
- PR-15 Accountant attempting `POST /rule-sets` → 403.
- PR-06 Purchase Officer attempting to activate a `pricing` rule set (outside their domain) → 403.
- PR-29 Agent attempting `POST /rule-sets` or `/rules` → 403, audited, and — since rule authorship is not in any agent's declared tool set at all (§8) — treated as a trust-ceiling violation attempt regardless of the agent's registered level (L9), not merely a scope miss.
- Any actor attempting to set `rule_type: tax` on a rule set → rejected at validation (KRN-07-FR-006), regardless of persona, including PR-21.
- PR-28 Implementation Partner attempting `rule_set.activate` on a live financial rule type → 403, since activation of the tenant's own financial policy is deliberately excluded from the partner's provisioning-window grant.

## 12. Events emitted / consumed

**Emitted** (Vol 1, verbatim, plus additions):
- `rules.set.activated` *(Vol 1, verbatim)*
- `rules.rule.version_created` *(Vol 1, verbatim)*
- `rules.set.deprecated` (addition — mirrors `rule_set.status → retired`/`superseded`, needed since Vol 1's two events do not cover deactivation)
- `rules.simulation.completed` (addition — the async simulation job (KRN-07-FR-003) needs a completion event for KRN-09 to notify the requesting persona and for the UI to refresh)

No per-evaluation event is emitted (KRN-07-FR-005) — this is a deliberate
scope decision, not an omission, and is flagged in §17.

**Consumed:**
- `metadata.field.deprecated` (KRN-04) — a rule condition referencing a
  field that KRN-04 deprecates is flagged for review rather than silently
  continuing to evaluate against a sunsetting field (addition, consistent
  with L12's deprecate-not-remove discipline extending into rule content).
- `process.approval.granted` / `.rejected` (KRN-05) — when `rule_set.activate`
  is routed through an approval matrix for a high-impact `rule_type` (§11),
  KRN-07 consumes the approval outcome to complete the activation (addition).

## 13. Reports and KPIs

- Active rule count by `rule_type` and owning module.
- Evaluation volume and p95 latency per rule set (a slow pricing rule set
  degrades every quote in SLS-07 — this is a real performance KPI, not
  cosmetic).
- Simulation-before-activation adoption rate — a governance KPI: did the
  tenant skip simulation before a live financial policy change.
- Match rate / no-match rate per rule — a rule that never fires is either
  dead policy or a scope error; both are worth surfacing.
- Rule age since last review — governance hygiene, especially for `credit`
  and `pricing` rule types that materially affect margin.

## 14. Compliance touchpoints

- CMP-01 (GST Engine) may itself be internally implemented on KRN-07's
  primitives, but per L7 and `KRN-07-FR-006` no other module may compute tax
  logic through a KRN-07 rule set — this boundary is enforced, not merely
  documented.
- FIN-13 (Credit & Collections Risk) and FIN-02 (Accounts Receivable)
  consume `credit`-type rule sets; `evaluation_log` is the explainability
  record a CFO or auditor needs when a customer disputes a credit block —
  this is the same explainability guarantee KRN-06-DR-001 gives to journeys,
  applied here to policy outcomes.
- `approval_threshold` rule sets (Vol 2 §P-12's absorption list) feed KRN-05
  approval matrices — a discount-approval routing decision is itself
  explainable through `evaluation_log`.
- CMP-05 (Statutory Filings) and SEC-06 (Audit & Evidence) may need to
  export `evaluation_log` entries as evidence that a `compliance_check` rule
  (e.g. an e-way bill distance/value threshold) fired correctly on a
  specific historical transaction.

## 15. Offline behaviour

**Profile: `online`.** Rule authorship, activation and simulation are not
field-capture activities; no offline-first persona interacts with the
authoring surfaces directly. However, `/evaluate` is called synchronously by
modules that *are* offline-`full` — notably SLS-10 (Field Sales & Beat Plan)
pricing an order while a beat rep is disconnected. Since KRN-07 itself has
no offline profile of its own, an offline-capable consuming module must:

- Cache the relevant active `rule_set`/`rule`/current `rule_version` locally
  via KRN-16's sync mechanism before going offline.
- Evaluate against that cached snapshot while disconnected, treating the
  result as provisional.
- On sync, re-evaluate against the authoritative server-side `rule_version`
  at that moment; per Vol 0 §9.2's declared policy (server-authoritative for
  financial quantities), the reconciled server-side price is the one that
  actually posts, and any difference from the provisional offline price is
  surfaced to the capturing persona rather than silently overwritten.

This behaviour is inferred from Vol 0 §9.2's general offline contract, not
specified for KRN-07 itself anywhere in Vol 1/2, and is flagged in §17.

## 16. Acceptance criteria (Given/When/Then)

Vol 1 gives no **Acceptance (sample)** for KRN-07 (unlike every other kernel
module in Part 2, including KRN-06). The set below is written from scratch
against the stated FR/DR and this draft's additions, and is flagged in §17
for confirmation that it correctly covers what a sample would have anchored.

**KRN-07-FR-001 — conditions are structured, field-validated expression trees**
> Given a condition referencing `item.hsn_sac`, a field declared in KRN-04
> When the rule is saved
> Then it validates successfully; when a second condition referencing an undeclared field `item.foo_bar` is saved
> Then it is rejected at save time with a stable machine error code, and no rule or rule_version is created.

**KRN-07-FR-002 — scope, period and priority ordering**
> Given two active rules in the same `pricing` rule set: Rule A (priority 1, scope `item_category: fasteners`, period covering today) and Rule B (priority 2, scope `item_category: fasteners`, period expired last month)
> When `/evaluate` is called for a fastener item today
> Then Rule B is excluded as a candidate before priority is even considered (period has lapsed), and Rule A is the sole candidate and match.

**KRN-07-FR-003 — simulation before activation**
> Given a draft revision to an active `credit` rule set that would tighten the exposure limit by 20%
> When PR-16 runs simulation against the last 90 days of AR records
> Then a diff report lists every customer whose credit status would change under the proposed rule set, no `evaluation_log` entries are created by the simulation run, and the live rule set is unaffected until explicit activation.

**KRN-07-FR-004 — every outcome logged and explainable against the exact version**
> Given a `pricing` rule (version 3) computes a 12% discount for quote line Q-991
> When the rule is later edited, creating version 4
> Then the `evaluation_log` entry for Q-991 still references `rule_version_id` for version 3 and reproduces the original 12% explanation unchanged, regardless of what version 4 would now compute.

**KRN-07-DR-001 — natural-language authoring compiles to inspectable form**
> Given a rule authored via STU-05 from the phrasing "give distributors 5% off orders above ₹2 lakh"
> When the rule is saved
> Then `authored_via: natural_language`, `natural_language_source` retains the original phrasing verbatim, and `conditions`/`actions` are a fully inspectable expression tree equivalent to the same rule authored through the structured UI editor — no opaque model behaviour executes at evaluation time.

**KRN-07-FR-005 (addition) — synchronous evaluation, no per-evaluation event**
> Given SLS-07 calls `/evaluate` while building a live quote
> When the call returns
> Then the response is synchronous within the same request/response cycle, and no `event` row is written to KRN-06 for this individual evaluation — only the `evaluation_log` entry is written; a subsequent rule-set activation elsewhere does emit `rules.set.activated`.

**KRN-07-FR-006 (addition) — no tax rule type outside CMP-01**
> Given any actor, including PR-21, attempts to create a `rule_set` with `rule_type: tax`
> When the create request is submitted
> Then it is rejected at validation with a stable machine error code referencing L7, and no rule_set is created.

**KRN-07-FR-007 (addition) — agents never author rules**
> Given `FIN-AG-03` (Credit Deterioration Detector, trust level L2) reads `evaluation_log` entries within its declared scope
> When it attempts to call `POST /rule-sets` or `/rules` (a tool not present in its declared tool set)
> Then the call fails as an invalid tool invocation, not merely a permission check, and is logged as a trust-ceiling boundary event regardless of the agent's registered level.

**KRN-07-DR-002 (addition) — plain-language explainability**
> Given an evaluation_log entry for a rule with `natural_language_source: "give distributors 5% off orders above ₹2 lakh"`
> When PR-01 asks INT-02 "why did this distributor get 5% off"
> Then the answer surfaces the original phrasing alongside the computed outcome, without requiring the owner to read the underlying expression tree.

## 17. Open questions

Flagged per Vol 6 §4/L13 — gaps in Vol 1/2's field-level and behavioural
detail that this draft filled by reasonable extrapolation. They should be
confirmed or corrected by the human before this Vol 3 file is treated as
binding:

1. **Reconciling Vol 2's flat P-12 field list against Vol 1's four owned
   entities** (§4.1) — Vol 2 §P-12 gives one flat field list (including a
   `version` field) for "Rule," while Vol 1 separately declares `rule_set`,
   `rule`, `rule_version` and `evaluation_log` as four distinct owned
   entities. This draft treats Vol 2's list as describing `rule`'s business
   fields and introduces `rule_set` above and `rule_version` below it.
   Specifically unclear: whether Vol 2's `version` field on Rule is the same
   thing as the universal optimistic-concurrency `version` field (Vol 2
   §1.2), or a distinct business-versioning field that duplicates what
   `rule_version` already provides. Confirm the intended relationship.
2. **Vol 1 gives no Acceptance (sample) for KRN-07** — unlike every other
   kernel module in Part 2, including KRN-06 (which lacks an Events line
   instead — see that file's §17). This draft's §16 is written from scratch
   rather than expanding a given sample; confirm it correctly anchors what a
   Vol 1 sample would have.
3. **Per-evaluation events vs. rule-lifecycle-only events** (KRN-07-FR-005)
   — a strict reading of L4 ("never emit a state change without an event")
   could be argued to require an event per `/evaluate` call, since each
   evaluation does record an outcome. This draft deliberately does not emit
   one, for event-store volume reasons, treating the `evaluation_log` entry
   itself as the durable record rather than a KRN-06 event. This is a live
   tension between two binding rules and needs explicit human confirmation.
4. **Match semantics (`match_mode`) are not specified in Vol 1/2** — whether
   a rule set stops at the first matching rule by priority, or accumulates
   all matches (needed for e.g. compliance-check rule types that may need
   every applicable check to fire, not just the highest-priority one). This
   draft proposes a `match_mode` field declared per `rule_set` rather than a
   single global behaviour. Confirm.
5. **Simulation output persistence** — this draft assumes simulation writes
   to a separate, non-authoritative result store rather than the live
   `evaluation_log`, so that simulation runs never pollute the explainability
   log used for real business decisions (KRN-07-FR-003's acceptance
   criterion above). Confirm this separation is intended, and if so, whether
   that separate store needs its own entity (not currently declared
   anywhere) or is ephemeral job output only.
6. **Offline evaluation/reconciliation behaviour** (§15) for offline-`full`
   modules calling `/evaluate` (notably SLS-10) is inferred entirely from Vol
   0 §9.2's general offline contract, not specified for KRN-07 itself.
   Confirm the "provisional client-side result, server-authoritative
   reconciliation at sync" model is correct, and whether a price computed
   offline needs its own distinct `evaluation_log.source: offline_sync`
   marker to distinguish provisional from authoritative evaluations in the
   audit trail.
7. **Rule-type activation governance** (§11's permission matrix, and which
   activations route through a KRN-05 approval matrix) is not specified
   anywhere in Vol 1 — this draft's matrix is a reasonable extrapolation from
   persona characteristics in Vol 0 §7, not a given rule. This needs
   confirmation before implementation, particularly for `pricing` and
   `credit` rule types, where an under-scoped activation permission is a
   real financial-risk exposure, not merely a UX question.
