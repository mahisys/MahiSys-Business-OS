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

---

### D-32 — `isolation_tier.promote` had no permission gate at all (found during implementation)

**Decision:** Added `isolation_tier.promote` as an explicit action to
KRN-01.md §11's permission matrix, gated the same way as `tenant.lifecycle`
(PR-21 propose, PR-01 approve; no other persona), and wired real
enforcement into `promoteIsolationTier()` — the only KRN-01 write path
enforced end-to-end so far (see Definition-of-Done note below).

**How this was found:** not by re-reading Vol 0/1/2 — by writing the
permission-test suite (Vol 6 §6 step 4) and noticing `Krn01Action` had no
entry corresponding to isolation-tier promotion at all, then checking
KRN-01.md §11 directly and confirming the column was simply missing from
the original draft's table. Isolation-tier promotion is a consequential,
hard-to-reverse infrastructure/compliance action (KRN-01-DR-001) — exactly
the kind of action that should never have been permission-less.

**Reasoning:** This is not a Tier-1 architectural question (no cross-module
disagreement, no conflicting rule) and not really a Tier-2 field-naming gap
either — it's a missing control, closer in kind to a bug than a drafting
gap. Per Vol 6 §1's end-of-session protocol ("record any decision you were
forced to make that Vol 0 did not cover") and D-31's own precedent ("a
concrete mismatch discovered by tests is fixed as ordinary implementation-
time correction"), this was fixed directly rather than escalated back to
Q&A — the fix (propose/approve split matching the closest existing
precedent, `tenant.lifecycle`) is conservative and reversible if the human
wants a different split.

**Decided by:** AI implementer, 2026-09-07, during KRN-01 permission-test
writing; flagged here for human awareness rather than gated behind a
question, consistent with D-31's "fix, don't re-litigate" precedent for
concrete implementation-time findings.

**Affects:** `spec/vol3/KRN-01.md` §11 (table + new negative case),
`core/krn-01/src/service/permissions.ts` (new action + matrix column),
`core/krn-01/src/service/tenant-service.ts` (`promoteIsolationTier` now
takes and enforces `callerPersona`), new permission tests in
`tests/unit/krn-01.permissions.test.ts`.

---

## KRN-01 Definition of Done (Vol 6 §5) — honest status, 2026-09-07

Recorded here rather than just claimed complete, per Vol 6 §5's own rule
("partial completion is recorded as in-progress, never as complete"):

- [x] Every FR/DR in KRN-01.md implemented — with documented scope limits
      on FR-004 (no real KRN-05 process instance, D-21 degrade), FR-006 and
      DR-002 (CMP-01/FIN-14 consumption out of scope, D-21 degrade).
- [x] Contract tests written and passing — 34/34.
- [x] Unit tests for all rules, calculations and state transitions — 12/12,
      exhaustive over every state pair for all three state machines plus
      isolation-tier monotonicity.
- [x] Acceptance criteria (Given/When/Then) all passing — 10/10, all of
      §16, with the same documented scope limits as above.
- [x] Events emitted match the declared schema exactly — verified by a
      dedicated conformance test that runs the real service functions and
      validates actual output against the real Zod schemas, not just
      asserted informally.
- [x] Permission matrix enforced and tested per persona, including negative
      cases — the matrix (`permissions.ts`) is complete and tested (17
      permission tests). Enforcement (`assertPermission`) is wired into
      every KRN-01 write path: `transitionTenantLifecycle`,
      `promoteIsolationTier`, `createLegalEntity`, `createOrgUnit`
      (including the `canProposeOrgUnit` PR-02 subtree check),
      `createCostCentre`, `closeFiscalPeriod`/`reopenFiscalPeriod`, each
      with a dedicated test proving an authorised persona succeeds and an
      unauthorised one is rejected by the real function call, not just by
      the matrix lookup. PR-28's provisioning-window restriction is
      enforced automatically wherever a `tenantId` is passed to
      `assertPermission`, rather than needing to be remembered per call
      site.
- [ ] Every journey it participates in passes end to end — **no Vol 0 §8
      journey (J-01..J-14) names KRN-01 explicitly in its module chain**;
      every chain lists application modules only (SLS-01, SCM-02, etc.).
      Interpreted as: KRN-01 is exercised indirectly through every journey
      via `tenant_id`/`entity_id` scoping, but has no journey test of its
      own to write at this layer — it will be exercised when the first
      named-module journey test (e.g. J-10 for MFG-05/SCM-02/CMP-03/FIN-03)
      is written. Flagged as an interpretation, not a silent skip.
- [ ] Every persona listed in its spec can complete its tasks on its
      assigned client — not tested; requires KRN-13-generated screens,
      which don't exist yet (KRN-13 itself is only a Vol 3 draft, Phase 0
      order has no built UI layer yet).
- [x] Declared offline profile behaves as specified — KRN-01's profile is
      `online` (§15); vacuously satisfied, no conflict policy applicable.
- [ ] Reversal path registered with KRN-18 and tested — not applicable yet;
      KRN-18 doesn't exist (Phase 1). Every event's `reversal_handle` field
      is present and `null`, per D-21's degrade pattern, ready for KRN-18
      to populate once built.
- [ ] Agents replay cleanly against historical events — not applicable;
      KRN-01 registers no agent (§8).
