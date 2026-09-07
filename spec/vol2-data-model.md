# MahiSys Business OS — Volume 2
## Canonical Data Model

**Document ID:** BOS-VOL2
**Version:** 1.0
**Depends on:** Vol 0 §6 (primitives), §42 (conventions)
**Binding on:** every module in Vol 3

> Twelve primitives. Every business object in every industry resolves to one
> of them (T2). A module extends a primitive; it never defines a parallel.
> If you believe you need a thirteenth, stop and ask (Vol 6 §4).

---

# PART 1 — MODELLING RULES

## 1.1 Namespace separation (T13)

Every entity, field, state and rule carries a namespace.

| Namespace | Owner | Writable by |
|---|---|---|
| `sys` | Platform | Platform upgrades only |
| `tnt` | Tenant | Studio, tenant admins, VDL manifests |

The platform never writes to `tnt`. A tenant may add `tnt` fields to a `sys`
entity; it may never modify or remove a `sys` field. This is the mechanism
that lets a heavily customised tenant accept a platform upgrade.

**Physical representation.** `sys` fields are real columns. `tnt` fields are
stored in a JSONB extension column with a metadata-declared schema, indexed
selectively by declaration. This gives typed platform fields and unlimited
tenant extension without per-tenant DDL.

## 1.2 Universal fields

Every persisted entity carries these. No module redefines them.

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | Time-ordered; primary key |
| `tenant_id` | UUID | Enforced by row-level security, never optional |
| `entity_id` | UUID | Legal entity within tenant (KRN-01) |
| `namespace` | enum | `sys` \| `tnt` |
| `ext` | JSONB | Tenant extension fields |
| `created_at` | timestamptz | UTC |
| `created_by` | actor ref | User, agent or service account |
| `updated_at` | timestamptz | |
| `updated_by` | actor ref | |
| `version` | integer | Optimistic concurrency |
| `deleted_at` | timestamptz | Soft delete; null when live |
| `deleted_by` | actor ref | |
| `source` | enum | `ui` \| `api` \| `import` \| `agent` \| `integration` \| `offline_sync` |
| `trace_id` | UUID | Links to originating event chain |

**Actor reference** is a composite: `{type: user|agent|service, id, version}`.
Agent version is mandatory so an action is attributable to a specific agent
build, not to "the system" (Vol 0 §27.2).

## 1.3 Referential rules

- Cross-module references are by ID only. No foreign keys across module
  boundaries; integrity is enforced by contract tests, not by the database.
- Within a module, foreign keys are used normally.
- Deletion is always soft. Hard deletion occurs only through the tenant
  data-deletion process (SEC-07) and never through module code.
- Every reference field records the referenced entity type explicitly, so
  polymorphic references remain resolvable.

## 1.4 Shared value objects

Defined once; used everywhere. Never redefined by a module.

| Object | Fields |
|---|---|
| **Money** | `amount` (decimal 18,4), `currency` (ISO 4217), `exchange_rate`, `base_amount` |
| **Quantity** | `value` (decimal 18,6), `uom_id`, `base_value`, `base_uom_id` |
| **Address** | `line1`, `line2`, `city`, `district`, `state_code`, `country_code`, `pincode`, `geo` (lat/lng), `type`, `is_primary` |
| **ContactChannel** | `type` (email/phone/whatsapp), `value`, `verified`, `consent`, `is_primary` |
| **Period** | `from`, `to`, `is_open_ended` |
| **TaxContext** | `place_of_supply`, `tax_treatment`, `hsn_sac`, `rate_set_id`, `reverse_charge` (computed by CMP-01, never by a module) |
| **Attachment** | `document_id`, `role`, `caption` (points to KRN-08) |
| **AuditNote** | `at`, `by`, `note`, `visibility` |
| **GeoStamp** | `lat`, `lng`, `accuracy`, `captured_at`, `device_id` |

## 1.5 Identity and numbering

