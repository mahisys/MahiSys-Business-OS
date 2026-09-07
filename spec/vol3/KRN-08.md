# KRN-08 · Document Service

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-04 (Entity & Metadata Engine — `document_type_id` resolution), KRN-06 (Event Bus), KRN-11 (Numbering & Sequencing — `document_number` rendered onto templates), KRN-15 (Scheduler & Job Runtime — async render/bulk-render)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-08)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

File storage, versioning, template design and print-accurate rendering
(Vol 0 §10). Every document a tenant issues — a tax invoice, a job work
challan, a quotation, a gate pass, a payslip — is rendered from a named
template held here; no module hard-codes a layout (L6, `KRN-08-FR-004`).
Vol 0 §10 names this "underestimated in every Indian business software
project, and a frequent cause of rejected implementations" — Indian
statutory documents are heavily formatted, legally particular, and routinely
customer-specific.

Not bought directly — `included` platform-fee substrate (Vol 0 §11). Every
document-producing module (`FIN-04`, `MFG-05`, `SCM-04`, `SCM-06`, `PPL-08`,
`OPS-10`, and dozens more) is a buyer in the architectural sense: it emits a
document and asks KRN-08 to render it. The direct "user" of its authoring
surface is PR-21 (System Administrator) and PR-28 (Implementation Partner)
for template configuration; PR-16/PR-02 approve branding and layout changes;
every persona that ever opens, downloads or prints a business document is an
indirect consumer.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Manages the template library, per-customer overrides, print format defaults, retention policy and legal holds |
| PR-28 Implementation Partner | Configures statutory/branded template overrides during onboarding (COM-06) |
| PR-16 Finance Controller / CFO | Approves statutory financial-document templates (invoice, credit note) before activation |
| PR-02 Functional Head (CXO) | Approves branded document templates for their function (e.g. Sales quote template) |
| PR-15 Accountant, PR-06 Purchase Officer, PR-08 Sales Manager | Consume rendered documents (invoice, PO, quote) day to day via their module's screens |
| PR-05 Store / Warehouse Keeper, PR-04 Shop Floor Supervisor | Print gate passes, challans and job cards on thermal/dot-matrix printers, often offline |
| PR-09 Field Sales / Beat Rep | Shares a rendered invoice or order confirmation over WhatsApp mid-visit |
| PR-22 Customer, PR-23 Dealer, PR-24 Vendor | Download their own invoices, statements and POs from the portal (WEB-08, WEB-09) |
| PR-25 External CA / Auditor, PR-26 Regulator / Inspector | Read rendered statutory documents as evidence, scoped and read-only |
| PR-30 Integration Service Account | Pulls rendered documents (e.g. e-invoice PDF with IRN QR) via API for downstream systems |

## 3. Scope in / scope out

**In scope:** file storage and versioning for any binary artefact (uploaded
or rendered); print template authoring, print-accurate preview, multi-format
rendering (A4, A5, thermal 2"/3", dot-matrix); QR/barcode blocks; digital
signature block placement; conditional sections; watermarks; multi-lingual
and multi-script rendering; per-customer template override; synchronous and
bulk asynchronous rendering; retention policy and legal hold.

**Out of scope:** the business logic that decides *what* goes in a document
(owned by the issuing module — e.g. `FIN-04` decides invoice line items,
`CMP-01` computes the tax amounts KRN-08 merely places); tax and statutory
number determination (`CMP-01`/`CMP-02`/`CMP-03` — KRN-08 renders the IRN,
QR and e-way bill number it is given, never computes them, L7); the
signature's legal meaning and multi-party signing workflow (`CMP-07`
Electronic Signature — KRN-08 places the `signature_block` on the layout;
CMP-07 owns signing intent and binding); folder/taxonomy document management
for internal knowledge files (`OPS-11` Document Management — a distinct
Layer-2 application over general documents, not print-rendered business
papers); full-text/semantic indexing of file contents (`KRN-14` Search &
Semantic Index consumes KRN-08 files, does not own them).

## 4. Entities owned; entities consumed

**Owned:** `file`, `file_version`, `print_template`, `template_binding`,
`render_job`, `signature_block`.

