# KRN-12 · Masters & Reference Data

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-01 (legal entity scoping for `tnt` reference values), KRN-04 (metadata registration of `tnt` reference types), **ITG-07** (Layer 1 — central reference-data refresh; a documented, named exception to Vol 0 §5's no-upward-layer-dependency rule, per D-19, scoped narrowly to this one read-only refresh job and not a general licence for Layer 0 to depend on Layer 1)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-12)
per Vol 6 §4/L13, for human review and approval. Reworked 2026-09-07 per
D-18 (per-tenant physical replication of `sys` reference data) and D-19
(ITG-07 exception for central updates) — see `/spec/decisions-taken.md`.
Not binding until fully approved (remaining open questions in §17).

---

## 1. Purpose and buyer

The shared reference layer every transacting module reads and no module
should ever be maintaining a private copy of: units of measure and their
conversions, currencies and exchange rates, tax codes, HSN/SAC classification,
country/state/district/pincode geography, business calendars and holidays,
and the bank master. It is the substrate that makes `Money` and `Quantity`
(Vol 2 §1.4 shared value objects) resolvable, and the reason a tenant never
has to manually keep its GST rate schedule or pin-code-to-state mapping
current.

Not bought directly — `included` platform-fee substrate. There is no
end-user "buyer" of KRN-12 as a product; its practical owner is PR-21 at
setup (loading manifest-declared master presets, Vol 0 §30's
`masters_preload`) and MahiSys' own platform operations function for the
centrally-maintained `sys` reference sets, since a tenant never edits those
(KRN-12-DR-001).

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Loads manifest-preloaded master sets at provisioning; adds tenant-specific (`tnt`) reference values (custom UoM, custom calendar) |
| PR-16 Finance Controller / CFO | Maintains exchange rates where not fed by an integration; reviews reference-data version history before period close |
| PR-15 Accountant | Consumes UoM, tax code and HSN/SAC lookups constantly while entering transactions in FIN/SCM screens (not a KRN-12 screen itself) |
| PR-17 HR Manager | Maintains the tenant's regional holiday calendar entries (`tnt`) consumed by PPL-06 (Leave) and PPL-07 (Shift & Roster) |
| PR-06 Purchase Officer | Consumes UoM conversions and HSN/SAC lookups when creating item masters and POs |
| PR-25 External CA / Auditor | Scoped read access to the reference-data version history as audit evidence for a rate or code that was in effect on a given transaction date |
| PR-28 Implementation Partner | Confirms manifest master presets and loads any additional `tnt` reference data during onboarding (COM-06) |
| Every other persona in the system | Consumes KRN-12 indirectly — any screen showing a unit, a currency, a tax rate, an address, or a business-calendar-aware date is reading through KRN-12 |

## 3. Scope in / scope out

**In scope:** UoM and multi-step conversion; currency and exchange rate
history; tax code and HSN/SAC master (the *code list*, not the computation —
see §14); country/state/district/pincode geography including GST state
codes; business calendar and holiday master; bank/IFSC master; industry code
master; versioning and effective-dating of all of the above; the `tnt`
extension mechanism for tenant-specific reference values.

**Out of scope:** tax *computation* (place-of-supply, rate application,
reverse charge — CMP-01, per L7: no module, KRN-12 included, computes GST);
GSTIN verification and legal-name lookup (ITG-07, a Layer-1 integration
service, not a Layer-0 kernel dependency — see §17 for the layering
implication); UoM assignment on a specific item (`P-02 Item.base_uom_id`,
owned by SCM-01); the actual bank *account* a party holds (`P-01
Party.channels` / FIN's own vendor/customer banking detail records — KRN-12
owns the bank/IFSC *directory*, not any party's account against it).

## 4. Entities owned; entities consumed

**Owned:** `uom`, `uom_conversion`, `currency`, `exchange_rate`, `tax_code`,
`hsn_sac`, `country`, `state`, `district`, `pincode`, `calendar`, `holiday`,
`bank`, `industry_code`.

**Consumed (by ID):**
- `KRN-01` `legal_entity` — `tnt` reference values (KRN-12-FR-002) and
  entity-specific exchange rate entries scope to a legal entity.
- `KRN-04` `entity_definition` — a `tnt` reference value type (e.g. a custom
  UoM category) is registered as metadata before it can be populated,
  keeping tenant extension inside the declared extension mechanism (Vol 2
  §1.7) rather than an ad hoc side table.

- `ITG-07` (Government APIs) — **D-19: a named, documented exception** to
  the general rule that Layer 0 may not depend on Layer 1. KRN-12's own
  central-refresh job calls ITG-07's read-only government-data endpoints
  (GSTN rate schedules, HSN/SAC, pincode/DGFT feeds) to source the values
  it then writes into every tenant's replicated copy (§4.1, D-18). This
  exception is scoped to exactly this one refresh path — it does not
  license any other Layer-0 module to call a Layer-1 service, and any
  future case of the same pattern should cite D-19 explicitly rather than
  being re-litigated as a new question (consistent with D-21's standing
  convention for recurring architectural patterns).

## 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every KRN-12 entity with **no
exception** (D-18): every `sys` reference row — every currency, HSN/SAC
entry, tax code, pincode, calendar, bank directory row — is physically
replicated per tenant and carries a genuine, real `tenant_id`, resolved
through row-level security identically to every other entity in the
platform. There is no shared platform-pseudo-tenant table and no
special-cased read path anywhere in KRN-12's data model.

**Replication mechanism (D-18/D-19).** A tenant's `sys` reference rows are
seeded at provisioning (COM-04, from the manifest's `masters_preload`, Vol
0 §30) and kept current by a scheduled per-tenant sync job (§10, §12) that
calls ITG-07 (D-19) and applies the same upstream update to every tenant's
copy in turn. A central update therefore fans out to 10,000 individual
writes rather than one — accepted as the cost of a uniform, exception-free
data model (D-18's stated reasoning). `KRN-12-DR-001`'s promise ("tenants
never carry stale statutory data") depends on this fan-out job's own
freshness SLA, tracked in §13.

**`uom`** and **`uom_conversion`** (extrapolated from KRN-12-FR-003; not
field-detailed in Vol 1 — flagged in §17):

| Entity | Field | Type | Notes |
|---|---|---|---|
| `uom` | `code`, `name` | string | e.g. `KG`, `Kilogram` |
| `uom` | `uom_category` | ref | Dimension the UoM belongs to (mass, length, count, volume …) — conversion only permitted within a category |
| `uom` | `is_base` | boolean | The canonical unit for its category (`Quantity.base_uom_id` resolves to this) |
| `uom_conversion` | `from_uom_id`, `to_uom_id` | ref | |
| `uom_conversion` | `factor` | decimal(18,9) | `to = from × factor` |
| `uom_conversion` | `precision`, `rounding` | int, enum | Applied at multi-step resolution (KRN-12-FR-003) |

**`currency`** and **`exchange_rate`** (extrapolated; not field-detailed in
Vol 1 — flagged in §17):

| Entity | Field | Type | Notes |
|---|---|---|---|
| `currency` | `iso_code` | string | ISO 4217, `sys`-maintained code list |
| `currency` | `decimal_places` | integer | |
| `exchange_rate` | `entity_id` | ref | An exchange rate is entity-scoped, since two legal entities on the same tenant may use different rate sources or dates |
| `exchange_rate` | `from_currency`, `to_currency` | ref | |
| `exchange_rate` | `rate`, `effective_date` | decimal, date | |
| `exchange_rate` | `source` | enum | `manual` \| `integration` — KRN-12 stores the rate regardless of source; a higher-layer module (e.g. FIN-07 via ITG-04) is responsible for feeding `integration`-sourced rates in, KRN-12 itself never calls out (§17) |

**`tax_code`** and **`hsn_sac`** — the *master list* CMP-01 reads to
determine tax outcomes, never itself computing an outcome (L7):

| Entity | Field | Type | Notes |
|---|---|---|---|
| `tax_code` | `code`, `name` | string | e.g. `GST-18`, `GST-EXEMPT` |
| `tax_code` | `rate_components` | list | `{component: cgst\|sgst\|igst\|cess, rate}` — the *declared* rate; CMP-01 applies it |
| `tax_code` | `effective_from`, `effective_to` | date, nullable | Versioned per KRN-12-FR-001 |
| `hsn_sac` | `code`, `description` | string | HSN (goods) or SAC (services) |
| `hsn_sac` | `default_tax_code_id` | ref, nullable | A default suggestion; CMP-01 owns whether/how it is overridden per transaction context |
| `hsn_sac` | `effective_from`, `effective_to` | date, nullable | |

**`country` / `state` / `district` / `pincode`**:

| Entity | Field | Type | Notes |
|---|---|---|---|
| `country` | `iso_code`, `name` | string | |
| `state` | `country_id`, `code`, `name` | ref, string | `code` includes the GST state code used in place-of-supply determination |
| `district` | `state_id`, `name` | ref, string | |
| `pincode` | `code`, `state_id`, `district_id` | string, ref | Resolves the `Address` value object's `state_code`/`district` from a pincode entry |

**`calendar`** and **`holiday`**:

| Entity | Field | Type | Notes |
|---|---|---|---|
| `calendar` | `entity_id`, `region_scope` | ref, ref, nullable | A business calendar may be entity-wide or region-scoped (state-level, for state-specific holidays) |
| `calendar` | `namespace` | enum | `sys` (national holidays, platform-maintained) \| `tnt` (tenant-added regional/industry holidays, e.g. a factory's declared shutdown days) |
| `holiday` | `calendar_id`, `date`, `name` | ref, date, string | |

**`bank`**:

| Field | Type | Notes |
|---|---|---|
| `ifsc` | string | Platform-maintained directory entry |
| `bank_name`, `branch_name`, `address` | string, Address | |
| `micr` | string, nullable | |

**`industry_code`**: `code`, `name`, `classification_system` (e.g. NIC) —
consumed by COM-02 (Package Recommender) and Vol 0 §32 signup discovery.

## 5. State machines

None of KRN-12's entities carry a business process state machine — reference
data is either `active`/`deprecated` (via the standard KRN-04-FR-003
deprecation-with-sunset mechanism, since these are all `sys` or `tnt`
entities registered through the metadata engine like any other) or
version/effective-dated (`tax_code`, `exchange_rate`, `hsn_sac` — a new
version does not replace the old one in place, it opens a new
`effective_from` window per KRN-12-FR-001, so a historical transaction always
resolves against the value that was true on its date, Vol 2 §1.6 "valid
time"). There is no KRN-05 process instance anywhere in this module.

## 6. Standard functional requirements

- `KRN-12-FR-001` Reference data is versioned and effective-dated; historical transactions resolve against the values valid at their date. *(Vol 1, verbatim)*
- `KRN-12-FR-002` Tenants may add `tnt` reference values (custom UoM, custom calendars) without altering platform sets. *(Vol 1, verbatim)*
- `KRN-12-FR-003` UoM conversions support multi-step resolution with defined precision and rounding. *(Vol 1, verbatim)*
- `KRN-12-FR-004` Country, state, district and pincode form a maintained geographic hierarchy including GST state codes, consumed for `Address` validation (Vol 2 §1.4) across every module. *(Addition — the entity exists per Vol 1's owned-entity list but has no FR of its own in Vol 1.)*
- `KRN-12-FR-005` The bank/IFSC master validates bank account and routing details consumed by FIN-05 (Payments), FIN-07 (Banking & Reconciliation) and PPL-08 (Payroll bank transfer files); KRN-12 stores and serves the directory, it does not itself initiate any payment or bank API call. *(Addition — same basis as FR-004.)*
- `KRN-12-FR-006` Calendar and holiday masters define business calendars consumed by KRN-05 (SLA clock pausing on holidays) and PPL-06/07 (leave accrual, roster and statutory rest-day compliance); a calendar may be entity-wide or region-scoped, and a tenant may layer `tnt` holiday entries (e.g. a factory shutdown) on top of a `sys` national-holiday base without altering the base set. *(Addition — same basis as FR-004.)*

## 7. Differentiating requirements

- `KRN-12-DR-001` HSN/SAC, GST rate schedules and pin-code mappings are platform-maintained and updated centrally, so tenants never carry stale statutory data. *(Vol 1, verbatim. Mechanism per D-18/D-19: a platform-operated sync job sources updates from ITG-07 and fans them out to every tenant's own replicated copy — "centrally maintained" describes the source of truth and the update process, not a single shared table.)*
- `KRN-12-DR-002` Because reference data is versioned and effective-dated (KRN-12-FR-001) rather than mutated in place, a central update to KRN-12-DR-001's data (e.g. a GST rate change effective a future date) never retroactively alters the tax outcome of an already-issued document — the historical version remains resolvable exactly as it was on the document's date. *(Addition — makes explicit why FR-001 and DR-001 must work together for DR-001's promise to actually hold.)*
- `KRN-12-DR-003` The per-tenant fan-out sync job (D-18/D-19) is idempotent and resumable: a tenant that missed one or more sync cycles (e.g. an isolation-tier-`dedicated` tenant temporarily unreachable) catches up to the current upstream state on its next successful run without manual intervention, and its `sync_freshness` metric (§13) reflects the actual lag honestly in the meantime. *(Addition — a direct consequence of choosing per-tenant replication over one shared table, per D-18: replication introduces a per-tenant freshness/consistency question that a single shared table would not have had, so it needs its own explicit guarantee.)*

## 8. Agents

None. KRN-12 is not in Vol 0 §27.4's launch agent registry, and reference
data maintenance is deliberately deterministic and centrally curated rather
than autonomous — a wrong HSN/SAC mapping or GST rate is a statutory-grade
error, and Vol 6 §6 requires statutory logic to be tested against published
cases, not inferred by a model.

## 9. Screens and flows

All screens are KRN-13-generated from KRN-04 metadata (L6). Standard views:

- **Master data browser** (list, one per reference entity — UoM, currency,
  tax codes, HSN/SAC, geography, calendars, banks) — read access broadly
  available; write access restricted per §11.
- **UoM & conversions** (list + form) — PR-21: define `tnt` custom units and
  their conversion factors within a declared category.
- **Exchange rates** (list, per entity/currency pair) — PR-16, PR-15: enter
  or review manually-sourced rates; rates fed by an integration
  (`source: integration`) display read-only with their feed provenance.
- **Business calendars & holidays** (list, per entity/region) — PR-17: add
  `tnt` holiday entries on top of the `sys` national base.
- **Reference-data version history** (list, per entity) — PR-16, PR-25: the
  audit-facing view showing every effective-dated version of a tax code,
  HSN/SAC entry or exchange rate and the date range each applied.

## 10. API surface

Base per Vol 0 §42: `/api/v1/masters/{entity}`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/masters/uom`, `/uom-conversions` | `tnt` entries writable via `POST`/`PATCH` by PR-21; `sys` entries read-only |
| GET | `/api/v1/masters/currencies`, `/exchange-rates` | `POST` on `exchange-rates` for `source: manual` entries |
| GET | `/api/v1/masters/tax-codes`, `/hsn-sac` | Read-only to all tenant callers — `sys`-maintained, platform-write-only (KRN-12-DR-001) |
| GET | `/api/v1/masters/countries`, `/states`, `/districts`, `/pincodes` | Read-only |
| CRUD | `/api/v1/masters/calendars`, `/holidays` | `sys` scope read-only; `tnt` scope writable per §11 |
| GET | `/api/v1/masters/banks` | Read-only, `sys`-maintained IFSC directory |
| GET | `/api/v1/masters/industry-codes` | Read-only |
| GET | `/api/v1/masters/{entity}/as-of?date=` | Resolves the effective-dated version valid on a given date (KRN-12-FR-001) — the mechanism every other module uses instead of reading the "current" row directly |
| POST | `/api/v1/masters/sync-jobs` | Platform-internal only (no tenant-facing caller) — triggers or is scheduled (KRN-15) to run the per-tenant reference-data fan-out sync against ITG-07 (D-19); one job run processes one tenant, per D-18's per-tenant replication model |
| GET | `/api/v1/masters/sync-jobs/{tenant_id}/status` | PR-21 visibility only — last successful sync time and freshness lag for that tenant's `sys` reference copy (§13) |

All list endpoints: cursor pagination, declared filters, field selection
(Vol 1 §1.2).

*Flagged in §17: Vol 1 gives no API surface for KRN-12. The above is this
draft's proposal.*

## 11. Permission matrix by persona

Actions: `read` (any `sys` or `tnt` reference set), `tnt.create/update`
(tenant-added reference values only), `exchange_rate.create` (manual entry).

| Persona | sys reference data.read | tnt reference data.create/update | exchange_rate.create (manual) |
|---|---|---|---|
| PR-21 System Admin | ✓ | ✓ | ✗ |
| PR-16 CFO | ✓ | ✗ | ✓ |
| PR-15 Accountant | ✓ | ✗ | ✓ (if delegated by PR-16) |
| PR-17 HR Manager | ✓ | ✓ (calendars/holidays only) | ✗ |
| PR-06 Purchase Officer | ✓ | ✗ | ✗ |
| PR-25 External CA / Auditor | ✓ (scoped, read-only) | ✗ | ✗ |
| PR-28 Implementation Partner | ✓ | ✓ (own tenant, provisioning window only) | ✗ |
| All other internal personas | ✓ (implicit, via lookups embedded in other modules' screens — not a direct KRN-12 screen) | ✗ | ✗ |

**Negative cases:**
- Any actor, including PR-21, attempting `PATCH`/`POST` on a `sys`-namespace
  `tax_code`, `hsn_sac`, `pincode`, `state` or `bank` entry → 403, regardless
  of role — this is L1's boundary, not a permission tier a role can be
  granted into, since a tenant may never modify `sys` (KRN-04-DR-001
  applies identically here).
- PR-06 (Purchase Officer) attempting `exchange_rate.create` → 403.
- PR-17 (HR Manager) attempting to add a `tnt` UoM or tax code entry (outside
  their scoped `calendars`/`holidays` write access) → 403.
- Any actor attempting to delete (hard-delete) any reference-data row rather
  than deprecate it with a sunset date → rejected at the API boundary
  (KRN-04-FR-003 / L12 apply identically to KRN-12's entities).

## 12. Events emitted / consumed

**Emitted** (not given in Vol 1 — proposed per Vol 0 §42 convention,
flagged in §17):
- `masters.uom.created`, `.deprecated`
- `masters.currency.added`
- `masters.exchange_rate.updated`
- `masters.tax_code.version_added`
- `masters.hsn_sac.version_added`
- `masters.pincode.updated`
- `masters.calendar.holiday_added`
- `masters.bank.updated`
- `masters.reference_data.sync_completed` — emitted once **per tenant** at
  the end of that tenant's fan-out sync run (D-18/D-19), carrying the set
  of entity types updated, so CMP-01 and any subscriber can invalidate that
  tenant's cached lookups rather than polling. (Revised from the original
  draft's single platform-wide event to a per-tenant event, consistent with
  D-18's per-tenant replication model — there is no longer one moment when
  "the platform" finishes updating, only 10,000 tenant-scoped completions.)
- `masters.reference_data.sync_failed` — emitted per tenant when a fan-out
  run fails (ITG-07 unreachable, tenant temporarily unreachable on
  `dedicated` isolation); consumed by KRN-15's retry policy and surfaced to
  PR-21 via §13's freshness reporting. *(Addition, D-18/D-19 consequence.)*

**Consumed:** none. KRN-12, like KRN-01, is foundational and initiates
reference data rather than reacting to other modules' events.

## 13. Reports and KPIs

- **Reference-data version history** per entity type — audit-facing, shown
  to PR-16/PR-25 (§9).
- **Sync freshness** — per tenant (D-18), how recently that tenant's
  replicated `sys` reference copy was last synced against ITG-07 (D-19).
  Primarily a platform-internal operational metric (aggregated across all
  10,000 tenants, to catch a systemic ITG-07 outage or a stuck job queue),
  but also visible per-tenant to PR-21 as reassurance that their own
  HSN/SAC and GST schedules are current (§10's `sync-jobs/{tenant_id}/status`).
- **UoM conversion coverage** — flags item masters (SCM-01) referencing a
  UoM pair with no declared conversion path, surfaced as a data-quality
  signal, not a KRN-12-owned remediation.

## 14. Compliance touchpoints

- `tax_code` and `hsn_sac` are the master *lists* CMP-01 (GST Engine) reads
  to determine tax outcomes — KRN-12 stores the codes and their declared
  rates/effective dates; **CMP-01 owns all computation** (place-of-supply,
  CGST/SGST/IGST split, reverse charge, ITC eligibility). This is the L7
  boundary made explicit: no module, KRN-12 included, computes GST — it only
  supplies the reference values the computation is performed against.
- `pincode`/`state`/`district` geography feeds CMP-01's place-of-supply
  determination and every module's `Address` validation.
- `calendar`/`holiday` feeds KRN-05's SLA business-calendar pausing and
  PPL-09 (Statutory & Compliance)'s computation of statutory rest-day and
  overtime rules, without KRN-12 itself implementing any labour-law logic.
- `bank`/IFSC feeds FIN-05/FIN-07/PPL-08 payment file generation validation,
  without KRN-12 itself initiating any payment.

## 15. Offline behaviour

**Profile: `read`.** Reference data changes centrally and infrequently;
offline-capable modules (SCM-02, MFG-04, MFG-06, SLS-10, DLV-05, DLV-07,
PPL-05, OPS-10 — Vol 0 §9.2) cache the relevant KRN-12 sets (UoM,
conversions, tax codes, HSN/SAC, calendar/holiday) locally via KRN-16 and
resolve lookups against the cached copy while offline. No module writes
reference data from a disconnected device, so no conflict-resolution policy
is required for the `sys` sets. `tnt` reference values (custom UoM, custom
calendar entries) are rarely edited and, in the uncommon case of a concurrent
edit, follow last-writer-wins (Vol 0 §9.2's default for independent fields) —
they are configuration, not transactional data, so this carries negligible
risk.

## 16. Acceptance criteria (Given/When/Then)

**KRN-12-FR-001 — versioned, effective-dated resolution**
> Given `tax_code GST-18` valid from 2025-01-01 with rate components `{cgst: 9%, sgst: 9%}`, superseded by a new version effective 2027-04-01 with `{cgst: 9%, sgst: 9%, cess: 1%}`
> When CMP-01 resolves the tax code for a document dated 2026-11-15
> Then it receives the pre-2027-04-01 version (no cess component), and a document dated 2027-05-01 receives the post-2027-04-01 version — regardless of which version is "current" at query time.

**KRN-12-DR-001 — centrally-maintained statutory data (per-tenant fan-out)**
> Given an upstream ITG-07 update that adds three new HSN codes and revises the GST rate on an existing HSN code, effective a stated future date, and 10,000 tenants each holding their own replicated `sys` HSN/SAC and tax-code copy (D-18)
> When the platform-scheduled fan-out sync (D-19) runs across all tenants
> Then every tenant's own copy receives the new codes and the revised rate from that effective date forward without any tenant-side action, each tenant emits its own `masters.reference_data.sync_completed` event on completion, a tenant unreachable during the run is retried per `KRN-12-DR-003` rather than silently skipped, and no tenant is able to independently modify their own `sys` HSN/SAC or tax-code rows to diverge from what the sync job wrote (per §11's negative case — `sys` write access is never granted to a tenant role regardless of whether the row is shared or replicated).

**KRN-12-DR-003 — sync job idempotency and catch-up**
> Given a `dedicated`-isolation tenant that misses two consecutive scheduled fan-out sync runs due to a network partition
> When connectivity is restored and the next scheduled run executes
> Then that tenant's `sys` reference copy catches up to the current upstream state in one run (not two queued, duplicate runs), its `masters.reference_data.sync_completed` event reflects the true content delta since its last successful sync, and its `sync_freshness` status (§13) accurately showed the lag as `stale` throughout the gap rather than silently reporting current.

**KRN-12-FR-002 — tenant-added reference values**
> Given a tenant on a Manufacturing manifest (VRT-01) that needs a custom UoM `COIL` (for wire coil stock) not present in the platform's `sys` UoM set
> When PR-21 adds `COIL` as a `tnt` UoM with a conversion factor to the base `KG` unit
> Then `COIL` is usable across the tenant's item masters and transactions, the platform's `sys` UoM set is unchanged, and a subsequent platform upgrade adding new `sys` UoM entries does not conflict with or remove `COIL`.

**KRN-12-FR-003 — multi-step UoM conversion**
> Given conversions `1 BOX = 12 PIECE` and `1 CARTON = 5 BOX`, with declared precision 3 and rounding `half_up`
> When a quantity of `2.5 CARTON` is resolved to its base unit `PIECE`
> Then the engine resolves the two-step path (`CARTON → BOX → PIECE`), applying declared precision and rounding once at the final result (`150.000 PIECE`), not compounding rounding error at each intermediate step.

**KRN-12-FR-004 — geographic hierarchy for address validation**
> Given a pincode `411001` mapped to state `Maharashtra` (GST state code `27`), district `Pune`
> When an `Address` value object is entered with `pincode: 411001` and no `state_code`
> Then `state_code` auto-resolves to `27` and `district` to `Pune`, and a subsequent attempt to save the same address with a manually-entered conflicting `state_code` is flagged for correction rather than silently accepted.

**KRN-12-FR-005 — bank/IFSC directory validation**
> Given IFSC `HDFC0001234` present in the `sys` bank master with `bank_name: HDFC Bank`
> When FIN-05 validates a vendor's bank account detail carrying that IFSC
> Then FIN-05 receives the resolved bank and branch name from KRN-12 for display/confirmation, and KRN-12 itself makes no call to any bank or payment API in doing so.

**KRN-12-FR-006 — calendar/holiday layering**
> Given a `sys` national holiday calendar for India and a `tnt` holiday entry added by PR-17 for a Maharashtra-specific factory shutdown day
> When KRN-05 evaluates whether an SLA clock should pause on that date
> Then both the `sys` national holidays and the tenant's `tnt` additions are honoured together, and a platform upgrade that adds a new `sys` national holiday does not remove or alter the tenant's `tnt` shutdown-day entry.

**KRN-12-DR-002 — versioning protects historical outcomes from central updates**
> Given a document issued 2026-06-01 under the pre-update GST rate, and a central rate update effective 2027-04-01 (as in KRN-12-DR-001's scenario)
> When the document is reprinted or re-audited any time after 2027-04-01
> Then it still resolves against the rate version effective on 2026-06-01, producing an identical tax outcome to when it was originally issued.

## 17. Open questions

Flagged per Vol 6 §4/L13 — gaps in Vol 1's detail that this draft filled by
reasonable extrapolation. To be confirmed or corrected by the human before
this file is treated as binding:

1. **API surface and events** (§10, §12) are not given in Vol 1 for KRN-12 —
   Vol 1 Part 2's KRN-12 section has no `API:`/`Events:` lines. This draft
   proposes both from scratch, consistent with Vol 0 §42's conventions.
   Please review specifically, as there was no source text to expand from.
2. **Field-level detail for all fourteen owned entities** (§4.1) is not
   given in Vol 1 beyond the entity names. The tables proposed here are a
   reasonable minimum consistent with the stated FRs and with Vol 2's shared
   value objects (`Money`, `Quantity`, `Address`) that reference them; please
   confirm or amend, particularly the `exchange_rate.entity_id` scoping
   choice and the `tax_code.rate_components` shape.
3. ~~**Tenant-scoping of `sys` reference rows.**~~ **RESOLVED — D-18.**
   Physical replication per tenant, every row carries a real `tenant_id`,
   no exception to Vol 2 §1.2's universal-fields rule. See §4.1.
4. ~~**Central-update mechanism and layering.**~~ **RESOLVED — D-19.**
   KRN-12 calls ITG-07 directly, as a documented, named exception to Vol 0
   §5's no-upward-layer-dependency rule, scoped to this one refresh job.
   The operational-ownership half of this question (which MahiSys team
   curates/monitors the fan-out job) remains genuinely open — D-19 settled
   the architecture, not the operational staffing. Flagged forward to
   `/spec/state.md`'s open issues rather than re-listed as a numbered item
   here.
5. **Exchange rate feed ownership** — this draft assumes KRN-12 only stores
   exchange rates (manually entered or written by a higher-layer module such
   as FIN-07 consuming ITG-04) and never itself calls an external rate
   source. Note this is now the *opposite* pattern from D-19's resolution
   for HSN/SAC/GST/pincode (where KRN-12 *does* call out, to ITG-07) — worth
   confirming this asymmetry is intended (exchange rates genuinely differ:
   they change continuously/intraday rather than on a statutory effective
   date, and FIN-07 is the natural owner of treasury-grade rate feeds) rather
   than an oversight, before FIN-07's own Vol 3 file is drafted.
