# Build state — live memory of this project across sessions

Per Vol 6 §1: read this at the start of every session; update it at the end
of every session. This file reconciles with reality per Vol 6 §10 (Phase
gates).

**Last updated:** 2026-09-07

---

## Phase status

| Phase | Content | Status |
|---|---|---|
| **Phase 0** | Kernel: KRN-01..14, CMP-01..04, ITG-01 | Spec drafting complete for KRN-01..20. Tier-1/Tier-2 review closed (D-18..D-32), plus D-33 (KRN-02 permission-gap findings). **KRN-01 and KRN-02: full test pyramids written and passing (139/139 combined — contract, unit, acceptance, permission enforcement, event-schema conformance for both), core business logic implemented in-memory, permission enforcement wired into every write path in both modules.** See each module's DoD status below for what's structurally left (journey/persona/upgrade/KRN-18/offline-runtime — all blocked on other modules or tooling, not on KRN-01/KRN-02 themselves). No other module has contract tests or implementation yet. |
| Phase 1 | STU-01..05, KRN-15..20 | Vol 3 drafted alongside Phase 0 (KRN-15..20 done early, ahead of need, since all 20 kernel modules were drafted as one batch). STU-01..05 not started — no Vol 3 files exist for Studio modules yet. |
| Phase 2 | INT-01, 02, 03, 04, 12 | Not started. |
| Phase 3+ | FIN, SCM, MFG, PPL, SLS, verticals, etc. | Not started. |

## Module status — kernel (KRN)

| Module | Vol 3 spec | Contract tests | Implementation | Notes |
|---|---|---|---|---|
| KRN-01 Tenancy & Organisation | APPROVED (D-18..D-32) | **74/74 passing** | **Core logic + full permission enforcement done — remaining DoD bullets blocked on other modules, see below** | Full logic at `core/krn-01/src/service/`; reference exemplar for the other 19 |
| KRN-02 Identity & Authentication | APPROVED (D-25, D-31), **reworked** (D-33) | **139/139 passing (combined with KRN-01)** | **Core logic + full permission enforcement done — remaining DoD bullets blocked on other modules/tooling except the offline-profile test, see below** | Full logic at `core/krn-02/src/service/`; KRN-02's own suite is 65 tests (26 contract + 10 unit + 8 acceptance + 20 permission + 1 event-schema) |
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
- `core/krn-01/src/service/` — in-memory reference implementation (not
  yet Postgres-backed — that's later infra work per D-12, decoupled via
  the `Krn01Store` shape). Full CRUD + lifecycle logic for tenant, legal
  entity, org unit, cost centre, fiscal calendar/period, isolation
  assignment; a bootstrap permission matrix (`permissions.ts`) mirroring
  KRN-01.md §11.
- Full test pyramid, 74/74 passing:
  - `tests/contract/krn-01.contract.test.ts` (34) — shape only (entity
    fields/enums, API request/response, event schema, P-08 envelope,
    agent-actor version requirement).
  - `tests/unit/krn-01.unit.test.ts` (12) — exhaustive state-transition
    legality for all three state machines + isolation-tier monotonicity.
  - `tests/unit/krn-01.acceptance.test.ts` (10) — every G/W/T in
    KRN-01.md §16, written failing first (confirmed red against a
    `NotImplementedError` stub) then made to pass by the real
    implementation.
  - `tests/unit/krn-01.permissions.test.ts` (17) — §11 positive/negative
    cases (including the D-32 fix) *and* functional proof that every
    write path (`createLegalEntity`, `createOrgUnit` incl. the PR-02
    subtree check, `createCostCentre`, `closeFiscalPeriod`) actually
    rejects an unauthorised persona at the real function call, not just
    at the matrix lookup.
  - `tests/unit/krn-01.event-schema-conformance.test.ts` (1, exercising 8+
    emitted events) — runs the real service functions and validates
    actual output against the real Zod event schemas, not just fixtures.
- Run tests: `npm test` (or `npx vitest run`). Typecheck: `npm run
  typecheck`.

## Tooling (established this session, KRN-02)

- `core/krn-02` — second module package, same shape as `core/krn-01`:
  `src/contracts/` (user, credential, session, service account, agent
  identity, device, login attempt, API, events — matching KRN-02.md
  exactly, including four state machines), `src/service/` (in-memory
  `Krn02Store`, bootstrap `permissions.ts` mirroring §11, and one service
  file per entity family).
- Full test pyramid, 65/65 passing (139/139 combined with KRN-01):
  - `tests/contract/krn-02.contract.test.ts` (26) — shape only.
  - `tests/unit/krn-02.unit.test.ts` (10) — exhaustive state-transition
    legality for all four state machines.
  - `tests/unit/krn-02.acceptance.test.ts` (8) — every G/W/T in
    KRN-02.md §16 (FR-001..006, DR-001, DR-002), written failing first.
  - `tests/unit/krn-02.permissions.test.ts` (20) — §11 positive/negative
    cases *and* functional proof that every write path rejects an
    unauthorised persona/actor at the real function call, including the
    D-33 fixes (`revokeDevice`, `enrolMfa`, `endImpersonation`,
    `upgradeAgentVersion`).
  - `tests/unit/krn-02.event-schema-conformance.test.ts` (1, exercising
    12+ emitted events) — runs the real service functions and validates
    actual output against the real Zod event schemas; caught the
    `system-actors.ts` UUID bug (internal system actors needed real UUIDs,
    not string literals, to satisfy `ActorRefSchema`).

