# KRN-17 · Data Platform

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-01 (tenant/entity scope), KRN-03 (row/field-level permission policy carried into analytics), KRN-06 (event bus/event store — the CDC source), KRN-15 (job runtime for materialisation)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-17)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

The warehouse, change-data-capture pipeline, lineage graph, retention engine
and incremental-materialisation substrate that every analytical and
intelligence capability in the platform reads from instead of touching a
transactional table directly. KRN-17 is what makes "one dataset, not twelve
APIs" (Vol 0 Part D, item 2 of the wow catalogue, §28) literally true at the
storage layer: INS-01..05 (Insights) and INT-01/05/09/10 (Intelligence) are
all consumers of KRN-17 datasets, never of another module's transactional
schema.

Not bought directly — it is `included` platform-fee substrate (Vol 0 §11).
No persona buys it; the direct "user" of its admin surface is PR-21 (System
Administrator), who configures retention and reviews materialisation health.
Every other persona who has ever opened a dashboard, a report or asked
Copilot a question is an indirect consumer.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Registers datasets' retention policy, monitors materialisation freshness and failures, resolves stuck jobs |
| PR-16 Finance Controller / CFO | Consumes KRN-17-backed reports (INS) and traces a reported number to its source transactions (lineage) when reconciling |
| PR-15 Accountant | Traces a figure in a statutory report back to the posting that produced it |
| PR-25 External CA / Auditor | Uses lineage to produce audit evidence — "show me every transaction behind this GSTR-3B line" |
| PR-26 Regulator / Inspector | Scoped read of lineage and historical snapshots as evidence, permission-fenced identically to their live-data scope (L11) |
| PR-28 Implementation Partner | Sets a tenant's retention policy defaults during onboarding, consistent with the tenant's manifest/plan |
| PR-01 Owner / Director | Consumes dashboards and KPI scorecards built on KRN-17 datasets; never interacts with KRN-17 directly |

Every persona who reads an INS dashboard, an INT-02 Copilot answer, an INT-05
simulation or an INT-09 anomaly alert is an indirect consumer of KRN-17's
materialisations — the permission fencing that applies to them there is
KRN-17-FR-001, not a separate check each of those modules reimplements.

## 3. Scope in / scope out

**In scope:** dataset registry (what is materialised, from which event
streams, at what cadence); incremental materialisation and freshness
reporting; a semantic layer of tenant-scoped metric definitions consumed by
INS-03/04; historical point-in-time snapshots; lineage capture and query
(source transaction → materialised figure); retention policy per dataset,
enforcing SEC-07 purpose-limitation and statutory minimums; row-level
security propagation into every analytical query.

**Out of scope:** the tenant-scoped knowledge graph over entities, documents,
emails, messages and call transcripts used for causal traversal and
conversational answers (INT-01 — a related but distinct construct: INT-01's
graph is built *from* KRN-17 datasets plus unstructured content, it is not
KRN-17 itself; see Open Question 2). Report and dashboard rendering (INS-01,
INS-02). Simulation logic and scenario definitions (INT-05 — KRN-17 supplies
the historical baseline, INT-05 owns the "what if"). Anomaly-detection
algorithms (INT-09). The read-only external BI connector surface itself
(INS-05 — INS-05 is the presentation/access-grant layer over a KRN-17
dataset, not a KRN-17 responsibility). Transactional writes of any kind —
KRN-17 is read-derived and append-only by construction.

## 4. Entities owned; entities consumed

**Owned:** `dataset`, `materialisation`, `lineage_edge`, `retention_policy`,
`snapshot` (Vol 1, verbatim list).

**Consumed (by ID):** `P-08 Event` (every dataset's raw material — KRN-17
subscribes to KRN-06's event stream and never reads another module's
tables directly, per L3); permission policy objects owned by KRN-03 (applied
per query, not copied); `P-06 Transaction` and `P-05 Document` by reference
only, as the ultimate lineage targets a trace resolves to.

### 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every entity below.

