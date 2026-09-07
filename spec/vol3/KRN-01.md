# KRN-01 · Tenancy & Organisation Model

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** none (foundational)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-01)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

Defines the container every other object in the system lives inside: tenant,
legal entity, org unit hierarchy, cost centre, fiscal calendar, and the
isolation tier a tenant runs under. Every record in the platform resolves to
exactly one tenant and one legal entity (Vol 2 §1.2 universal fields:
`tenant_id`, `entity_id`).

Not bought directly — it is the `included` platform-fee substrate every
module depends on (Vol 0 §11). The buyer is every tenant implicitly; the
direct "user" of its admin surface is PR-21 (System Administrator) at
tenant setup, and PR-16 (CFO) / PR-02 (Functional Head) for ongoing entity
and cost-centre structure.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Creates/configures the tenant's legal entities, org units, cost centres; manages isolation tier promotion requests |
| PR-16 Finance Controller / CFO | Owns fiscal calendar configuration and period close per legal entity |
| PR-02 Functional Head (CXO) | Views org unit structure for their function; requests new org units via process (KRN-05) |
| PR-01 Owner / Director | Reads tenant-level status (trial/active/suspended); approves legal entity changes above a threshold (delegated) |
| PR-15 Accountant | Reads fiscal period state to know whether posting is open |
| PR-28 Implementation Partner | Configures org structure during onboarding, scoped to the tenant they are provisioning (COM-06) |

Every other persona in the system consumes KRN-01 indirectly: every record
they touch carries `tenant_id` and `entity_id`, and every permission check
(KRN-03) resolves against org-unit scope defined here.

## 3. Scope in / scope out

**In scope:** tenant record and lifecycle; legal entity record, multi-entity
and multi-currency/multi-fiscal-calendar support; org unit hierarchy;
cost centre master; fiscal calendar and period state; isolation tier
assignment and promotion.

**Out of scope:** who can log in (KRN-02 Identity), what a role can do
(KRN-03 Access Control), the actual chart of accounts and GL (FIN-01), the
provisioning workflow that creates a tenant from a manifest (COM-04 —
KRN-01 is the data model COM-04 writes into, not the provisioning process
itself), billing/entitlement (KRN-20).

## 4. Entities owned; entities consumed

**Owned:** `tenant`, `legal_entity`, `org_unit`, `cost_centre`,
`fiscal_calendar`, `fiscal_period` (child of `fiscal_calendar`),
`isolation_assignment`.

**Consumed (by ID):** none at the data level — KRN-01 is foundational and
sits below every other module in the layer model (Vol 0 §5). It references
`P-04 Location` conceptually (a branch/site is a Location that belongs to an
org unit) but does not own or require Location records to exist; the
relationship is declared, not enforced, since KRN-04 (Location owner via
SCM/OPS) may not yet be provisioned when a tenant is created.

### 4.1 Field-level detail

Universal fields (Vol 2 §1.2 — `id`, `tenant_id` where applicable,
`namespace`, `ext`, `created_at/by`, `updated_at/by`, `version`,
`deleted_at/by`, `source`, `trace_id`) apply to every entity below and are
not repeated per field table.

**`tenant`** (Vol 1 §KRN-01, verbatim):

| Field | Type | Notes |
|---|---|---|
| `code` | string | Tenant-unique, immutable after creation |
| `name` | string | |
| `status` | enum | `trial` \| `active` \| `suspended` \| `closed` |
| `isolation_tier` | enum | `row` \| `schema` \| `dedicated` |
| `region` | string | GCP region the tenant's data is pinned to |
| `manifest_id` | ref | The VDL pack applied at provisioning (Vol 0 §30) |
| `plan_id` | ref | KRN-20 plan |
| `provisioned_at` | timestamptz | |

Note: `tenant` has no `tenant_id` field of its own (it *is* the tenant root);
`id` is the tenant identifier every other entity's `tenant_id` references.

**`legal_entity`** (Vol 1 §KRN-01, verbatim):

