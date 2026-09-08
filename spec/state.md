# Build state — live memory of this project across sessions

Per Vol 6 §1: read this at the start of every session; update it at the end
of every session. This file reconciles with reality per Vol 6 §10 (Phase
gates).

**Last updated:** 2026-09-08

---

## Phase status

| Phase | Content | Status |
|---|---|---|
| **Phase 0** | Kernel: KRN-01..14, CMP-01..04, ITG-01 | Spec drafting complete for KRN-01..20. Tier-1/Tier-2 review closed (D-18..D-32), plus D-33 (KRN-02 permission-gap findings), D-34 (KRN-04 `sys` metadata physically replicated per tenant, extending D-18), D-35 (three more KRN-04.md internal-consistency gaps) and D-36 (two KRN-03.md internal-consistency gaps). **KRN-01, KRN-02, KRN-04 and KRN-03: full test pyramids written and passing (243/243 combined — contract, unit, acceptance, permission enforcement, event-schema conformance for all four), core business logic implemented in-memory, permission enforcement wired into every write path in all four modules.** See each module's DoD status below for what's structurally left (journey/persona/upgrade/KRN-18/offline-runtime/STU-10 — all blocked on other modules or tooling, not on KRN-01/KRN-02/KRN-04/KRN-03 themselves). No other module has contract tests or implementation yet. |
| Phase 1 | STU-01..05, KRN-15..20 | Vol 3 drafted alongside Phase 0 (KRN-15..20 done early, ahead of need, since all 20 kernel modules were drafted as one batch). STU-01..05 not started — no Vol 3 files exist for Studio modules yet. |
| Phase 2 | INT-01, 02, 03, 04, 12 | Not started. |
| Phase 3+ | FIN, SCM, MFG, PPL, SLS, verticals, etc. | Not started. |

## Module status — kernel (KRN)

| Module | Vol 3 spec | Contract tests | Implementation | Notes |
|---|---|---|---|---|
| KRN-01 Tenancy & Organisation | APPROVED (D-18..D-32) | **74/74 passing** | **Core logic + full permission enforcement done — remaining DoD bullets blocked on other modules, see below** | Full logic at `core/krn-01/src/service/`; reference exemplar for the other 19 |
| KRN-02 Identity & Authentication | APPROVED (D-25, D-31), **reworked** (D-33) | **139/139 passing (combined with KRN-01)** | **Core logic + full permission enforcement done — remaining DoD bullets blocked on other modules/tooling except the offline-profile test, see below** | Full logic at `core/krn-02/src/service/`; KRN-02's own suite is 65 tests (26 contract + 10 unit + 8 acceptance + 20 permission + 1 event-schema) |
| KRN-03 Access Control | APPROVED (D-25, D-31), **reworked** (D-36) | **243/243 passing (combined with KRN-01/02/04)** | **Core logic + full permission enforcement done — remaining DoD bullets blocked on other modules/tooling except the offline-profile test, see below** | Full logic at `core/krn-03/src/service/`; KRN-03's own suite is 50 tests (18 contract + 8 unit + 10 acceptance + 13 permission + 1 event-schema); owns the single effective-permissions resolution path (DR-003) every future module's data-access layer will call |
| KRN-04 Entity & Metadata Engine | APPROVED (D-31), **reworked** (D-34, D-35) | **193/193 passing (combined with KRN-01/02)** | **Core logic + full permission enforcement done — remaining DoD bullets blocked on other modules/tooling, see below** | Full logic at `core/krn-04/src/service/`; KRN-04's own suite is 54 tests (19 contract + 8 unit + 12 acceptance + 14 permission + 1 event-schema); the true dependency bottleneck of the kernel graph — 12 other modules name it directly |
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

## Tooling (established this session, KRN-04)

- `core/krn-04` — third module package, same shape as `core/krn-01`/
  `core/krn-02`: `src/contracts/` (primitive catalogue, entity_definition,
  field_definition, relationship_definition, validation_rule,
  computed_field, schema_version, extension_point, API, events — matching
  KRN-04.md as reworked by D-34/D-35, including three state machines),
  `src/service/` (in-memory `Krn04Store`, bootstrap `permissions.ts`
  mirroring §11, one service file per owned entity).
