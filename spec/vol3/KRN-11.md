# KRN-11 · Numbering & Sequencing

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-01 (legal entity, fiscal calendar), KRN-04 (entity/document-type definitions), KRN-06 (event bus)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-11)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

Issues the human-facing, legally significant number every business document
carries (Vol 2 §1.5: `P-05 Document.document_number`) — invoice numbers, job
work challan numbers, purchase order numbers, gate pass numbers, and every
other numbered paper the platform produces. For statutory document types this
guarantee is not cosmetic: a gapless, non-reusable sequence is a GST
compliance requirement, and an auditor or GST officer inspecting a tenant's
invoice register expects contiguous numbers with cancellations explicitly
recorded, never silently skipped.

Not bought directly — it is `included` platform-fee substrate every
document-producing module depends on. There is no direct end-user "buyer";
the practical owner of its configuration is PR-21 (System Administrator) at
tenant setup and whenever a new branch or document type is added, with PR-16
(CFO) and PR-15 (Accountant) as the personas who rely on its guarantee being
correct and who answer for it in a GST audit.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Configures number series per legal entity, document type, location and fiscal year at tenant setup and onboarding |
| PR-16 Finance Controller / CFO | Reviews the cancelled-number and series-utilisation report; approves fiscal-year rollover policy per entity |
| PR-15 Accountant | Relies on the gapless guarantee when preparing GSTR-1/3B (CMP-05); investigates any cancelled number in the register |
| PR-25 External CA / Auditor | Scoped read access to the series configuration and the cancelled-number log as audit evidence |
| PR-28 Implementation Partner | Configures branch-wise series during tenant provisioning (COM-06) |
| PR-06 Purchase Officer, PR-07 Quality Inspector, PR-05 Store/Warehouse Keeper, PR-08 Sales Manager, and every other document-creating persona | Never interact with KRN-11 directly — they create a document in their own module (SLS-07, MFG-05, SCM-04, FIN-04, …) and receive an allocated `document_number` transparently |

KRN-11 is deliberately invisible to the personas who create documents. Its
correctness is proven by the numbers they never have to think about.

## 3. Scope in / scope out

**In scope:** number series definition and scoping (entity, document type,
location, fiscal year); the live sequence counter and its transactional,
concurrency-safe allocation; cancellation recording; fiscal-year rollover;
reservation and confirmation of a number ahead of a document being fully
issued (Vol 0 §11 catalogue entry: "reservation and cancellation handling").

**Out of scope:** what a `document_number` is attached to and what it means
(`P-05 Document`, owned per transacting module); GST-specific numbering rules
such as IRN or e-way bill number format (CMP-02, CMP-03 — those systems issue
their *own* government-assigned identifiers, which KRN-11 stores as
`Document.statutory.irn` / `.eway_bill_no` but does not generate); the
document's state machine and approval routing (KRN-05); which template the
numbered document prints on (KRN-08).

## 4. Entities owned; entities consumed

**Owned:** `number_series`, `series_assignment`, `sequence_state`,
`cancelled_number`.

**Consumed (by ID):**
- `KRN-01` `legal_entity`, `fiscal_calendar`/`fiscal_period` — a series is
  scoped to a legal entity and, where `reset_policy = fiscal_year`, rolls
  over on that entity's own fiscal calendar (KRN-01-FR-003).
- `KRN-04` `entity_definition` (specifically the `is_document` entities) —
  `number_series.document_type_id` references the document type registered
  there; a series cannot be configured for a document type that does not
  exist in the metadata engine.
- `P-04 Location` — branch-wise series scoping (`number_series.location_id`).
- `P-05 Document` — the consumer of the allocated number; KRN-11 writes
  `document_number` back onto the document at allocation time but does not
  own the document record itself.

## 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every entity below and are not
repeated per field table.