**Consumed (by ID):**
- `P-05 Document` — the primary subject rendered. `Document.template_id`
  (Vol 2 §P-05) references KRN-08's `print_template`; `Document.attachments`
  (`Attachment` value object, Vol 2 §1.4) references KRN-08's `file`.
- `entity_definition` (KRN-04) — `print_template.document_type_id` resolves
  to a KRN-04 `entity_definition` with `is_document = true` (see §17.1 for
  why this draft treats "document type" as an `entity_definition`, not a
  separate KRN-08-owned master).
- `document_number` (KRN-11) — rendered onto the template, never generated
  by KRN-08.
- `TaxContext`, `statutory` object (`irn`, `ack_no`, `qr`, `eway_bill_no`) —
  Vol 2 §P-05 fields, populated by CMP-01/02/03 on the `Document`, merely
  placed by KRN-08's template engine.
- `Party` (P-01) — counterparty and recipient identity for addressing and
  per-customer template override lookup (`template_binding.scope_id`).

## 5. State machines

**`print_template.status`:** `draft → active → deprecated`. `active →
deprecated` requires a sunset date and a successor template reference
(L12); a `deprecated` template continues to render for documents already
issued under it (Vol 2 §P-05 — documents are immutable once issued) but
cannot be selected for new documents after `sunset_at`.

**`render_job.status`:** `queued → rendering → completed`, with `rendering →
failed → queued` as an automatic retry path (bounded retry count, then
`failed` terminal with a diagnosable error, consistent with KRN-06's
dead-letter pattern). Bulk jobs additionally track `partial` (some items
rendered, some failed) as a terminal-but-actionable state — a bulk run does
not roll back successes because of individual failures (`KRN-08-FR-005`).

**`file.legal_hold`:** boolean flag, not a state machine — `false → true`
(hold applied) and `true → false` (hold released) are both audited
(KRN-10) actions, independent of `file`'s otherwise soft-delete lifecycle
(Vol 2 §1.3). A file under legal hold cannot be hard-deleted regardless of
retention policy expiry.

**`template_binding`:** effective/expired by `Period` (Vol 2 §1.4), not a
discrete state machine — a binding is simply active when `now()` falls
within its period and inactive otherwise; overlapping bindings for the same
scope are resolved by specificity (customer override beats tenant default)
then by most-recent `effective_from`.

## 6. Standard functional requirements

- `KRN-08-FR-001` Files support versioning, checksums, virus scanning, retention policy and legal hold. *(Vol 1, verbatim)*
- `KRN-08-FR-002` Templates render to A4, A5, thermal 2", thermal 3", and dot-matrix, with print-accurate preview. *(Vol 1, verbatim)*
- `KRN-08-FR-003` Templates support QR and barcode blocks, digital signature blocks, conditional sections driven by rules, watermarks (draft, duplicate, triplicate), and multi-script output. *(Vol 1, verbatim)*
- `KRN-08-FR-004` Every document-producing module references a template ID. Hard-coded layouts are rejected at review (L6). *(Vol 1, verbatim)*
- `KRN-08-FR-005` Bulk generation is asynchronous, resumable and progress-reported. *(Vol 1, verbatim)*
- `KRN-08-FR-006` *(addition)* A template designer surface renders a print-accurate WYSIWYG preview of the exact layout, format and locale a persona will receive, before activation — this is the tool §10 requires but Vol 1's FR list only implies via the "print-accurate preview" clause in FR-002; this item makes the authoring surface itself an explicit requirement, distinct from render-time preview of a live document.
- `KRN-08-FR-007` *(addition)* Templates are multi-lingual as well as multi-script (Vol 0 §10 names both): the same template renders in any of KRN-19's active language packs for the recipient's `preferred_language` (P-01 field), with fallback to the tenant's default language if no translated copy exists — FR-003's "multi-script output" covers character-rendering; this item covers language *selection*, which Vol 1's FR-003 text does not separately state.
- `KRN-08-FR-008` *(addition)* File retention defaults to the longest applicable statutory retention period for the document type it is attached to (e.g. GST records, Companies Act records) and cannot be shortened by a tenant below that floor — mirrors `KRN-10-FR-005`'s pattern, needed here because rendered statutory documents (invoices, e-way bills) are themselves the evidence a GST or Companies Act audit relies on, and Vol 1's FR-001 mentions "retention policy" without stating a floor.

