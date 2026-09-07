# Decisions taken during build — for human review

Format: date, decision ID (where applicable), decision, reasoning, who decided.

---

## D-11 — Book of record

**Decision:** Mirror mode first. Tally remains authoritative for a defined
period; the OS runs alongside with daily reconciliation reporting (Vol 0
§38). Cutover to OS-as-book-of-record happens once the owner is confident,
not on a fixed date.

**Reasoning:** Lower risk for the pilot and for early FIN development — the
migration acceptance tests (opening trial balance, stock valuation, ageing,
GST return reproduction — Vol 0 §38) get to prove out against a live parallel
run before anything depends on the OS being correct.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** Migration design (KRN + ITG-02 Tally Bridge), FIN-01..08 scope
when built in Phase 3, sales/onboarding narrative (COM-05).

---

## D-12 — Technology stack

**Decision:** Adopt Vol 1 §1.1's recommendation as-is, layered onto GCP:

- **Datastore:** PostgreSQL 16+ (GCP Cloud SQL, migrating to AlloyDB if scale
  demands) — JSONB for `tnt` extensions, native RLS for T11, `pgvector` for
  INT-01.
- **Language:** TypeScript, Node 22+, across API and workers.
- **Data access:** Query builder (Kysely or Drizzle), not a full ORM.
- **Queue/jobs:** Postgres-backed (pgmq or River) at Phase 0; revisit only if
  volume demands a dedicated broker.
- **Cache:** Redis (GCP Memorystore).
- **Object storage:** S3-compatible interface over GCS.
- **Search:** Postgres FTS + pgvector; no separate search cluster at Phase 0.
- **Web frontend:** React + a metadata-driven renderer (KRN-04/KRN-13 render
  screens from entity/layout metadata — L6; no hand-built forms).
- **Mobile (iOS + Android):** React Native, sharing TypeScript logic, API
  client and design tokens with the web renderer; offline store required
  (KRN-16).
- **Infra:** Cloud Run for API/web, Cloud Build/GitHub Actions for CI/CD,
  Cloud SQL, Memorystore, GCS, Cloud CDN.

**Reasoning:** Matches the stack independently recommended earlier in this
engagement before Vol 1-2 were supplied, and matches Vol 1 §1.1's own
reasoning: one datastore to operate rather than four, one language end to
end, capacity is the binding constraint (Vol 0 §40) not architecture novelty.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** All of Vol 1 (per Vol 0's own gating text); every
`[stack-bound]` section in Vol 1.

---

## D-13 — Deployment model

**Decision:** Pure SaaS only for now. On-prem/dedicated-instance support is
deferred until a regulated-vertical customer (BFSI/Pharma, Phase III per
Vol 0 §31) actually requires it.

**Reasoning:** KRN-01's isolation tiers (row / schema / dedicated instance)
already give strong per-tenant isolation on GCP-hosted infrastructure without
true on-prem deployment. Building on-prem/local-model support into INT-12 and
kernel packaging now would add real complexity for a Phase III need, against
Vol 0 §40's explicit depth-over-breadth guidance.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** Kernel packaging, INT-12 (Model Gateway) design.

---

## D-14 — Ordder.io and Karyaflo

**Decision:** Deferred. Not relevant to current build scope.

**Reasoning:** Neither product is described anywhere in Vol 0, 1 or 2, and
the human confirmed it does not need resolving now. Does not block Phase 0
kernel work (only blocks product boundary/roadmap/brand decisions per Vol 0
§43.2).

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion.

**Revisit:** Before any work that would touch Ordder.io/Karyaflo integration,
product boundary, or brand positioning relative to them.

---

## D-15 — Billing metric

**Decision:** Seats by user type — full / light / self-service / external,
per Vol 0 §33.4.

**Reasoning:** This pricing structure is already fully designed in Vol 0 and
maps directly onto the persona model (PR-01..30). Simplest to implement in
KRN-20 and avoids under-pricing floor/field roles (self-service is free above
a threshold; light/external priced differently from full seats), consistent
with Vol 0 §33.3's rule against billing on self-reported metrics.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** COM-03 (Pricing & Quote Engine), KRN-20 (Licensing &
Entitlement).

