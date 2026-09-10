# Build state — live memory of this project across sessions

Per Vol 6 §1: read this at the start of every session; update it at the end
of every session. This file reconciles with reality per Vol 6 §10 (Phase
gates).

**Last updated:** 2026-09-10 (KRN-10 session)

---

## Phase status

| Phase | Content | Status |
|---|---|---|
| **Phase 0** | Kernel: KRN-01..14, CMP-01..04, ITG-01 | Spec drafting complete for KRN-01..20. Tier-1/Tier-2 review closed (D-18..D-32), plus D-33 (KRN-02 permission-gap findings), D-34 (KRN-04 `sys` metadata physically replicated per tenant, extending D-18), D-35 (three more KRN-04.md internal-consistency gaps), D-36 (two KRN-03.md internal-consistency gaps), D-37 (KRN-03 delegation bug found via the demo), D-38 (three KRN-06.md gaps), D-39 (KRN-11: real KRN-06 event integration, `open_reservations` addition, a confirm-ordering fix), D-40 (KRN-10: a real hash-chain tamper-detection bug caught by its own tests before commit) and D-41 (KRN-07: activation cascade, two-dimensional domain-grant matrix, PR-02's context-dependent domain). **KRN-01, KRN-02, KRN-04, KRN-03, KRN-06, KRN-11, KRN-10 and KRN-07: full test pyramids written and passing (422/422 combined — contract, unit, acceptance, permission enforcement, event-schema conformance for all eight), core business logic implemented in-memory, permission enforcement wired into every write path in all eight modules.** See each module's DoD status below for what's structurally left (journey/persona/upgrade/KRN-18/offline-runtime/STU-10 — all blocked on other modules or tooling, not on the eight built modules themselves). A circular dependency between KRN-13 and KRN-19 (both still unbuilt) is flagged in Open issues, unresolved. No other module has contract tests or implementation yet. |
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
| KRN-06 Event Bus & Event Store | APPROVED (D-31), **reworked** (D-38) | **298/298 passing (combined with KRN-01/02/03/04)** | **Core logic + full permission enforcement done — remaining DoD bullets blocked on other modules/tooling, see below** | Full logic at `core/krn-06/src/service/`; KRN-06's own suite is 54 tests (12 contract + 10 unit + 17 acceptance + 14 permission + 1 event-schema-conformance); owns `recordEvent`, the single FR-001 outbox-write path every other kernel module's own `store.emit()`-style helper conceptually models (KRN-06 is the first module to actually *be* that mechanism, not just assume it) |
| KRN-07 Rules Engine | APPROVED (D-20, D-31), **reworked** (D-41) | **422/422 passing (combined with KRN-01/02/03/04/06/10/11)** | **Core logic + full permission enforcement done — remaining DoD bullets blocked on other modules/tooling, see below** | Full logic at `core/krn-07/src/service/`; KRN-07's own suite is 41 tests (11 contract + 4 unit + 9 acceptance + 16 permission + 1 event-schema-conformance); third module to emit through KRN-06's real `recordEvent()` (D-39 pattern), for rule_set/rule lifecycle + simulation only — `/evaluate`'s per-call `evaluation_log` writes deliberately never do (KRN-07-FR-005) |
| KRN-08 Document Service | APPROVED (D-22, D-31) | Not started | Not started | |
| KRN-09 Notification & Comms Hub | APPROVED (D-21, D-31) | Not started | Not started | |
| KRN-10 Audit & Immutable Log | APPROVED (D-21, D-23, D-31), **reworked** (D-40) | **381/381 passing (combined with KRN-01/02/03/04/06/11)** | **Core logic + full permission enforcement done — remaining DoD bullets blocked on other modules/tooling, see below** | Full logic at `core/krn-10/src/service/`; KRN-10's own suite is 41 tests (13 contract + 4 unit + 12 acceptance + 11 permission + 1 event-schema-conformance); second module to emit through KRN-06's real `recordEvent()` (D-39 pattern), for its 3 administrative events only — `audit_entry`/`access_log` writes deliberately never do (§12 anti-circularity) |
| KRN-11 Numbering & Sequencing | APPROVED (D-26, D-27, D-31), **reworked** (D-39) | **340/340 passing (combined with KRN-01/02/03/04/06)** | **Core logic + full permission enforcement done — remaining DoD bullets blocked on other modules/tooling, see below** | Full logic at `core/krn-11/src/service/`; KRN-11's own suite is 42 tests (13 contract + 2 unit + 12 acceptance + 14 permission + 1 event-schema-conformance); first module to emit through KRN-06's real `recordEvent()` API rather than a local stand-in (D-39) — the integration pattern every module built from here should follow |
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

## Tooling (established this session, KRN-06)

- `core/krn-06` — fifth module package, same shape as its siblings:
  `src/contracts/` (event — P-08 verbatim, not universal-fields-wrapped;
  event_schema, subscription, delivery_attempt, dead_letter, outbox — all
  extrapolated per §17 item 1, D-31-bulk-approved; a locally-defined
  `RuleCondition`/`filter-expression.ts`, the same P-12 shape KRN-03
  defines locally, independently redefined here per L3/Vol 6 §7 rather
  than imported from `@mahisys/krn-03`; API contracts; the module's own
  administrative event contracts per §12), `src/service/` (in-memory
  `Krn06Store`, bootstrap `permissions.ts` mirroring §11 plus
  `retention.configure` — D-38, one service file per owned entity/concern).
- `Krn06Store.emit()` (aliased as `recordEvent()` in event-service.ts) is
  the FR-001 atomic outbox-write path: writes the `event` row and its
  `outbox` entry together, with no code path producing one without the
  other, then immediately runs the (synchronous, no separate worker
  process exists yet) publish step through a real
  `OUTBOX_STATUS_TRANSITIONS`-checked transition rather than a hardcoded
  literal. Every other function in the module — including KRN-06's own
  administrative mutations (subscription created/paused/disabled, dead
  letter created/redriven/discarded, replay executed, schema
  registered/deprecated) — calls this same function, directly
  implementing §12's "these events themselves flow through the same
  outbox pattern... recursive, but consistent" rather than treating it as
  a side note.
- `attemptEventMutation()` exists solely to make KRN-06-FR-002
  (append-only, no update/delete path, for any actor including PR-21)
  testable: every branch throws unconditionally, with no persona
  parameter at all — the whole point being that no permission check could
  ever let this succeed, unlike every other gated action in the module.
- `event_schema.register` (§17 item 4) is implemented as a
  never-persona-gated, service-actor-only action (`actor.type ===
  'service'`), matching how KRN-04 treats `sys` writes (D-34's
  precedent) rather than adding it to the persona matrix at all — §11's
  own table already says ✗ for every persona including PR-21.
- `queryEvents`/`getEventById` take an explicit, pre-resolved
  `EventReadScope` (`subject_type_allow_list: string[] | null`) rather
  than resolving a caller's actual KRN-03 data_scope itself (L3) —
  mirrors KRN-03's own `isRowInScope` pre-resolved-parameter pattern
  exactly. List queries (`queryEvents`) filter silently outside scope
  (KRN-06-FR-010's literal "returns no result" sample); a direct
  fetch-by-id outside scope (`getEventById`) is a 403 instead, per §11's
  separate negative case for that access shape.
- Full test pyramid, 54/54 passing (298/298 combined with
  KRN-01/02/03/04):
  - `tests/contract/krn-06.contract.test.ts` (12) — shape only, including
    the D-38 `event_schema.schema_version` vs universal `version` distinction.
  - `tests/unit/krn-06.unit.test.ts` (10) — exhaustive state-transition
    legality for all five KRN-06 state machines (`outbox`,
    `delivery_attempt`, `dead_letter`, `subscription`, and the inferred
    `event_schema` machine — §5 gives no explicit one for the last, noted
    in the code as inferred from its own `status` enum).
  - `tests/unit/krn-06.acceptance.test.ts` (17) — every G/W/T in
    KRN-06.md §16 (FR-001..011, DR-001, DR-002), adapted where KRN-06
    doesn't own the domain mutation a sample references (L3), same
    pattern as KRN-03/04's adaptations.
  - `tests/unit/krn-06.permissions.test.ts` (14) — §11 positive/negative
    cases *and* functional proof that every write path rejects an
    unauthorised persona/actor at the real function call, including the
    PR-30-ownership-check negative case and the service-actor-only
    `event_schema.register` gate.
  - `tests/unit/krn-06.event-schema-conformance.test.ts` (1, exercising 9
    administrative event types) — runs the real service functions and
    validates actual emitted events against the real Zod schemas.

## Tooling (established this session, KRN-11)

- `core/krn-11` — sixth module package, same shape as its siblings, but
  the **first built after KRN-06 exists**: `src/contracts/` (number_series,
  series_assignment, sequence_state — with the D-39 `open_reservations`
  addition, cancelled_number; API contracts; the module's own event
  contracts per §12), `src/service/` (in-memory `Krn11Store`, bootstrap
  `permissions.ts` mirroring §11, one service file per concern).
- **`Krn11Store` takes a `Krn06Store` reference at construction and every
  mutation emits through `@mahisys/krn-06`'s real, exported
  `recordEvent()`** — not a local `store.events` array like
  KRN-01/02/03/04 (all built before KRN-06 existed, so each kept its own
  stand-in). This is the pattern every module built from here on should
  follow: `createStore(krn06Store)` takes the sibling module's store as
  an explicit dependency, and events are real KRN-06 event-store rows,
  provably so (the event-schema-conformance test asserts against
  `krn06.events`, not a KRN-11-local list). See decisions-taken.md D-39.
- The universal `entity_id` field doubles as "the KRN-01 legal entity
  this record belongs to" for `number_series`/`series_assignment` —
  exactly the same convention KRN-01's own `cost_centre` already
  established, not a new pattern.
- `allocate()` is the single entry point for both `on_issue` (immediate,
  final) and `on_draft_with_reservation` (reserves, later
  `confirmReservation`s or `cancelReservation`s) modes, idempotent on a
  caller-supplied key (KRN-11-FR-005 point 4) via `store.idempotencyIndex`.
  Neither `allocate()` nor `confirmReservation()` takes a `callerPersona`
  parameter — §11's own note that these are never persona-gated, only
  reachable through a transacting module's own already-authorised
  document-creation action.
- `confirmReservation`'s ordering check was wrong on first pass (required
  exactly `current_value + 1`) and was caught by its own acceptance test
  failing before commit — fixed to reject only a *still-open* smaller
  reservation, not a smaller value that was already cancelled and
  permanently retired. See D-39.
- Full test pyramid, 42/42 passing (340/340 combined with
  KRN-01/02/03/04/06):
  - `tests/contract/krn-11.contract.test.ts` (13) — shape only.
  - `tests/unit/krn-11.unit.test.ts` (2) — the one formal entity state
    machine (`number_series.status`); the "per-number lifecycle" §5
    describes is implicit across fields, exercised in acceptance tests.
  - `tests/unit/krn-11.acceptance.test.ts` (12) — every G/W/T in
    KRN-11.md §16 (FR-001..007, DR-001, DR-002), including a full
    200-concurrent-request load-accounting scenario (KRN-11-FR-005) —
    logical correctness only, proven single-threaded in this in-memory
    harness; true concurrent-load testing needs a real Postgres backend
    (D-12 stack-bound infra work), flagged rather than claimed covered.
  - `tests/unit/krn-11.permissions.test.ts` (14) — §11 positive/negative
    cases *and* functional proof that every write path rejects an
    unauthorised persona/actor, including the PATCH-immutable-fields
    engine rule holding even for PR-21.
  - `tests/unit/krn-11.event-schema-conformance.test.ts` (1, exercising 6
    event types) — runs the real service functions and validates actual
    events recorded in the real `Krn06Store` against the real Zod
    schemas.

## Tooling (established this session, KRN-10)

- `core/krn-10` — seventh module package: `src/contracts/` (audit_entry —
  bespoke, not `withUniversalFields`, mirroring `@mahisys/krn-06`'s
  `StoredEvent` for the identical reason; audit_chain_seal; access_log;
  API contracts; the module's own 3 administrative event contracts per
  §12), `src/service/` (in-memory `Krn10Store`, bootstrap
  `permissions.ts` mirroring §11, one service file per concern). Unlike
  every other kernel module's Vol 3 file so far, KRN-10.md has **no §4.1
  field-level table at all** — its entity shapes were assembled directly
  from FR-001/002/006/008 and DR-001's prose, one step further from
  source than KRN-06/11's "table extrapolated from an entity name" gap.
- `Krn10Store` takes a `Krn06Store` reference at construction (D-39's
  pattern, second module to use it) — but unlike KRN-11, `recordAuditEntry`/
  `logAccess` **never** call `recordEvent()`: KRN-10.md §12 states this
  explicitly as an anti-circularity rule (auditing the audit log's own
  writes would be circular). Only the three genuinely administrative
  actions — `sealChain`, `generateEvidencePack`, and a failed
  `verifyChain` — emit through the real KRN-06 API.
- **D-40: a real hash-chain tamper-evidence bug, caught by this module's
  own tests before commit.** `computeEntryHash`'s first pass used
  `JSON.stringify(canonical, Object.keys(canonical).sort())` to get a
  stable key order — but a `JSON.stringify` array-replacer applies as one
  flat whitelist at *every* nesting level, so `before`/`after`'s own
  nested field names (never present in the top-level key list) were
  silently stripped before hashing entirely. `KRN-10-FR-002`'s own
  tamper-detection guarantee was structurally broken: a hypothetically
  tampered `after.quantity` produced an identical hash. Both a dedicated
  unit test and the FR-002 acceptance test's own hypothetical-tamper
  scenario failed immediately, before any commit — replaced with a
  proper recursive `canonicalize()`. See decisions-taken.md D-40.
- Full test pyramid, 41/41 passing (381/381 combined with
  KRN-01/02/03/04/06/11):
  - `tests/contract/krn-10.contract.test.ts` (13) — shape only, including
    the DR-001 agent-fields-iff-agent-actor refine and the
    sequence_no-1-iff-prev_hash-null refine.
  - `tests/unit/krn-10.unit.test.ts` (4) — KRN-10.md §5 declares no state
    machines at all ("this absence is itself the point of the module"),
    so in their place: `computeEntryHash`'s determinism, prev-hash
    sensitivity, content sensitivity (the D-40 regression) and key-order
    independence.
  - `tests/unit/krn-10.acceptance.test.ts` (12) — every G/W/T in
    KRN-10.md §16 (FR-001..008, DR-001), including the FR-002 tamper
    scenario and FR-006's seal-then-verify flow.
  - `tests/unit/krn-10.permissions.test.ts` (11) — §11 positive/negative
    cases *and* functional proof that every read/export/verify path
    rejects an unauthorised persona at the real function call, including
    PR-25/PR-26 never getting direct query access at all.
  - `tests/unit/krn-10.event-schema-conformance.test.ts` (1, exercising
    all 3 administrative event types) — runs the real service functions
    and validates actual events recorded in the real `Krn06Store`;
    separately asserts `audit_entry`/`access_log` writes never reach
    KRN-06 at all (§12's anti-circularity rule, proven not just claimed).

## Tooling (established this session, KRN-07)

- `core/krn-07` — eighth module package: `src/contracts/` (a locally
  defined `RuleConditionSchema` — the P-12 expression-tree shape KRN-03/
  KRN-06 already define locally too; KRN-07 is P-12's actual owning
  module, so this is now the canonical definition for any *new* module
  needing it, though retrofitting KRN-03/KRN-06's already-working copies
  is out of scope this session; rule_set, rule, rule_version,
  evaluation_log — the last three not universal-fields-wrapped where
  append-only/bespoke, same reasoning as `event`/`AuditEntry`; API
  contracts; the module's own 4 event contracts per §12),
  `src/service/` (in-memory `Krn07Store`, a genuinely two-dimensional
  persona × `rule_type`-domain permission matrix — D-41 — one service
  file per concern).
- `evaluate()` (KRN-07-FR-005) is the single synchronous evaluation entry
  point, not persona-gated, called by any producing module within its
  own request/response cycle — same "governed by the caller's own
  permission matrix" rationale as KRN-11's `allocate()`. Scope/period
  filtering happens before priority ordering (KRN-07-FR-002); an
  `evaluation_log` entry is written for every call, matched or not, but
  **no KRN-06 event is ever emitted for an individual evaluation** —
  only rule-set/rule lifecycle changes and simulation completion do
  (third module to use the D-39 KRN-06 integration pattern, and the
  first to combine it with a deliberate "some mutations don't emit"
  exception, per KRN-07-FR-005's own explicit carve-out).
- `editRule()` never changes `rule.status` — it creates a new
  `rule_version`, marks the prior one `superseded_by_version_id`, and
  advances `current_version_id`, so `evaluation_log.rule_version_id`
  keeps resolving to the *exact* version that actually fired even after
  a later edit (KRN-07-FR-004, proven by a dedicated acceptance test:
  editing a rule after evaluation never changes the already-logged
  explanation).
- D-41 records three implementation-time modeling decisions: activating
  a `rule_set` cascades to its draft `rule`s (§10 names no separate
  per-rule activation endpoint); the permission matrix uses a genuine
  `DomainGrant` (`RuleType[] | 'all' | 'none'`) per persona × action
  rather than a flat boolean, since §11's table is two-dimensional by
  nature; PR-02's "own function's rule types" is a caller-supplied
  `callerDomainOverride`, not a static table entry, since which function
  a given PR-02 heads is runtime context, not a fixed list.
- Full test pyramid, 41/41 passing (422/422 combined with
  KRN-01/02/03/04/06/10/11):
  - `tests/contract/krn-07.contract.test.ts` (11) — shape only, including
    the rule_type enum excluding `tax` entirely and the
    natural_language_source-iff-authored_via-natural_language refine.
  - `tests/unit/krn-07.unit.test.ts` (4) — exhaustive state-transition
    legality for both `rule_set.status` and `rule.status`.
  - `tests/unit/krn-07.acceptance.test.ts` (9) — every G/W/T in
    KRN-07.md §16 (FR-001..007, DR-001, DR-002) — Vol 1 gives no
    Acceptance sample for KRN-07 at all (§17 item 2), so both KRN-07.md's
    own §16 and this suite are written from scratch against the stated
    FR/DR, not expanded from a given sample.
  - `tests/unit/krn-07.permissions.test.ts` (16) — §11 positive/negative
    cases across the full domain matrix *and* functional proof that
    every write/activate/simulate path rejects an unauthorised
    persona-domain pair at the real function call, including PR-02's
    override-driven checks and the tax-rule-type rejection applying to
    PR-21 too.
  - `tests/unit/krn-07.event-schema-conformance.test.ts` (1, exercising
    4 event types) — runs the real service functions and validates
    actual events recorded in the real `Krn06Store`; separately asserts
    no `evaluation_log`-subject event ever reaches KRN-06 (FR-005's
    carve-out, proven not just claimed).

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

## KRN-06 Definition of Done — see `/spec/decisions-taken.md`

Full checklist with reasoning recorded there. Short version: core logic
— most importantly `recordEvent`/`Krn06Store.emit()`, the single FR-001
outbox-write path every producing module's data-access layer would call
— full test pyramid, and permission enforcement across every write path
in all 6 owned entities (event, event_schema, subscription,
delivery_attempt, dead_letter, outbox) are done and tested, including
the D-38 fixes (`event_schema.schema_version` naming collision,
`retention.configure` missing permission column). **Remaining DoD
bullets are structurally blocked on other modules/tooling**, same
pattern as every kernel module so far: journey needs named application
modules; persona/UI needs KRN-13; reversal-path needs KRN-18; upgrade
rehearsal needs STU-10; agent-replay is N/A (§8: KRN-06 has no agents of
its own — it is the trigger substrate other agents subscribe through,
via INT-03, not built yet). **Two items are real, not-yet-closed gaps,
flagged rather than silently assumed:** the offline profile (§15,
`online` — no field-capture surface of its own, but must behave
correctly under KRN-16's downstream sync load once KRN-16 exists) has no
automated offline-runtime-harness test, same shared gap as KRN-02/
KRN-03; and the statutory retention floor (KRN-06-FR-009) is implemented
against a clearly-labelled placeholder value pending human confirmation
(D-38). **Same process deviation as KRN-04/KRN-03:** acceptance tests
were not strictly written failing-first this time — contracts, service
layer and tests were developed together against KRN-06.md directly.

## KRN-11 Definition of Done — see `/spec/decisions-taken.md`

Full checklist with reasoning recorded there. Short version: core logic
— most importantly `allocate`/`confirmReservation`, the gapless,
idempotent allocation path — full test pyramid, and permission
enforcement across every write path in all 4 owned entities are done and
tested, including the D-39 fixes (real KRN-06 event integration,
`open_reservations` addition, the confirm-ordering correction). A load
scenario (200 concurrent-shaped requests, KRN-11-FR-005) is exercised and
accounted for exactly, though only as *logical* correctness in a
single-threaded in-memory harness — true concurrent-load verification
under a real Postgres backend is explicitly out of scope here (D-12
stack-bound infra work), flagged rather than silently claimed done.
**Remaining DoD bullets are structurally blocked on other modules/
tooling**, same pattern as every kernel module so far: journey needs
named application modules; persona/UI needs KRN-13; reversal-path needs
KRN-18; upgrade rehearsal needs STU-10; agent-replay is N/A (§8: KRN-11
has no agents of its own — deterministic, statutory-grade allocation is
exactly the kind of thing that must never be probabilistic, T15).
**Offline profile is `online`** (§15) by design, not a gap: gapless
allocation fundamentally cannot happen on a disconnected device, so
there is nothing to test here the way KRN-02/03/06's offline gaps needed
flagging. **Same process deviation as every module since KRN-04:**
acceptance tests were not strictly written failing-first this time.

## KRN-10 Definition of Done — see `/spec/decisions-taken.md`

Full checklist with reasoning recorded there. Short version: core logic
— most importantly `recordAuditEntry`/`verifyChain`/`sealChain`, the
tamper-evident hash-chain mechanism FR-001/002/006 describe — full test
pyramid, and permission enforcement across every read/export/verify path
across all 3 owned entities are done and tested, including the D-40 fix
(a real tamper-detection bug caught by this module's own tests before
commit). **Remaining DoD bullets are structurally blocked on other
modules/tooling**, same pattern as every kernel module so far: journey
needs named application modules; persona/UI needs KRN-13 (SEC-06 owns
the actual audit application on top of this kernel engine, §17 item 1);
reversal-path is N/A in the usual sense — KRN-10 stores `reversal_handle`
references but does not itself execute reversals (KRN-18 does); upgrade
rehearsal needs STU-10; agent-replay is N/A (§8: KRN-10 records but does
not run agents). **KRN-10.md itself has no §4.1 field-level table at
all** (flagged prominently above and in the module's own contract file
headers) — a step beyond every other module's "table extrapolated from
an entity name" gap, since here even the entity *names* had no field
list to extrapolate from; the shapes built are traceable directly to
FR-001/002/006/008 and DR-001's prose instead. Offline profile is
`online` by nature (§15), same non-gap reasoning as KRN-11's. **Same
process deviation as every module since KRN-04:** acceptance tests were
not strictly written failing-first this time — though in this case the
tests still caught a real bug (D-40) on first run regardless, which is
exactly what the failing-first discipline is for.

## KRN-07 Definition of Done — see `/spec/decisions-taken.md`

Full checklist with reasoning recorded there. Short version: core logic
— most importantly `evaluate()`, the single synchronous evaluation path
every pricing/credit/reorder/eligibility/approval-threshold/compliance
decision platform-wide would call — full test pyramid, and permission
enforcement across every read/edit/activate/simulate path in all 4 owned
entities are done and tested, including the D-41 modeling decisions
(activation cascade, two-dimensional domain grants, PR-02's
context-dependent domain). **Remaining DoD bullets are structurally
blocked on other modules/tooling**, same pattern as every kernel module
so far: journey needs named application modules; persona/UI needs
KRN-13 (the "Rule builder" and "Evaluation log explorer" screens); the
KRN-05-routed activation approval for high-impact rule types degrades to
direct execution (D-21, same as KRN-01's `tenant.lifecycle`) until KRN-05
ships; reversal-path needs KRN-18; upgrade rehearsal needs STU-10;
agent-replay is N/A (§8: KRN-07 has no agents of its own — several
catalogue agents consume its outcomes as evidence, but KRN-07-FR-007
means none of them can ever author a rule, so there is no agent
authorship path to replay). Offline profile is `online` (§15) — KRN-07
itself has no offline surface, but an offline-`full` consuming module
(e.g. SLS-10) must cache the active rule/version locally and treat an
offline `/evaluate` result as provisional per Vol 0 §9.2's general
contract; this is inferred, not specified for KRN-07 itself (§17 item
6), and not independently testable from inside this module alone. **Same
process deviation as every module since KRN-04:** acceptance tests were
not strictly written failing-first this time.

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
- D-37: `createDelegation`'s bounded-scope check
  (`delegatorHoldsPermissionSet`) only recognised a permission_set held
  via a *direct* grant, silently rejecting the common case of a set held
  through a role — found while extending the throwaway demo to exercise
  KRN-03, since neither the acceptance nor permission tests had happened
  to exercise the role-based grant path for delegation. Fixed with a
  regression test, no spec change needed. See `/spec/decisions-taken.md`
  D-37. Closed.
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
- D-38: three KRN-06.md gaps found while writing contracts/service/tests
  — a field-naming collision between §4.1's `event_schema.version` and
  Vol 2 §1.2's universal `version` lock field (renamed to
  `schema_version`), a missing `retention.configure` permission-matrix
  column despite §1/§2 naming it as a stated PR-21 job, and
  `subscription.retry_ceiling` implemented as a real per-subscription
  field per §17 item 6's own proposal. One item deferred, not decided:
  the actual statutory retention floor value (§17 item 3) — implemented
  against a clearly-flagged placeholder (2922 days / 8 years), not
  blocking. See `/spec/decisions-taken.md` D-38. Closed (mechanism);
  retention floor value remains open pending human confirmation.
- KRN-06's offline profile (§15, `online`) has no automated test, same
  reason as KRN-02/KRN-03's identical open issue — no offline runtime
  harness exists yet. Not blocking Phase 0.
- D-39: KRN-11 (first module built after KRN-06 existed) established the
  real cross-module event-integration pattern — `Krn11Store` takes a
  `Krn06Store` at construction and emits through KRN-06's real
  `recordEvent()`, not a local stand-in array (the pattern every module
  built from here on should follow). Also added `sequence_state.
  open_reservations` (a field-table gap: the API needs `allocation_id`
  to resolve against something, §5 rules out a new top-level entity for
  it) and fixed a real `confirmReservation` ordering bug caught by its
  own acceptance test before commit. See `/spec/decisions-taken.md`
  D-39. Closed.
- D-40: `computeEntryHash`'s canonicalization was silently blind to any
  change inside a nested `before`/`after` payload (a `JSON.stringify`
  array-replacer applies at every nesting level, not just the top one),
  defeating `KRN-10-FR-002`'s entire tamper-evidence guarantee from the
  first line of code. Caught by the module's own unit and acceptance
  tests before commit. Fixed with a proper recursive canonicalizer. See
  `/spec/decisions-taken.md` D-40. Closed.
- **Flagged, not yet resolved: KRN-13 and KRN-19 have a circular
  dependency as drafted.** KRN-13.md's own `Depends on:` line names
  KRN-19 ("terminology overrides for labels"); KRN-19.md's own `Depends
  on:` line names KRN-13 ("Layout & Navigation Engine — renders the
  overridden/translated labels on every generated screen"). Neither can
  be built first under Vol 6 §3's dependency-gating rule as literally
  read. This is a genuine architectural question (Vol 6 §4: "you believe
  a law... must be broken," or here, two modules' own stated
  dependencies cannot both be satisfied in order) — not guessed around.
  Likely resolutions: one dependency is actually softer than stated (e.g.
  KRN-13 could render *unoverridden* labels and pick up KRN-19's
  overrides as an optional enhancement, breaking the cycle), or the two
  need a combined build. Left for human confirmation before either
  module is attempted; discovered while re-checking dependency clauses
  after KRN-07 (this session), not blocking anything already in
  progress.
- D-41: three KRN-07 implementation-time modeling decisions — activating
  a `rule_set` cascades to its draft `rule`s (no separate per-rule
  activation endpoint exists in §10), the permission matrix uses a
  genuine two-dimensional `DomainGrant` per persona × `rule_type` rather
  than a flat boolean (§11's table is two-dimensional by nature), and
  PR-02's domain is a caller-supplied `callerDomainOverride` rather than
  a static table entry (which function a PR-02 instance heads is runtime
  context). See `/spec/decisions-taken.md` D-41. Closed.
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
9. ~~KRN-03 is complete per Vol 6 §5 for every applicable bullet~~ **DONE**
   (except the offline-profile test, a real tracked gap shared with
   KRN-02, not a structural block — see Open issues) — moved to KRN-06
   (Event Bus & Event Store), identified as the biggest bottleneck (11
   dependent modules).
10. ~~KRN-06 full test pyramid + permission enforcement~~ **DONE — 54/54
    passing (298/298 combined with KRN-01/02/03/04), every write path
    across all 6 owned entities enforced and proven by test, including
    the D-38 fixes.** KRN-06 is complete per Vol 6 §5 for every
    applicable bullet except the offline-profile test (shared gap, not
    structural) and the statutory-retention-floor placeholder value
    (D-38, not blocking).
11. ~~With KRN-01/02/03/04/06 all done, re-checking every kernel module's
    dependency clause~~ **DONE** — showed KRN-05, KRN-07, KRN-10, KRN-11,
    KRN-14 and KRN-20 all fully unblocked (KRN-05 turned out *not* to be,
    on closer reading — its dependency clause continues onto a second
    line naming KRN-07 and KRN-12 too, both still unbuilt). **KRN-11
    (Numbering & Sequencing)** was picked as the next bottleneck (2
    dependents: KRN-08, KRN-16) and built this session.
12. ~~KRN-11 full test pyramid + permission enforcement~~ **DONE — 42/42
    passing (340/340 combined with KRN-01/02/03/04/06), every write path
    across all 4 owned entities enforced and proven by test, including
    the D-39 fixes.** KRN-11 is complete per Vol 6 §5 for every applicable
    bullet (offline is `online` by design here, not a gap — see its DoD
    note above). KRN-11 is also the first module to route its own events
    through KRN-06's real `recordEvent()` API instead of a local
    stand-in (D-39) — the pattern every module built from here on should
    follow.
13. ~~Re-checking dependency clauses again with KRN-11 now done too~~
    **DONE** — showed KRN-07, KRN-10, KRN-14 and KRN-20 unblocked.
    **KRN-10 (Audit & Immutable Log)** was picked as the next step (core
    compliance infrastructure directly consuming KRN-06, reinforcing the
    D-39 integration pattern) and built this session.
14. ~~KRN-10 full test pyramid + permission enforcement~~ **DONE — 41/41
    passing (381/381 combined with KRN-01/02/03/04/06/11), every
    read/export/verify path across all 3 owned entities enforced and
    proven by test, including the D-40 fix** — a real tamper-detection
    bug (the hash canonicalization silently ignored nested before/after
    fields) caught by this module's own tests before commit. KRN-10 is
    complete per Vol 6 §5 for every applicable bullet (offline is
    `online` by nature here, not a gap; reversal-path is N/A — KRN-10
    stores the reference, KRN-18 executes it).
15. ~~Re-checking dependency clauses with KRN-10 now done too~~ **DONE**
    — showed KRN-07, KRN-14, KRN-20 unblocked, with KRN-07 the
    highest-leverage pick (advances KRN-05, which itself unblocks
    KRN-09/KRN-18). **KRN-07 (Rules Engine)** was built this session.
17. ~~KRN-07 full test pyramid + permission enforcement~~ **DONE —
    41/41 passing (422/422 combined with KRN-01/02/03/04/06/10/11),
    every read/edit/activate/simulate path across all 4 owned entities
    enforced and proven by test, including the D-41 modeling
    decisions.** KRN-07 is complete per Vol 6 §5 for every applicable
    bullet (offline is `online` here, inferred not specified — see its
    DoD note above, not a gap this module alone can close).
18. Re-checking dependency clauses with KRN-07 now done too: **KRN-05
    moved from "needs KRN-07 + KRN-12" to needing only KRN-12** — but
    KRN-12 itself is blocked on **ITG-07** (Layer 1), which has no Vol 3
    file drafted yet at all — a real excursion outside the kernel-only
    pool of already-drafted, dependency-satisfied modules. Of the
    already-drafted kernel modules, only **KRN-14** (0 dependents) and
    **KRN-20** (1 dependent: KRN-13) remain fully unblocked. **Also
    found and flagged (not yet resolved): KRN-13 and KRN-19 depend on
    each other** — see Open issues above; this closes off that branch
    entirely until a human resolves it. **Recommended next step: KRN-20
    (Licensing & Entitlement)** — the better-leverage pick of the two
    remaining options, since it's one of KRN-13's two blockers (the
    other being the KRN-13/KRN-19 cycle itself). KRN-14 remains a valid,
    fully-unblocked alternative. **After KRN-14/KRN-20, no further
    already-drafted kernel module is buildable without either (a)
    drafting ITG-07's Vol 3 file (a Layer-1 excursion, D-19's documented
    exception) to unblock KRN-12 → KRN-05 → KRN-09/KRN-18, or (b) a human
    resolving the KRN-13/KRN-19 cycle** — worth flagging now so the next
    session isn't surprised by a shrinking pool.
19. Studio (STU-01..05) and remaining Phase 1 kernel Vol 3 files
    (already drafted for KRN-15..20 ahead of need) get the same review
    treatment before Phase 1 begins.

## Decisions log pointer

D-01 through D-17: initial charter/stack/deployment/billing decisions.
D-18 through D-41: kernel Vol 3 review decisions (Tier 1, Tier 2) plus
implementation-time findings across KRN-01, KRN-02, KRN-04, KRN-03,
KRN-06, KRN-11, KRN-10 and KRN-07 (2026-09-07/08/09/10). See
`/spec/decisions-taken.md` for the full record.
