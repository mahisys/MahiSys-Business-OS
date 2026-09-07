# Vol 3 Kernel Drafts — Review Summary

**Purpose:** All 20 kernel modules (KRN-01..20) now have full Vol 3 SRS
files at `/spec/vol3/KRN-01.md` through `KRN-20.md`, drafted per Vol 6 §4
(human chose "draft for review" over supplying Vol 3 personally). Each
individual file carries its own §17 "Open questions" section. This document
exists so the human reviewer doesn't have to read 20 files end to end to
find what actually needs a decision — it separates **architectural
questions that block or shape Phase 0 build** from **routine drafting gaps**
that can be confirmed in bulk.

**Status:** All 20 files are DRAFT, not binding, per Vol 6 §4/L13. Nothing
in `/core` has been written against them yet.

**Validation performed:** every module/persona/primitive/journey/agent ID
cited across all 20 files was extracted and cross-checked against Vol 0's
catalogue. Zero invented IDs found (L15 compliance confirmed by direct
audit, not just by instruction to the drafting agents).

---

## 1. Stats

| Module | Lines | FR (Vol1 / total) | DR (Vol1 / total) | Open Qs |
|---|---|---|---|---|
| KRN-01 Tenancy & Organisation | 374 | 4/6 | 1/2 | 5 |
| KRN-02 Identity & Authentication | 515 | 5/6 | 1/2 | 7 |
| KRN-03 Access Control | 485 | 5/6 | 2/3 | 7 |
| KRN-04 Entity & Metadata Engine | 478 | 5/6 | 2/3 | 6 |
| KRN-05 Process Engine | 541 | 6/7 | 1/2 | 5 |
| KRN-06 Event Bus & Event Store | 512 | 7/11 | 1/2 | 7 |
| KRN-07 Rules Engine | 461 | 4/7 | 1/2 | 7 |
| KRN-08 Document Service | 392 | 5/8 | 1/2 | 5 |
| KRN-09 Notification & Comms Hub | 376 | 5/8 | 1/1 | 4 |
| KRN-10 Audit & Immutable Log | 373 | 5/8 | 1/1 | 5 |
| KRN-11 Numbering & Sequencing | 416 | 5/7 | 0/2 | 6 |
| KRN-12 Masters & Reference Data | 403 | 0/4 | 1/2 | 5 |
| KRN-13 Layout & Navigation Engine | 463 | 5/7 | 1/2 | 6 |
| KRN-14 Search & Semantic Index | 379 | 4/8 | 1/2 | 6 |
| KRN-15 Scheduler & Job Runtime | 406 | 5/9 | 0/2 | 6 |
| KRN-16 Sync & Offline Service | 512 | 5/9 | 1/2 | 6 |
| KRN-17 Data Platform | 360 | 4/6 | 0/1 | 5 |
| KRN-18 Undo & Compensation | 358 | 4/6 | 1/1 | 5 |
| KRN-19 Localisation & Terminology | 335 | 3/5 | 1/1 | 5 |
| KRN-20 Licensing & Entitlement | 398 | 4/7 | 0/1 | 5 |
| **Total** | **8,537** | | | **133** |

Note: "FR (Vol1 / total)" reads as "requirements that existed in Vol 1 /
total after this draft's minimal, clearly-marked additions." No module's
additions exceed 4 items, and every addition states its Vol 0/2 basis
in-line, per the drafting constraint.

---

## 2. Tier 1 — architectural questions needing your decision

**STATUS: ALL 12 RESOLVED — 2026-09-07.** Full decisions and reasoning
recorded as D-18 through D-30 in `/spec/decisions-taken.md`. Two decisions
(D-18, D-19) went against this document's recommended defaults and
required substantive rework of `spec/vol3/KRN-12.md` (per-tenant physical
replication of `sys` reference data, and a named exception letting KRN-12
call ITG-07 directly). One decision (D-28) added a new value-gated
second-approval requirement (`KRN-18-FR-007`) to `spec/vol3/KRN-18.md`.
The remaining nine confirmed the drafts as originally written. The
sub-sections below are kept as the historical record of what was asked and
why — see `/spec/decisions-taken.md` for the actual resolutions.

These aren't drafting gaps — they're places where two modules' specs could
genuinely disagree, where Vol 0/1/2 themselves seem to conflict, or where a
real product/risk decision is hiding inside what looks like an
implementation detail. Grouped by theme.

### 2.1 A genuine Vol 2 vs. Vol 1 tension: tenant_id universality