- [ ] Statutory behaviour tested against published cases — not applicable;
      KRN-01 has no statutory logic of its own (L7 — that's CMP-01..08).
- [ ] Upgrade test passes against a `tnt`-customised tenant — not
      attempted; no upgrade/migration tooling exists yet.
- [x] `state.md` updated.

**Net: KRN-01 is not "done" per Vol 6 §5** — genuinely in-progress, with a
clear, honest list of what remains. The core business logic, its full
test pyramid (contract → unit → acceptance → permission enforcement →
event-schema conformance, 74/74 passing), and full permission-enforcement
wiring across every write path are solid. What's left is entirely the
bullets that are structurally inapplicable until other modules exist
(journey tests need named application modules; persona/UI tests need
KRN-13; reversal-path testing needs KRN-18; upgrade testing needs upgrade
tooling) or that Vol 0 §5's layer model says belongs elsewhere (agent
replay, statutory tests — not applicable to KRN-01 itself). No further
KRN-01-only work remains to be discovered by more testing at this layer.

---

### D-33 — Three KRN-02 write paths had incomplete or missing permission gates (found during implementation)

**Decision:** Fixed three gaps in KRN-02's permission enforcement, all
found by the same "sweep every write path for a matching `Krn02Action`
and a real `assertPermission` call" discipline that produced D-32 for
KRN-01:

1. **`device.revoke (others)` had no column in KRN-02.md §11's permission
   matrix at all**, even though §9 documents "self-service revoke-own-
   device; PR-21 admin view across the tenant." Added the column (own
   device: unconditional for every persona; another user's device: PR-21
   only), added `device.revoke_others` to `Krn02Action`, and wired
   self-vs-others gating into `revokeDevice()` (self-check on
   `device.user_id === callerUserId`, `assertPermission` otherwise) —
   mirroring `revokeSession()`'s existing pattern exactly.
2. **`mfa.reset (others)` was already correctly in §11's table, but the
   implementation had never wired the check into `enrolMfa()`** — any
   actor could enrol MFA for any user. Added the same self-vs-others gate
   (self-enrolment always allowed; enrolling another user's MFA requires
   `mfa.reset_others`).
3. **`endImpersonation()` had no permission check of any kind**, even
   though §10 states `POST /api/v1/identity/impersonation/start | /end`
   are both "PR-21 only" — only `startImpersonation()` enforced this.
   Wired `assertPermission(callerPersona, 'impersonation.start')` into
   `endImpersonation()` too (reusing the one matrix action, since §11 has
   no separate column for `end`).

A fourth, adjacent finding from the same sweep: **`upgradeAgentVersion()`
had no actor-type check**, even though `registerAgentIdentity()` (the
sibling write on the same entity) already required a `service` actor per
§17 item 7. Not a §11 matrix gap (agent-identity writes are gated by actor
type, not by the persona matrix, exactly like `registerAgentIdentity`) but
the same class of bug — a write path silently missing the guard its
neighbour already had. Fixed by adding the identical `actor.type !==
'service'` guard.

**How this was found:** writing the KRN-02 permission-test suite (Vol 6 §6
step 4) and, per the D-32 precedent, deliberately re-reading every
exported write function in `core/krn-02/src/service/*.ts` against §10/§11
rather than trusting that a function existing meant it was gated. All four
gaps involve real, callable functions with no compile-time signal that
anything was missing — TypeScript could not have caught any of them; only
line-by-line comparison against the spec's own words could.

**Reasoning:** Same as D-32 — these are missing controls, not drafting
ambiguities or Tier-1/Tier-2 gaps. §10/§11 already said what should happen
in every one of the four cases; the implementation simply hadn't done it
yet. Per D-31/D-32's precedent ("a concrete mismatch found by tests gets
fixed as ordinary implementation-time correction"), all four were fixed
directly rather than escalated back to Q&A, and are recorded here for
human awareness.

**Decided by:** AI implementer, 2026-09-07, during KRN-02 permission-test
writing; flagged here rather than gated behind a question, consistent with
D-31/D-32.

**Affects:** `spec/vol3/KRN-02.md` §11 (new `device.revoke (others)`
column + note) and §11 negative cases (two new entries for
`impersonation/end` and `upgradeAgentVersion`);
`core/krn-02/src/service/permissions.ts` (new `device.revoke_others`
action + matrix column); `core/krn-02/src/service/device-service.ts`
(`revokeDevice` now takes and enforces `callerPersona`/`callerUserId`);
`core/krn-02/src/service/user-service.ts` (`enrolMfa` now takes and
enforces `callerPersona`/`callerUserId`);
`core/krn-02/src/service/session-service.ts` (`endImpersonation` now
takes and enforces `callerPersona`);
`core/krn-02/src/service/agent-identity-service.ts` (`upgradeAgentVersion`
now requires a `service` actor); new/updated tests in
`tests/unit/krn-02.permissions.test.ts`,
`tests/unit/krn-02.acceptance.test.ts`,
`tests/unit/krn-02.event-schema-conformance.test.ts`.

---

## KRN-02 Definition of Done (Vol 6 §5) — honest status, 2026-09-07

Recorded here rather than just claimed complete, per Vol 6 §5's own rule
("partial completion is recorded as in-progress, never as complete"):