- D-34's per-tenant replication model is implemented directly: every
  write takes `tenant_id` as an explicit input (never inferred), `sys`
  writes require `actor.type === 'service'` rather than a persona grant,
  and `schema_version.release_id` correlates one platform release's
  per-tenant physical copies without gating one tenant's lifecycle on
  another's (proven in the DR-002 acceptance test: tenant A promotes
  while tenant B is still `validated`, untouched).
- Full test pyramid, 54/54 passing (193/193 combined with KRN-01/KRN-02):
  - `tests/contract/krn-04.contract.test.ts` (19) — shape only, including
    the primitive-catalogue closed-set check and the D-34 `release_id`
    namespace refine.
  - `tests/unit/krn-04.unit.test.ts` (8) — exhaustive state-transition
    legality for all three state machines.
  - `tests/unit/krn-04.acceptance.test.ts` (12) — every G/W/T in
    KRN-04.md §16; FR-002/FR-004 adapted to what KRN-04 actually owns
    (see its DoD note below on the two Vol 1 samples that describe a
    business-record write KRN-04 has no store for, L3).
  - `tests/unit/krn-04.permissions.test.ts` (14) — §11 positive/negative
    cases *and* functional proof that every write path across all 7
    owned entities rejects an unauthorised persona/actor at the real
    function call, split correctly on `sys` (service-actor-only) vs
    `tnt` (matrix-gated) per record.
  - `tests/unit/krn-04.event-schema-conformance.test.ts` (1, exercising
    17 event types) — runs the real service functions and validates
    actual output against the real Zod event schemas; this sweep is what
    found 6 of D-35's missing-event gaps.

## Tooling (established this session, KRN-03)

- `core/krn-03` — fourth module package, same shape as its siblings:
  `src/contracts/` (role, permission_set, permission_grant,
  data_scope_rule, field_policy, delegation, API, events — matching
  KRN-03.md as reworked by D-36, including four state machines and a
  locally-defined `RuleConditionSchema` reusing `P-12 Rule.conditions`'s
  shape, the same way KRN-01's `legal-entity.ts` locally defines
  `TaxRegistrationSchema` for `P-01`), `src/service/` (in-memory
  `Krn03Store`, bootstrap `permissions.ts` mirroring §11, one service
  file per owned entity, plus `effective-permissions-service.ts` — the
  single DR-003 resolution path).
- `resolveEffectivePermissions` merges `permission_grant`s (via `role`'s
  now-fixed `permission_set_ids` link, D-36, or a bare `permission_set_id`)
  *and* active `delegation`s targeting the subject, one level deep — the
  concrete mechanism behind `KRN-03-FR-004`'s "the peer approves within
  the delegated set." `isRowInScope`, `resolveFieldPolicy` and
  `checkAgentActionGrant` are the row/field/agent-facing primitives built
  on top of it. KRN-03 never reaches into KRN-01's org-unit hierarchy
  directly (L3) — `isRowInScope`'s `org_unit_and_below` case takes a
  pre-resolved descendant-id list as an explicit parameter, exactly
  mirroring how `isWithinProvisioningWindow` takes tenant status as a
  parameter rather than reading another module's store.
