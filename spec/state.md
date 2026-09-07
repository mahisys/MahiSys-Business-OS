# Build state — live memory of this project across sessions

Per Vol 6 §1: read this at the start of every session; update it at the end
of every session. This file reconciles with reality per Vol 6 §10 (Phase
gates).

**Last updated:** 2026-09-07

---

## Phase status

| Phase | Content | Status |
|---|---|---|
| **Phase 0** | Kernel: KRN-01..14, CMP-01..04, ITG-01 | **Spec drafting complete for KRN-01..20 (all 20, not just the Phase-0 subset — drafted together for consistency). Zero implementation code written. Blocked on Tier-1 review (see below) before contract tests / code begin.** |
| Phase 1 | STU-01..05, KRN-15..20 | Vol 3 drafted alongside Phase 0 (KRN-15..20 done early, ahead of need, since all 20 kernel modules were drafted as one batch). STU-01..05 not started — no Vol 3 files exist for Studio modules yet. |
| Phase 2 | INT-01, 02, 03, 04, 12 | Not started. |
| Phase 3+ | FIN, SCM, MFG, PPL, SLS, verticals, etc. | Not started. |

## Module status — kernel (KRN)

| Module | Vol 3 spec | Contract tests | Implementation | Notes |
|---|---|---|---|---|
| KRN-01 Tenancy & Organisation | DRAFT, unreviewed | Not started | Not started | Reference exemplar for the other 19 |
| KRN-02 Identity & Authentication | DRAFT, unreviewed | Not started | Not started | |
| KRN-03 Access Control | DRAFT, unreviewed | Not started | Not started | Largest Vol 1 field-detail gap of any module |
| KRN-04 Entity & Metadata Engine | DRAFT, unreviewed | Not started | Not started | |
| KRN-05 Process Engine | DRAFT, unreviewed | Not started | Not started | |
| KRN-06 Event Bus & Event Store | DRAFT, unreviewed | Not started | Not started | Vol 1 gave no Events line — flagged |
| KRN-07 Rules Engine | DRAFT, unreviewed | Not started | Not started | L4-vs-volume tension flagged, see review §2.3 |
| KRN-08 Document Service | DRAFT, unreviewed | Not started | Not started | OPS-11 boundary flagged |
| KRN-09 Notification & Comms Hub | DRAFT, unreviewed | Not started | Not started | SEC-07 phase-order flagged |
| KRN-10 Audit & Immutable Log | DRAFT, unreviewed | Not started | Not started | SEC-06 boundary + KRN-18 phase-order flagged |
| KRN-11 Numbering & Sequencing | DRAFT, unreviewed | Not started | Not started | Scope (universal vs statutory-only) unresolved |
| KRN-12 Masters & Reference Data | DRAFT, unreviewed | Not started | Not started | tenant_id universality conflict + layering conflict — see review §2.1/2.2 |
| KRN-13 Layout & Navigation Engine | DRAFT, unreviewed | Not started | Not started | STU-03 boundary flagged |
| KRN-14 Search & Semantic Index | DRAFT, unreviewed | Not started | Not started | Phase 0/1/2 degrade-gracefully pattern |
| KRN-15 Scheduler & Job Runtime | DRAFT, unreviewed | Not started | Not started | No Vol 1 DRs at all |
| KRN-16 Sync & Offline Service | DRAFT, unreviewed | Not started | Not started | |
| KRN-17 Data Platform | DRAFT, unreviewed | Not started | Not started | INT-01 boundary flagged |
| KRN-18 Undo & Compensation | DRAFT, unreviewed | Not started | Not started | Maker-checker on large reversals unresolved |
| KRN-19 Localisation & Terminology | DRAFT, unreviewed | Not started | Not started | Live machine-translation product decision unresolved |
| KRN-20 Licensing & Entitlement | DRAFT, unreviewed | Not started | Not started | Billing metric (D-15) closed; price numbers (D-16) still deferred |

All other modules (CMP, ITG, INT, STU, COM, and every L2 application family):
no Vol 3 files exist yet. Not started.

## Open issues

- **`/spec/vol3-review-summary.md`** consolidates 12 Tier-1 architectural
  questions across the 20 kernel drafts that need explicit human decisions
  before Phase 0 contract tests are written (tenant_id universality on
  platform-shared reference data, a real L4-vs-practicality tension in
  KRN-07, three phase-ordering patterns, three kernel/Layer-2 scope
  boundaries, the INT-04 trust-ceiling enforcement boundary, KRN-11's
  numbering scope, a missing Vol 0 Differentiating line for KRN-11, a
  maker-checker gap in KRN-18, and a live-machine-translation product
  decision in KRN-19). See that file for full detail.
- Every individual KRN-*.md file also carries routine "Tier 2" gaps (§17 in
  each) — mostly missing Vol 1 field-level/API/Events detail that the draft
  filled in and flagged for confirmation. See review summary §3.
- D-16 (AI unit economics) remains deferred pending target gross margin and
  price point from the human (per `/spec/decisions-taken.md`) — not
  blocking Phase 0, will block Phase 2/Commerce pricing work.
- D-14 (Ordder.io/Karyaflo) and D-17 (partner strategy timing) remain
  deferred per their stated revisit triggers — not blocking Phase 0.

## Next step

1. Human reviews `/spec/vol3-review-summary.md` §2 (Tier 1) and resolves
   the 12 flagged architectural questions.
2. Human skims Tier 2 per-file gaps (§4.1/§10/§12 in each KRN-*.md),
   approves in bulk or corrects specific items.
3. Once approved, per Vol 6 §6 (test-first protocol): write contract tests
   for KRN-01 first (no dependencies, fewest open questions), then unit
   tests, then permission tests, then implement — in that order, before
   moving to KRN-02.
4. Studio (STU-01..05) and remaining Phase 1 kernel Vol 3 files
   (already drafted for KRN-15..20 ahead of need) get the same review
   treatment before Phase 1 begins.
