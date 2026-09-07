# KRN-20 · Licensing & Entitlement

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-01 (tenant scope, tenant lifecycle — KRN-01-FR-004 names KRN-20 as an explicit subscriber of tenant lifecycle events), KRN-02 (Identity — a seat is assigned to an identity, and a user's persona/type comes from there), KRN-03 (Access Control — entitlement gates layer on top of, never replace, role/row permission checks), KRN-04 (Entity & Metadata Engine — module visibility in navigation/search is a metadata-layer gate)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-20)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17). **Billing metric (D-15) is closed** — see §6/§17 note 4.

---

## 1. Purpose and buyer

Enforces what a tenant has actually bought, at the metadata layer: an
unpurchased module is invisible in navigation, absent from search, and
rejected at the API boundary, while its data contracts still exist so an
upgrade is instantaneous and needs no migration (Vol 0 §11, §33.5). KRN-20
is the mechanism behind D-15's closed billing-metric decision (`/spec/
decisions-taken.md`): **seats by user type — full, light, self-service,
external** (Vol 0 §33.4), never self-reported revenue or headcount (Vol 0
§33.3's explicit warning against gameable metrics).

Not bought directly — `included` platform-fee substrate; it is what makes
every other SKU sellable and enforceable. The direct "user" of its admin
surface is PR-21 (System Administrator) for seat assignment, and PR-01/PR-16
for reviewing plan, usage and billing exposure. COM-03 (Pricing & Quote
Engine) and COM-04 (Tenant Provisioning & Lifecycle) are KRN-20's primary
system-level "buyers" — they write entitlements and seat assignments on the
tenant's behalf as the commercial outcome of a purchase or plan change.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Assigns users to seats and seat types; monitors usage meters and grace state |
| PR-01 Owner / Director | Reviews plan, entitlements, and billing exposure; approves a seat-type change or module add-on above a delegated threshold |
| PR-16 Finance Controller / CFO | Reviews usage-meter burn-down, seat mix, inference budget consumption; reconciles billing during close |
| PR-19 Employee | Consumes a `self_service` seat (free above a manifest-declared threshold, per Vol 0 §33.4) for attendance/leave/payslip/claims — never sees or configures entitlement themselves |
| PR-22..27 (External personas — Customer, Dealer, Vendor, CA/Auditor, Regulator, Job Candidate) | Consume an `external` seat, priced per portal, not per head (Vol 0 §33.4) |
| PR-28 Implementation Partner | Configures initial plan/entitlement/seat assignment during provisioning (COM-04), scoped to the tenant being provisioned |
| PR-30 Integration Service Account | Ingests `usage_record`s (transactions, documents, inference tokens) into `usage_meter`s |

Every internal and external persona's own `seat_assignment.user_type` is
resolved implicitly on every request as part of the permission/entitlement
check (KRN-03/KRN-20 together) — this is not a screen they interact with.

## 3. Scope in / scope out

**In scope:** plan and SKU registry; entitlement grant/suspend/expire per
tenant per module/SKU; seat assignment and metering by user type (full,
light, self-service, external — per portal); usage-meter recording for
billable events (transaction/document counts, inference tokens); grace-state
degrade-not-lock behaviour; inference-budget enforcement that degrades AI
features without ever blocking a business transaction (L8).

**Out of scope:** pricing calculation, proposal generation, quote/contract
terms and GST-on-subscription (COM-03 — KRN-20 enforces what a contract
grants, it does not compute the contract itself); the actual provisioning
mechanics of seeding masters, roles and demo data (COM-04 — KRN-20 supplies
the entitlement/seat data COM-04 writes at provisioning time, it is not the
provisioning workflow); payment collection, invoicing, dunning ladder and
churn signals for the platform's own subscription revenue (COM-05); MahiSys's
own GST/statutory obligations as a seller (CMP-01/04/05, on MahiSys's own
tenant, not a KRN-20 concern); the actual inference cost-control mechanisms
(model routing, caching, PII redaction — INT-12; KRN-20 enforces the budget
ceiling INT-12 reports against, it does not do the routing).

## 4. Entities owned; entities consumed

**Owned:** `plan`, `sku`, `entitlement`, `seat_assignment`, `usage_meter`,
`usage_record`, `grace_state` (Vol 1, verbatim list).

**Consumed (by ID):** `tenant_id`, `tenant.status` (KRN-01 — a `closed`
tenant's entitlements are terminally revoked, a `suspended` tenant enters
`grace_state`); actor/user identity and their assigned persona (KRN-02 — a
`seat_assignment.persona_id` names a `PR-NN` from Vol 0 §7, never an invented
role); module IDs from Vol 0's application catalogue (§11–26) as the object
every `sku.module_id` and `entitlement.module_id` references; `P-08 Event`
as the source of `usage_record`s (a billable action is always first an
event, never a KRN-20-original fact).

### 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every entity below.

**`plan`** (extrapolated from KRN-20-FR-002/005 and Vol 0 §33.1/§33.4; not
field-detailed in Vol 1 — flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `code`, `name` | string | e.g. `manufacturing-professional` |
| `included_sku_ids` | list<ref> | SKUs bundled into this plan by default |
| `seat_price_by_type` | object | `{full: Money, light: Money, self_service: Money, external_per_portal: Money}` — directly implements D-15/§33.4 |
| `self_service_free_threshold` | integer | Free `self_service` seats before pricing applies (Vol 0 §33.4 — addition, KRN-20-FR-006) |
| `inference_budget_tokens_per_month` | integer | Feeds KRN-20-FR-005/§29.2 |
| `status` | enum | `draft` \| `active` \| `retired` |

**`sku`**:

| Field | Type | Notes |
|---|---|---|
| `code`, `name` | string | |
| `module_id` | ref | A Vol 0 catalogue module ID (e.g. `SLS-07`, `INT-05`) — never invented (L15) |
| `sku_family` | enum | `application` \| `intelligence_tier` \| `studio` \| `industry_os_pack` \| `platform` — mirrors Vol 0 §33.1 structure |
| `sku_tier` | enum | `included` \| `core` \| `essential` \| `professional` \| `add-on` \| `platform` — vocabulary taken from Vol 0 §11–26's own per-module tier labels |
| `billing_unit` | enum | `included_in_platform` \| `seat` \| `usage` |

**`entitlement`**:

| Field | Type | Notes |
|---|---|---|
| `tenant_id` | ref | |
| `plan_id` | ref | |
| `sku_id`, `module_id` | ref | |
| `status` | enum | `trial` \| `active` \| `suspended` \| `expired` |
| `effective_from`, `effective_to` | timestamptz, nullable | |
| `source` | enum | `plan_default` \| `add_on_purchase` \| `trial_grant` |

**`seat_assignment`**:

| Field | Type | Notes |
|---|---|---|
| `tenant_id` | ref | |
| `user_id` | actor ref | KRN-02 identity |
| `persona_id` | ref | `PR-NN`, from Vol 0 §7 |
| `user_type` | enum | `full` \| `light` \| `self_service` \| `external` — KRN-20-FR-002 |
| `portal_scope` | ref, nullable | Required when `user_type = external`; identifies the shared portal (e.g. one `P-01 Party` dealer/vendor account) so multiple external logins under one portal consume one billed unit (Vol 0 §33.4 "priced per portal not per head") |
| `assigned_at` | timestamptz | |
| `status` | enum | `active` \| `revoked` |

**`usage_meter`**:

| Field | Type | Notes |
|---|---|---|
| `tenant_id` | ref | |
| `meter_type` | enum | `transaction_count` \| `document_count` \| `inference_tokens` \| `api_call` |
| `period` | Period | Billing-cycle window (Vol 2 §1.4) |
| `current_value` | integer | Aggregated, not per-event (KRN-20-FR-003 — cheap to read) |
| `ceiling` | integer, nullable | Set for `inference_tokens` per KRN-20-FR-005 |

**`usage_record`**:

| Field | Type | Notes |
|---|---|---|
| `usage_meter_id` | ref | |
| `source_event_id` | ref | The `P-08 Event` this billable action derives from |
| `quantity` | integer | |
| `recorded_at` | timestamptz | Append-only; aggregated into `usage_meter.current_value` asynchronously (KRN-15 job), never synchronously on the hot write path (KRN-20-FR-003) |

**`grace_state`**:

| Field | Type | Notes |
|---|---|---|
| `tenant_id` | ref | |
| `trigger` | enum | `payment_failed` \| `plan_expired` \| `trial_ended` |
| `entered_at` | timestamptz | |
| `grace_ends_at` | timestamptz | |
| `current_access_level` | enum | `full` \| `read_export_only` \| `suspended` |
| `status` | enum | `active` \| `resolved` |

## 5. State machines

**`entitlement.status`:** `trial → active → suspended → expired`, with
`suspended → active` reactivation permitted (mirrors KRN-01's
`tenant.status`); `expired` is terminal for that entitlement record — a
renewal creates a fresh `entitlement`, consistent with never silently
resurrecting a lapsed grant.

**`seat_assignment.status`:** `active ↔ revoked` — non-terminal, a seat may
be reassigned freely as staff change roles.

**`grace_state`:** `none → payment_failed/plan_expired/trial_ended`, then
`current_access_level` degrades stepwise `full → read_export_only →
suspended` as `grace_ends_at` approaches and passes (KRN-20-FR-004);
resolution (payment received, plan renewed) sets `status = resolved` and
restores `current_access_level = full` without a new tenant or entitlement
being created.

## 6. Standard functional requirements

- `KRN-20-FR-001` Entitlements are checked at the metadata layer, so an unpurchased module is invisible in navigation, absent from search, and rejected at the API boundary. *(Vol 1, verbatim)*
- `KRN-20-FR-002` Seats are metered by user type (Vol 0 §33.4): full, light, self-service and external, priced differently. *(Vol 1, verbatim)* **D-15 is closed on exactly this metric** (`/spec/decisions-taken.md`) — full detail: `external` seats are priced **per portal, not per head** (`seat_assignment.portal_scope`, §4.1), so a dealer's five staff logging into one distributor portal consume one billed `external` unit; `self_service` seats are free up to `plan.self_service_free_threshold` and priced only above it.
- `KRN-20-FR-003` Usage meters record billable events (transactions, documents, inference tokens) without themselves becoming a performance cost. *(Vol 1, verbatim)*
- `KRN-20-FR-004` Grace states degrade rather than lock: an expired tenant retains read access and export for a defined period before suspension. *(Vol 1, verbatim)*
- `KRN-20-FR-005` Inference budgets (Vol 0 §29.2) are enforced here; exceeding one degrades AI features but never blocks a business transaction (L8). *(Vol 1, verbatim)*
- `KRN-20-FR-006` Self-service seats (`PR-19` Employee, primarily) are included free up to a plan-declared threshold count and priced only above it, per Vol 0 §33.4's explicit warning against pricing floor/field and self-service personas at full-seat rates.
- `KRN-20-FR-007` Entitlement and seat-assignment checks are cached per tenant, per the kernel-wide metadata-caching convention (Vol 1 §1.2), with explicit invalidation on any entitlement or seat change — an every-request KRN-20-FR-001 gate must not become the NFR §36 latency bottleneck (p95 < 400 ms record read).

## 7. Differentiating requirements

- `KRN-20-DR-001` Data contracts for unpurchased modules still exist, so an upgrade is instantaneous and requires no migration. *(Vol 1, verbatim)*

## 8. Agents

None. KRN-20 is entitlement/metering infrastructure with no autonomous
behaviour of its own — INT-04 (Trust Ladder) reads `usage_meter`/inference
data KRN-20 maintains, but KRN-20 registers no agent itself.

## 9. Screens and flows

All screens KRN-13-generated (L6), and themselves subject to KRN-20-FR-001
(a screen for an unpurchased module is not merely hidden by convention, it
does not resolve). Standard views:

- **Plan & entitlements** (read-only) — PR-01, PR-16, PR-21: current plan,
  included SKUs, entitlement status per module.
- **Seat assignment** (list + form) — PR-21: assign/revoke a user's seat and
  `user_type`; external seats managed against a `portal_scope`, not
  per-login.
- **Usage & billing dashboard** — PR-16, PR-01: usage-meter burn-down vs
  ceiling, inference budget consumption, seat mix vs purchased.
- **Grace/suspension banner** — surfaced to every persona when
  `grace_state.status = active`, informational only, with a "resolve" link
  scoped to PR-01/PR-16 (billing authority).

## 10. API surface

Base per Vol 0 §42: `/api/v1/core/{entity}`. *(Vol 1 gives no explicit API
surface for KRN-20 — proposed by the implementer per Vol 6 §4/L13; flagged
in §17.)*

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/core/plans` | Platform-managed (`sys`) catalogue, read-only to tenants |
| GET/PATCH | `/api/v1/core/entitlements` | PATCH restricted to COM-03/COM-04 service accounts, never end-user-callable directly (mirrors KRN-01 §10's tenant-lifecycle pattern) |
| CRUD | `/api/v1/core/seat-assignments` | PR-21 |
| GET | `/api/v1/core/usage-meters` | Filterable by `meter_type`, `period` |
| POST | `/api/v1/core/usage-meters/{id}/records` | Service-account only (`PR-30`), idempotency-keyed, high-volume, async-aggregated (KRN-20-FR-003/007) |
| GET | `/api/v1/core/grace-state` | Read; transitions are driven by COM-05 payment/dunning events, never a direct tenant-user write |
| GET | `/api/v1/core/entitlements/check` | `{module_id}` → boolean + reason — the single call KRN-13 navigation, KRN-14 search and every module's API gateway make (KRN-20-FR-001), rather than each reimplementing the gate |

All list endpoints: cursor pagination, declared filters, field selection.
All writes: idempotency key required.

## 11. Permission matrix by persona

Actions: `read_plan`, `seat_assignment.create/update`, `read_usage`,
`grace_state.resolve`, `entitlement.write` (service-account only).

| Persona | read_plan | seat_assignment.create/update | read_usage | grace_state.resolve |
|---|---|---|---|---|
| PR-21 System Admin | ✓ | ✓ | ✓ | ✗ (billing authority, not admin) |
| PR-01 Owner | ✓ | ✗ | ✓ | ✓ |
| PR-16 CFO | ✓ | ✗ | ✓ | ✓ |
| PR-19 Employee | ✗ | ✗ | ✗ | ✗ |
| PR-22..27 External personas | ✗ | ✗ | ✗ | ✗ |
| PR-28 Implementation Partner | ✓ (own tenant, provisioning window) | ✓ (own tenant, provisioning window) | ✗ | ✗ |
| PR-30 Integration Service Account | ✗ | ✗ | ✗ (write-only, `usage_record` ingestion) | ✗ |
| PR-29 Agent | ✗ | ✗ | ✗ | ✗ |

**Negative cases:**
- Any tenant-side actor attempting `entitlement.write` directly (not via the
  COM-03/COM-04 service account) → 403, same pattern as KRN-01 §11's
  `tenant.create` negative case — entitlement grants are a commercial-process
  outcome, not a role permission.
- PR-19 (Employee) attempting to view the plan/usage/billing screen → 403;
  self-service personas have no billing visibility by design.
- PR-29 (Agent) attempting to modify `plan.inference_budget_tokens_per_month`
  or its own `usage_meter.ceiling` at any trust level → 403, unconditionally
  (L9 — an agent may never modify its own ceiling).
- PR-28 (Implementation Partner) attempting `seat_assignment.create` outside
  the provisioning window → 403 (same pattern as KRN-01 §11).

## 12. Events emitted / consumed

**Emitted:**
- `core.entitlement.granted`
- `core.entitlement.suspended`
- `core.entitlement.expired`
- `core.seat_assignment.created`
- `core.seat_assignment.revoked`
- `core.usage_meter.threshold_breached`
- `core.grace_state.entered`
- `core.grace_state.escalated` (access degraded a further step)
- `core.grace_state.resolved`

**Consumed:** `core.tenant.activated` / `core.tenant.suspended` /
`core.tenant.closed` (KRN-01 — KRN-01-FR-004 names KRN-20 as an explicit
subscriber); COM-03 plan-change/quote-acceptance events; COM-05
payment-success and payment-failed/dunning events (the trigger for
`grace_state` transitions).

## 13. Reports and KPIs

- Seats by user type — purchased vs assigned vs active, per plan.
- Usage-meter burn-down vs ceiling, per meter type and period.
- Inference budget consumption % — the number INT-12/§29.2's degrade
  decision is made against.
- Entitlement coverage — modules purchased vs modules with any recorded
  usage (a COM-03 upsell/downsell signal, raw data only — KRN-20 does not
  itself recommend a plan change).
- Grace-state tenant list — the operational queue COM-05's dunning ladder
  consumes.

## 14. Compliance touchpoints

- KRN-20-FR-005's inference-budget degrade is the direct implementation of
  L8 ("never let an AI failure block a business transaction") for the cost
  dimension specifically — a token ceiling breach degrades to cached or
  deterministic behaviour (Vol 0 §29.1/§29.2), it never halts a process.
- KRN-20-FR-004's grace-state degrade-not-lock behaviour is a data-access
  continuity guarantee, not a statutory one — but it is the mechanism that
  keeps a lapsed tenant able to export their own records (a SEC-07-adjacent
  concern: data portability even mid-dispute).
- No GST/statutory logic runs inside KRN-20 itself (L7) — MahiSys's own
  billing of its tenants for the platform fee and SKUs is a COM-03/COM-05
  concern against MahiSys's own books, entirely outside KRN-20's scope.

## 15. Offline behaviour

**Profile: `online`.** Entitlement enforcement is a live, server-side gate
by design — a client-cached "unlocked" decision could be stale or exploited,
so every API boundary check (KRN-20-FR-001) is always evaluated
server-side regardless of client state. Mobile clients may cache the
*last-known* entitlement set purely to render navigation correctly while
offline (an offline-`full` module like `SLS-10` should not disappear from a
beat rep's home screen mid-route because connectivity dropped), but that
cached state is a rendering convenience only, reconciled — never trusted —
on reconnect, and never used to authorise a write.

## 16. Acceptance criteria (Given/When/Then)

**KRN-20-FR-001 — entitlement enforced at the metadata layer**
> Given tenant `T1` with no entitlement for `MFG-05` (Job Work Out & Back)
> When a `T1` user searches for "job work" (KRN-14) or attempts `GET /api/v1/mfg/job-work-challan`
> Then `MFG-05` does not appear in navigation, does not appear in search results, and the API call is rejected with a stable machine error code — all three surfaces resolve from the single `entitlements/check` call, not three separate implementations.

**KRN-20-FR-002 — seats metered by user type, including per-portal external pricing**
> Given tenant `T1` assigns `user_type: full` to 8 users, `light` to 40 users, `self_service` to 120 employees, and `external` seats to 3 users who all log into the same dealer `portal_scope: DLR-01`
> When the seat/usage report is generated for billing
> Then it reflects 8 full, 40 light, 120 self-service (subject to FR-006's free threshold) and exactly **1** billed external unit for `DLR-01` — not 3 — because all three logins share one `portal_scope`.

**KRN-20-FR-003 — usage metering without a hot-path performance cost**
> Given 50,000 sales-order-creation events occur across an hour on tenant `T2`
> When those events post `usage_record`s against the `document_count` meter
> Then each individual `SLS-07` document-creation request's latency is unaffected by usage recording (no synchronous meter-update lock on the write path), and `usage_meter.current_value` for `document_count` reflects the full 50,000 once the async aggregation job (KRN-15) next runs.

**KRN-20-FR-004 — grace state degrades, never locks outright**
> Given tenant `T3`'s subscription payment fails and `grace_state.trigger = payment_failed` with `grace_ends_at` 14 days out
> When a `T3` user logs in on day 5 of the grace window
> Then `current_access_level = full` still holds (per the declared grace period) and every business process completes normally; on day 15, past `grace_ends_at`, `current_access_level` steps to `read_export_only` — users can still view and export their data, but new transactions are blocked — and only a further, separately-declared step (not tested here) would reach `suspended`.

**KRN-20-FR-005 — inference budget degrades AI, never a transaction**
> Given tenant `T4`'s `plan.inference_budget_tokens_per_month` is exhausted mid-month
> When a user attempts to post a sales order that would normally also trigger an INT-02 Copilot summarisation step
> Then the sales order posts successfully and completely without the AI step (degrading to a cached/deterministic summary or none at all, per §29.1), the tenant admin is notified of the budget exhaustion, and at no point does the business transaction itself fail or wait on the AI call (L8).

**KRN-20-FR-006 — self-service free threshold**
> Given plan `P1` with `self_service_free_threshold = 100` for tenant `T5`, which has 120 `self_service` seat assignments
> When the seat/billing report is generated
> Then exactly 20 self-service seats are billed (120 − 100), the first 100 are billed at zero, and a tenant with 90 self-service seats on the same plan is billed zero for that user type entirely.

**KRN-20-FR-007 — entitlement checks are cached and invalidated correctly**
> Given tenant `T6`'s entitlement for `SLS-07` is cached as `active`
> When PR-21 revokes that entitlement (e.g. a downgrade via COM-03)
> Then the cache is explicitly invalidated in the same transaction as the entitlement write, and the very next request to `SLS-07` — not merely the next cache-expiry cycle — is rejected per FR-001, with p95 read latency on unrelated, still-entitled modules unaffected (NFR §36).

**KRN-20-DR-001 — data contracts persist for unpurchased modules; instant upgrade**
> Given tenant `T7` has never purchased `INS-05` (BI Connector & Export), and the platform later ships a schema addition to `INS-05`'s underlying dataset contract
> When `T7` later purchases `INS-05` for the first time
> Then the feature activates immediately with no data migration step — the schema was present and versioned all along, only gated off by `entitlement.status` — and a tenant who has always had `INS-05` receives the same platform upgrade with no visible disruption at the moment `T7` is granted access.

## 17. Open questions

Flagged per Vol 6 §4/L13:

1. **Field-level detail for all seven owned entities** (§4.1) is not given
   in Vol 1 — only their names and purpose are stated. The fields proposed
   here (particularly `seat_assignment.portal_scope` implementing the
   "priced per portal not per head" rule from Vol 0 §33.4, and
   `plan.self_service_free_threshold`) are a reasonable minimum inferred
   from Vol 0 §33 and D-15, not a verbatim source. Please confirm or amend.
2. **API surface and event names** (§10, §12) are not specified in Vol 1 for
   KRN-20 — proposed by the implementer per Vol 6 §4/L13. Please confirm or
   amend before contract tests are written against it.
3. **Actual price points and inference-budget numbers per plan/tier remain
   unset.** D-15 closes *which metric* to bill on (seats by user type), but
   D-16 (AI unit economics, §29.3 calculation) is explicitly deferred per
   `/spec/decisions-taken.md` pending target gross margin and target Indian
   SMB price point from the human. KRN-20's data model (`plan.seat_price_by_type`,
   `plan.inference_budget_tokens_per_month`) is structured to hold whatever
   numbers D-16 eventually produces; this file sets no numbers itself, and
   none of its acceptance criteria depend on a specific price point.
4. **`self_service_free_threshold` value and `grace_ends_at` default
   duration** are not given anywhere in Vol 0/1 — KRN-20-FR-004 says only "a
   defined period" and Vol 0 §33.4 says self-service is "free above a
   threshold" without naming it. This draft models both as plan-configurable
   fields rather than hard-coded constants, consistent with L6 (never
   hard-code), but the actual default values need a human/COM-03 decision
   before Professional/Essential plans are seeded.
5. **Definition of "one portal" for external seat pricing** — this draft
   assumes one `portal_scope` corresponds to one `P-01 Party` record acting
   as a dealer/vendor/customer account (so all individual logins under that
   Party's organisation share one billed unit), but Vol 0 §33.4 does not
   define the unit precisely (per legal entity? per GSTIN? per named
   account?). Confirm this boundary with COM-03/SLS-03 before external-seat
   billing acceptance tests are finalised, since it directly affects
   revenue calculation for the Dealer/Distributor (PR-23) and Vendor (PR-24)
   personas at scale.