- [x] Every FR/DR in KRN-02.md implemented — with the documented scope
      simplification on OTP/SSO verification (any non-empty `proof`
      accepted, since real OTP delivery via KRN-09 and SAML/OIDC assertion
      validation are out of KRN-02's own scope per §3 and not built yet;
      `password` verification is real, hash-compared via `verifyPassword`).
- [x] Contract tests written and passing — 26/26.
- [x] Unit tests for all rules, calculations and state transitions — 10/10,
      exhaustive over every state pair for all four state machines (user,
      session, agent identity, device trust).
- [x] Acceptance criteria (Given/When/Then) all passing — 8/8, covering
      FR-001 through FR-006, DR-001, DR-002 (KRN-02.md §16), confirmed
      genuinely red against stubs before implementation.
- [x] Events emitted match the declared schema exactly — verified by a
      dedicated conformance test that runs the real service functions
      (login, session revoke/timeout, device register/revoke, service
      account create/rotate, agent register/upgrade, impersonation
      start/end) and validates actual output against the real Zod
      schemas, catching the `system-actors.ts` UUID bug along the way.
- [x] Permission matrix enforced and tested per persona, including
      negative cases — the matrix (`permissions.ts`) is complete and
      tested (20 permission tests). Enforcement is wired into every
      KRN-02 write path: `createUser`, `suspendUser`/`deactivateUser`,
      `enrolMfa`, `revokeSession`/`bulkRevokeUserSessions`,
      `revokeDevice`, `createServiceAccount`/`rotateServiceAccountCredential`,
      `registerAgentIdentity`/`upgradeAgentVersion`,
      `startImpersonation`/`endImpersonation` — each with a dedicated test
      proving an authorised persona/actor succeeds and an unauthorised one
      is rejected by the real function call, not just the matrix lookup.
      Three gaps (`device.revoke_others` unwired, `mfa.reset_others`
      unwired, `endImpersonation` ungated) plus one adjacent actor-type gap
      (`upgradeAgentVersion`) were found and closed during this pass — see
      D-33.
- [ ] Every journey it participates in passes end to end — same
      structural gap as KRN-01 (D-32/KRN-01 DoD note): no Vol 0 §8 journey
      names KRN-02 explicitly in its module chain; every persona/session
      authenticates *through* KRN-02 but no journey test exists at this
      layer yet. Will be exercised when the first named-module journey
      test (e.g. J-10) is written.
- [ ] Every persona listed in its spec can complete its tasks on its
      assigned client — not tested; requires KRN-13-generated screens,
      which don't exist yet (same as KRN-01).
- [x] Declared offline profile behaves as specified — KRN-02's profile per
      §15 allows cached-credential offline login with online-required MFA
      re-validation on reconnect; not exercised by an automated test (no
      offline runtime harness exists yet), so this is a documented gap
      rather than a passing check — **recorded as `[x]` in error; correcting
      to `[ ]`** — see note below.
- [ ] Reversal path registered with KRN-18 and tested — not applicable
      yet; KRN-18 doesn't exist (Phase 1). Every event's `reversal_handle`
      field is present and `null`, per D-21's degrade pattern.
- [ ] Agents replay cleanly against historical events — not applicable;
      KRN-02 issues agent *identities* (`agent_identity`) but registers no
      agent of its own (§8) — mirrors KRN-01's identical note.
- [ ] Statutory behaviour tested against published cases — not
      applicable; KRN-02 has no statutory logic of its own (L7).
- [ ] Upgrade test passes against a `tnt`-customised tenant — not
      attempted; no upgrade/migration tooling exists yet.
- [x] `state.md` updated.

**Correction on the offline-profile bullet above:** on review while
writing this checklist, "declared offline profile behaves as specified"
was about to be marked `[x]` by analogy with KRN-01's vacuous `online`
case — but KRN-02's own §15 profile is *not* vacuous (it specifies real
cached-credential/offline-login/reconnect-revalidation behaviour), and
nothing in this build exercises it. Marking it `[ ]` instead, per Vol 6 §5
("twelve of fourteen is not done") and the instruction not to let a
close-analogy shortcut turn an untested bullet into a checked one.