**KRN-12 §17.3.** Vol 2 §1.2 says `tenant_id` is a universal field, "never
optional," on every persisted entity. But KRN-12 owns platform-shared `sys`
reference data (HSN/SAC, GST rate schedules, currencies, pincodes, banks) —
logically the same data for all 10,000 tenants, not tenant-specific. The
draft assumes this is a deliberate, declared exception (reference rows
carry no real per-tenant `tenant_id`, or sit under a platform pseudo-tenant
visible to every tenant's read path) rather than 10,000 physical copies of
the same HSN table. **This needs a real answer** — it affects row-level
security design platform-wide (KRN-01 §3.1), not just KRN-12, and either
Vol 2 §1.2's wording needs a stated exception or the physical model needs
to change.

### 2.2 A layering conflict: KRN-12's "centrally updated" claim vs. L0/L1 dependency direction

**KRN-12 §17.4.** KRN-12-DR-001 says HSN/SAC and GST schedules are
"platform-maintained and updated centrally" — the obvious mechanism is
ITG-07 (Government APIs), but ITG-07 is Layer 1 and KRN-12 is Layer 0, and
Vol 0 §5 forbids a lower layer depending on a higher one. The draft assumes
an internal platform-ops data-refresh process (curated and pushed by
MahiSys, scheduled via KRN-15) distinct from ITG-07's tenant-facing GSTIN
lookup at signup. Confirm this reading, and who owns keeping the upstream
curated data current — Vol 0/1 name no owner for that operational process.

### 2.3 A live conflict between two binding laws (L4 vs. practicality)

**KRN-07 §17.3.** L4 says "never emit a state change without an event."
Every rule evaluation records an outcome (`evaluation_log`) — does that
count as a state change requiring a KRN-06 event per evaluation? The draft
deliberately does *not* emit one (treating `evaluation_log` as the durable
record instead), for event-store volume reasons at scale (thousands of
pricing/credit evaluations per day per tenant). This is presented as a
genuine tension between L4's letter and its evident intent, not resolved by
extrapolation — needs your call.

### 2.4 Phase-ordering: a Phase 0 module's requirement references a Phase 1/8 module

Three instances of the same pattern — a kernel module's Vol 1 text names
another module that ships later per Vol 0 §39's build order:

- **KRN-09 §17.2** — `KRN-09-FR-004` names SEC-07 (Data Privacy & DPDP,
  Phase 8) for consent enforcement, but KRN-09 itself is Phase 0 and
  `consent_record` is a KRN-09-owned entity. Draft assumes KRN-09 owns and
  enforces channel/purpose consent directly from Phase 0, with SEC-07 later
  providing the tenant-wide DPDP subject-request workflow *across* it.
- **KRN-10 §17.3** — `KRN-10-DR-001` requires storing "the exact rollback
  handle," a KRN-18 (Phase 1) concept, while KRN-10 is Phase 0. Draft
  assumes the field is opaque/nullable at Phase 0, populated once KRN-18
  ships.
- **KRN-14 §17.3/17.4** — full reindex naturally wants KRN-15 (Phase 1,
  KRN-14 is Phase 0); semantic/vector search depends on INT-12 (Phase 2).
  Draft assumes KRN-14 degrades to incremental-only indexing and
  keyword-only (Postgres FTS) search for its first two phases.

All three are plausible and internally consistent, but represent the same
underlying pattern worth a single ruling: **is "degrade gracefully until
the dependency ships" the right general policy for a Phase 0 kernel module
whose Vol 1 text references a later-phase module?** If yes, worth stating
once as a convention rather than re-deciding per module.

### 2.5 Scope boundaries between a kernel module and its Layer 2 near-namesake

Three cases where a KRN module and an OPS/SEC application module have
near-identical Vol 0 one-line descriptions:

- **KRN-08 §17.3** — Document Service vs. **OPS-11** Document Management.
  Draft assumes KRN-08 is the low-level storage/render engine, OPS-11 the
  Layer-2 folder/taxonomy/check-in-check-out workflow over the same files.
- **KRN-10 §17.1** — Audit & Immutable Log vs. **SEC-06** Audit & Evidence.
  Draft assumes KRN-10 is the kernel storage/hash-chain/API engine, SEC-06
  the Layer-2 persona-facing search/evidence-pack UI on top.
- **KRN-17 §17.2** — Data Platform's "semantic layer" vs. **INT-01**'s
  "semantic graph." Draft assumes KRN-17 is a flat BI metric/dimension
  catalogue, INT-01 a broader graph built from KRN-17 plus unstructured
  content.

Same underlying question each time: **is the kernel-module/application-module
split correct as drafted, or did Vol 0's one-line descriptions actually mean
these to be the same capability, just described twice at different
altitudes?** Recommend confirming this pattern once, since it recurs and
will likely recur again in Phase 1+ modules.

### 2.6 Trust Ladder (INT-04) enforcement boundary, asked three times

- **KRN-02 §17.4** — who writes `agent_identity.trust_ceiling`: KRN-02 as
  system of record, INT-04 as sole governed writer?
- **KRN-03 §17.5** — is agent authorization a two-gate model (KRN-03
  permission grant, then INT-04 trust ceiling), with each module blocking
  independently?
- **KRN-15 §17.4** — is the scheduler itself trust-unaware, running
  whatever was registered, with all L9 enforcement inside INT-04/the
  agent's own tool-call layer?

All three drafts assume KRN-02/03/15 are trust-ceiling-*unaware* and INT-04
is the sole enforcement point — a consistent position across all three
files, which is good, but it was inferred, not stated in Vol 1, and INT-04's
own Vol 3 file (not yet drafted) needs to agree with all three before Phase
2 (when INT-04 ships) begins. Worth confirming as a standing architectural
rule now, since three independent drafting agents converged on the same
answer without coordinating, which is a reasonably strong signal it's the
intended design — but "reasonably strong signal" isn't the same as your
confirmation.

### 2.7 KRN-11 numbering scope — universal or statutory-only?

**KRN-11 §17.4.** Vol 1's purpose line says "statutory-grade document
numbering" (sounds narrow); Vol 2 §1.5 says "every business document also
carries a `document_number` issued by KRN-11" (sounds universal). The draft
assumes universal, with `is_gapless` distinguishing statutory from
non-statutory series. The alternative (KRN-11 only for statutory types,
other modules number their own) would materially change KRN-11-FR-007 and
DR-001. This is a real fork, not a field-naming question.

### 2.8 KRN-11 has no "Differentiating" line in Vol 0's catalogue at all

**KRN-11 §17.5.** Every other kernel module in Vol 0 §11 has a
`*Differentiating:*` line; KRN-11's entry doesn't. The draft invented one
(`KRN-11-DR-001`) as a reasonable extrapolation, but flags: is this a
genuine platform gap (KRN-11 really is pure table-stakes plumbing with no
differentiator) worth correcting upstream in Vol 0 itself, or an oversight?
Worth a quick check against Vol 0 directly rather than silently keeping the
invented DR.

### 2.9 KRN-18 large-batch reversal — no maker-checker

**KRN-18 §17.3.** A whole-agent-day reversal (the "undo the day"
wow-catalogue capability) can currently be confirmed by PR-01/PR-21 alone,
no second approver, regardless of the financial value being reversed. Given
agent *actions* get financial ceilings and approval routing (Vol 0
§27.2/§27.3), should *reversing* a large batch of them get the same
treatment? This is a risk-control question, not a modelling one.

### 2.10 KRN-19 — is unreviewed machine translation allowed to go live?

**KRN-19 §17.3.** A genuine product decision hiding in a fallback-logic
requirement: can a tenant/manifest opt to show `machine_translated` (not
human-reviewed) Marathi/Hindi text in production, or must unreviewed
translations always fall back to English? Smaller verticals without
in-house reviewers would want the former; quality risk argues for the
latter as the default.

### 2.11 KRN-20 — "one portal" definition for external-seat billing

**KRN-20 §17.5.** External users (PR-22..27) are priced "per portal not per
head" per Vol 0 §33.4, but the unit isn't defined: per legal entity? per
GSTIN? per named account? This directly affects revenue for the
Dealer/Distributor (PR-23) and Vendor (PR-24) personas at scale and should
be settled with COM-03/SLS-03 before billing acceptance tests are written
— not urgent for Phase 0 kernel code, but worth flagging now since it's a
revenue-model gap, not just a spec gap.

### 2.12 KRN-20 pricing numbers — expected gap, not a new one

**KRN-20 §17.3/17.4.** Confirms what's already known: D-16 (AI unit
economics) is deferred pending your target gross margin and price point
(see `/spec/decisions-taken.md`). KRN-20's data model holds the fields;
no number is hard-coded. No action needed beyond what's already tracked.