## KRN-01 Definition of Done — see `/spec/decisions-taken.md`

Full checklist with reasoning recorded there. Short version: core logic,
full test pyramid, and permission enforcement across every write path
(`transitionTenantLifecycle`, `promoteIsolationTier`, `createLegalEntity`,
`createOrgUnit`, `createCostCentre`, `closeFiscalPeriod`/
`reopenFiscalPeriod`) are done and tested. **Remaining DoD bullets are
structurally blocked on other modules, not on more KRN-01 work:**
journey tests need named application modules (Vol 0 §8 chains don't name
KRN-01 itself); persona/UI tests need KRN-13 (not built); reversal-path
testing needs KRN-18 (not built, Phase 1); upgrade testing needs upgrade
tooling (not built). No further KRN-01-only increment remains identified.

## KRN-02 Definition of Done — see `/spec/decisions-taken.md`

Full checklist with reasoning recorded there. Short version: core logic,
full test pyramid, and permission enforcement across every write path
(`createUser`, `suspendUser`/`deactivateUser`, `enrolMfa`, `revokeSession`/
`bulkRevokeUserSessions`, `revokeDevice`, `createServiceAccount`/
`rotateServiceAccountCredential`, `registerAgentIdentity`/
`upgradeAgentVersion`, `startImpersonation`/`endImpersonation`) are done
and tested — including the four D-33 fixes. **Most remaining DoD bullets
are structurally blocked on other modules/tooling, same as KRN-01**
(journey, persona/UI, reversal-path, upgrade). **One bullet is a real,
not-yet-closed gap, not a structural block:** KRN-02's declared offline
profile (§15 — cached-credential login, online-required MFA
re-validation on reconnect) has no automated test, because no offline
runtime harness exists in this codebase yet. Flagged rather than marked
done by loose analogy to KRN-01's vacuous `online` case.

## Open issues

- ~~Tier-1 architectural questions~~ **RESOLVED** (D-18..D-30).
- ~~Tier-2 routine drafting gaps~~ **RESOLVED, bulk-approved** (D-31).
- D-16 (AI unit economics) remains deferred pending target gross margin and
  price point from the human — not blocking Phase 0, will block Phase
  2/Commerce pricing work.
- D-14 (Ordder.io/Karyaflo) and D-17 (partner strategy timing) remain
  deferred per their stated revisit triggers — not blocking Phase 0.
- KRN-01-FR-004's "process-governed" tenant lifecycle transitions are
  implemented against direct transition-legality checking, not a real
  KRN-05 process instance (KRN-05 doesn't exist yet, Phase 1) — per D-21's
  degrade convention. Revisit once KRN-05 ships.
- D-32: `isolation_tier.promote` had no permission gate at all in the
  original KRN-01.md §11 draft — found and fixed during implementation
  (spec updated, code enforces it, tests prove it). See
  `/spec/decisions-taken.md` D-32. Closed.
- D-33: three KRN-02 write paths (`revokeDevice`, `enrolMfa`,
  `endImpersonation`) had missing or unwired permission gates, plus one
  adjacent actor-type gap (`upgradeAgentVersion`) — found and fixed during
  implementation (spec updated, code enforces it, tests prove it). See
  `/spec/decisions-taken.md` D-33. Closed.
- KRN-02's offline profile (§15) has no automated test — no offline
  runtime harness exists yet in this codebase. Not blocking Phase 0 (no
  offline-dependent module is being built yet), but a real, tracked gap
  rather than a structural one — revisit once KRN-16 (Sync & Offline
  Service) or an equivalent harness exists.

## Next step

1. ~~Tier 1 and Tier 2 review~~ **DONE.**
2. ~~KRN-01 full test pyramid + permission enforcement~~ **DONE — 74/74
   passing, every write path enforced and proven by test.**
3. ~~KRN-01 is complete per Vol 6 §5 for every applicable bullet~~ **DONE**
   — moved to KRN-02.
4. ~~KRN-02 full test pyramid + permission enforcement~~ **DONE — 65/65
   passing (139/139 combined with KRN-01), every write path enforced and
   proven by test, including the D-33 fixes.**
5. KRN-02 is complete per Vol 6 §5 for every applicable bullet except the
   offline-profile test (a real, tracked gap, not a structural block —
   see Open issues) — move to KRN-03 (Access Control), the next kernel
   module with no incomplete dependency now that KRN-01 and KRN-02 are
   both closed. **Current step.**
6. Studio (STU-01..05) and remaining Phase 1 kernel Vol 3 files
   (already drafted for KRN-15..20 ahead of need) get the same review
   treatment before Phase 1 begins.

## Decisions log pointer

D-01 through D-17: initial charter/stack/deployment/billing decisions.
D-18 through D-33: kernel Vol 3 review decisions (Tier 1, Tier 2) plus
implementation-time findings across KRN-01 and KRN-02 (2026-09-07). See
`/spec/decisions-taken.md` for the full record.