## 7. Differentiating requirements

- `KRN-08-DR-001` Statutory Indian layouts ship pre-built per document type; per-customer template overrides are configuration, never development. *(Vol 1, verbatim)*
- `KRN-08-DR-002` *(addition)* Template overrides resolve by declared specificity (`template_binding` scope: tenant default → location → customer) at render time with no code branch per customer — the same rendering call is made regardless of how many overrides exist, keeping unlimited per-customer branding an entirely data-driven operation (extends DR-001's "configuration, never development" claim to the resolution mechanism itself, which Vol 1 does not describe).

## 8. Agents

None. KRN-08 is a rendering/storage substrate with no autonomous behaviour
of its own. `INT-06` Document Intelligence consumes files KRN-08 stores (a
photographed vendor invoice, a scanned GRN) for extraction, but INT-06 is a
separately registered Intelligence-layer module, not a KRN-08 agent.

## 9. Screens and flows

All screens are KRN-13-generated from KRN-04 metadata (L6 — no hand-built
form). Standard views:

- **Template Designer** (drag/configure layout, bind fields, conditional
  sections, watermark rules, signature block placement, print-accurate
  preview per format) — PR-21, PR-28.
- **Template Library** (statutory pre-built + tenant overrides, list with
  status, document type, formats supported) — PR-21, PR-16 (financial
  document templates), PR-02 (functional templates), all read-only for
  approval review.
- **Template Bindings** (which override applies to which customer/location,
  effective dates) — PR-21, PR-28.
- **File & Version History** (per-document attachment list, version
  timeline, checksum, legal hold toggle) — surfaced as a tab on every
  document-producing module's own record screen, not a standalone KRN-08
  screen for end users.
- **Bulk Render Monitor** (job progress, per-item success/failure, retry
  failed items) — PR-15/PR-16 for bulk invoice runs, PR-18 for bulk
  payslips (PPL-08 consumes this surface), PR-21 for any bulk job.
- **Print / Download action** (available wherever a `P-05 Document` is
  shown) — every persona with read access to the underlying document,
  format selector defaults to the recipient's declared preference.

## 10. API surface

Base per Vol 0 §42: `/api/v1/documents/{entity}`.

| Method | Path | Notes |
|---|---|---|
| POST/GET | `/api/v1/documents/files` | Upload; multipart, returns `file` + initial `file_version` |
| GET | `/api/v1/documents/files/{id}` | Metadata + current version pointer |
| POST | `/api/v1/documents/files/{id}/versions` | New version; checksum + virus scan required before `status: available` |
| POST | `/api/v1/documents/files/{id}/legal-hold` | `{hold: true\|false, reason}` — audited (KRN-10) |
| CRUD | `/api/v1/documents/templates` | `print_template` — POST/PATCH restricted per §11 |
| GET | `/api/v1/documents/templates/{id}/preview` | `{format, locale, sample_document_id}` → print-accurate rendered preview, no file persisted |
| CRUD | `/api/v1/documents/templates/{id}/bindings` | `template_binding` |
| POST | `/api/v1/documents/render` | `{document_id, template_id?, format}` — synchronous for a single document; `template_id` optional, resolves via bindings if omitted |
| POST | `/api/v1/documents/bulk-render` | `{document_ids[] \| filter, template_id?, format}` — async (KRN-15), returns `render_job` |
| GET | `/api/v1/documents/render-jobs/{id}` | Status, progress, per-item results |
| POST | `/api/v1/documents/render-jobs/{id}/retry` | Retries only failed items in a `partial` job |
| CRUD | `/api/v1/documents/signature-blocks` | Placement metadata; signing execution is `CMP-07` |

All list endpoints: cursor pagination, declared filters, field selection
(Vol 1 §1.2). All writes: idempotency key required.

## 11. Permission matrix by persona

Actions: `create`, `read`, `update`, `delete` (soft, SEC-07 only), `approve`
(template activation), `export`.

| Persona | file.upload/read | template.create/update | template.approve | binding.create/update | render.request | bulk-render.request | legal_hold.set |
|---|---|---|---|---|---|---|---|
| PR-21 System Admin | ✓ | ✓ | ✓ (non-financial) | ✓ | ✓ | ✓ | ✓ |
| PR-28 Implementation Partner | ✓ (own tenant, provisioning window) | ✓ (own tenant, provisioning window) | ✗ | ✓ (own tenant, provisioning window) | ✓ | ✗ | ✗ |
| PR-16 CFO | ✓ | ✗ | ✓ (financial document types only) | ✗ | ✓ | ✓ | ✓ |
| PR-02 Functional Head | ✓ (own function's documents) | ✗ | ✓ (own function's non-financial types) | ✗ | ✓ | ✓ | ✗ |
| PR-15/06/08 and other document-issuing personas | ✓ (documents they may read per underlying module's KRN-03 scope) | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| PR-04/05/09 floor and field personas | ✓ (read/print own-scope documents, often offline — see §15) | ✗ | ✗ | ✗ | ✓ (own-scope) | ✗ | ✗ |
| PR-22/23/24 external portal personas | ✓ (own documents only, via WEB-08/WEB-09) | ✗ | ✗ | ✗ | ✗ (pre-rendered documents only; no render-on-demand) | ✗ | ✗ |
| PR-25/26 Auditor / Regulator | ✓ (scoped, read-only, itself logged per `KRN-10-FR-003` when the underlying document is sensitive) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| PR-30 Integration Service Account | ✓ (scoped by grant) | ✗ | ✗ | ✗ | ✓ (scoped) | ✗ | ✗ |

**Negative cases:**
- PR-02 (Functional Head) attempting to approve a template for a financial
  document type (invoice, credit note) → 403; only PR-16/PR-21 may approve
  financial templates, even within the requester's own function.
- PR-22 (Customer) attempting `POST /render` directly (render-on-demand)
  rather than downloading a document the issuing module already rendered
  and shared to the portal → 403; external personas never trigger rendering,
  only retrieve what has been rendered and released to them.
- Any persona attempting to hard-delete a `file` under `legal_hold: true`
  → 403, regardless of role, until the hold is released by PR-16/PR-21.
- A document-issuing module attempting to reference a layout string instead
  of a `template_id` at render time → rejected at the API boundary (this is
  the runtime enforcement of `KRN-08-FR-004`/L6, not merely a code-review
  rule).

## 12. Events emitted / consumed

**Emitted** (Vol 1, verbatim, plus extensions):
- `documents.file.uploaded`
- `documents.file.version_added`
- `documents.file.legal_hold_applied` *(addition)*
- `documents.file.legal_hold_released` *(addition)*
- `documents.template.activated` *(addition)*
- `documents.template.deprecated` *(addition)*
- `documents.template.binding_created` *(addition)*
- `documents.render.completed`
- `documents.render.failed`
- `documents.bulk_render.progress` *(addition — periodic, for the Bulk Render Monitor screen; not every subscriber needs it, declared low-priority)*

**Consumed:** `core.legal_entity.updated` (KRN-01 — re-resolves address
blocks on active templates referencing entity address); `metadata.field.deprecated`
(KRN-04 — flags templates binding a deprecated field for review, does not
auto-remove); `access.role.granted`/`.revoked` (KRN-03 — no direct action,
permission is evaluated live, not cached from these events).

## 13. Reports and KPIs

- Render job success/failure rate by document type and format (operational
  health, surfaced to PR-21).
- Template usage: which templates are active per document type, override
  count per customer (surfaced to PR-16/PR-02 when reviewing branding
  spend/consistency).
- Bulk render throughput and average completion time (KRN-15 job
  observability, surfaced on the Bulk Render Monitor).
- File storage volume and legal-hold count (platform-internal, INS/ops
  visibility).

No statutory reports originate in KRN-08 itself — it renders the statutory
documents CMP-02/03/05 require; the filing calendar and evidence archive are
owned by CMP-05.

## 14. Compliance touchpoints

- Statutory Indian layouts (`KRN-08-DR-001`) are the mechanism by which
  every GST tax invoice, job work challan (MFG-05, GST Rule 143), and e-way
  bill print (CMP-03) meet mandated field positions without any module
  hand-coding one — CMP-01/02/03 supply the data, KRN-08 supplies the
  legally compliant layout.
- The `signature_block` placement on a template is a pure layout concern;
  the actual signing event, its legal meaning and evidentiary binding are
  `CMP-07` Electronic Signature's responsibility — KRN-08 never asserts a
  document is signed, only that a signature block was rendered or executed
  via a CMP-07 callback.
- `CMP-06` Regulated Records (Pharma/BFSI/Aviation/Healthcare) depends on
  KRN-08's file immutability and versioning (`KRN-08-FR-001`) — a rendered
  regulated document's prior versions must remain retrievable, never
  overwritten, which is already how `file_version` works by design.
- Retention floor (`KRN-08-FR-008`) is the GST/Companies Act evidentiary
  backstop — a tenant cannot configure faster deletion of the invoices,
  challans and e-way bills a statutory audit may request years later.

## 15. Offline behaviour

**Profile: mixed, per artefact.** Template *definitions* used by
offline-`full` modules (`SCM-02`, `MFG-04`, `OPS-10`, `SLS-10` per Vol 0
§9.2) are cached on-device (`read` profile) so a gate pass, a challan or a
job card can be rendered and printed to a connected thermal/dot-matrix
printer with no connectivity — the layout, QR/barcode logic and static
branding travel with the device. Template *updates* are server-authoritative
and last-writer-wins on the client: a stale cached template is replaced on
next sync, never merged, and a device never edits a template locally.

Rendering that requires a **server-issued statutory number or QR carrying
an IRN/e-way-bill number obtained online** (e.g. a full tax invoice with
IRN) cannot complete offline — the underlying `P-05 Document` itself is
queued for sync per its own module's offline profile (e.g. `SCM-02`), and
the render request is queued alongside it, completing once connectivity
returns. This is consistent with T15: the *business transaction* (dispatch,
gate pass) still completes offline; only the fully statutory-stamped
render artefact waits for sync — never the reverse.

## 16. Acceptance criteria (Given/When/Then)

**KRN-08-FR-001 — file versioning, checksum, retention, legal hold**
> Given a vendor invoice PDF uploaded as `file` F-1 with checksum C-1
> When a corrected copy is uploaded as a new version
> Then `file_version` 2 is created with its own checksum, F-1's `current_version_id` updates to version 2, version 1 remains retrievable, and a virus scan runs on the new version before it is marked available.

**KRN-08-FR-002 — multi-format render**
> Given a tax invoice `P-05 Document` D-500 bound to template T-INV-01
> When it is rendered for A4 and for thermal 3"
> Then both outputs carry identical amounts and statutory fields, formatted for their respective print geometry, and a print-accurate preview is available for each before the physical print.

**KRN-08-FR-003 — conditional sections, watermark, QR/barcode, multi-script**
> Given template T-INV-01 with a rule "show export declaration section only when `Document.party.country_code != IN`" and a "DUPLICATE" watermark rule for re-prints
> When D-500 (a domestic sale) is rendered the first time, and again as a duplicate
> Then the export declaration section is absent both times, the QR block renders the IRN correctly, and only the second render carries the "DUPLICATE" watermark.

**KRN-08-FR-004 — no hard-coded layouts**
> Given a new module attempting to POST a document render request with a raw HTML/PDF layout string instead of a `template_id`
> When the request reaches the API boundary
> Then it is rejected with a stable machine error code, no render_job is created, and the rejection is visible to the calling module's contract tests (L6 enforced at runtime, not only at code review).

**KRN-08-FR-005 — async, resumable, progress-reported bulk generation**
> Given a bulk render request for 5,000 payslips (PPL-08) and the render_job fails after completing 3,200 of them due to a transient storage error
> When PR-18 retries the job
> Then only the remaining 1,800 are re-attempted, the 3,200 completed renders are untouched, and progress is visible throughout at `render-jobs/{id}`.

**KRN-08-FR-006 — print-accurate template designer preview**
> Given a template being edited in the Template Designer with an unsaved conditional-section change
> When PR-21 previews it against a sample `P-05 Document` for thermal 2"
> Then the preview reflects the unsaved change exactly as it would print, with no draft-vs-print discrepancy, before the template is activated.

**KRN-08-FR-007 — multi-lingual rendering by recipient preference**
> Given customer Party PA-9 with `preferred_language: mr` (Marathi) and template T-INV-01 with an active Marathi translation
> When an invoice is rendered for PA-9
> Then labels render in Marathi with correct script (Devanagari) while numeric/statutory fields remain locale-correct per KRN-19, and a customer with no translated template available falls back to the tenant's default language without error.

**KRN-08-FR-008 — retention floor cannot be shortened below statutory minimum**
> Given a tenant attempting to set retention on rendered GST tax invoices to 2 years
> When the statutory floor for GST records is longer
> Then the configuration is rejected, the effective retention is clamped to the statutory floor, and the rejection reason names the statutory basis.

**KRN-08-DR-001 — statutory layouts pre-built; overrides are configuration**
> Given a customer PA-9 requiring a bespoke invoice layout (their PO number field repositioned, their logo added)
> When PR-21 creates a `template_binding` scoping a customised template to PA-9 without writing code
> Then PA-9's invoices render with the bespoke layout, every other customer continues on the statutory default template, and no deployment or code change occurred.

**KRN-08-DR-002 — override resolution is pure data, no per-customer branch**
> Given tenant default template T-DEF, location override T-LOC for Pune branch, and customer override T-CUST for PA-9 at Pune, all active simultaneously
> When an invoice for PA-9 is rendered from the Pune branch
> Then T-CUST is selected (highest specificity), the render call made is identical in shape to any other render call, and removing T-CUST causes the same document to fall through to T-LOC with no code path difference.

## 17. Open questions

Flagged per Vol 6 §4/L13 — gaps in Vol 1's field-level detail this draft
filled by reasonable extrapolation. Confirm or correct before this file is
binding:

1. **`document_type_id` resolution.** Vol 1/Vol 2 never state where
   "document type" (Quotation, PO, invoice, challan…) is mastered. This
   draft assumes `P-05 Document.document_type_id` and
   `print_template.document_type_id` both resolve to a KRN-04
   `entity_definition` record with `is_document = true` (that field is
   explicitly listed on `entity_definition` in Vol 1 §KRN-04), rather than
   KRN-08 owning a separate `document_type` master. Confirm this is
   intended, since it means KRN-08 has no `document_type` entity of its own
   despite owning everything that consumes one.
2. **Field-level detail for `file`, `file_version`, `print_template`,
   `template_binding`, `render_job`, `signature_block`** (§4, entity
   shapes referenced throughout) is not given in Vol 1 beyond the entity
   names — only purpose and requirements are stated. The fields proposed
   throughout this draft are a reasonable minimum consistent with
   `KRN-08-FR-001..005`, not verbatim source. Please confirm or amend,
   especially `template_binding`'s scope model (tenant/location/customer),
   which is inferred from `KRN-08-DR-001`'s "per-customer template override"
   phrase rather than stated as a field list anywhere.
3. **Scope boundary with `OPS-11` Document Management.** Vol 0 §22
   describes OPS-11 as "folder and taxonomy structure, versioning,
   check-in/check-out, retention, access control, full-text and semantic
   search" — strongly overlapping KRN-08's `file`/`file_version` versioning
   and retention. This draft assumes KRN-08 is the low-level storage/render
   engine (any module's binary artefacts, rendered or uploaded) and OPS-11
   is a Layer-2 application providing folder/taxonomy/check-in-check-out
   *workflow* over the same underlying files for internal knowledge-document
   use cases (SOPs, contracts, drawings) — mirroring how COM-04 wraps
   KRN-01. Confirm this boundary before OPS-11's own Vol 3 file is drafted.
4. **Signature block execution vs. placement.** This draft assumes
   `signature_block` on KRN-08 is purely layout metadata (position,
   signatory role, placeholder vs. rendered-signature-image) and that the
   actual e-signing flow, consent capture and legal binding belong entirely
   to `CMP-07`. Vol 1 does not state this boundary explicitly since CMP-07
   is not yet specified in a Vol 3 file. Confirm when CMP-07 is drafted.
5. **Retention floor values** (`KRN-08-FR-008`, an addition beyond Vol 1's
   literal text) — this draft states the *mechanism* (a floor that cannot be
   shortened) but not the actual statutory year-counts per document type,
   which belong in CMP-05/CMP-06's domain knowledge, not KRN-08's. Confirm
   whether KRN-08 should hold a lookup table of floors per document type
   (platform-maintained, like `KRN-12-DR-001`'s HSN/SAC pattern) or query
   CMP-05 for it at retention-policy-evaluation time.
