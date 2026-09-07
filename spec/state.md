# Build state — live memory of this project across sessions

Per Vol 6 §1: read this at the start of every session; update it at the end
of every session. This file reconciles with reality per Vol 6 §10 (Phase
gates).

**Last updated:** 2026-09-07

---

## Phase status

| Phase | Content | Status |
|---|---|---|
| **Phase 0** | Kernel: KRN-01..14, CMP-01..04, ITG-01 | Spec drafting complete for KRN-01..20 (all 20, not just the Phase-0 subset). Tier-1 and Tier-2 review both closed (D-18..D-31). **KRN-01 contract tests written and passing (34/34).** No other module has contract tests or implementation yet. |
| Phase 1 | STU-01..05, KRN-15..20 | Vol 3 drafted alongside Phase 0 (KRN-15..20 done early, ahead of need, since all 20 kernel modules were drafted as one batch). STU-01..05 not started — no Vol 3 files exist for Studio modules yet. |
| Phase 2 | INT-01, 02, 03, 04, 12 | Not started. |
| Phase 3+ | FIN, SCM, MFG, PPL, SLS, verticals, etc. | Not started. |

## Module status — kernel (KRN)

| Module | Vol 3 spec | Contract tests | Implementation | Notes |
|---|---|---|---|---|
| KRN-01 Tenancy & Organisation | APPROVED (D-18..D-31) | **Written, passing (34/34)** — `tests/contract/krn-01.contract.test.ts` | Not started | Contracts at `core/krn-01/src/contracts/`; reference exemplar for the other 19 |
| KRN-02 Identity & Authentication | APPROVED (D-25, D-31) | Not started | Not started | |
| KRN-03 Access Control | APPROVED (D-25, D-31) | Not started | Not started | Largest Vol 1 field-detail gap of any module |
| KRN-04 Entity & Metadata Engine | APPROVED (D-31) | Not started | Not started | |
| KRN-05 Process Engine | APPROVED (D-31) | Not started | Not started | |
| KRN-06 Event Bus & Event Store | APPROVED (D-31) | Not started | Not started | Vol 1 gave no Events line — flagged |
| KRN-07 Rules Engine | APPROVED (D-20, D-31) | Not started | Not started | |
| KRN-08 Document Service | APPROVED (D-22, D-31) | Not started | Not started | |
| KRN-09 Notification & Comms Hub | APPROVED (D-21, D-31) | Not started | Not started | |
| KRN-10 Audit & Immutable Log | APPROVED (D-21, D-23, D-31) | Not started | Not started | |
| KRN-11 Numbering & Sequencing | APPROVED (D-26, D-27, D-31) | Not started | Not started | Universal numbering scope confirmed |
| KRN-12 Masters & Reference Data | APPROVED, **reworked** (D-18, D-19, D-31) | Not started | Not started | Per-tenant replication + ITG-07 exception |
| KRN-13 Layout & Navigation Engine | APPROVED (D-31) | Not started | Not started | |
| KRN-14 Search & Semantic Index | APPROVED (D-21, D-31) | Not started | Not started | |
| KRN-15 Scheduler & Job Runtime | APPROVED (D-25, D-31) | Not started | Not started | |
| KRN-16 Sync & Offline Service | APPROVED (D-31) | Not started | Not started | |
| KRN-17 Data Platform | APPROVED (D-24, D-31) | Not started | Not started | |
| KRN-18 Undo & Compensation | APPROVED, **reworked** (D-28, D-31) | Not started | Not started | New `KRN-18-FR-007` maker-checker |
| KRN-19 Localisation & Terminology | APPROVED (D-29, D-31) | Not started | Not started | |
| KRN-20 Licensing & Entitlement | APPROVED (D-30, D-31) | Not started | Not started | Price numbers still deferred (D-16, non-blocking) |

All other modules (CMP, ITG, INT, STU, COM, and every L2 application family):
no Vol 3 files exist yet. Not started.

## Tooling (established this session, KRN-01)

- Node 22 / TypeScript, npm workspaces (`core/*`), Vitest as the test
  runner, Zod for schema definition + runtime validation — per D-12.
- `core/shared` — kernel-wide contracts every module reuses: universal
  fields (Vol 2 §1.2), shared value objects (Vol 2 §1.4), the P-08 event
  envelope, and API conventions (cursor pagination, idempotency key,
  stable error shape — Vol 1 §1.2). Future modules import from
  `@mahisys/shared` rather than redefining these.
- `core/krn-01` — first module package, `src/contracts/` holds Zod schemas
  for every owned entity, API request/response, and event payload,
  matching KRN-01.md exactly (including its state machines, encoded as
  `*_TRANSITIONS` maps and helper functions like `isValidTierPromotion`).
- `tests/contract/krn-01.contract.test.ts` — 34 tests validating shape
  only (entity fields/enums, API request/response shape, event schema
  shape including the P-08 envelope and agent-actor version requirement).
  Deliberately does **not** test business behaviour (state-machine
  legality enforcement, permission checks, statutory correctness) — that
  is acceptance/unit/permission tests, Vol 6 §6 steps 3-4, not yet
  written.
- Run tests: `npm test` (or `npx vitest run`). Typecheck: `npm run
  typecheck`.

## Open issues

- ~~Tier-1 architectural questions~~ **RESOLVED** (D-18..D-30).
- ~~Tier-2 routine drafting gaps~~ **RESOLVED, bulk-approved** (D-31).
- D-16 (AI unit economics) remains deferred pending target gross margin and
  price point from the human — not blocking Phase 0, will block Phase
  2/Commerce pricing work.
- D-14 (Ordder.io/Karyaflo) and D-17 (partner strategy timing) remain
  deferred per their stated revisit triggers — not blocking Phase 0.
- None of KRN-01's contract tests exercise KRN-01-FR-004's "process-
  governed" tenant lifecycle transitions against an actual KRN-05 process
  instance (KRN-05 doesn't exist yet) — the contract tests only validate
  the *shape* of the lifecycle request/response, not that KRN-05 actually
  governs it. Flagged so this isn't mistaken for behavioural coverage.

## Next step

1. ~~Tier 1 and Tier 2 review~~ **DONE.**
2. ~~KRN-01 contract tests~~ **DONE — 34/34 passing.**
3. Per Vol 6 §6 (test-first protocol), next for KRN-01: unit tests (rules,
   calculations, state transitions — e.g. `TENANT_STATUS_TRANSITIONS`,
   `isValidTierPromotion` exercised against every legal/illegal pair), then
   acceptance tests as failing tests (the Given/When/Then in KRN-01.md
   §16), then permission tests including negative cases (§11), then
   implement, then run journey tests for every journey KRN-01
   participates in. **Current step.**
4. Once KRN-01 is fully done per Vol 6 §5's definition, move to KRN-02
   (only kernel module with no incomplete dependency once KRN-01 closes).
5. Studio (STU-01..05) and remaining Phase 1 kernel Vol 3 files
   (already drafted for KRN-15..20 ahead of need) get the same review
   treatment before Phase 1 begins.

## Decisions log pointer

D-01 through D-17: initial charter/stack/deployment/billing decisions.
D-18 through D-31: kernel Vol 3 review decisions, Tier 1 and Tier 2
(2026-09-07). See `/spec/decisions-taken.md` for the full record.