- Per D-25 (KRN-02/KRN-03/KRN-15 are all trust-ceiling-*unaware*),
  `checkAgentActionGrant` (`KRN-03-FR-006`'s grant-only half) has no
  trust-ceiling parameter or concept anywhere in its signature — not a
  stub, a deliberate absence, proven by a dedicated acceptance test.
- Full test pyramid, 50/50 passing (243/243 combined with KRN-01/02/04):
  - `tests/contract/krn-03.contract.test.ts` (18) — shape only.
  - `tests/unit/krn-03.unit.test.ts` (8) — exhaustive state-transition
    legality for all four state machines.
  - `tests/unit/krn-03.acceptance.test.ts` (10) — every G/W/T in
    KRN-03.md §16 plus the §12 consumed-event handler
    (`revokeGrantsForSubject`); FR-001/002/003's Vol 1 samples reference
    business records (Deals, Invoices, Payroll) KRN-03 does not own (L3)
    — adapted to the resolution primitives a record-owning module's
    data-access layer would actually call.
  - `tests/unit/krn-03.permissions.test.ts` (13) — §11 positive/negative
    cases *and* functional proof that every write path across all 6
    owned entities rejects an unauthorised persona/actor. One §11
    negative case ("PR-25/26 attempting any write action anywhere in the
    platform") is documented as a provisioning-time discipline, not
    re-tested as a KRN-03 runtime check — `resolveEffectivePermissions`
    works by `subject_id`, not persona label, so it cannot honestly claim
    to enforce a persona-shaped rule at that layer.
  - `tests/unit/krn-03.event-schema-conformance.test.ts` (1, exercising
    14 event types) — runs the real service functions and validates
    actual output against the real Zod event schemas; this sweep is what
    found 2 of D-36's gaps (the missing `role.permission_set_ids` link
    and 4 missing events).

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

## KRN-04 Definition of Done — see `/spec/decisions-taken.md`

Full checklist with reasoning recorded there. Short version: core logic,
full test pyramid, and permission enforcement across every write path in
all 7 owned entities are done and tested, including the D-34 replication
rework and the D-35 completeness fixes (missing `sunset_at`, missing
events for 4 of 7 entities, missing events for 5 more state transitions).
**Remaining DoD bullets are structurally blocked on other modules/
tooling** (journey needs named application modules; persona/UI needs
KRN-13; reversal-path needs KRN-18; upgrade rehearsal needs STU-10 — and
KRN-04 is itself the engine that rehearsal would exercise most directly,
once STU-10 exists). **One process deviation, named plainly rather than
hidden:** unlike KRN-01/KRN-02, KRN-04's acceptance tests were not
strictly written failing-first against a stub before the real
implementation existed — contracts, service layer and tests were
developed together this session, and Vol 1's own FR-002/FR-004 samples
were adapted (not applied literally) since they describe a business
record write KRN-04 does not own (L3).

## KRN-03 Definition of Done — see `/spec/decisions-taken.md`

Full checklist with reasoning recorded there. Short version: core logic
— most importantly `resolveEffectivePermissions`, the single DR-003
resolution path — full test pyramid, and permission enforcement across
every write path in all 6 owned entities are done and tested, including
the D-36 completeness fixes (`role.permission_set_ids`, 4 missing
events). **Remaining DoD bullets are structurally blocked on other
modules/tooling** (journey needs named application modules; persona/UI
needs KRN-13; reversal-path needs KRN-18; upgrade rehearsal needs
STU-10), **except the offline-profile test, a real not-yet-closed gap
KRN-03 shares with KRN-02** — its `read` profile (§15, device-cached
effective permissions with server-authoritative reconnect) has no
automated test, because no offline runtime harness exists yet. One §11
negative case (PR-25/26 never getting a write grant) is documented as a
provisioning-time discipline outside what `resolveEffectivePermissions`
itself can honestly claim to enforce, not silently skipped. **Same
process deviation as KRN-04:** acceptance tests were not strictly written
failing-first this time.

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
- D-34: KRN-04.md originally said `tenant_id` is null for `sys` records,
  directly contradicting D-18 (decided after KRN-04.md's first draft,
  never revisited) and the shared `UniversalFieldsSchema` contract.
  Resolved by extending D-18's replication model to KRN-04 — every `sys`
  row is now a real, physically-replicated per-tenant copy, correlated by
  the new `schema_version.release_id` for cross-tenant reporting only,
  never as a lifecycle gate. See `/spec/decisions-taken.md` D-34. Closed.
- D-35: three more KRN-04.md internal-consistency gaps found while
  writing contracts/service/tests — `entity_definition` missing
  `sunset_at` despite §5 requiring it, §12 naming events for only 3 of 7
  owned entities, and 5 state transitions with no event at all. Spec,
  code and tests all updated. See `/spec/decisions-taken.md` D-35.
  Closed.
- ~~KRN-03 was wrongly named as the next buildable module~~ **RESOLVED**
  — corrected to KRN-04 (see Next step below); KRN-04 was built first,
  then KRN-03 itself (this session), since its real dependency (KRN-01
  ✓, KRN-02 ✓, KRN-04 ✓) is now satisfied. KRN-03 is no longer "Not
  started" — see its module-status row and DoD above.
- D-36: two more KRN-03.md internal-consistency gaps found while writing
  contracts/service/tests — `role` had no field connecting it to
  `permission_set` at all (making role-based grants structurally
  unsatisfiable), and §12 named events for only some of the state
  transitions in §5. Spec, code and tests all updated. See
  `/spec/decisions-taken.md` D-36. Closed.
- KRN-03's offline profile (§15) has no automated test, for the same
  reason as KRN-02's identical open issue above — no offline runtime
  harness exists yet in this codebase. Not blocking Phase 0.
- A throwaway, hand-built demo UI for KRN-01/KRN-02 (Node HTTP server +
  static HTML/JS driving the real in-memory service functions directly)
  was built at `/demo` purely to produce screenshots for the human, per
  explicit request. It is `.gitignore`d and never committed — it is not
  KRN-13-generated, not metadata-driven, and must not be treated as real
  screen work or extended. Delete the directory once no longer needed;
  do not build on it when KRN-13 (Layout & Navigation Engine) is
  eventually implemented.
- **Product-direction note (not a Vol 0 decision, just a breadcrumb for
  whoever specs STU-09):** the human, on seeing the throwaway demo,
  asked that tenants be able to pick their own colour theme rather than
  the product carrying one fixed brand colour. The demo now has a small
  live theme picker (7 presets + a custom colour swatch, one CSS custom
  property driving every accent, badge, and button) proving the pattern
  works cheaply. This is real per-tenant branding, which is STU-09's job
  (KRN-02.md §9 already references "branded per tenant (STU-09)") — no
  STU-09 Vol 3 file exists yet, so nothing is implemented against the
  real product. Recorded here so the preference isn't lost by the time
  STU-09 gets specced in Phase 1.

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
   see Open issues). ~~KRN-03 was wrongly named here as next~~ —
   corrected to KRN-04, per the dependency-order note preserved in Open
   issues.