`id` is a UUIDv7 and is never shown to users. Every business document also
carries a `document_number` issued by KRN-11, which is the human and
statutory identifier, gapless where the law requires it, and scoped to
entity, document type, series and fiscal year.

## 1.6 Temporality

Three distinct time concepts, never conflated:

| Concept | Meaning | Example |
|---|---|---|
| **Transaction time** | When the system recorded it | `created_at` |
| **Valid time** | When it is true in the business | Price list effective from |
| **Event time** | When it happened in the world | Production logged offline at 14:05, synced at 19:30 |

Offline capture makes this non-optional: event time and transaction time
routinely differ by hours (Vol 0 §9.2).

## 1.7 Extension policy

A module may: add fields to its own entities; add states within a declared
transition set; register computed fields; subscribe to events.
A module may not: add fields to another module's entities; alter a primitive's
core fields; introduce a new primitive; change another module's state machine.

---
---

# PART 2 — THE TWELVE PRIMITIVES

Each primitive below lists core fields (`sys`), relationships, states where
applicable, and declared extension points. Module-specific attributes are
defined in Vol 3 and stored as module-owned extension records or `ext` fields,
never by mutating the primitive.

---

## P-01 · Party

Any legal or natural person the business has a relationship with.

**Core fields**

| Field | Type | Notes |
|---|---|---|
| `party_type` | enum | `organisation` \| `individual` |
| `legal_name` | string | Statutory name |
| `display_name` | string | Trade or common name |
| `roles` | set | `customer`, `vendor`, `employee`, `lead`, `partner`, `patient`, `candidate`, `regulator`, `citizen` — **a Party may hold several simultaneously** |
| `status` | enum | `prospect` \| `active` \| `dormant` \| `blocked` \| `closed` |
| `tax_registrations` | list | `{type: gstin/pan/tan/cin/udyam, number, verified_at, status}` |
| `addresses` | list<Address> | |
| `channels` | list<ContactChannel> | |
| `parent_party_id` | ref | Group hierarchy |
| `industry_code` | ref | |
| `preferred_language` | ref | Drives vernacular surfaces |
| `owner_user_id` | ref | Internal relationship owner |
| `credit` | object | `{limit: Money, terms_days, block_flag, risk_grade}` |
| `consent` | object | Purpose-scoped, DPDP-aligned (SEC-07) |

**Design notes.** `roles` as a set is the single most important decision in
this document. A vendor who is also a customer is one Party, which is what
makes cross-module anomaly detection (Vol 0 §28 item 12) possible at all.
Role-specific attributes live in role extension records: `party_customer`,
`party_vendor`, `party_employee` — owned by SLS-03, SCM-05 and PPL-02
respectively.

**Duplicate policy.** Deterministic match on verified tax registration;
probabilistic match on name, address and channel proposed to a human, never
merged automatically.

**Extension points.** Role extension records; `ext` fields; additional
`tax_registrations` types by vertical manifest.

---

## P-02 · Item

Anything sellable, buyable, consumable or stockable.

**Core fields**

| Field | Type | Notes |
|---|---|---|
| `item_type` | enum | `goods` \| `service` \| `asset` \| `kit` \| `plan` |
| `code` | string | Tenant-unique |
| `name`, `description` | string | |
| `category_id` | ref | Hierarchical |
| `base_uom_id` | ref | |
| `uom_conversions` | list | `{uom_id, factor}` |
| `hsn_sac` | string | Feeds TaxContext |
| `tracking` | enum | `none` \| `batch` \| `serial` \| `batch_and_serial` |
| `shelf_life_days` | integer | Nullable |
| `is_stockable` | boolean | |
| `valuation_method` | enum | `fifo` \| `weighted_avg` \| `standard` |
| `status` | enum | `draft` \| `active` \| `phasing_out` \| `discontinued` |
| `attributes` | JSONB | Variant-defining attributes |
| `parent_item_id` | ref | Variant grouping |
| `alternates` | list<ref> | Substitutes |
| `default_vendor_id` | ref | |