---

## D-16 — AI unit economics (§29.3 calculation)

**Decision:** Deferred. This is a calculation, not a decision, and requires
pricing targets (target gross margin, target Indian SMB price point) that
have not yet been supplied. Does not block Phase 0 kernel work — it only
gates the pricing model (§33) and the Intelligence tier boundary, both
downstream of Phase 2 (Intelligence) and later Commerce work.

**Reasoning:** Cannot be computed responsibly without target margin/price
inputs; guessing them would produce a number that looks authoritative but
isn't grounded, which is worse than not having one yet.

**Decided by:** Carried forward from Vol 0 §29.3 (not yet closed); flagged
2026-09-07.

**Revisit:** Before Phase 2 (Intelligence) pricing work or Commerce (COM-03)
work begins — request target gross margin and target price point from the
human at that point, then compute against Claude API / Vertex AI pricing.

---

## D-17 — Partner strategy timing

**Decision:** Deferred — decide later, when Phase 2 Commerce planning starts.

**Reasoning:** Only blocks COM-06 (Partner & Reseller Channel) and the
manifest certification model, both well downstream of Phase 0 kernel work
(Vol 0 §39 places COM-01..06 from Phase 2 onward; STU-08 itself is a Phase 1
add-on). No need to force this decision now.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Revisit:** At Phase 2 Commerce planning.

---

## Summary (D-11..D-17)

All of D-11 through D-17 are now closed or explicitly, deliberately deferred
with a stated revisit trigger, per Q-002 in `/spec/questions.md`. Per Vol 0's
closing line and Vol 6 §11, Vol 1 (Kernel SRS) and the pilot slice gate are
therefore unblocked. Phase 0 (Kernel: KRN-01..14, CMP-01..04, ITG-01 per
Vol 0 §39) may begin, subject to the separate blocker raised in Q-003
(missing Vol 3 module SRS files with full acceptance criteria — required by
Vol 6 L13 before any code is written).

---

## Tier-1 kernel Vol 3 review decisions (D-18 through D-30)

Resolved 2026-09-07, working through `/spec/vol3-review-summary.md` §2
(the 12 architectural questions flagged across the 20 kernel Vol 3 drafts).
All decided by the human via AskUserQuestion. Each entry below states
whether the corresponding Vol 3 file(s) needed a substantive edit as a
result, or only needed the open question marked resolved.

---

### D-18 — Physical model for KRN-12 platform-shared (`sys`) reference data

**Decision:** Physically replicate reference data (HSN/SAC, GST rate
schedules, currencies, geography, banks) per tenant. Every tenant holds its
own real copy, each row carrying a genuine `tenant_id`, matching Vol 2
§1.2's universal-fields rule literally — no declared exception to that rule
is needed.

