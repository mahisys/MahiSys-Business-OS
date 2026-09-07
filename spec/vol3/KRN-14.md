# KRN-14 · Search & Semantic Index

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-01, KRN-02, KRN-03, KRN-04, KRN-06

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-14)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

Full-text and vector indexing across records, documents and communications —
the substrate INT-01 (Semantic Graph) is built on (Vol 1 §KRN-14). Every
entity in the platform, across all twelve primitives, is searchable through
one index rather than a per-module search box, and "search" and "ask" share
that one substrate rather than diverging into two systems (KRN-14-DR-001).

Not bought directly — `included` platform-fee substrate. The direct user of
its admin surface is PR-21 (System Administrator), who monitors index health
and coverage; every other persona consumes it implicitly through the search
bar present on every screen (KRN-13) and through INT-01/INT-02 once those
modules exist.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Monitors index lag, coverage and failure queue; triggers backfill/reindex jobs; reviews `index_policy` for a newly Studio-generated entity |
| PR-01 Owner / Director | Uses global search to find any record fast, on mobile |
| PR-08 Sales Manager, PR-15 Accountant, PR-16 CFO, and every web-surfaced internal persona | Uses scoped and global search as a daily navigation tool |
| PR-22 Customer, PR-23 Dealer, PR-24 Vendor | Uses portal-scoped search (their own orders, invoices, tickets only) |
| PR-25 External CA / Auditor, PR-26 Regulator | Uses read-mostly scoped search against the evidence they are entitled to see, never more |
| PR-28 Implementation Partner | Searches within the tenant they are provisioning, scoped to the provisioning window |
| PR-29 Agent | Queries the index as a tool call, scoped to the agent's own registered data scope (Vol 0 §27.2) |

Every persona that can log in is, implicitly, a user of KRN-14 — it is the
one search substrate behind every screen's search bar (Vol 0 §11 KRN-14:
"global search, scoped search, permission-filtered results, fuzzy matching,
recent and suggested").

## 3. Scope in / scope out

**In scope:** full-text and vector indexing of platform entities; permission
filtering at query time; global and scoped search; fuzzy/typo-tolerant
matching; recent and suggested results; incremental event-driven indexing;
sensitive-field exclusion by declaration; index health, lag and coverage
observability; reindex/backfill jobs.

**Out of scope:** the semantic *graph* itself — relationship traversal,
causal chains, entity resolution across documents ("why did Nashik margin
drop") is INT-01, which is built on top of KRN-14's indexed corpus, not
inside it. Conversational answering is INT-02 (Copilot). Declaring which
fields of an entity are identifiers, meaning-bearing or sensitive is done in
KRN-04's metadata layer; KRN-14 consumes that declaration, it does not
define it. Embedding model selection, routing and cost control is INT-12
(Model Gateway) — KRN-14 calls it, it does not own it.

## 4. Entities owned; entities consumed

**Owned:** `index_document`, `embedding`, `index_policy`, `index_job`.

**Consumed (by ID):** none at the data level — per L3, KRN-14 never reads
another module's tables. It consumes two kinds of upstream signal instead:

1. **Metadata.** KRN-04 declares, per entity and field, whether a field is
   an identifier, meaning-bearing, or sensitive-and-excluded (Vol 2 §3.5).
   KRN-14 subscribes to KRN-04's metadata-change events and materialises its
   own `index_policy` copy — it does not read KRN-04's tables directly.
2. **Content.** Every module's own mutation events on KRN-06 (
   `module.entity.verb_past`) are the only channel through which KRN-14 ever
   sees a module's data. The event payload, filtered through that entity's
   `index_policy`, is what gets tokenised and embedded. KRN-14 conceptually
   indexes instances of all twelve primitives (`P-01`..`P-12`) but owns none
   of them.

### 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every entity below.