6. ~~KRN-04 full test pyramid + permission enforcement~~ **DONE — 54/54
   passing (193/193 combined with KRN-01/KRN-02), every write path across
   all 7 owned entities enforced and proven by test, including the D-34
   replication rework and the D-35 completeness fixes.**
7. ~~KRN-04 is complete per Vol 6 §5 for every applicable bullet~~ **DONE**
   — moved to KRN-03 (Access Control), whose real dependency (KRN-01,
   KRN-02, KRN-04) was fully satisfied.
8. ~~KRN-03 full test pyramid + permission enforcement~~ **DONE — 50/50
   passing (243/243 combined with KRN-01/02/04), every write path across
   all 6 owned entities enforced and proven by test, including the D-36
   completeness fixes.**
9. KRN-03 is complete per Vol 6 §5 for every applicable bullet except the
   offline-profile test (a real, tracked gap shared with KRN-02, not a
   structural block — see Open issues). With KRN-01/02/03/04 all done,
   **KRN-20 (Licensing & Entitlement)** newly has every dependency
   satisfied too (`Depends on: KRN-01, KRN-02, KRN-03, KRN-04` — exactly
   this set), alongside KRN-05 (Process Engine) and KRN-06 (Event Bus &
   Event Store), both dependency-free from the start. Of these three,
   **KRN-06 is the next bottleneck to clear**: 11 other kernel modules
   (KRN-07, 08, 09, 10, 11, 13, 14, 15, 16, 17, 18) name it as a direct
   dependency — more than any module since KRN-04. **Current step:
   KRN-06.** (KRN-05 and KRN-20 remain valid alternatives if priorities
   shift.)
10. Studio (STU-01..05) and remaining Phase 1 kernel Vol 3 files
    (already drafted for KRN-15..20 ahead of need) get the same review
    treatment before Phase 1 begins.

## Decisions log pointer

D-01 through D-17: initial charter/stack/deployment/billing decisions.
D-18 through D-36: kernel Vol 3 review decisions (Tier 1, Tier 2) plus
implementation-time findings across KRN-01, KRN-02, KRN-04 and KRN-03
(2026-09-07/08). See `/spec/decisions-taken.md` for the full record.