**`dataset`** (extrapolated from KRN-17-FR-002/003/004 and the Vol 0 §11
"semantic layer" line; not field-detailed in Vol 1 — flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `code`, `name` | string | Tenant-unique |
| `owning_module_id` | ref | The module whose domain this dataset materialises (e.g. `FIN-01`) |
| `source_type` | enum | `event_stream` \| `snapshot_projection` \| `derived_metric` |
| `source_refs` | list<string> | Event names (`module.entity.verb_past`) or entity types this dataset is built from — never a table name (L3) |
| `refresh_cadence` | enum | `real_time` \| `micro_batch` \| `daily` \| `on_demand` |
| `row_level_security_policy_ref` | ref | KRN-03 policy applied at query time (KRN-17-FR-001) |
| `metric_definitions` | list, child | `{metric_code, name, expression, unit, dimensions[]}` — the semantic layer INS-03/04 read |
| `status` | enum | `draft` \| `active` \| `deprecated` |
| `sunset_at` | timestamptz, nullable | Required when `status = deprecated` (L12) |

**`materialisation`**:

| Field | Type | Notes |
|---|---|---|
| `dataset_id` | ref | |
| `run_status` | enum | `queued` \| `running` \| `succeeded` \| `failed` \| `stale` |
| `started_at`, `completed_at` | timestamptz | |
| `incremental_watermark` | string | Last processed event cursor — makes materialisation incremental (KRN-17-FR-002) |
| `rows_processed` | integer | |
| `freshness_lag_seconds` | integer | Reported per KRN-17-FR-002, surfaced on the freshness board (§13) |
| `error_detail` | string, nullable | Present only when `run_status = failed` |

**`lineage_edge`**:

| Field | Type | Notes |
|---|---|---|
| `from_ref` | object | `{type: transaction\|event\|document, id}` — the source fact |
| `to_ref` | object | `{type: dataset_row\|metric\|report_cell, id}` — the derived figure |
| `edge_type` | enum | `derives_from` \| `aggregates` \| `joins` |
| `dataset_id` | ref | |
| `captured_at` | timestamptz | |

**`retention_policy`**:

| Field | Type | Notes |
|---|---|---|
| `scope` | object | `{level: dataset\|tenant\|module, ref_id}` |
| `retention_period` | interval | |
| `statutory_basis` | string, nullable | e.g. "GST records — 6 years" — reference only, CMP-05 owns the statutory rule itself |
| `action_on_expiry` | enum | `archive` \| `anonymise` \| `delete` |
| `last_enforced_at` | timestamptz | |

**`snapshot`**:

| Field | Type | Notes |
|---|---|---|
| `dataset_id` | ref | |
| `snapshot_at` | timestamptz | The point-in-time this snapshot represents (valid time, Vol 2 §1.6) |
| `storage_ref` | string | Object storage pointer (KRN-08 substrate, not a KRN-08 record) |
| `retention_policy_id` | ref | |

## 5. State machines

**`dataset.status`:** `draft → active → deprecated`. `deprecated` requires a
`sunset_at` and a migration note for any consumer (INS report, INT model)
that references it — no dataset a tenant or built-in report may reference is
silently removed (L12).

**`materialisation.run_status`:** `queued → running → succeeded`, with
`running → failed` and `failed → queued` (retry, bounded by KRN-15's retry
policy). `succeeded → stale` when `freshness_lag_seconds` exceeds the
dataset's declared SLA; `stale → running` re-materialises.

**`retention_policy` and `snapshot`** carry no state machine — they are
declarative configuration and immutable point-in-time captures respectively.

## 6. Standard functional requirements

- `KRN-17-FR-001` Row-level security carries into analytics; an analytical query cannot reveal what a transactional query would not. *(Vol 1, verbatim)*
- `KRN-17-FR-002` Materialisations are incremental and freshness-reported. *(Vol 1, verbatim)*
- `KRN-17-FR-003` Historical snapshots support point-in-time reporting and simulation baselines (INT-05). *(Vol 1, verbatim)*
- `KRN-17-FR-004` Lineage is queryable: any number in a report can be traced to its source transactions. *(Vol 1, verbatim)*
- `KRN-17-FR-005` A dataset's `source_refs` are declared event names or entity types only; KRN-17 never materialises by reading another module's tables directly, consistent with L3 — a dataset that needs data a module has not published as an event or exposed via API is a gap in that module's event schema, not a KRN-17 workaround.
- `KRN-17-FR-006` Retention policy is configurable per dataset, per tenant and per statutory basis, and enforces SEC-07 purpose-limitation and any statutory retention minimum; expiry triggers the declared action (archive, anonymise or delete) rather than unbounded growth or silent loss.

## 7. Differentiating requirements

- `KRN-17-DR-001` Lineage is graph-native and queryable at the individual transaction level, not a documentation exercise reconstructed after the fact: every materialised row and every semantic-layer metric carries `lineage_edge` rows back to the events that produced it, so a "trace this number" action is a single KRN-17 query available from any report (INS-01..04) or Copilot answer (INT-02) rather than a bespoke drill-through each module would otherwise have to build. *(Addition — Vol 1 lists no DR for KRN-17; Vol 0 §11's catalogue entry for KRN-17 gives no differentiating bullet either, so this is inferred from FR-004 plus wow-catalogue item 2, §28.)*

## 8. Agents

None. KRN-17 is analytical infrastructure with no autonomous behaviour of its
own — it is the substrate INT-09 (Anomaly & Signal Detection) and other
agents query, not an agent itself.

## 9. Screens and flows

All screens KRN-13-generated (L6). Standard views:

- **Dataset registry** (list + form) — PR-21: register/edit a dataset,
  its source refs, cadence and semantic-layer metric definitions.
- **Materialisation health board** (dashboard) — PR-21: freshness lag per
  dataset, failed runs, retry action.
- **Retention policy** (list + form) — PR-21, PR-28 (provisioning window):
  set retention per dataset/tenant, view statutory basis.
- **Lineage explorer** — invoked contextually from any report cell or
  Copilot answer ("trace this number") — PR-15, PR-16, PR-25, PR-26 (scoped);
  not a standalone menu item, always entered from the figure being traced.
- **Snapshot browser** — PR-21, and INT-05 (system-to-system) for simulation
  baseline selection.

## 10. API surface

Base per Vol 0 §42: `/api/v1/core/{entity}`. *(Vol 1 gives no explicit
API surface for KRN-17 — this design is proposed by the implementer per Vol
6 §4/L13; flagged in §17.)*

| Method | Path | Notes |
|---|---|---|
| CRUD | `/api/v1/core/datasets` | Write restricted to service accounts of the owning module (`PR-30`) and PR-21 |
| GET | `/api/v1/core/datasets/{id}/materialisations` | Freshness/status history |
| POST | `/api/v1/core/datasets/{id}/materialisations/retry` | Re-run a failed/stale materialisation (KRN-15 job) |
| CRUD | `/api/v1/core/retention-policies` | PR-21 |
| GET | `/api/v1/core/lineage` | `{ref: {type, id}}` → list of `lineage_edge`, permission-filtered per KRN-17-FR-001 before results are returned |
| GET | `/api/v1/core/snapshots` | Filterable by `dataset_id`, `snapshot_at` range |
| POST | `/api/v1/core/snapshots` | System-initiated (KRN-15 schedule) or INT-05-requested ad hoc baseline |

All list endpoints: cursor pagination, declared filters, field selection.
All writes: idempotency key required.

## 11. Permission matrix by persona

Actions: `create`, `read`, `update`, `delete` (soft, SEC-07 only), `trace`
(lineage query), `export`.

| Persona | dataset.create/update | materialisation.read/retry | retention_policy.create/update | lineage.trace | snapshot.read |
|---|---|---|---|---|---|
| PR-21 System Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-16 CFO | ✗ | ✗ (read only, via dashboard) | ✗ | ✓ (own entity scope) | ✓ (own entity scope) |
| PR-15 Accountant | ✗ | ✗ | ✗ | ✓ (own entity scope) | ✓ (own entity scope) |
| PR-25 External CA/Auditor | ✗ | ✗ | ✗ | ✓ (scoped, read-mostly per Vol 0 §7.2) | ✓ (scoped) |
| PR-26 Regulator/Inspector | ✗ | ✗ | ✗ | ✓ (scoped read-only) | ✓ (scoped) |
| PR-28 Implementation Partner | ✗ | ✗ | ✓ (own tenant, provisioning window only) | ✗ | ✗ |
| All other internal personas | ✗ | ✗ | ✗ | ✓ (own row/field scope, exercised implicitly via INS/INT screens) | ✗ |

**Negative cases:**
- Any persona's `lineage.trace` call that would surface a transaction outside
  their row/entity/field scope → the trace stops at the permission boundary
  and returns "restricted" rather than the underlying value, never a
  partial leak (KRN-17-FR-001, L11).
- PR-25/PR-26 attempting to trace or snapshot data outside their granted
  audit/inspection scope → 403.
- A tenant's own service account attempting `dataset.create` with a
  `source_refs` entry pointing at another module's table name rather than a
  declared event name → rejected at validation, not merely discouraged
  (KRN-17-FR-005).

## 12. Events emitted / consumed

**Emitted:**
- `core.dataset.registered`
- `core.dataset.deprecated`
- `core.materialisation.completed`
- `core.materialisation.failed`
- `core.materialisation.stale_detected`
- `core.retention_policy.updated`
- `core.retention_policy.enforced` (archive/anonymise/delete action taken)
- `core.snapshot.captured`

**Consumed:** every published `module.entity.verb_past` event named in a
dataset's `source_refs` (via KRN-06 subscription — CDC, not table access,
per L3/KRN-17-FR-005); `core.tenant.isolation_changed` (KRN-01) triggers a
re-check of per-dataset row-level security wiring after an isolation-tier
promotion.

## 13. Reports and KPIs

- Materialisation freshness board (per dataset, lag vs SLA) — PR-21.
- Lineage completeness — % of reportable figures with a resolvable trace.
- Retention compliance — datasets past their declared retention action.
- Dataset usage — which INS/INT consumers actually query each dataset
  (informs deprecation candidates without breaking L12).

No statutory reports originate in KRN-17 itself; it supplies the traceable
substrate CMP-05's filing evidence archive and INS-01's statutory report
library both depend on.

## 14. Compliance touchpoints

- `retention_policy.action_on_expiry` is the mechanism SEC-07 (Data Privacy
  & DPDP) uses to enforce purpose limitation and retention on analytical
  copies of personal data — a dataset does not get to outlive the
  transactional record's own retention rule by being "just analytics."
- Lineage (`KRN-17-FR-004`) is what makes CMP-05's filing evidence archive
  and PR-25/PR-26's audit access defensible — a filed GSTR-3B figure must
  trace to real postings, not a black-box aggregate.
- Row-level security parity (`KRN-17-FR-001`) is the specific mechanism that
  satisfies L11's "no exceptions... this includes analytics" clause.

## 15. Offline behaviour

**Profile: `online`.** KRN-17 is server-side analytical infrastructure; none
of the offline-first personas (PR-04/05/07/09/13/19/20, Vol 0 §7.3) interact
with it directly, and it has no capture surface to make offline-tolerant. No
conflict policy needed. (Dashboards and reports built on KRN-17 datasets may
themselves be cached for offline *read* by their owning module — INS-02 —
but that caching contract belongs to INS-02, not to KRN-17.)

## 16. Acceptance criteria (Given/When/Then)

**KRN-17-FR-001 — row-level security carried into analytics**
> Given user `U1` (PR-15, Accountant) whose row scope is limited to org unit `Plant-A`, and a dataset containing postings from `Plant-A` and `Plant-B`
> When `U1` runs an ad-hoc query (INS-03) or asks Copilot (INT-02) a question against that dataset
> Then only `Plant-A` rows are returned or reasoned over, `Plant-B` rows are absent from both the result set and any aggregate total, and the same query issued by `U2` (PR-16, CFO, entity-wide scope) returns both.

**KRN-17-FR-002 — incremental, freshness-reported materialisation**
> Given dataset `D1` last materialised at watermark `E-1000` with `freshness_lag_seconds = 40`
> When 25 new events (`E-1001..E-1025`) are published on `D1`'s declared source stream
> Then the next materialisation run processes only `E-1001..E-1025` (not a full re-scan), `materialisation.rows_processed` reflects the incremental set, and `freshness_lag_seconds` is recomputed and visible on the health board within the declared cadence.

**KRN-17-FR-003 — point-in-time snapshots**
> Given a snapshot of dataset `D2` captured at `2027-03-31T18:30:00Z`
> When INT-05 requests a simulation baseline "as of 31-Mar-2027"
> Then the snapshot is returned unchanged regardless of mutations to `D2` after that timestamp, and a second snapshot captured a month later coexists without overwriting the first.

**KRN-17-FR-004 — lineage traceable to source transactions**
> Given a GST filing report figure (INS-01) showing taxable value ₹4,25,000 for GSTIN `27ABCDE1234F1Z5` in period `2027-02`
> When PR-15 invokes "trace this number"
> Then KRN-17 returns the exact set of `P-06 Transaction` records that sum to ₹4,25,000, each resolvable to its source `P-05 Document`, permission-filtered per FR-001, with no manual reconciliation step.

**KRN-17-FR-005 — no direct table access as a dataset source**
> Given a proposed dataset registration with `source_refs: ["scm_02.stock_ledger_table"]` (a raw table name, not a published event)
> When the registration is submitted
> Then it is rejected at validation with a stable machine error code naming the offending `source_refs` entry, and no materialisation job is scheduled.

**KRN-17-FR-006 — retention enforcement**
> Given retention policy `RP1` on dataset `D3` with `retention_period = 6 years` and `action_on_expiry = anonymise`
> When a snapshot of `D3` passes the 6-year mark
> Then it is anonymised per the declared action, `retention_policy.last_enforced_at` is updated, `core.retention_policy.enforced` is emitted, and the anonymised snapshot remains queryable for aggregate statutory purposes without exposing the original personal data.

**KRN-17-DR-001 — graph-native, single-hop lineage**
> Given a KPI scorecard tile (INS-04) showing "DSO: 42 days" and a Copilot answer (INT-02) citing the same figure in a causal explanation
> When either surface's "trace this number" action is invoked
> Then both resolve through the same `lineage_edge` query against the same underlying dataset, return an identical source-transaction set, and neither INS-04 nor INT-02 contains its own bespoke drill-through logic — both call the one KRN-17 lineage API.

## 17. Open questions

Flagged per Vol 6 §4/L13:

1. **Field-level detail for all five owned entities** (§4.1) is not given in
   Vol 1 — only their names and purpose are stated. The fields proposed here
   (including the `dataset.metric_definitions` child structure standing in
   for "semantic layer") are a reasonable minimum, not a verbatim source.
   Please confirm or amend.
2. **Boundary between KRN-17's "semantic layer" and INT-01's "semantic
   graph"** — Vol 0 describes both in similar language (§11 KRN-17: "semantic
   layer"; §13 INT-01: "one tenant-scoped knowledge graph"). This draft
   assumes KRN-17's semantic layer is a flat metric/dimension catalogue for
   structured BI-style queries (INS-03/04), while INT-01's graph is a
   separate, broader construct spanning unstructured content (documents,
   transcripts, messages) and is *built from* KRN-17 datasets plus that
   unstructured content rather than being the same object. Confirm this
   boundary before INT-01's Vol 3 file is drafted, to avoid the two modules
   disagreeing about which one owns metric definitions.
3. **API surface and event names** (§10, §12) are not specified in Vol 1 at
   all for KRN-17 — this entire section is the implementer's proposed design
   per Vol 6 §4/L13's instruction to design and flag where Vol 1 gives no
   explicit API/Events lines. Please confirm or amend before contract tests
   are written against it.
4. **Retention default periods per statutory basis** (e.g. the "6 years"
   used in the FR-006 acceptance sample) are illustrative only — the actual
   statutory retention schedule (GST, Companies Act, labour law records,
   DPDP-driven personal-data limits) is CMP-05/SEC-07 domain knowledge that
   should populate `retention_policy` defaults per manifest, not be
   hard-coded in KRN-17. Confirm CMP-05/SEC-07 is the source of truth for
   these numbers when those Vol 3 files are drafted.
5. **Lineage granularity** — whether `lineage_edge` is captured at
   individual-field granularity (e.g. "this cell came from exactly these
   three line items") or only at record/transaction granularity is not
   specified in Vol 1. This draft assumes transaction-level granularity as
   the minimum bar for FR-004 and DR-001; field-level lineage would be a
   richer, costlier design. Confirm which is required before INT-02's
   causal-traversal acceptance criteria are drafted, since "why did Nashik
   margin drop" (Vol 0 §13 INT-02) plausibly needs field-level precision.