**Design notes.** One Item serves manufacturing BOMs, sales catalogues,
e-commerce listings, purchase and accounting. Selling price is **not** an Item
field — prices live in OPS-12 rate cards, because an item has many prices.

**Extension points.** `item_manufacturing` (MFG), `item_ecommerce` (WEB-04),
`item_pharma` (VRT-05) as module- or manifest-owned extension records.

---

## P-03 · Resource

A capacity-constrained thing that gets booked or utilised. The primitive that
absorbs beds, machines, aircraft, technicians, rooms and trucks.

**Core fields**

| Field | Type | Notes |
|---|---|---|
| `resource_type_id` | ref | Manifest-defined: machine, bed, bay, technician |
| `code`, `name` | string | |
| `location_id` | ref | P-04 |
| `capacity` | object | `{unit, value, concurrent_bookings}` |
| `calendar_id` | ref | Availability, shifts, holidays |
| `status` | enum | `available` \| `booked` \| `in_use` \| `maintenance` \| `breakdown` \| `retired` |
| `party_id` | ref | When the resource *is* a person (technician, doctor) |
| `cost_rate` | Money | Per capacity unit |
| `attributes` | JSONB | Skills, specifications, certifications |
| `parent_resource_id` | ref | Line → machine → station |

**Design notes.** A Resource that is also a person carries a `party_id` rather
than duplicating personal data. Booking is not a field on Resource; it is a
Process instance (OPS-03), which is why hospital beds, service bays and
consultation slots need no separate modules.

---

## P-04 · Location

**Core fields:** `location_type` (plant | warehouse | zone | bin | branch |
route | territory | site | ward), `code`, `name`, `parent_location_id`,
`address` (Address), `entity_id`, `is_stock_holding`, `gstin` (a location may
have its own registration — critical for multi-state), `geo_fence`, `status`.

**Design notes.** Strictly hierarchical with unlimited depth. The
`is_stock_holding` flag distinguishes places that hold inventory from places
that merely organise. GSTIN at location level is what makes correct
place-of-supply determination possible for multi-state tenants.

---

## P-05 · Document

A business paper with a lifecycle and legal identity.

**Core fields**

| Field | Type | Notes |
|---|---|---|
| `document_type_id` | ref | Quotation, PO, invoice, challan, work order, gate pass |
| `document_number` | string | From KRN-11 |
| `document_date` | date | |
| `entity_id`, `location_id` | ref | |
| `party_id` | ref | Counterparty |
| `process_id` | ref | P-07 instance governing its lifecycle |
| `status` | ref | Current state within that process |
| `currency`, `exchange_rate` | | |
| `tax_context` | TaxContext | From CMP-01 |
| `totals` | object | `{taxable, tax, total, rounding}` all Money |
| `reference_documents` | list | `{document_id, relation: amends/reverses/fulfils/derived_from}` |
| `lines` | child | Line entity per document type |
| `attachments` | list<Attachment> | |
| `template_id` | ref | KRN-08 print template (never hard-coded) |
| `statutory` | object | `{irn, ack_no, qr, eway_bill_no, signed_at}` |

**Design notes.** Documents are immutable once issued. Corrections happen
through a new document with a `reference_documents` relation, never by
editing. This is what makes statutory audit trails defensible and is
non-negotiable for CMP-06.

**Line entity core:** `line_no`, `item_id`, `description`, `quantity`
(Quantity), `rate` (Money), `discount`, `tax_context`, `amounts`,
`source_line_ref` (for traceability across the document chain).

---

## P-06 · Transaction

An atomic movement of value or material. Two specialisations sharing one
contract.

**Common fields:** `transaction_type`, `posting_date`, `value_date`,
`entity_id`, `source_document_id`, `source_event_id`, `reversal_of_id`,
`is_reversed`, `narration`, `period_id`, `posted_by`.