**Net: KRN-02 is not "done" per Vol 6 §5** — in-progress, on the same
honest basis as KRN-01. Core business logic, full test pyramid (contract →
unit → acceptance → permission enforcement → event-schema conformance,
139/139 passing across both kernel modules), and full permission-
enforcement wiring across every write path (including the D-33 fixes) are
solid. What remains is: journey/persona/UI/reversal/upgrade bullets that
are structurally inapplicable until other modules and tooling exist (same
category as KRN-01's open bullets), plus the one real, not-yet-closed gap
— the offline profile (§15) has no automated test proving its cached-
credential/conflict-resolution behaviour, because no offline runtime
harness exists yet in this codebase.

---

### D-34 — KRN-04's `sys` metadata is physically replicated per tenant, extending D-18

**Decision:** `entity_definition`, `field_definition`, `relationship_definition`,
`validation_rule`, `computed_field`, `extension_point` and `schema_version`
rows are physically replicated per tenant — including `namespace: sys`
rows — exactly as D-18 chose for KRN-12's reference data. Every row, with
no exception anywhere in the codebase, carries a real, non-null
`tenant_id`. `entity_definition.code` (and the equivalent natural key on
each sibling entity) remains the stable cross-tenant identity a `sys`
record is "the same definition" by; the row's own `id` is per-tenant-copy,
never shared. A `sys` `schema_version` gains a new field, `release_id`
(uuid, nullable — set only for `sys` versions), correlating every tenant's
physical copy of "the same platform release" for reporting and audit,
without those copies sharing a row or a lifecycle gate: each tenant's copy
of a `sys` schema_version progresses `draft → validated → rehearsed →
promoted` independently, mirroring D-18/KRN-12-DR-003's "a tenant that
missed a fan-out run catches up on its next one, rather than blocking
every other tenant." Fan-out to "every known tenant" is not something
KRN-04's own service functions do internally — every KRN-04 write takes
`tenant_id` as an explicit input parameter, exactly like every KRN-01/
KRN-02 write does, and the platform release pipeline (external to KRN-04,
the same `PR-30` service account §11 already names) is responsible for
calling KRN-04's write/promote endpoints once per tenant. This is the
identical division of labour KRN-12's fan-out sync job already
established (`KRN-12-DR-001`/`003`: "one job run processes one tenant"),
so KRN-04 never needs to read KRN-01's tenant table directly (L3).

**How this was found:** reading KRN-04.md §4.1 before writing its Zod
contracts. Its literal text says "for a `sys` definition record,
`tenant_id` is null" — flagged in that same paragraph as this draft's own
extrapolation, not sourced from Vol 1. That directly contradicts D-18's
explicit, human-chosen reasoning ("every row in the system, without
exception, carries a real `tenant_id`... no special-casing for 'platform
pseudo-tenant' visibility anywhere in the query/permission layer") and the
shared `UniversalFieldsSchema.tenant_id` contract every module composes
via `withUniversalFields()`, which is `uuid` (non-nullable) with a comment
citing D-18 directly. KRN-04.md was drafted before D-18 was decided and
was never revisited afterward — unlike KRN-12.md, which D-18's own
"Affects" line says was reworked. This is a genuine spec/spec
inconsistency between two already-approved Vol 3 files, not a routine
Tier-2 field-naming gap, so it was put to the human rather than resolved
unilaterally (unlike D-32/D-33, which were concrete implementation-time
mismatches fixed directly per the D-31 precedent) — this one changes the
physical shape of every `sys` row in the module and reopens a
"no-exceptions" invariant the human had explicitly closed once already.

**Reasoning (human's choice, matching the recommended default):** Keeps
D-18's "no exceptions, ever" invariant intact rather than reopening it for
KRN-04 specifically — a tenant-isolated `dedicated`/`isolate`-tier tenant
never has even a read-only cross-tenant-visible row for its own schema, on
the same principle D-18 already established for reference data. Accepted
trade-off: `schema_version` needs the new `release_id` correlation field,
and a platform release now writes N per-tenant physical copies rather than
one shared row — the same fan-out cost D-18 already accepted for KRN-12,
so no new category of complexity is introduced, just one more module
paying the cost the human already chose to pay once.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default (consistent with D-18's original
choice).

**Affects:** `spec/vol3/KRN-04.md` — reworked (§4.1 field design incl. new
`schema_version.release_id`, §5 per-tenant-independent lifecycle note,
§10/§11 framing, §12 events become per-tenant, §16 acceptance criteria).
`core/krn-04` contracts and service layer, once written, implement the
replicated model directly — no `tenant_id`-nullable code path anywhere.

---

### D-35 — Three more KRN-04.md gaps found while writing contracts/service/tests

**Decision:** Fixed three additional concrete gaps in KRN-04.md, found by
the same "read the spec's own sections against each other, don't trust
that they agree" discipline that produced D-32/D-33, all fixed directly
per the D-31 precedent rather than escalated to Q&A (none is an
architectural or cross-module question — each is an internal
inconsistency within KRN-04.md itself):

1. **`entity_definition`'s field table never declared `sunset_at`**, even
   though §5's state machine already required it ("`active → deprecated`
   requires `sunset_at` to be set in the same write"). Added
   `deprecated_at`/`sunset_at` to §4.1, mirroring `field_definition`'s
   identical shape, and renamed the field table's literal `version` to
   `schema_version_id` (a reference, not a duplicate of the universal
   `version` counter every entity already carries — the two would have
   collided in the Zod schema).
2. **§12's event list named events for only 3 of the 7 owned entities'
   mutations** (`entity_definition`, `field_definition`, `schema_version`
   — nothing for `relationship_definition`, `validation_rule`,
   `computed_field`, `extension_point`). Added
   `metadata.relationship.created`, `metadata.validation_rule.created`,
   `metadata.computed_field.created`, `metadata.extension_point.created`.
3. **A second pass over §5 found five more state transitions with no
   event at all**: `entity_definition`'s `draft→active` and
   `deprecated→retired`, `field_definition`'s `deprecated→retired`, and
   `schema_version`'s `draft→validated`, `validated→rehearsed`, plus the
   `promoted→superseded` side-effect a new promotion causes on the
   version it replaces. Added `metadata.entity.activated`,
   `metadata.entity.retired`, `metadata.field.retired`,
   `metadata.schema.version_validated`,
   `metadata.schema.version_rehearsed`,
   `metadata.schema.version_superseded`. The `superseded→promoted` path a
   `rollback` restores reuses the existing
   `metadata.schema.version_promoted` event rather than a new one, since
   restoring a version to `promoted` is semantically a promotion of it —
   consistent with KRN-02's `revokeDevice` precedent (one event per
   affected row in a cascading mutation, not a new event name per
   trigger).

**How this was found:** items 1 and 3 came from checking every field
referenced in §5's prose against §4.1's actual field tables, and every
state-machine transition against §12's event list, rather than assuming
the two sections were already consistent because both were part of the
same "APPROVED" file. Item 2 came from checking that all 7 owned entities
(§4) had at least one emitted event, the same sweep that found item 3.
L4 ("never emit a state change without an event") is one of the fifteen
absolute laws — none of these three gaps is optional to close.

**Reasoning:** Same as D-32/D-33 — concrete, mechanical mismatches
*within* an already-approved spec file, not new design questions. Vol 6
§4/L13's "flag gaps, don't guess" duty is about genuine ambiguity or
missing sourcing; these are places the file simply forgot to apply its
own stated rules consistently across sections, discoverable by
cross-referencing, not by re-deciding anything. Fixed directly per D-31's
"a concrete mismatch found by tests/implementation gets fixed as ordinary
implementation-time correction" precedent.

**Decided by:** AI implementer, 2026-09-07, during KRN-04 contract/
service/test writing; flagged here for human awareness rather than gated
behind a question, consistent with D-32/D-33/D-34.

**Affects:** `spec/vol3/KRN-04.md` §4.1 (new fields) and §12 (ten new/
renamed events); `core/krn-04/src/contracts/entity-definition.ts`,
`field-definition.ts`, `events.ts`; `core/krn-04/src/service/*.ts` (every
lifecycle-transition function now emits); new/updated coverage in
`tests/unit/krn-04.event-schema-conformance.test.ts`.

---

## KRN-04 Definition of Done (Vol 6 §5) — honest status, 2026-09-07

Recorded here rather than just claimed complete, per Vol 6 §5's own rule
("partial completion is recorded as in-progress, never as complete"):

- [x] Every FR/DR in KRN-04.md implemented — including the D-34 rework
      (physical per-tenant replication of `sys` metadata) and the D-35
      fixes (missing `sunset_at`, missing events for 4 of 7 entities,
      missing events for 5 more state transitions).
- [x] Contract tests written and passing — 19/19.
- [x] Unit tests for all rules, calculations and state transitions —
      8/8, exhaustive over every state pair for all three state machines
      (`entity_definition.status`, `field_definition.status`,
      `schema_version.status`).
- [x] Acceptance criteria (Given/When/Then) all passing — 12/12, covering
      every FR/DR in §16, including the two Vol 1 samples (FR-002,
      FR-004) adapted to what KRN-04 actually owns (a type-check/
      consistency primitive a record-owning module would call, not a
      literal business-record write KRN-04 has no store for — L3).
      **Process note:** unlike KRN-01/KRN-02, these were not strictly
      written failing-first against a `NotImplementedError` stub before
      the real implementation existed — contracts, service layer and
      tests were developed together in this session. All are genuinely
      passing against real logic, but the "confirmed red first" discipline
      Vol 6 §6 describes was not literally followed step-by-step this
      time; flagged honestly rather than claimed.
- [x] Events emitted match the declared schema exactly — verified by a
      dedicated conformance test exercising all 17 event types (including
      the 10 added during implementation, D-35) against the real Zod
      schemas.
- [x] Permission matrix enforced and tested per persona, including
      negative cases — the matrix (`permissions.ts`) is complete and
      tested (14 permission tests). Enforcement is wired into every
      KRN-04 write path across all 7 owned entities, split consistently
      on each record's own `namespace` (`sys` → service-actor-only,
      never persona-gated; `tnt` → the matrix), including the D-34
      per-tenant-independent `schema_version` lifecycle (promote/
      rollback proven both for `tnt`, matrix-gated, and `sys`,
      service-actor-gated).
- [ ] Every journey it participates in passes end to end — same
      structural gap as KRN-01/KRN-02: no Vol 0 §8 journey names KRN-04
      explicitly; every screen/report/module depends on it *indirectly*
      through KRN-13/STU-04, neither of which exist yet. Will be
      exercised once the first named-module journey test is written.
- [ ] Every persona listed in its spec can complete its tasks on its
      assigned client — not tested; requires KRN-13-generated screens,
      which don't exist yet (same as KRN-01/KRN-02).
- [x] Declared offline profile behaves as specified — KRN-04's own
      authoring surface is `online` (§15); vacuously satisfied, mirroring
      KRN-01's identical case. (KRN-04's *read* API being cached by
      offline-capable clients via KRN-16 is a KRN-16 behaviour to test
      when KRN-16 is built, not a KRN-04 offline-profile obligation.)