**`index_document`** (not field-detailed in Vol 1 — flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `subject_type` | string | The owning module's entity type, e.g. `MFG-05:job_work_challan`, or a primitive shorthand, e.g. `P-05:Document` |
| `subject_id` | ref | The source record's `id` |
| `source_module` | string | Module ID that emitted the source event |
| `index_policy_id` | ref | Policy version applied |
| `identifier_text` | string | Concatenated identifier fields (number, name, code) — always indexed, never excluded |
| `content_text` | text | Concatenated meaning-bearing fields, post-exclusion, used for full-text search |
| `content_hash` | string | Detects staleness against the current source state |
| `scope_snapshot` | JSONB | Denormalised `{tenant_id, entity_id, org_unit_path, owner_id}` used to pre-filter candidates before the live KRN-03 check (KRN-14-FR-001 — this is an optimisation, never a substitute for the query-time permission check) |
| `language` | string | Detected/declared language (KRN-19) |
| `index_status` | enum | `pending` \| `indexed` \| `stale` \| `excluded` \| `failed` |
| `last_indexed_at` | timestamptz | |
| `lag_ms` | integer | `last_indexed_at - source event occurred_at`, for KRN-14-FR-004 lag monitoring |

**`embedding`**:

| Field | Type | Notes |
|---|---|---|
| `index_document_id` | ref | |
| `model_id` | ref | INT-12 model identifier; recorded so a model change is traceable and re-embeddable |
| `vector` | vector | `pgvector`, dimension per `model_id` |
| `chunk_no` | integer | Long content is chunked; 0 for single-chunk documents |

**`index_policy`** (materialised projection of KRN-04's declaration, not the
authoritative source of it):

| Field | Type | Notes |
|---|---|---|
| `entity_type` | string | Matches `index_document.subject_type` |
| `identifier_fields` | list<string> | Never excluded, always indexed |
| `semantic_fields` | list<string> | Meaning-bearing, embedded |
| `excluded_fields` | list<string> | Sensitive — salary, medical content, KYC identifiers (KRN-14-FR-003) |
| `embedding_model_id` | ref | INT-12 model to use for this entity type |
| `reindex_trigger_events` | list<string> | Event names that mark this entity's index stale |
| `version` | integer | Bumped on every KRN-04 declaration change |

**`index_job`**:

| Field | Type | Notes |
|---|---|---|
| `job_type` | enum | `incremental` \| `backfill` \| `full_reindex` \| `policy_migration` |
| `scope` | JSONB | `{entity_type?, entity_id?, tenant_id?}` — narrowest scope wins |
| `status` | enum | `queued` \| `running` \| `completed` \| `failed` \| `cancelled` |
| `records_processed`, `records_failed` | integer | |
| `triggered_by` | actor ref | |
| `started_at`, `completed_at` | timestamptz | |

## 5. State machines

**`index_document.index_status`:** `pending → indexed`, with `indexed →
stale` on a matching `reindex_trigger_events` arrival, `stale → indexed` on
re-index, `pending/stale → failed` on processing error with retry back to
`pending`, and `pending → excluded` when policy resolution determines the
entity type carries no indexable content (fully sensitive) — `excluded` is
terminal for that document unless the policy itself changes.

**`index_job.status`:** `queued → running → completed`, with `running →
failed` (visible, not silently dropped) and `queued/running → cancelled` on
operator cancellation (mirrors KRN-15-FR-004 cancellability, since
`index_job` executes on the KRN-15 substrate once available — §17).

## 6. Standard functional requirements

- `KRN-14-FR-001` Results are permission-filtered at query time, never post-filtered. *(Vol 1, verbatim)*
- `KRN-14-FR-002` Each entity declares its semantic index policy (Vol 2 §3.5): which fields are identifiers, which carry meaning, which are excluded as sensitive. *(Vol 1, verbatim)*
- `KRN-14-FR-003` Sensitive fields (salary, medical content, KYC identifiers) are excluded from embeddings by declaration. *(Vol 1, verbatim)*
- `KRN-14-FR-004` Indexing is incremental, event-driven and lag-monitored. *(Vol 1, verbatim)*
- `KRN-14-FR-005` Search supports both global (cross-entity, cross-module) queries and scoped queries (a single module, entity type, or record's related items). *(Addition — from Vol 0 §11 KRN-14 standard capability list, not itemised as an FR in Vol 1.)*
- `KRN-14-FR-006` Keyword search is fuzzy and typo-tolerant; a misspelled party name or item code still surfaces the intended result within a declared edit-distance threshold. *(Addition — Vol 0 §11.)*
- `KRN-14-FR-007` Each user's recent searches and permission-scoped suggested/trending results are surfaced ahead of query entry, personalised per user and never leaking another user's search activity. *(Addition — Vol 0 §11.)*
- `KRN-14-FR-008` The index and its embeddings are tenant-isolated consistent with KRN-01's isolation tier; a query issued under any isolation tier never returns, ranks against, or leaks the existence of another tenant's vectors or documents. *(Addition — L11 makes this non-negotiable even though Vol 1 does not state it explicitly for the index.)*

## 7. Differentiating requirements

- `KRN-14-DR-001` The same index serves keyword search and semantic retrieval, so "search" and "ask" share one substrate rather than diverging into two systems. *(Vol 1, verbatim)*
- `KRN-14-DR-002` Ranking blends lexical and semantic relevance in one hybrid score per query, so no module or the Copilot (INT-02) needs its own reranking layer — a differentiator only possible because keyword and vector indexing share one `index_document`/`embedding` pair rather than living in separate systems that would need to be reconciled after the fact. *(Addition.)*

## 8. Agents

None registered by KRN-14 itself. It is, however, the substrate INT-01
(Semantic Graph) and INT-02 (Copilot) query on every agent's and every
user's behalf, and every registered agent's tool calls that touch "find a
record" resolve through this module's permission-filtered query path — an
agent never gets a search result a human in its position could not see
(L11, L9).

## 9. Screens and flows

All screens are KRN-13-generated from KRN-04 metadata (L6).

- **Global search bar** (persistent, all web/mobile surfaces) — every
  logged-in persona: type-ahead with fuzzy matching, recent and suggested
  results (KRN-14-FR-006/007), results grouped by entity type, each result
  permission-filtered before render.
- **Search results screen** (full page) — facets by entity type, module,
  date range, status; drill-through to the source record.
- **Index health dashboard** — PR-21 only: coverage (% eligible entities
  indexed), lag (p50/p95), failure queue, per-`index_policy` version, manual
  reindex trigger.
- **Index policy viewer** — PR-21, read-only: shows the resolved
  `index_policy` per entity type as materialised from KRN-04; editing the
  underlying declaration happens in KRN-04/Studio, not here.

## 10. API surface

Base per Vol 0 §42: `/api/v1/core/{entity}`. *(Not given in Vol 1 for
KRN-14 — designed here per convention; flagged in §17.)*

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/core/search` | `{q, scope?, entity_types?, cursor}` — the one query endpoint behind both global and scoped search (KRN-14-FR-005); always permission-filtered server-side |
| GET | `/api/v1/core/search/suggested` | Per-user, permission-scoped |
| GET | `/api/v1/core/search/recent` | Per-user, private to that user |
| GET | `/api/v1/core/index-policies` | PR-21 only; read-only projection of KRN-04 declarations |
| GET | `/api/v1/core/index-jobs` | PR-21 only; filterable by `status`, `job_type` |
| POST | `/api/v1/core/index-jobs` | PR-21 only; `{job_type, scope}` — triggers backfill/reindex |
| POST | `/api/v1/core/index-jobs/{id}/cancel` | PR-21 only |

All list endpoints: cursor pagination, declared filters, field selection.
All writes: idempotency key required (Vol 1 §1.2).

## 11. Permission matrix by persona

Actions: `search` (query, always permission-filtered), `index_admin.read`
(health/policy/job visibility), `index_admin.manage` (trigger/cancel jobs).

| Persona | search (own scope) | index_admin.read | index_admin.manage |
|---|---|---|---|
| PR-21 System Admin | ✓ | ✓ | ✓ |
| PR-01..20 internal personas | ✓ (results filtered to their KRN-03 row/field scope) | ✗ | ✗ |
| PR-22 Customer, PR-23 Dealer, PR-24 Vendor | ✓ (portal-exposed entities only) | ✗ | ✗ |
| PR-25 External CA / Auditor, PR-26 Regulator | ✓ (scoped grant only, read-mostly) | ✗ | ✗ |
| PR-27 Job Candidate | ✓ (own application record only) | ✗ | ✗ |
| PR-28 Implementation Partner | ✓ (own tenant, provisioning window) | ✓ (own tenant, provisioning window) | ✗ |
| PR-29 Agent | ✓ (own registered data scope, Vol 0 §27.2) | ✗ | ✗ |
| PR-30 Integration Service Account | ✓ (own scoped grant, rate limited) | ✗ | ✗ |

**Negative cases:**
- Any persona's query returning a result their KRN-03 scope would reject on
  a direct record read → excluded from the result set entirely, not shown
  redacted (KRN-14-FR-001: filtered at query time, never post-filtered — a
  redacted-but-visible hit would itself leak existence).
- PR-25 (Auditor) querying outside their scoped evidence grant → zero
  results for the out-of-scope entity types, no error that would reveal
  their existence.
- Any non-PR-21/28 persona calling `POST /index-jobs` → 403, audited.
- A cross-tenant query attempt (malformed `tenant_id` in a service-account
  call) → 403, audited, zero results, per KRN-14-FR-008.

## 12. Events emitted / consumed

**Emitted** (not given in Vol 1 for KRN-14 — designed here; flagged in
§17):
- `core.index_document.indexed`
- `core.index_document.excluded`
- `core.index_document.failed`
- `core.index_job.completed`
- `core.index_job.failed`

**Consumed:** not a fixed list — a declarative subscription. KRN-14
subscribes to (a) KRN-04's metadata-change events, to keep `index_policy`
current, and (b) every event named in any entity type's
`reindex_trigger_events` list, which in practice means every module's
`module.entity.verb_past` events for entity types that have a non-empty
`index_policy`. No module needs to know KRN-14 exists (L3) — it is KRN-14's
job to subscribe broadly and filter by policy, not the emitting module's job
to notify it specifically.

## 13. Reports and KPIs

- Index coverage (% of eligible entity instances indexed) per module.
- Index lag, p50/p95, from source event `occurred_at` to `indexed`.
- Index failure rate and failure-queue depth.
- Search query latency, p95.
- Zero-result query rate (surfaced to PR-21 as a content/metadata gap
  signal, not a tenant-facing report).

## 14. Compliance touchpoints

- L11 (permission layer) is enforced entirely inside KRN-14's query path —
  this module *is* the mechanism by which "no query executes without
  tenant, role and row scope applied" is kept true for search, analytics
  drill-through and agent queries alike.
- KRN-14-FR-003's sensitive-field exclusion is a DPDP/SEC-07
  privacy-by-declaration control: salary, medical content and KYC
  identifiers never enter an embedding, so they cannot be retrieved by a
  semantic query even indirectly.
- On a SEC-07 hard-deletion (tenant data-deletion process), the
  corresponding `index_document` and `embedding` rows are purged in the
  same operation — a soft-deleted source record is merely excluded from
  results (`index_status = excluded`), but a hard-deleted one must leave no
  vector or text behind.
- CMP-06 (Regulated Records) tenants may require a query-audit trail (who
  searched what, when) beyond the KRN-10 baseline — see §17.

## 15. Offline behaviour

**Profile: `read`** *(not stated in Vol 1 for KRN-14 — extrapolated;
flagged in §17)*. The mobile app may cache a device's own recent-search and
last-fetched-results list for offline display, but a fresh query requires
connectivity: permission filtering (KRN-14-FR-001) must be evaluated
server-side against current KRN-03 state, and a stale offline permission
snapshot could leak a since-revoked visibility. No conflict policy applies
— this is a read path with no device-originated write.

## 16. Acceptance criteria (Given/When/Then)

**KRN-14-FR-001 — permission-filtered at query time**
> Given user `U1` (PR-08 Sales Manager, scoped to Territory A) and a sales order in Territory B that matches `U1`'s search text exactly
> When `U1` runs the query
> Then the Territory B order does not appear in the result set at all, and no count, snippet or existence hint for it is returned.

**KRN-14-FR-002 — declared semantic index policy**
> Given entity type `SLS-04:deal` with an `index_policy` declaring `name`/`account_name` as identifier fields, `notes`/`loss_reason` as semantic fields, and no excluded fields
> When a deal is created with those fields populated
> Then `index_document.identifier_text` contains the identifier fields, `content_text` and its embedding are derived only from the declared semantic fields, and a policy change (e.g. adding an excluded field) is reflected in the next `index_job` without requiring a code change.

**KRN-14-FR-003 — sensitive fields excluded from embeddings**
> Given entity type `PPL-08:payroll_line` with `basic_salary` and `net_pay` declared `excluded_fields`
> When a payroll line is created or updated
> Then no embedding is generated containing salary figures, `identifier_text` contains only the employee and period identifiers, and a semantic query for an approximate salary figure returns no payroll-line hits.

**KRN-14-FR-004 — incremental, event-driven, lag-monitored indexing**
> Given a quotation is updated at `14:00:00`
> When the update event is published on KRN-06
> Then the corresponding `index_document` reaches `indexed` status without a scheduled full reindex, `lag_ms` is recorded, and a lag exceeding the declared SLO raises a KRN-14 health signal to PR-21 rather than failing silently.

**KRN-14-FR-005 — global vs scoped search**
> Given a user on a work order's detail screen who searches "steel"
> When they use the scoped search widget bound to that work order's related items
> Then only items referenced by that work order match; the same query run from the global search bar returns matches across every permitted entity type.

**KRN-14-FR-006 — fuzzy matching**
> Given an item named "Stainless Steel Flange" indexed
> When a user searches "stainles steel flang"
> Then the item is returned within the top results, ranked by edit-distance-adjusted relevance.

**KRN-14-FR-007 — recent and suggested, per user**
> Given user `U1` searched "Nashik dealer claim" five minutes ago
> When `U1` opens the search bar again with no query typed
> Then "Nashik dealer claim" appears in `U1`'s recent list, and no other user's recent searches ever appear in `U1`'s list.

**KRN-14-FR-008 — tenant isolation of the index**
> Given tenant `T1` on `dedicated` isolation and tenant `T2` on `row` isolation, both holding an item named "Bearing 6205"
> When `T1`'s user searches "Bearing 6205"
> Then only `T1`'s item is returned, regardless of `T1`'s or `T2`'s isolation tier, and no ranking signal or embedding neighbour from `T2` is ever computed against `T1`'s query.

**KRN-14-DR-001 — one substrate for search and ask**
> Given the same `index_document`/`embedding` pair for a customer record
> When a user runs a keyword search for the customer's name and, separately, INT-02 asks a natural-language question that resolves to the same customer
> Then both paths query the same underlying index with the same permission filter, and a policy or content change is reflected identically in both without a second indexing pipeline.

**KRN-14-DR-002 — hybrid ranking**
> Given a query that has both a strong lexical match (exact item code) and a strong semantic match (a differently-worded but conceptually matching note) among the candidate set
> When results are ranked
> Then both are returned in one ranked list ordered by a combined lexical+semantic score, with no separate "keyword results" and "AI results" sections to reconcile.

## 17. Open questions

Flagged per Vol 6 §4/L13:

1. **Field-level detail for `index_document`, `embedding`, `index_policy`,
   `index_job`** (§4.1) is not given in Vol 1 — only entity names and
   purpose. The fields proposed here are a reasonable minimum consistent
   with KRN-14-FR-001..004. Please confirm or amend.
2. **API surface and event names** (§10, §12) are not given in Vol 1 for
   KRN-14 at all (unlike KRN-16, which carries a Vol 1 acceptance sample).
   Everything in those two sections is designed here from Vol 0 §42
   conventions and should be treated as a first proposal, not a verbatim
   source.
3. **Reindexing execution substrate.** `index_job` (full reindex, backfill)
   naturally wants to run on KRN-15 (Scheduler & Job Runtime), but Vol 0
   §39 places KRN-14 in Phase 0 and KRN-15 in Phase 1 — KRN-14 is built and
   must function *before* KRN-15 exists. This draft assumes incremental,
   event-driven indexing (KRN-14-FR-004) works standalone via a lightweight
   internal worker loop from Phase 0, and full-tenant reindex/backfill
   capability (`index_job` beyond `incremental`) lands once KRN-15 is
   available in Phase 1. Confirm this phase-boundary assumption before
   Phase 0 acceptance testing is written.
4. **Embedding generation depends on INT-12 (Model Gateway), which is
   Phase 2.** This draft assumes keyword/full-text search (Postgres FTS)
   is fully functional from Phase 0 using `identifier_text`/`content_text`
   alone, while the `embedding` table and vector/semantic retrieval
   (KRN-14-DR-001's "ask" half, and DR-002 hybrid ranking) remain
   dark/unpopulated until INT-12 ships in Phase 2. Confirm that KRN-14 is
   expected to degrade to keyword-only search for two phases, since Vol 0/1
   do not state this explicitly.
5. **Query-audit trail for regulated tenants** (§14) — Vol 1 does not state
   whether every search query itself must be logged to KRN-10 (as opposed
   to only mutations), which has real storage and performance cost at
   scale. This draft assumes query logging is off by default and enabled
   per-tenant for CMP-06 tenants only. Confirm.
6. **Offline profile (`read`)** (§15) is not stated in Vol 1 for KRN-14 —
   extrapolated from the module's nature (a query substrate, not a capture
   surface). Confirm against the mobile app's actual UX requirement before
   PPL-05/SLS-10-class offline personas' search behaviour is specified.