**`number_series`** (extrapolated from KRN-11-FR-001/002/004; not
field-detailed in Vol 1 — flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `entity_id` | ref | `KRN-01` legal entity the series belongs to |
| `document_type_id` | ref | `KRN-04` entity definition (document type) |
| `location_id` | ref, nullable | `P-04` — null means the series applies across all locations of the entity (KRN-11-FR-001) |
| `fiscal_year` | string, nullable | Null when `reset_policy = never` |
| `prefix`, `suffix` | string | e.g. `INV/`, `/A` |
| `width` | integer | Zero-padding digit width |
| `separator` | string, nullable | Between prefix/counter/suffix segments |
| `is_gapless` | boolean | `true` for statutory document types (KRN-11-FR-002); `false` permits skip-tolerant internal numbering (e.g. an internal reference number that is not a statutory document) |
| `reset_policy` | enum | `fiscal_year` \| `calendar_year` \| `never` |
| `allocation_mode` | enum | `on_issue` (number allocated only at the transition that legally issues the document) \| `on_draft_with_reservation` (number reserved at draft creation, confirmed on issue — KRN-11-FR-006) |
| `status` | enum | `active` \| `closed` |
| `namespace` | enum | `sys` \| `tnt` — a tenant may define an additional series (e.g. for a `tnt`-authored document type from STU-01) but may never modify a `sys` series' `is_gapless` or `width` once numbers have been issued against it |

**`series_assignment`** (extrapolated; not field-detailed in Vol 1 — flagged
in §17). Resolves *which* series a given document draws from when more than
one candidate series could match (e.g. an entity-wide default and a
branch-specific override):

| Field | Type | Notes |
|---|---|---|
| `series_id` | ref | |
| `entity_id`, `document_type_id` | ref | Match keys |
| `location_id` | ref, nullable | More specific (non-null) assignments win over entity-wide ones |
| `priority` | integer | Explicit tie-break when two assignments could both match |
| `effective_from` | timestamptz | |

**`sequence_state`** — the live, hot-path counter, kept separate from the
series' declarative configuration so that the concurrency-critical row is as
small as possible:

| Field | Type | Notes |
|---|---|---|
| `series_id` | ref | |
| `current_value` | integer | Last value successfully allocated (not merely reserved) |
| `reserved_high_watermark` | integer | Highest value currently held under an open reservation (KRN-11-FR-006); `current_value ≤ reserved_high_watermark` |
| `locked_at` | timestamptz, nullable | Allocation-time advisory lock marker. **[stack-bound: advisory lock or sequence table]** |

**`cancelled_number`**:

| Field | Type | Notes |
|---|---|---|
| `series_id` | ref | |
| `sequence_value` | integer | The numeric slot that was consumed and cancelled |
| `formatted_number` | string | The full rendered number (prefix + padded value + suffix) |
| `document_id` | ref, nullable | Null when the reservation was released before any document existed to attach it to |
| `reason` | enum | `document_failed_validation` \| `reservation_expired` \| `document_voided` \| `manual_correction` |
| `cancelled_at` | timestamptz | |
| `cancelled_by` | actor ref | |

## 5. State machines

**`number_series.status`:** `active → closed`. A series is closed, never
deleted (L12) — closing prevents new allocation while preserving history for
audit. There is no `closed → active` transition; a series that must resume
issuing requires a new series (a business decision recorded by PR-16, not an
engine-offered reversal, consistent with the one-directional pattern KRN-01
uses for isolation-tier promotion).

**Per-number lifecycle** (a state carried implicitly across `sequence_state`
and `cancelled_number`, not a separate entity's own field): `reserved` (only
under `allocation_mode = on_draft_with_reservation`) → `allocated` →
terminal, **or** `reserved` → `cancelled` (reservation expired or released
without the document ever issuing) → terminal, **or** `allocated` →
`cancelled` (a fully issued document is subsequently voided) → terminal. Once
`cancelled`, a `sequence_value` is never reused (KRN-11-FR-002) regardless of
which path it took to get there.

## 6. Standard functional requirements

- `KRN-11-FR-001` Series are scoped by legal entity, document type, location, and fiscal year, with configurable prefix, suffix and width. *(Vol 1, verbatim)*
- `KRN-11-FR-002` Statutory series are gapless. A cancelled number is recorded as cancelled, never reused, never silently skipped. *(Vol 1, verbatim)*
- `KRN-11-FR-003` Number allocation is transactional; a failed document does not consume a statutory number. *(Vol 1, verbatim)*
- `KRN-11-FR-004` Fiscal-year rollover resets series where configured, on the entity's own fiscal calendar. *(Vol 1, verbatim)*
- `KRN-11-FR-005` Concurrent allocation under load produces no duplicates and no gaps. **[stack-bound: advisory lock or sequence table]** *(Vol 1, verbatim)*
- `KRN-11-FR-006` A series may declare `allocation_mode: on_draft_with_reservation`, holding a number from the moment a document enters `draft` in its process (KRN-05) rather than only at issue. If the process instance never reaches the issuing transition, the reservation is released and recorded in `cancelled_number` with `reason: reservation_expired`, preserving the gapless guarantee for confirmed documents while giving the business early visibility of the number it will receive (needed, for example, where pre-printed stationery must match). *(Addition — covers "reservation ... handling" named in Vol 0 §11's catalogue entry for KRN-11 but not elaborated as its own FR in Vol 1.)*
- `KRN-11-FR-007` Every document-producing module resolves its series through `series_assignment`, never by maintaining its own counter; a module that needs a number calls KRN-11's allocation API rather than generating one locally. *(Addition — makes explicit the boundary implied by L3/L6: no module may reimplement numbering.)*

## 7. Differentiating requirements

- `KRN-11-DR-001` One numbering engine serves every document-producing module — a Sales tax invoice (FIN-04), a Manufacturing job work challan (MFG-05), a Warehouse gate pass (OPS-10), a Finance credit note (FIN-02) — so the gapless, non-reuse guarantee is enforced identically platform-wide rather than reimplemented, and potentially inconsistently satisfied, module by module. *(Addition — Vol 0 §11's KRN-11 catalogue entry states only `Standard` capabilities with no `Differentiating` line; this draft proposes the natural differentiator implied by the module's placement in the kernel and flags the gap in §17.)*
- `KRN-11-DR-002` Series configuration, the live counter, and the cancellation log are three separable concerns (`number_series` / `sequence_state` / `cancelled_number`) rather than one mutable row, which is what lets the hot allocation path stay narrow under the concurrency guarantee of KRN-11-FR-005 while the audit-facing configuration and history remain fully queryable without contending with live traffic. *(Addition.)*

## 8. Agents

None. KRN-11 is a deterministic, statutory-grade allocation service with no
autonomous behaviour — correctness here is precisely the kind of thing that
must never be probabilistic (consistent with T15: numbering must work even
when the AI layer is unavailable, and in fact never depends on it at all).

## 9. Screens and flows

All screens are KRN-13-generated from KRN-04 metadata (L6). Standard views:

- **Number series** (list + form) — PR-21: create/edit series per entity,
  document type, location, fiscal year; set `is_gapless`, `width`,
  `allocation_mode`; close a series (guarded action).
- **Series assignment** (list, per document type) — PR-21: resolve which
  series applies to which entity/location combination; priority ordering
  where more than one could match.
- **Cancelled numbers** (list, filterable by entity/series/date) — PR-15,
  PR-16, PR-25 (read-only, scoped): the audit-facing register of every
  cancelled number and its reason, the primary evidence artefact for a GST
  audit of the gapless guarantee.
- **Fiscal-year rollover** (guarded action, per entity) — PR-16: triggers
  rollover for series with `reset_policy: fiscal_year` at the entity's own
  fiscal year-end; a preview step shows which series will reset before
  confirming.

No screen exposes `sequence_state` directly — the live counter is an
internal implementation detail, not something a human edits.

## 10. API surface

Base per Vol 0 §42: `/api/v1/numbering/{entity}`.

| Method | Path | Notes |
|---|---|---|
| CRUD | `/api/v1/numbering/series` | Create/edit series configuration; `PATCH` on immutable fields (`is_gapless`, `width`) after any number has been allocated is rejected |
| POST | `/api/v1/numbering/series/{id}/close` | Guarded — sets `status: closed` |
| CRUD | `/api/v1/numbering/series-assignments` | |
| POST | `/api/v1/numbering/allocate` | `{entity_id, document_type_id, location_id?}` → allocates (or, under `on_draft_with_reservation`, reserves) the next number transactionally. **Called by other modules, not by end users directly** (KRN-11-FR-007) |
| POST | `/api/v1/numbering/{allocation_id}/confirm` | Confirms a reservation into a firm allocation (only meaningful under `on_draft_with_reservation`) |
| POST | `/api/v1/numbering/{allocation_id}/cancel` | `{reason}` — records a `cancelled_number`; never deletes or reuses the value |
| POST | `/api/v1/numbering/series/{id}/rollover` | Fiscal-year rollover for one series; `/rollover-preview` for the dry-run shown to PR-16 |
| GET | `/api/v1/numbering/cancelled-numbers` | Filterable by `entity_id`, `series_id`, date range — the audit report |

All list endpoints: cursor pagination, declared filters, field selection
(Vol 1 §1.2). All writes: idempotency key required — critical here, since a
retried allocation call must never issue two numbers for one document.

*Flagged in §17: Vol 1 gives no API surface for KRN-11. The above is this
draft's proposal, consistent with Vol 0 §42 and the pattern used by every
other kernel module in Vol 1 Part 2.*

## 11. Permission matrix by persona

Actions: `configure` (series/assignment create/update), `close`,
`rollover`, `cancel`, `read` (cancelled-number register).

| Persona | series.configure | series.close | rollover | cancel | cancelled_numbers.read |
|---|---|---|---|---|---|
| PR-21 System Admin | ✓ | ✓ | ✓ (propose; per KRN-05 approval where configured) | ✗ | ✓ |
| PR-16 CFO | ✗ | ✗ | ✓ (approve) | ✓ | ✓ |
| PR-15 Accountant | ✗ | ✗ | ✗ | ✓ (own entity's documents, with reason) | ✓ |
| PR-25 External CA / Auditor | ✗ | ✗ | ✗ | ✗ | ✓ (read-only, scoped, evidence-pack export via KRN-10) |
| PR-28 Implementation Partner | ✓ (own tenant, provisioning window only) | ✗ | ✗ | ✗ | ✗ |
| All document-creating personas (PR-05..09, PR-15, etc.) | ✗ (no direct KRN-11 screen) | ✗ | ✗ | ✗ | ✗ |

*Note:* `allocate`/`confirm` are not persona-gated at all — they are called
internally by a transacting module's own document-creation action, which is
itself governed by that module's own permission matrix (e.g. "who may create
a tax invoice" is FIN-04's concern, not KRN-11's).

**Negative cases:**
- PR-15 (Accountant) attempting to `close` a series or trigger `rollover` →
  403, audited, series/state unchanged.
- Any actor attempting to `cancel` a number belonging to a series they do
  not have `entity_id`/`location_id` scope over → 403.
- Any actor attempting `PATCH` on `is_gapless` or `width` for a series that
  already has at least one allocated number → rejected with a stable error
  code, regardless of role — this is an engine-level integrity rule, not a
  permission decision (changing it after issuance would retroactively make
  history unexplainable).
- A retried `allocate` call carrying the same idempotency key after a prior
  successful allocation → returns the original allocation, does not issue a
  second number, regardless of caller.

## 12. Events emitted / consumed

**Emitted** (not given in Vol 1 — proposed per Vol 0 §42 convention,
flagged in §17):
- `numbering.series.created`, `.updated`, `.closed`
- `numbering.number.reserved`
- `numbering.number.allocated`
- `numbering.number.cancelled`
- `numbering.series.rolled_over`

**Consumed:** none directly by event subscription. KRN-11 is called
synchronously by the transacting module at the moment a number is needed
(the allocation must complete, or fail cleanly, within the same transaction
as the document write — KRN-11-FR-003), which rules out an asynchronous
event-driven allocation path.

## 13. Reports and KPIs

- **Cancelled-number register** per entity/series/period — the primary GST
  audit artefact (§9), exportable as an evidence pack (KRN-10).
- **Series utilisation** — current value vs. configured width headroom, so
  PR-21 is warned before a series approaches its digit-width ceiling.
- **Gap integrity check** — a scheduled (KRN-15) verification that, for
  every `is_gapless` series, `current_value` minus the count of allocated
  and cancelled numbers is zero; any discrepancy raises a platform-internal
  alert, not a tenant-visible one, since a discrepancy would indicate an
  engine defect rather than tenant behaviour.

## 14. Compliance touchpoints

- The gapless guarantee (KRN-11-FR-002/005) is itself the statutory
  requirement — GST law expects a tax invoice series to be sequential and
  consecutive within a financial year, with any cancellation disclosed
  rather than the number silently disappearing. CMP-05 (Statutory Filings)
  and a GST audit both consume the cancelled-number register as evidence.
- CMP-02 (E-Invoicing) and CMP-03 (E-Way Bill) issue their *own* government
  identifiers (IRN, e-way bill number) on top of the KRN-11-issued
  `document_number` — KRN-11 does not generate those, only stores the
  resulting document's number that the government system was told about
  (Vol 2 §P-05 `statutory` object).
- Fiscal-year rollover (KRN-11-FR-004) must align with each legal entity's
  fiscal calendar (KRN-01), which is why rollover is entity-scoped, not a
  single tenant-wide event — a tenant with entities on different fiscal
  years (KRN-01-FR-001) rolls each independently.

## 15. Offline behaviour

**Profile: `online`.** Because gapless allocation requires a single
consistent counter under transactional and concurrency control
(KRN-11-FR-003/005), numbers cannot be safely allocated on a disconnected
device — two offline devices could not be prevented from allocating the same
number. Offline-capable modules that create numbered documents (e.g. SCM-02
stock transfers, MFG-04 production confirmations feeding job work challans)
either defer number allocation until the device reconnects and the document
syncs (KRN-16), or — where the business genuinely needs a number visible
offline — use `allocation_mode: on_draft_with_reservation` allocated at the
moment connectivity last permitted it, never generated locally on the
device. No module may generate its own placeholder number offline and expect
KRN-11 to reconcile it; this would silently reintroduce the gap risk
KRN-11-FR-005 exists to close.

## 16. Acceptance criteria (Given/When/Then)

**KRN-11-FR-001 — series scoping**
> Given legal entity `E1` with two locations `L-Pune` and `L-Nashik`, both issuing tax invoices
> When a series is configured for `document_type: tax_invoice`, `entity: E1`, `location: L-Pune` with prefix `PUN/INV/`, and a separate series for `L-Nashik` with prefix `NSK/INV/`
> Then an invoice created at `L-Pune` allocates from the Pune series and an invoice at `L-Nashik` allocates from the Nashik series, and neither series' counter is affected by the other's allocations.

**KRN-11-FR-002 — gapless statutory guarantee**
> Given a gapless (`is_gapless: true`) series currently at `current_value = 118`
> When invoice `#119` is issued and later voided (cancelled) by the accountant
> Then `#119` is recorded in `cancelled_number` with `reason: document_voided`, the series' `current_value` remains `119` (not decremented), and the next issued invoice is numbered `#120` — `#119` is never assigned to any other document.

**KRN-11-FR-003 — transactional allocation, failed document consumes no number**
> Given a gapless series at `current_value = 200`, and `allocation_mode: on_issue`
> When a user submits an invoice that fails a validation rule (e.g. a mandatory GSTIN check) after the allocation call would otherwise have fired
> Then no number is allocated, `current_value` remains `200`, and no `cancelled_number` entry is created either — because under `on_issue` mode the allocation call itself never executes until validation passes; the failed attempt leaves no trace in the sequence at all.

**KRN-11-FR-004 — fiscal-year rollover**
> Given entity `E1` on fiscal year Apr–Mar with a series `reset_policy: fiscal_year` at `current_value = 847` as FY2027 (Apr 2026–Mar 2027) closes
> When the FY2028 rollover runs for `E1`
> Then a new `fiscal_year` scope is opened at `current_value = 0` for the series, the FY2027 history (847 allocations, any cancellations) remains queryable unchanged under its own fiscal-year scope, and an entity `E2` on a different fiscal calendar on the same tenant is unaffected until its own fiscal year-end triggers its own rollover.

**KRN-11-FR-005 — concurrent allocation under load (statutory-grade; expanded from Vol 1's sample)**
> Given a gapless series at `current_value = 1000`, and 200 invoice-creation requests submitted concurrently against it
> When all 200 requests attempt allocation simultaneously, and 6 of those 200 subsequently fail a downstream validation rule after their document was otherwise ready to issue
> Then:
> 1. Exactly 200 distinct sequence values (`1001`–`1200`) are allocated — no value is issued to two requests, and no value in that range is skipped by any successful request.
> 2. The 6 that failed validation are individually recorded in `cancelled_number` with `reason: document_failed_validation`, each carrying its own distinct `sequence_value` — they are not silently returned to the pool and reissued to a later request.
> 3. `sequence_state.current_value` ends at exactly `1200` — the count of successful allocations (194) plus cancellations (6) equals the total numbers issued (200); no gap exists anywhere in `1001`–`1200` that is neither an allocated document nor a `cancelled_number` entry.
> 4. Re-running the same 200 requests with the same idempotency keys (simulating a client retry storm) allocates no additional numbers — every retry resolves to its original result.
> 5. **[stack-bound: advisory lock or sequence table]** Whichever mechanism is implemented, the guarantee in points 1–4 holds under the full concurrency load described, verified by a dedicated load test before the module is marked done (Vol 6 §5).

**KRN-11-FR-006 — reservation and release**
> Given a series with `allocation_mode: on_draft_with_reservation` at `current_value = 50`
> When a purchase order is created in `draft` state (reserving `#51`) and the user abandons it without ever transitioning it to `issued`, and the reservation's configured expiry passes
> Then `#51` is released, recorded in `cancelled_number` with `reason: reservation_expired`, and the next document to reach `issued` state on that series is allocated `#52` — the abandoned draft never re-acquires `#51`.

**KRN-11-FR-007 — no module maintains its own counter**
> Given MFG-05 (Job Work & Subcontracting) needs to issue a job work challan number
> When its challan-creation flow runs
> Then it calls `POST /api/v1/numbering/allocate` with its `document_type_id`, and at no point does MFG-05's own schema contain a counter, sequence table, or locally-incremented value for challan numbers.

**KRN-11-DR-001 — one engine, every module**
> Given a tenant with FIN-04 issuing tax invoices, MFG-05 issuing job work challans, and OPS-10 issuing material gate passes, all in the same fiscal year on the same entity
> When the tenant's GST auditor requests the cancelled-number register across all three document types
> Then a single `GET /api/v1/numbering/cancelled-numbers` query (filtered by `entity_id`) returns cancellations from all three, in one consistent schema, evidencing the same gapless discipline regardless of which module produced the document.

**KRN-11-DR-002 — separation of configuration, counter and history**
> Given a series under sustained concurrent allocation load (KRN-11-FR-005's scenario)
> When PR-16 simultaneously runs the cancelled-number report for a prior fiscal year
> Then the report query against `cancelled_number` completes without contending with, or being blocked by, the live `sequence_state` allocation path.

## 17. Open questions

Flagged per Vol 6 §4/L13 — gaps in Vol 1's detail that this draft filled by
reasonable extrapolation. To be confirmed or corrected by the human before
this file is treated as binding:

1. **API surface and events** (§10, §12) are not given in Vol 1 for KRN-11 at
   all — Vol 1 Part 2's KRN-11 section has no `API:`/`Events:` lines, unlike
   most other kernel modules. This draft proposes both from scratch,
   consistent with Vol 0 §42's conventions and the pattern every other Vol 1
   module follows. Please review the endpoint and event list specifically —
   there was no source text to expand from here, only a purpose statement
   and five FRs.
2. **`number_series` / `series_assignment` / `sequence_state` /
   `cancelled_number` field tables** (§4.1) are not given at field level in
   Vol 1 — only the four entity names are listed. The split between
   `number_series` (declarative config) and `sequence_state` (live counter)
   is this draft's inference from the concurrency requirement
   (KRN-11-FR-005) and is not itself stated in Vol 1; confirm this
   separation is the intended physical model, or whether a single entity
   was meant.
3. **`allocation_mode: on_draft_with_reservation` (KRN-11-FR-006)** is an
   addition beyond Vol 1's literal five FRs, inferred from Vol 0 §11's
   catalogue line "reservation and cancellation handling" (Vol 1 only
   elaborates the cancellation half). Confirm this is the intended meaning
   of "reservation," or whether it refers to something else entirely (e.g.
   a soft hold with no document semantics).
4. **Universal scope of KRN-11 (statutory and non-statutory numbering)** —
   Vol 1's purpose line says "Statutory-grade document numbering," but Vol 2
   §1.5 states "every business document also carries a `document_number`
   issued by KRN-11," which reads as universal. This draft assumes KRN-11 is
   the single numbering service for *all* documents, with `is_gapless`
   distinguishing statutory from non-statutory series (KRN-11-DR-001 depends
   on this reading). Confirm, since the alternative (KRN-11 only for
   statutory types, with non-statutory modules free to number their own
   documents) would materially change KRN-11-FR-007 and DR-001.
5. **`KRN-11-DR-001`** itself is an addition — Vol 0 §11's catalogue entry
   for KRN-11 gives no `*Differentiating:*` line at all (every other kernel
   module in that section has one). This draft proposes the natural
   differentiator implied by the module's role; confirm whether Vol 0 simply
   omitted it for KRN-11 deliberately (i.e. KRN-11 genuinely has no
   differentiating capability, being pure table-stakes plumbing) or whether
   this was an oversight to correct upstream in Vol 0 itself.
6. **Fiscal-year rollover approval** (§9, §11: PR-16 "approve") — Vol 1 does
   not state whether rollover requires approval at all, or runs
   automatically at fiscal year-end. This draft assumes a guarded,
   PR-16-approved action with a preview step, consistent with how
   consequential and hard-to-reverse the action is; confirm whether it
   should instead be a fully automatic scheduled job (KRN-15) with no human
   gate.