**Reasoning (human's choice, against the recommended default):** Keeps the
universal-fields rule (Vol 2 §1.2) simple and exception-free — every row in
the system, without exception, carries a real `tenant_id` and goes through
identical row-level security logic (KRN-01 §3.1). No special-casing for
"platform pseudo-tenant" visibility anywhere in the query/permission layer.
Trades away a single shared physical table for update fan-out to every
tenant's copy when GST rates or HSN mappings change — accepted as the cost
of a uniform data model.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion.

**Affects:** `spec/vol3/KRN-12.md` — reworked (§4.1 field design, §11
permission matrix framing, §16 acceptance criteria, §17 open question
closed). See file for the updated design.

---

### D-19 — KRN-12's central-update mechanism for reference data

**Decision:** KRN-12 calls ITG-07 (Government APIs) directly to receive
central updates, as a documented, explicit exception to Vol 0 §5's
no-upward-layer-dependency rule (Layer 0 depending on Layer 1).

**Reasoning (human's choice, against the recommended default):** ITG-07 is
the natural, already-built source for this data (GSTN, HSN/SAC, pincode,
DGFT feeds per Vol 0 §12) — routing it through a separate internal
platform-ops process would duplicate integration work ITG-07 already does.
The exception is scoped narrowly (KRN-12's own central-refresh job calling
ITG-07's read-only government-data endpoints, not a general license for
Layer 0 to depend on Layer 1) and should be documented as exactly that — a
named, bounded exception — not a precedent for other L0-calls-L1 shortcuts.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion.

**Affects:** `spec/vol3/KRN-12.md` — reworked (§3 scope note on the
exception, §6 requirement text for KRN-12-DR-001, §10 API/job description,
§17 open question closed). Also relevant to `CLAUDE.md`/Vol 6 review: this
is now a standing, named exception to Vol 0 §5 and should be cited (not
re-litigated) if a similar L0→L1 pattern appears in a later module.

---

### D-20 — KRN-07 rule-evaluation events and L4 scope

**Decision:** No KRN-06 event is emitted per rule evaluation. The
`evaluation_log` entry is the durable, explainable record of the outcome;
L4 ("never emit a state change without an event") is read as applying to
state changes with downstream consequence, not to every read-like
evaluation that merely records an outcome for explainability.

**Reasoning:** Accepting the recommended default. Avoids event-store volume
that would dwarf actual business transactions at scale (thousands of
pricing/credit evaluations per tenant per day), most of which nothing else
in the system needs to react to. `evaluation_log`'s own audit trail already
satisfies the transparency goal L4 exists to serve.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** `spec/vol3/KRN-07.md` — no change needed; the draft already
assumed this reading (§17 open question closed, confirmed not overridden).

---

### D-21 — Phase-order "degrade gracefully" as a standing convention

**Decision:** Adopted as a standing rule: whenever a Phase 0 (or any
earlier-phase) kernel module's Vol 1/Vol 3 text references a capability
owned by a module that ships in a later phase, the earlier module
implements its own piece fully and treats the later dependency's
field/integration/behaviour as absent, opaque, or degraded until that
module ships — never blocking on it, and never becoming a permanent stub
(distinct from Vol 6's ban on stubbing an *incomplete same-phase*
dependency, which remains absolute).

**Reasoning:** Accepting the recommended default. Three independent Vol 3
drafts (KRN-09→SEC-07, KRN-10→KRN-18, KRN-14→KRN-15/INT-12) converged on
this same resolution without coordinating, which is itself evidence it is
the natural reading of the build-order model (Vol 0 §39) applied to
forward references. Stating it once avoids re-deriving it for every future
module that references a later-phase capability.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** No Vol 3 file changes — confirms the existing assumptions in
`KRN-09.md`, `KRN-10.md`, `KRN-14.md` without modification. Should be
cited as precedent for any future module hitting the same pattern, rather
than re-asked as a new question each time.

---

### D-22 — KRN-08 (Document Service) vs OPS-11 (Document Management) split

**Decision:** Confirmed as drafted. KRN-08 is the production/rendering
engine (document type + data + template → print-accurate file: invoices,
challans, job cards). OPS-11 is the repository/knowledge-management layer
(folders, taxonomy, versioning, check-in/check-out, search) over any file,
including KRN-08's own rendered outputs and manually uploaded knowledge
documents (SOPs, contracts, drawings).

**Reasoning:** Accepting the recommended default. Clean division of
concerns — one module produces documents, the other organises and finds
them — mirroring how COM-04 already wraps KRN-01 as an application layer
over kernel data.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** No Vol 3 file changes — confirms `KRN-08.md`'s existing §17
open question as resolved.

---

### D-23 — KRN-10 (Audit & Immutable Log) vs SEC-06 (Audit & Evidence) split

**Decision:** Confirmed as drafted. KRN-10 is the kernel write path and
low-level query/export API (every mutation's before/after values, hash
chain, tamper-evidence verification as a raw capability), needed from
Phase 0 since every other module depends on it existing. SEC-06 (Phase 8,
Add-on) is the persona-facing workflow built on top of KRN-10's API:
scoped auditor access for PR-25/26, packaging a specific evidence pack for
a specific external audit engagement, search UX.

**Reasoning:** Accepting the recommended default. SEC-06 becomes a thin
application layer over KRN-10 rather than re-implementing storage/hash-
chain logic — consistent with the kernel/application split used
throughout Vol 0's layer model (§5).

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** No Vol 3 file changes — confirms `KRN-10.md`'s existing §17
open question as resolved.

---

### D-24 — KRN-17 (Data Platform) vs INT-01 (Semantic Graph) split

**Decision:** Confirmed as drafted. KRN-17 is a flat metric/dimension
warehouse layer for structured BI-style analytics (feeding INS-01..05).
INT-01 is the broader, separate knowledge graph spanning KRN-17's
structured datasets plus unstructured content (documents, transcripts,
messages, indexed via KRN-14) — the "one brain" moat capability. INT-01 is
built from KRN-17 plus more; it is not the same object as KRN-17's
semantic layer.

**Reasoning:** Accepting the recommended default. Functionally distinct
systems (star-schema/warehouse vs knowledge graph) even though Vol 0's two
one-line descriptions both use the word "semantic," which was the source
of the apparent overlap.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** No Vol 3 file changes — confirms `KRN-17.md`'s existing §17
open question as resolved.

---

### D-25 — INT-04 as sole Trust Ladder (L9) enforcement point

**Decision:** Confirmed. KRN-02 (identity), KRN-03 (permission grant), and
KRN-15 (job runtime) are each trust-ceiling-*unaware* — they do their own
job and never independently check an agent's trust level. INT-04 alone
checks and enforces L9 (trust ceiling) before/around any agent action.

**Reasoning:** Accepting the recommended default. Three independent
drafting passes (KRN-02, KRN-03, KRN-15) converged on this same boundary
without coordinating, a reasonably strong signal it is the natural reading
of Vol 0 §27.3. Centralising enforcement in one module also keeps "what
can this agent do" answerable from one place, consistent with
KRN-03-DR-002's own stated goal.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** No Vol 3 file changes yet — confirms `KRN-02.md`, `KRN-03.md`,
`KRN-15.md`'s existing assumptions. Binding on INT-04's own Vol 3 file when
it is drafted in Phase 2: INT-04 must be specified as the sole enforcement
point, not merely one of several checks.

---

### D-26 — KRN-11 numbering scope: universal vs statutory-only

**Decision:** Universal. KRN-11 numbers every `P-05 Document` across every
module, with an `is_gapless` flag distinguishing statutory series
(invoices, e-way bills — must be gapless) from non-statutory ones (internal
work orders, quotations — can be flexible).

**Reasoning:** Accepting the recommended default. Matches Vol 2 §1.5's
literal text ("every business document also carries a `document_number`
issued by KRN-11") and gives one numbering engine platform-wide, avoiding
185 modules each inventing their own numbering logic — consistent with
Vol 0 T2/T3's one-kernel thesis.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** No Vol 3 file changes — confirms `KRN-11.md`'s existing design
(the draft already assumed universal scope) as resolved, not overridden.

---

### D-27 — KRN-11's missing "Differentiating" line in Vol 0 §11

**Decision:** Keep the drafted `KRN-11-DR-001` ("one gapless-numbering
engine platform-wide" vs a federated competitor's per-app numbering) as
written. No Vol 0 §11 amendment needed — treated as a minor omission, not
a substantive gap.

**Reasoning:** Accepting the recommended default. Not worth amending the
master specification over; the drafted differentiator is defensible and
low-stakes either way.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** No Vol 3 or Vol 0 file changes — confirms `KRN-11.md`'s
existing `KRN-11-DR-001` as resolved, not overridden.

---

### D-28 — KRN-18 maker-checker on large-value reversal batches

**Decision:** Value-gated second approval. Below a declared value ceiling,
PR-01/PR-21 alone may confirm a whole-agent-day (or any batch) reversal.
Above the ceiling, the batch routes through a KRN-05 approval matrix for a
second approver before execution.

**Reasoning:** Accepting the recommended default. Mirrors how agent
financial ceilings already work (Vol 0 §27.2/§27.3) — a large reversal is
itself a significant financial action and deserves the same category of
control as the actions it is undoing, rather than a single person being
able to reverse an arbitrarily large set of financial postings unilaterally.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** `spec/vol3/KRN-18.md` — reworked (new requirement for a
value-ceiling-gated second approval on `reversal_batch`, §11 permission
matrix updated, §16 acceptance criteria updated, §17 open question
closed). See file for the updated design.

---

### D-29 — KRN-19 live (unreviewed) machine translation

**Decision:** Allowed, opt-in per tenant/manifest. A tenant/manifest may
choose to accept `machine_translated` (not human-reviewed) text live in
production, rather than always falling back to English until a human
approves it.

**Reasoning:** Accepting the recommended default. Consistent with T15/L8
(never let missing intelligence block a process) applied to localisation —
an unreviewed-but-present vernacular translation beats English-only
screens for floor/field personas (PR-04/05/07/09/13, Vol 0 §7.3) who may
not read English, and smaller verticals often have no in-house Marathi/
Hindi reviewer at all.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** No Vol 3 file changes — confirms `KRN-19.md`'s existing
`KRN-19-FR-003` fallback-logic assumption as resolved, not overridden.

---

### D-30 — KRN-20 "one portal" definition for external-seat billing

**Decision:** One `P-01 Party` record. One billed unit per dealer/vendor
organisation (their Party record) — every individual login under that
Party's account shares one charge.

**Reasoning:** Accepting the recommended default. Matches the intent of
"not per head" (Vol 0 §33.4) at the organisation level; Party is already
the canonical organisation identity (P-01), so no new grouping concept is
needed. (Considered and rejected: per-GSTIN, which would charge a
multi-state distributor multiple times for one relationship — working
against the same "not per head" spirit at the entity level instead of the
individual-login level.)

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** No Vol 3 file changes — confirms `KRN-20.md`'s existing
`seat_assignment.portal_scope` design (already modelled as a `P-01 Party`
reference) as resolved, not overridden.

---

## Summary (D-18..D-30)

All 12 Tier-1 items from `/spec/vol3-review-summary.md` §2 are now closed.
Two decisions (D-18, D-19) went against the drafts' recommended defaults
and required substantive rework of `spec/vol3/KRN-12.md`. One decision
(D-28) added a new requirement to `spec/vol3/KRN-18.md`. The remaining
nine confirmed the drafts as written, with only their §17 open questions
marked resolved.

---

### D-31 — Tier-2 routine drafting gaps, bulk-approved

**Decision:** All remaining Tier-2 items across the 20 kernel Vol 3 files
(`/spec/vol3-review-summary.md` §3 — entity field-level detail this draft
extrapolated where Vol 1 gave only entity names, and proposed API/Events
sections where Vol 1 gave none at all) are bulk-approved as written,
without going through them individually.

**Reasoning:** These are drafting-completeness gaps, not architectural
forks — unlike the 12 Tier-1 items, none of them involve two modules
potentially disagreeing, a conflict between binding rules, or a real
product/risk decision hiding in the text. Each was already produced by an
agent grounded directly in Vol 0/1/2, cross-checked for ID validity, and
built to match KRN-01.md's reviewed depth and structure. Confirming ~110
individual field/type/endpoint proposals one at a time would cost far more
than the risk they carry — per Vol 6 §4's own principle ("guessing on any
of these costs more to unwind than asking costs to resolve"), the
inverse also holds where the guesses are this well-grounded and this
low-stakes: re-litigating each one is now the more expensive path.

**What this does not mean:** these fields/endpoints/events are not beyond
correction. As Phase 0 implementation proceeds module by module, contract
tests (Vol 6 §6 step 2) will concretely exercise each proposed shape; a
mismatch discovered there is fixed as ordinary implementation-time
correction, not treated as reopening a stop-and-ask question. `spec/state.md`
tracks module-by-module status as this happens.

**Decided by:** Human (project owner), 2026-09-07, in conversation
(explicit "bulk-approve the Tier 2 gaps").

**Affects:** No individual Vol 3 file edits made as a result (unlike
D-18/D-19/D-28) — the files stand as drafted. `/spec/vol3-review-summary.md`
§3 and `/spec/state.md` updated to record this approval and unblock KRN-01
contract-test writing.

---

## Summary (D-31)

Tier 2 is closed by bulk approval. Combined with D-18 through D-30 (Tier 1),
every open item raised in `/spec/vol3-review-summary.md` is now resolved.
Per Vol 6 §6 (test-first protocol), KRN-01 contract tests may begin —
KRN-01 is the module with no dependencies, and its Vol 3 file carries no
outstanding architectural question.