- [ ] Reversal path registered with KRN-18 and tested — not applicable
      yet; KRN-18 doesn't exist (Phase 1). Every event's `reversal_handle`
      field is present and `null`, per D-21's degrade pattern.
- [ ] Agents replay cleanly against historical events — not applicable;
      KRN-04 registers no agent of its own (§8).
- [ ] Statutory behaviour tested against published cases — not
      applicable; KRN-04 has no statutory logic of its own (L7).
- [ ] Upgrade test passes against a `tnt`-customised tenant — not
      attempted; no upgrade/migration tooling exists yet. (Notably,
      KRN-04 *is* the engine such a test would eventually exercise most
      directly — `schema_version`'s rehearse/promote/rollback lifecycle
      is the literal mechanism Vol 0 §34 upgrade-safety rests on — but
      exercising it end-to-end needs STU-10, which doesn't exist yet.)
- [x] `state.md` updated.

**Net: KRN-04 is not "done" per Vol 6 §5** — in-progress, on the same
honest basis as KRN-01/KRN-02. Core business logic, full test pyramid
(contract → unit → acceptance → permission enforcement → event-schema
conformance, 54/54 passing for KRN-04, 193/193 combined across all three
kernel modules), and full permission-enforcement wiring across every
write path in all 7 owned entities are solid, including the D-34
per-tenant replication model and the D-35 completeness fixes. What
remains is entirely the bullets that are structurally inapplicable until
other modules and tooling exist (journey/persona/UI need KRN-13;
reversal-path needs KRN-18; upgrade rehearsal needs STU-10) — the one
process deviation worth naming plainly is that acceptance tests were not
strictly written failing-first this time, unlike KRN-01/KRN-02.

---

### D-36 — Two KRN-03.md gaps found while writing contracts/service/tests

**Decision:** Fixed two concrete gaps in KRN-03.md, found by the same
"read the spec's own sections against each other" discipline that
produced D-32/D-33/D-35, both fixed directly per the D-31 precedent
(neither is an architectural or cross-module question):

1. **`role`'s field table had no field connecting it to `permission_set`
   at all**, even though §9 explicitly says the Roles screen lets PR-21
   "define `sys`/`tnt` roles, attach `permission_set`s." Without this, a
   `permission_grant` whose `role_id` is set (no `permission_set_id`)
   would resolve to zero `{entity, action, scope}` grants — making
   `KRN-03-FR-001` structurally unsatisfiable for role-based grants, and
   directly closing the object-graph question §17 item 2 had left open.
   Added `role.permission_set_ids: list<ref>` — a role's effective
   grants are the union of every attached `permission_set`'s `grants`.
2. **§12's event list, checked against every state transition in §5,
   was missing four events**: `role` creation (every sibling owned
   entity's creation has one, `role`'s didn't); `role.status`'s `active →
   deprecated`; `permission_grant.status`'s system-driven `expired` path
   (uncovered by the human-only `access.role.revoked`); and
   `delegation`'s own creation into `pending`, distinct from
   `access.delegation.started`'s `pending → active` transition. Added
   `access.role.created`, `access.role.deprecated`,
   `access.permission_grant.expired`, `access.delegation.created`. L4 is
   unconditional.

**How this was found:** item 1 came from noticing that `resolveEffective
Permissions` (the DR-003 single resolution path every consumer must be
able to call) had no way to produce a non-empty result for a role-based
grant, given the entities as originally field-tabled — traced back to
the missing link, not assumed away. Item 2 is the same "every state
transition needs a named event" sweep D-35 ran for KRN-04, applied here.

**Reasoning:** Same as D-32/D-33/D-35 — concrete, mechanical gaps within
an already-approved spec file (KRN-03.md is APPROVED per D-25/D-31), not
new design questions requiring human input. Fixed directly per D-31's
"a concrete mismatch found by tests/implementation gets fixed as ordinary
implementation-time correction" precedent.

**Decided by:** AI implementer, 2026-09-08, during KRN-03 contract/
service/test writing; flagged here for human awareness rather than gated
behind a question, consistent with D-32/D-33/D-35.

**Affects:** `spec/vol3/KRN-03.md` §4.1 (new `role.permission_set_ids`)
and §12 (four new events); `core/krn-03/src/contracts/role.ts`,
`events.ts`; `core/krn-03/src/service/role-service.ts`,
`permission-grant-service.ts`, `delegation-service.ts`,
`effective-permissions-service.ts` (role-based grant resolution now
actually works); new/updated coverage in
`tests/unit/krn-03.event-schema-conformance.test.ts`.

---

## KRN-03 Definition of Done (Vol 6 §5) — honest status, 2026-09-08

Recorded here rather than just claimed complete, per Vol 6 §5's own rule
("partial completion is recorded as in-progress, never as complete"):

- [x] Every FR/DR in KRN-03.md implemented — including the D-36 fixes.
      `KRN-03-FR-006`'s trust-ceiling half is implemented as documented
      absence, not as a stub: per D-25 (KRN-02/KRN-03/KRN-15 are all
      trust-ceiling-*unaware*; INT-04 alone enforces L9),
      `checkAgentActionGrant` answers only "can this agent ever perform
      this action" and has no ceiling parameter or concept anywhere in
      its signature — proven by a dedicated acceptance test, not merely
      asserted in a comment.
- [x] Contract tests written and passing — 18/18.
- [x] Unit tests for all rules, calculations and state transitions —
      8/8, exhaustive over every state pair for all four state machines
      (`role.status`, `permission_grant.status`,
      `data_scope_rule.status`, `delegation.status`).
- [x] Acceptance criteria (Given/When/Then) all passing — 10/10, covering
      every FR/DR in §16 plus the §12 consumed-event handler
      (`revokeGrantsForSubject`, representing `identity.user.deactivated`
      closing access automatically). FR-001/002/003's Vol 1 samples
      reference business records (Deals, Invoices, Payroll, P&L) KRN-03
      does not own (L3) — adapted to the resolution primitives
      (`hasEffectivePermission`, `isRowInScope`, `resolveFieldPolicy`) a
      record-owning module's data-access layer would actually call.
      **Process note, same as KRN-04's:** not strictly written
      failing-first against a stub before the real implementation
      existed — contracts, service layer and tests were developed
      together this session.
- [x] Events emitted match the declared schema exactly — verified by a
      dedicated conformance test exercising all 14 event types (including
      the 4 added during implementation, D-36) against the real Zod
      schemas.
- [x] Permission matrix enforced and tested per persona, including
      negative cases — the matrix (`permissions.ts`) is complete and
      tested (13 permission tests). Enforcement is wired into every
      KRN-03 write path across all 6 owned entities, including the
      self-vs-others split on `delegation.create`/`effective_permissions.
      read` and the bounded-delegation check (a `permission_set_id` the
      delegator does not themselves hold is rejected at write time, not
      merely documented). **One negative case from §11 is explicitly not
      re-tested as a KRN-03 runtime check** — "PR-25/26 attempting any
      write action anywhere in the platform" is a provisioning-time
      discipline (never author a write grant into their `permission_set`),
      not something `resolveEffectivePermissions` itself enforces or
      could honestly claim to test, since it resolves by `subject_id`,
      not by persona label. Documented in
      `tests/unit/krn-03.permissions.test.ts` rather than faked.
- [ ] Every journey it participates in passes end to end — same
      structural gap as KRN-01/02/04: no Vol 0 §8 journey names KRN-03
      explicitly; every module's own permission checks depend on it
      *indirectly*. Will be exercised once the first named-module journey
      test is written.
- [ ] Every persona listed in its spec can complete its tasks on its
      assigned client — not tested; requires KRN-13-generated screens,
      which don't exist yet (same as KRN-01/02/04).
- [x] Declared offline profile behaves as specified — KRN-03's profile is
      `read` (§15): the device caches the effective permission set at
      last sync and enforces it client-side, with server-authoritative
      reconciliation on reconnect. Not exercised by an automated test (no
      offline runtime harness exists yet, same gap KRN-02's DoD already
      named) — **recorded as `[ ]`**, not `[x]` by loose analogy; see the
      open issue this shares with KRN-02.
- [ ] Reversal path registered with KRN-18 and tested — not applicable
      yet; KRN-18 doesn't exist (Phase 1). Every event's `reversal_handle`
      field is present and `null`, per D-21's degrade pattern.
- [ ] Agents replay cleanly against historical events — not applicable;
      KRN-03 registers no agent of its own (§8).
- [ ] Statutory behaviour tested against published cases — not
      applicable; KRN-03 has no statutory logic of its own (L7).
- [ ] Upgrade test passes against a `tnt`-customised tenant — not
      attempted; no upgrade/migration tooling exists yet. `data_scope_rule`/
      `field_policy`'s versioned/superseded design (§5) is the mechanism
      such a test would exercise once STU-10 exists.
- [x] `state.md` updated.

**Scope note, not a gap:** `role` has no update path beyond
`deprecateRole` — its `permission_set_ids` are set once at creation. §5
only defines role's lifecycle as `active → deprecated` with no "role
updated" event anywhere in §12 even after the D-36 additions, so
treating `role` as create-once (attach permission sets at creation,
deprecate-and-recreate to change them) is this draft's minimal,
defensible reading of what's actually specified — flagged here rather
than silently built as a mutable entity with an invented event.

**Net: KRN-03 is not "done" per Vol 6 §5** — in-progress, on the same
honest basis as KRN-01/02/04. Core business logic — most importantly the
single effective-permissions resolution path (DR-003) every future
consumer module will call — full test pyramid (contract → unit →
acceptance → permission enforcement → event-schema conformance, 49/49
passing for KRN-03, 243/243 combined across all four kernel modules), and
full permission-enforcement wiring across every write path in all 6
owned entities are solid, including the D-36 completeness fixes. What
remains is entirely the bullets that are structurally inapplicable until
other modules and tooling exist (journey/persona/UI need KRN-13;
reversal-path needs KRN-18; upgrade rehearsal needs STU-10; the offline
profile needs a runtime harness, same open gap KRN-02 already carries).

---

### D-37 — `createDelegation`'s bounded-scope check missed role-based holdings (found via the throwaway demo)

**Decision:** Fixed `delegatorHoldsPermissionSet` (in
`core/krn-03/src/service/delegation-service.ts`) to also count a
`permission_set` the delegator holds *indirectly* through an active
`role_id` grant (`role.permission_set_ids`, D-36), not only a direct
`permission_set_id` grant. Before the fix, delegating a permission set a
user held only through a role was always rejected as "not held" —
`KRN-03-FR-004`'s bounded check was correct in shape but incomplete in
coverage, since it silently ignored the more common real-world grant
path (grant a role, not a bare permission set).

**How this was found:** while extending the throwaway demo UI (per
explicit request, screenshots) to exercise KRN-03 end to end. The demo
grants roles to users (matching how the acceptance/permission tests also
mostly grant roles), then tried to delegate the permission set that role
attaches — and every attempt failed. The existing acceptance test
(`KRN-03-FR-004`) and the existing bounded-delegation permission test
both happened to grant the permission set *directly* to the delegator,
never through a role, so neither exercised the path that was actually
broken. This is the same class of finding as D-32/33/35/36 (a concrete
mismatch surfaced by exercising the real code, not a spec ambiguity),
but found through downstream *use* of the module rather than through
writing its own tests — a reminder that "the tests pass" and "the tests
cover the realistic path" are not the same claim.

**Reasoning:** Same as D-32/33/35/36 — a concrete implementation bug,
fixed directly per the D-31 precedent, with a regression test added
(`tests/unit/krn-03.permissions.test.ts`) proving the previously-broken
path now works. No spec change was needed — `role.permission_set_ids`
already existed (D-36); the bug was that `delegatorHoldsPermissionSet`
never consulted it.

**Decided by:** AI implementer, 2026-09-09, while extending the demo UI;
flagged here for human awareness rather than gated behind a question,
consistent with D-32/33/35/36.

**Affects:** `core/krn-03/src/service/delegation-service.ts`
(`delegatorHoldsPermissionSet` now checks both grant paths);
`tests/unit/krn-03.permissions.test.ts` (new regression test). No spec
changes. All 244 KRN-01..04 tests still pass.

---

### D-38 — KRN-06.md gaps found during implementation

**Decision:** Three fixes made directly while building KRN-06 (Event Bus &
Event Store), all per the D-31/D-32-style precedent ("a concrete mismatch
found during implementation gets fixed directly, not escalated to
Q&A"), plus one genuinely deferred item flagged rather than guessed at:

1. **Field-naming collision: `event_schema.version`.** KRN-06.md §4.1's
   field table names `event_schema`'s own schema-version-number field
   `version` — but every entity's universal fields (Vol 2 §1.2) already
   carry a `version` (the record's own optimistic-concurrency counter),
   which this would silently collide with and override in a Zod
   `.extend()`. Renamed the business field to `schema_version` in the
   implementation, matching the terminology `event.schema_version`
   ("Resolves against `event_schema`") already uses to reference it — the
   two fields were clearly meant to correlate by name. Not a design
   question, a field-table typo class of gap, same as D-33's found-not-
   designed pattern.

2. **Missing `retention.configure` permission-matrix column.** KRN-06.md
   §1/§2 both explicitly name "configures retention above the statutory
   floor" as one of PR-21's stated jobs, but §11's permission table has no
   column for it at all — exactly the same shape of gap as KRN-01's D-32
   (`isolation_tier.promote` had no permission gate despite being a
   stated, consequential action). Added `retention.configure` to the
   bootstrap matrix, PR-21-only (matching every other administrative
   action in this module), and wired real enforcement into
   `setRetentionPolicy()`.

3. **`subscription.retry_ceiling` implemented as a real field, not a
   hard-coded constant.** §17 item 6 already flags the dead-letter
   threshold as unspecified and proposes "configurable per subscription,
   platform default 5 attempts" — this is not a new decision (already
   D-31-covered as a Tier-2 drafting gap), noted here only because the
   implementation takes the proposal at its word: `retry_ceiling` is a
   genuine per-subscription field a caller can set, defaulting to 5, not
   a constant baked into the delivery-service logic.

**Deferred, not decided (flagged per §17 item 3, not blocking):** the
actual statutory retention floor value (`KRN-06-FR-009`) is unknown — Vol
2 §P-08 states only "above a statutory floor," no number. Implemented
`setRetentionPolicy`'s below-floor rejection mechanism in full (fully
testable and correct regardless of the constant's exact value) against a
clearly-labelled placeholder of 2922 days (8 years — the longer of
India's two most likely applicable periods: Companies Act 2013
books-of-account retention at 8 years, GST record retention at 72
months/6 years from the annual-return due date). Same "deferred number,
not blocking" treatment as D-16/D-30's pricing figures — only the
constant in `core/krn-06/src/service/retention-service.ts`
(`STATUTORY_RETENTION_FLOOR_DAYS`) needs correcting once a human confirms
the actual applicable statutory period(s); the mechanism around it does
not change.

**How these were found:** writing KRN-06's contract/service/test layers
against KRN-06.md directly (Vol 6 §6 steps 2-4) — the field collision
surfaced immediately when constructing a literal `EventSchemaRecord`
object (a duplicate-key TypeScript error), and the missing permission
column surfaced by cross-checking §1/§2's persona job descriptions
against §11's table, the same cross-referencing method that found D-36's
gaps in KRN-03.

**Reasoning:** All three are concrete, mechanical corrections against an
already-approved spec file (KRN-06.md is APPROVED per D-31), not new
architectural questions — per D-31's own "what this does not mean"
clause and the D-32/33/35/36/37 precedent chain.

**Decided by:** AI implementer, 2026-09-09, during KRN-06 implementation.

**Affects:** `spec/vol3/KRN-06.md` (no edit needed — the field-table typo
and missing permission column are corrected in the implementation and
recorded here, following the same lightweight-correction pattern used
when a fix is unambiguous and conservative); `core/krn-06/src/contracts/
event-schema.ts`, `core/krn-06/src/service/{event-schema-service.ts,
retention-service.ts, permissions.ts}`; `tests/unit/krn-06.*.test.ts`
and `tests/contract/krn-06.contract.test.ts`. All 298 KRN-01..04/06 tests
pass (54 new KRN-06 tests: 12 contract + 10 unit + 17 acceptance + 14
permission + 1 event-schema-conformance).