| Field | Type | Notes |
|---|---|---|
| `tenant_id` | ref | |
| `legal_name` | string | Statutory name |
| `tax_registrations` | list | `{type: gstin\|pan\|tan\|cin\|udyam, number, verified_at, status}` — same shape as `P-01 Party.tax_registrations` (Vol 2 §P-01) |
| `base_currency` | ref | ISO 4217 |
| `reporting_currency` | ref | ISO 4217 |
| `fiscal_year_start` | string | e.g. `04-01` |
| `address` | Address | Shared value object (Vol 2 §1.4) |
| `parent_entity_id` | ref, nullable | Self-reference for group hierarchy |
| `consolidation_method` | enum | `full` \| `proportional` \| `equity` \| `none` — required when `parent_entity_id` is set |

**`org_unit`** (extrapolated from KRN-01-FR-002; not field-detailed in Vol 1
— flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `entity_id` | ref | The legal entity this org unit belongs to |
| `parent_org_unit_id` | ref, nullable | Unlimited depth (KRN-01-FR-002) |
| `code`, `name` | string | |
| `org_unit_type` | ref | Manifest-defined (division, branch, department, plant, line — terminology overridden per KRN-19) |
| `location_id` | ref, nullable | `P-04 Location`, once SCM/OPS provisions it |
| `status` | enum | `active` \| `inactive` |

**`cost_centre`** (extrapolated; not field-detailed in Vol 1 — flagged in
§17):

| Field | Type | Notes |
|---|---|---|
| `entity_id` | ref | |
| `parent_cost_centre_id` | ref, nullable | |
| `code`, `name` | string | |
| `org_unit_id` | ref, nullable | Default org unit mapping for postings against this cost centre |
| `status` | enum | `active` \| `inactive` |

**`fiscal_calendar`** and **`fiscal_period`** (extrapolated from
KRN-01-FR-003; not field-detailed in Vol 1 — flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `entity_id` | ref | One calendar per legal entity |
| `fiscal_year` | string | e.g. `FY2027` |
| *(fiscal_period, child)* `period_no` | integer | 1..12 (or per manifest) |
| *(fiscal_period)* `from`, `to` | date | Period (Vol 2 §1.4) |
| *(fiscal_period)* `status` | enum | `open` \| `closed` \| `permanently_closed` |

**`isolation_assignment`**:

| Field | Type | Notes |
|---|---|---|
| `tenant_id` | ref | |
| `isolation_tier` | enum | `row` \| `schema` \| `dedicated` |
| `effective_from` | timestamptz | |
| `migration_status` | enum | `none` \| `scheduled` \| `in_progress` \| `completed` \| `failed` |
| `previous_tier` | enum, nullable | For audit/rollback reference |

## 5. State machines

**`tenant.status`:** `trial → active → suspended → closed`, with
`active → suspended` and `suspended → active` both permitted (grace/reactivation
per KRN-20-FR-004); `closed` is terminal — no transition out (a closed tenant
is re-provisioned as new, never reopened, consistent with L12's spirit of
never silently resurrecting identity).

**`fiscal_period.status`:** `open → closed → permanently_closed`. `closed →
open` is permitted (reopen for correction) only while not
`permanently_closed`; `permanently_closed` is terminal. Posting (any
`P-06 Transaction` with `posting_date` inside the period) is rejected once
`status != open` (KRN-01-FR-003).

**`isolation_assignment.migration_status`:** `none → scheduled → in_progress
→ completed`, with `in_progress → failed → scheduled` as a retry path.
`row`/`schema`/`dedicated` promotion is monotonic — no downgrade path is
defined at this layer (a business/support decision, not a state the engine
offers).

## 6. Standard functional requirements

- `KRN-01-FR-001` A tenant may hold multiple legal entities with independent fiscal calendars, currencies and tax registrations. *(Vol 1, verbatim)*
- `KRN-01-FR-002` Org units form an unlimited hierarchy; every user, document and transaction resolves to exactly one entity and zero or more org units. *(Vol 1, verbatim)*
- `KRN-01-FR-003` Fiscal periods support open, closed and permanently-closed states; posting into a closed period is rejected. *(Vol 1, verbatim)*
- `KRN-01-FR-004` Tenant lifecycle transitions (`trial → active → suspended → closed`) are process-governed (KRN-05) and emit events consumed by COM-04 and KRN-20. *(Vol 1, verbatim)*
- `KRN-01-FR-005` Cost centres form an unlimited hierarchy scoped to a legal entity, independent of the org-unit hierarchy, and may default-map to an org unit for postings without requiring one.
- `KRN-01-FR-006` A legal entity's `tax_registrations` list supports multiple GSTINs (e.g. one per state of operation), each independently verifiable via ITG-07.

## 7. Differentiating requirements

- `KRN-01-DR-001` Isolation tier is a tenant attribute. Promotion from `row` to `schema` to `dedicated` occurs by migration without any change to application code or logical model. *(Vol 1, verbatim)*
- `KRN-01-DR-002` Consolidation method on `legal_entity.parent_entity_id` relationships is declared data, not code — FIN-14 (Multi-Entity & Consolidation, when built) reads this declaration rather than each tenant needing bespoke consolidation logic.

## 8. Agents

None. KRN-01 is structural/administrative data with no autonomous behaviour
of its own. (Agents elsewhere — e.g. `CMP-AG-01`, `FIN-AG-*` — act on records
that carry `tenant_id`/`entity_id` resolved here, but KRN-01 registers no
agent of its own.)

## 9. Screens and flows

All screens are KRN-13-generated from KRN-04 metadata (L6 — no hand-built
form). Standard views:

- **Tenant settings** (form) — PR-21 only: code, name, region, isolation
  tier (read-only display; promotion is a separate guarded action, not a
  field edit), plan.
- **Legal entities** (list + form) — PR-21, PR-16: create/edit entity,
  manage `tax_registrations` (with ITG-07 GSTIN lookup autofill per Vol 0
  §32.2), currency and fiscal year start.
- **Org unit hierarchy** (tree/kanban-style structure view) — PR-21, PR-02
  (read within their function).
- **Cost centres** (list) — PR-21, PR-16.
- **Fiscal periods** (list, per entity) — PR-15, PR-16: view state; PR-16
  only: close/reopen period (guarded action, audited).

## 10. API surface

Base per Vol 0 §42: `/api/v1/core/{entity}`.

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/v1/core/tenants` | POST restricted to COM-04 provisioning service account, never end-user-callable |
| GET/PATCH | `/api/v1/core/tenants/{id}` | PATCH limited to `region` (pre-activation only), `plan_id` |
| POST | `/api/v1/core/tenants/{id}/lifecycle` | `{action: activate\|suspend\|close}` — process-governed (KRN-05), not a direct status write (KRN-01-FR-004) |
| POST | `/api/v1/core/tenants/{id}/isolation-tier/promote` | `{target_tier}` — async job (KRN-15), returns `isolation_assignment` |
| CRUD | `/api/v1/core/legal-entities` | Standard idempotent-key writes per Vol 1 §1.2 |
| CRUD | `/api/v1/core/org-units` | |
| CRUD | `/api/v1/core/cost-centres` | |
| GET | `/api/v1/core/fiscal-periods` | Filterable by `entity_id`, `fiscal_year`, `status` |
| POST | `/api/v1/core/fiscal-periods/{id}/close` | Guarded: rejects if open transactions exist that block close per FIN close rules (owned by FIN-01 when built; KRN-01 exposes the state, FIN-01 owns the close checklist) |
| POST | `/api/v1/core/fiscal-periods/{id}/reopen` | Rejected if `permanently_closed` |

All list endpoints: cursor pagination, declared filters, field selection
(Vol 1 §1.2). All writes: idempotency key required.

## 11. Permission matrix by persona

Actions: `create`, `read`, `update`, `delete` (always soft, SEC-07 only),
`approve` (lifecycle/period transitions), `export`.

| Persona | tenant.read | tenant.lifecycle | legal_entity.create/update | org_unit.create/update | cost_centre.create/update | fiscal_period.read | fiscal_period.close/reopen |
|---|---|---|---|---|---|---|---|
| PR-21 System Admin | ✓ | ✓ (propose; approval per KRN-05 matrix) | ✓ | ✓ | ✓ | ✓ | ✗ |
| PR-01 Owner | ✓ | ✓ (approve) | ✗ | ✗ | ✗ | ✓ | ✗ |
| PR-02 Functional Head | ✓ (own function) | ✗ | ✗ | ✓ (propose, own function) | ✗ | ✓ (own function) | ✗ |
| PR-16 CFO | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ |
| PR-15 Accountant | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| PR-28 Implementation Partner | ✓ (own tenant, provisioning window only) | ✗ | ✓ (own tenant, provisioning window only) | ✓ (own tenant, provisioning window only) | ✓ (own tenant, provisioning window only) | ✗ | ✗ |
| All other internal personas | ✓ (own entity/org-unit scope, read-only, resolved implicitly for row scoping — not a direct screen) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

**Negative cases:**
- PR-15 (Accountant) attempting `fiscal_period.close` → 403, audited (KRN-10), no partial close, period state unchanged.
- PR-02 (Functional Head) attempting `org_unit.create` outside their own function's subtree → 403.
- Any persona attempting `tenant.create` via API directly (not via COM-04 service account) → 403, regardless of role, since tenant creation is a provisioning-process action, not a role-permission grant (KRN-01-FR-004, Vol 6 L1 — platform never writes `tnt` on a tenant's behalf, and equally a tenant never self-provisions a sibling tenant).
- PR-28 (Implementation Partner) attempting any action outside the provisioning window (after `tenant.status` leaves `trial`/pre-`active`, unless explicitly re-engaged) → 403.

## 12. Events emitted / consumed

**Emitted** (Vol 1, verbatim, plus extensions):
- `core.tenant.provisioned`
- `core.tenant.activated`
- `core.tenant.suspended`
- `core.tenant.closed`
- `core.tenant.isolation_changed` (KRN-01-DR-001 acceptance sample)
- `core.legal_entity.created`
- `core.legal_entity.updated`
- `core.org_unit.created`
- `core.cost_centre.created`
- `core.fiscal_period.closed`
- `core.fiscal_period.reopened`

**Consumed:** none. KRN-01 is foundational (Layer 0) and initiates state
rather than reacting to other modules' events, with one exception: it
*receives* provisioning instructions from COM-04 via direct API call (not
event subscription — provisioning is synchronous/orchestrated, not
event-driven, since the tenant does not yet exist to have an event stream).

## 13. Reports and KPIs

- Tenant count by status and isolation tier (platform-internal, INS/ops
  visibility, not tenant-facing).
- Legal entity count and consolidation structure per tenant.
- Fiscal period status board (open/closed per entity) — surfaced to PR-15/16
  as a standard dashboard widget (KRN-13).

No statutory reports originate in KRN-01 itself (statutory filings are
CMP-05).

## 14. Compliance touchpoints

- `legal_entity.tax_registrations` is the field CMP-01 (GST Engine) reads to
  determine place-of-supply and registration status per entity — KRN-01
  stores the registration, CMP-01 owns all tax determination logic (L7).
- Multi-GSTIN-per-entity (KRN-01-FR-006) is required for CMP-02/CMP-03 to
  determine the correct originating registration for e-invoices and e-way
  bills issued from a branch location.
- Fiscal period close state (KRN-01-FR-003) is a hard gate CMP-05 (Statutory
  Filings) and FIN-01 (GL) both depend on — no posting into a closed period,
  full stop.

## 15. Offline behaviour

**Profile: `online`.** Tenant, legal entity, org unit, cost centre and
fiscal period are administrative configuration, not field-capture data —
none of PR-04/05/07/09/13/19/20 (the offline-first personas, Vol 0 §7.3)
interact with this module directly. No conflict policy needed.

## 16. Acceptance criteria (Given/When/Then)

**KRN-01-FR-001 — multi-entity, independent fiscal calendars/currencies**
> Given a tenant `T1` with legal entities `E1` (fiscal year Apr–Mar, INR) and `E2` (fiscal year Jan–Dec, USD)
> When a user posts a transaction dated 15-Jan-2027 against `E2`
> Then it resolves to `E2`'s fiscal period Jan-2027, `E1`'s fiscal calendar and periods are unaffected, and the transaction's `entity_id` is `E2`.

**KRN-01-FR-002 — org unit resolution**
> Given an org unit hierarchy `HQ > Plant-A > Line-3`, all under legal entity `E1`
> When a document is created scoped to `Line-3`
> Then it resolves to exactly one entity (`E1`, via `Plant-A`) and the org unit ancestor chain `[Line-3, Plant-A, HQ]` is available for KRN-03 scope checks.

**KRN-01-FR-003 — closed period rejects posting**
> Given fiscal period `2027-01` on entity `E1` with status `closed`
> When a transaction with `posting_date` inside `2027-01` is submitted against `E1`
> Then the write is rejected with a stable machine error code (Vol 1 §1.2), no record is created, and no event is emitted.

**KRN-01-FR-004 — tenant lifecycle is process-governed and eventful**
> Given a tenant `T3` in status `trial`
> When the trial-to-active transition is approved through its KRN-05 process instance
> Then `T3.status` becomes `active`, `core.tenant.activated` is emitted within the same transaction as the status write, and COM-04 and KRN-20 subscribers receive it.

**KRN-01-FR-005 — cost centre hierarchy independent of org units**
> Given cost centres `CC-Corp > CC-Plant-A` on entity `E1`, and org units `HQ > Plant-A` on the same entity, with no required parent-child alignment between the two hierarchies
> When a transaction posts against `CC-Plant-A` with `org_unit_id` left unset
> Then it resolves successfully using `CC-Plant-A`'s default org-unit mapping, and the two hierarchies remain independently editable.

**KRN-01-FR-006 — multi-GSTIN per entity**
> Given legal entity `E1` with `tax_registrations` containing GSTINs for Maharashtra and Gujarat, both `verified` via ITG-07
> When a document is issued from a branch located in Gujarat
> Then CMP-01 resolves the Gujarat GSTIN for place-of-supply determination, and the Maharashtra GSTIN is unaffected and independently selectable for a different branch.

**KRN-01-DR-001 — isolation tier promotion (full form of Vol 1's sample)**
> Given a tenant `T2` on `row` isolation with 40,000 records across 12 entities
> When `T2` is promoted to `schema` isolation
> Then all 40,000 records remain accessible at identical IDs, every foreign key and `tnt` extension field resolves unchanged, no application code path differs, `isolation_assignment.migration_status` reaches `completed`, and exactly one `core.tenant.isolation_changed` event is emitted carrying `{previous_tier: row, new_tier: schema}`.

**KRN-01-DR-002 — declarative consolidation**
> Given legal entities `E1` (parent) and `E2` (`parent_entity_id = E1`, `consolidation_method = full`)
> When FIN-14 (once built) requests a consolidated statement for `E1`
> Then it reads `consolidation_method` from `legal_entity` rather than requiring entity-specific consolidation code, and a different tenant with `proportional` consolidation on an equivalent structure requires no KRN-01 code change — only different declared data.

## 17. Open questions

Flagged per Vol 6 §4/L13 — these are gaps in Vol 1's field-level detail that
this draft filled by reasonable extrapolation from the stated purpose and
requirements. They should be confirmed or corrected by the human before this
Vol 3 file is treated as binding:

1. **`org_unit`, `cost_centre`, `fiscal_calendar`/`fiscal_period` field
   tables** (§4.1) are not given at field level in Vol 1 — only their
   existence and purpose are stated. The fields proposed here are a
   reasonable minimum consistent with KRN-01-FR-002/003/005, not a
   verbatim source. Please confirm or amend.
2. **`org_unit_type`** is described as "manifest-defined" — confirm this
   means a `tnt`/manifest-declared reference list (consistent with T13/L1),
   not a `sys` enum, since different verticals need different org unit
   vocabularies (e.g. "Ward" for Healthcare vs "Line" for Manufacturing) —
   this draft assumes the former.
3. **Isolation tier downgrade** — no downgrade path is specified anywhere
   in Vol 0/1. This draft assumes promotion is one-directional at the
   engine level (a downgrade, if ever needed, would be a new tenant plus
   data migration, not a reverse of this operation). Confirm this is
   intended, since it affects whether `isolation_assignment` needs a
   `target_tier < current_tier` guard.
4. **Fiscal period close checklist ownership** — this draft assumes FIN-01
   (not yet built) owns the substantive close checks (open sub-ledgers,
   unposted batches, etc.) and KRN-01 only owns the state flag and the
   reject-on-closed-period rule. Confirm this boundary before FIN-01's own
   Vol 3 is drafted, to avoid KRN-01 and FIN-01 disagreeing about who
   blocks a close.
5. **Multi-GSTIN-per-entity (KRN-01-FR-006)** is an addition beyond Vol 1's
   literal text (Vol 1 only shows a single `tax_registrations` list without
   discussing multiplicity), inferred from `P-04 Location.gstin` in Vol 2
   ("a location may have its own registration — critical for multi-state
   tenants"). Confirm this is the intended mechanism, or whether
   multi-state GSTIN handling should live entirely on `Location` instead of
   also being declared at `legal_entity` level.