---

## 3. Tier 2 — routine drafting gaps (bulk-confirmable)

Every file flags, in its own §17, wherever Vol 1 gave no field-level detail
for an owned entity, or no explicit API/Events section. This is expected —
Vol 1 explicitly says full detail "lives in `/spec/vol3/`" and many kernel
modules' Vol 1 sections were genuinely thin (KRN-11 through KRN-20
especially — Vol 1 gives most of them no API/Events lines at all, and
several no Differentiating Requirements). Modules affected: all 20, to
varying degrees; heaviest gaps in KRN-03 (no Vol 1 field detail
whatsoever), KRN-11/12/13/14/15/17/18/19/20 (no Vol 1 API/Events lines).

**Recommendation:** rather than confirming these one field at a time, skim
each file's §4.1 (entity tables) and §10/§12 (API/Events) once, and either
approve in bulk or flag specific fields that look wrong. These don't block
starting Phase 0 build on the modules with no open Tier-1 item once
approved — they're implementation-detail confirmations, not architecture
forks.

---

## 4. Recommended next step

1. ~~Resolve the twelve Tier-1 items above~~ **DONE** — see
   `/spec/decisions-taken.md` D-18 through D-30.
2. Skim Tier 2 per-file gaps; approve in bulk or flag specific corrections.
   **Not yet done — this is the current blocker.**
3. Once approved, Phase 0 kernel implementation (contract tests first, per
   Vol 6 §6) can begin on KRN-01 — the module with the fewest open
   questions and no dependencies.