**Financial transaction:** `account_id`, `party_id`, `cost_centre_id`,
`debit` (Money), `credit` (Money), `tax_component`. Balanced double entry;
enforced at the transaction group level.

**Material transaction:** `item_id`, `location_from_id`, `location_to_id`,
`quantity` (Quantity), `batch_id`, `serial_ids`, `valuation` (Money),
`stock_type` (`on_hand` | `in_transit` | `at_subcontractor` | `quarantine` |
`consignment`).

**Design notes.** Transactions are append-only. A correction is a reversal
transaction plus a new one, never an update. `stock_type` including
`at_subcontractor` is what makes job-work exposure tracking (MFG-05) possible
without a parallel system.

---

## P-07 · Process

A state machine plus approvals plus SLA. The primitive behind pipelines,
tickets, hiring flows, routings, discharges and file movements.

**Definition entity:** `process_type_id`, `name`, `states` (list with
`{code, name, is_initial, is_terminal, sla, namespace}`), `transitions`
(`{from, to, guard, actions, allowed_roles, allowed_agents}`),
`approval_matrix`, `escalation_rules`, `version`, `effective_from`.

**Instance entity:** `process_definition_id`, `subject_type`, `subject_id`,
`current_state`, `entered_state_at`, `sla_due_at`, `assigned_to`,
`approval_state`, `history` (append-only state log).

**Design notes.** A transition may nominate an agent as an approver at a
declared trust level (Vol 0 §27.3), which is how routine approvals disappear
while exceptions still reach a human. Tenant-added states carry `namespace:
tnt` and must fit within the declared transition set — this is what keeps a
customised workflow upgrade-safe.

---

## P-08 · Event

An immutable fact. The spine of the system (T3).

**Fields:** `event_id` (UUIDv7), `tenant_id`, `entity_id`, `event_name`
(`module.entity.verb_past`), `schema_version`, `occurred_at` (event time),
`recorded_at` (transaction time), `actor` (actor ref), `subject_type`,
`subject_id`, `payload` (JSONB, schema-validated), `causation_id` (the event
that caused this), `correlation_id` (the journey instance), `trace_id`,
`reversal_handle` (KRN-18).

**Rules.** Append-only. Never updated, never deleted. Schema-versioned with
forward compatibility. Every mutation emits one (L4). Retention is
tenant-configurable above a statutory floor.

**Design notes.** `causation_id` and `correlation_id` together allow a full
journey (J-01 through J-14) to be reconstructed, which is what makes causal
answers (INT-02) and journey testing possible.

---

## P-09 · Record

A longitudinal file about a Party or Resource: patient chart, machine
history, employee file, KYC file, customer 360, aircraft logbook.

**Fields:** `record_type_id`, `subject_type` (`party` | `resource`),
`subject_id`, `opened_at`, `closed_at`, `status`, `summary` (maintained by
INT-11), `access_policy` (records frequently carry stricter access than their
subject), `entries` (child).

**Entry fields:** `entry_type`, `occurred_at`, `recorded_at`, `author`
(actor ref), `content` (structured + narrative), `attachments`,
`source_document_id`, `source_event_id`, `is_amended`, `amends_entry_id`.

**Design notes.** Entries are append-only and amendments are additive, never
destructive — a requirement for clinical, aviation and regulated records
(CMP-06) that also happens to be correct everywhere else.

---

## P-10 · Agreement

A binding term set with a validity window: contract, SLA, AMC, subscription,
rate card, scheme, lease.

**Fields:** `agreement_type_id`, `agreement_number`, `parties` (list with
roles), `period` (Period), `status` (`draft` | `pending_signature` | `active`
| `suspended` | `expired` | `terminated` | `renewed`), `terms` (structured),
`obligations` (child), `commercials` (`{value: Money, billing_frequency,
escalation_rule_id}`), `renewal` (`{type: auto/manual, notice_days,
renewal_terms_ref}`), `parent_agreement_id`, `signatures`, `documents`.

**Obligation child:** `description`, `owner_party_id`, `due_rule`,
`measurement_basis`, `penalty_rule_id`, `status`, `linked_process_id`.

**Design notes.** Obligations as first-class child records are what let
OPS-06 turn a signed contract into live tasks and alerts rather than a filed
PDF. This is the difference between contract storage and contract management.

---

## P-11 · Measurement

A recorded observation with unit and tolerance: QC reading, lab result,
sensor value, meter reading, vitals, inspection score.

**Fields:** `measurement_type_id`, `subject_type`, `subject_id`,
`characteristic_id` (what is measured), `value_numeric`, `value_text`,
`value_boolean`, `uom_id`, `specification` (`{target, lower_limit,
upper_limit, method}`), `result` (`pass` | `fail` | `warning` |
`out_of_trend`), `measured_at`, `measured_by` (actor ref),
`instrument_id` (ref to Resource, for calibration traceability),
`sample_ref`, `source` (`manual` | `device` | `voice` | `import`),
`geo` (GeoStamp), `is_amended`, `amends_id`.

**Design notes.** `instrument_id` pointing at a Resource is what links a
reading to a calibration record — mandatory for MFG-06 and VRT-05, and
frequently missing in SMB quality systems. `source: voice` is a first-class
case, not an afterthought (INT-07).

---

## P-12 · Rule

A declarative condition-action policy: pricing, credit, eligibility,
discount, reorder, compliance check, approval threshold.

**Fields:** `rule_set_id`, `rule_type`, `name`, `priority`, `conditions`
(structured expression tree, not free text), `actions`, `period` (Period),
`scope` (`{entity_id, location_id, party_segment, item_category}`),
`status`, `version`, `authored_by`, `authored_via` (`ui` | `natural_language`
| `manifest`), `natural_language_source` (the original phrasing when
authored via STU-05).

**Design notes.** Rules authored in natural language always compile to an
inspectable expression tree and are stored with their original phrasing. They
never execute as opaque model behaviour (Vol 0, KRN-07). An owner must be able
to read why a price was what it was.

---
---

# PART 3 — CROSS-CUTTING MODEL CONCERNS

## 3.1 Multi-tenancy

`tenant_id` on every row, enforced by database row-level security rather than
application code, so a missing WHERE clause cannot leak data. Isolation tier
(KRN-01) determines whether tenants share a schema, hold their own schema, or
run on a dedicated instance — the logical model is identical in all three,
which is what makes tier promotion possible without re-implementation.

## 3.2 Soft delete and retention

`deleted_at` everywhere. Queries filter it by default at the data-access
layer. Hard deletion happens only through SEC-07 data-deletion processing,
which is itself audited and irreversible by design.

## 3.3 Concurrency

Optimistic via `version`. Offline sync uses the conflict policy declared per
module (Vol 0 §9.2): last-writer-wins for independent fields,
server-authoritative for stock and financial quantities, queued-for-review
where a machine should not decide.

## 3.4 Indexing policy

Mandatory: `(tenant_id, id)`, `(tenant_id, deleted_at)`, every foreign key,
`(tenant_id, document_number)` on documents, `(tenant_id, occurred_at)` on
events and measurements. `tnt` JSONB fields are indexed only where the
metadata declaration requests it, to keep tenant extension from degrading
platform performance.

## 3.5 Semantic index projection

Every entity declares what INT-01 indexes: which fields carry meaning, which
are identifiers, which are sensitive and must be excluded. Sensitive fields
(salary, medical content, KYC identifiers) are excluded from embeddings by
declaration, not by hope.

## 3.6 Migration policy

Additive migrations only. New fields are nullable or defaulted. Renames are
implemented as add-plus-backfill-plus-deprecate, never as a rename. Removals
require a major version, a sunset period and explicit tenant acceptance
(L12). Every migration is reversible and tested against a tenant carrying
`tnt` customisations before release.

---

*End of Volume 2.*
