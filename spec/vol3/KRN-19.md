# KRN-19 · Localisation & Terminology

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-01 (tenant scope — locale/terminology are tenant-configurable), KRN-04 (Entity & Metadata Engine — overrides apply to entity/field/label metadata), KRN-13 (Layout & Navigation Engine — renders the overridden/translated labels on every generated screen)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-19)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

Language packs, number/date/currency formatting, and vertical terminology
overrides — the mechanism that makes a single "Party" primitive read as
"Customer" in a Manufacturing tenant, "Patient" in a Healthcare tenant and
"Citizen" in a Government tenant, from one manifest line, with zero code
difference (Vol 0 §11, §30 VDL example). Without KRN-19, every Industry OS
pack (Vol 0 §31) would need its own fork of every screen label — the exact
outcome Vol 0 T7 ("composition over configuration over customisation")
exists to prevent.

Not bought directly — `included` platform-fee substrate. No persona buys it;
the direct "user" of its admin surface is PR-21 (System Administrator) for
locale/format configuration, and PR-28 (Implementation Partner) who authors
the `terminology:` block of a VDL manifest (Vol 0 §30) that COM-04 applies
at provisioning. Every persona who has ever read a screen, a report, a
notification or an export is an indirect consumer.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Enables/disables locales for the tenant, sets the default locale, configures number/date/currency format policy |
| PR-28 Implementation Partner | Authors the `terminology:` overrides in a VDL manifest during vertical/partner onboarding; reviews translation coverage before go-live |
| PR-01 Owner / Director | Sets or confirms the tenant's default working language, especially for a vernacular-first deployment |
| PR-04/05/07/09/13/19/20 (offline-first, vernacular personas, Vol 0 §7.3) | Consume translated and terminology-overridden labels on every mobile/voice surface — the primary reason this module exists |
| All other internal and external personas | Read translated/overridden terminology on every screen, report, notification and document their role touches — an implicit, universal consumer relationship, not a direct screen interaction |

## 3. Scope in / scope out

**In scope:** locale registry and per-tenant enablement; translation
key/value catalogue with fallback behaviour; terminology overrides
(entity/field/role label substitution) applied platform-wide; number
formatting (Indian lakh/crore grouping vs international), date formatting
and currency display, all locale-driven.

**Out of scope:** the actual rendering of a screen from entity/layout
metadata (KRN-13 — KRN-19 supplies the label text, KRN-13 lays it out);
vernacular voice recognition and text-to-speech (INT-07 — INT-07 consumes
KRN-19's terminology/translation catalogue for its own vocabulary but owns
the speech pipeline itself); statutory document template layout and
multi-script print rendering (KRN-08, Vol 0 §10 — KRN-08 renders in the
script KRN-19 declares, it does not own the translation catalogue); the tax,
compliance or numbering logic that happens to be locale-adjacent (CMP-01,
KRN-11 — a currency *display* format is KRN-19's; the actual tax rate or
document-number rule is never here, per L7).

## 4. Entities owned; entities consumed

**Owned:** `locale`, `translation_key`, `translation`, `terminology_override`,
`format_policy` (Vol 1, verbatim list).

**Consumed (by ID):** entity, field and role identifiers owned by KRN-04
(the *thing* a `terminology_override` renames is a KRN-04 metadata object —
KRN-19 attaches a label to it, it never redefines the underlying entity or
field, consistent with L2/L6); `tenant_id` (KRN-01); the manifest structure
that carries a `terminology:` block (Vol 0 §30, applied by COM-04 at
provisioning — KRN-19 executes what the manifest declares, it does not own
manifest authoring itself, that is STU-08/COM-04 territory).

### 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every entity below; note that
`terminology_override` is always `namespace: tnt` (§7 — a tenant's/vertical's
choice of words is by definition a tenant artefact, never a `sys` one).

**`locale`** (extrapolated from KRN-19-FR-001; not field-detailed in Vol 1 —
flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `code` | string | BCP-47, e.g. `en-IN`, `hi-IN`, `mr-IN` |
| `name` | string | |
| `script` | string | e.g. Devanagari for `hi-IN`/`mr-IN` |
| `platform_supported` | boolean | `true` for the launch set (en/hi/mr); `false` for a locale added via the "framework for ten more" path (KRN-19-FR-001) — see Open Question 4 |
| `status` | enum | `enabled` \| `disabled` — per tenant |
| `is_tenant_default` | boolean | Exactly one `true` per tenant |

**`translation_key`**:

| Field | Type | Notes |
|---|---|---|
| `key` | string | Namespaced, e.g. `screen.sales_order.title`, or a metadata-object label key such as `entity.Party.label` |
| `namespace` | enum | `sys` \| `tnt` |
| `default_text` | string | English fallback (KRN-19-FR-003) |
| `context` | string, nullable | Author-facing description, disambiguates short keys |

**`translation`**:

| Field | Type | Notes |
|---|---|---|
| `translation_key_id` | ref | |
| `locale_id` | ref | |
| `text` | string | |
| `status` | enum | `machine_translated` \| `draft` \| `approved` |
| `updated_at`, `updated_by` | | |

**`terminology_override`**:

| Field | Type | Notes |
|---|---|---|
| `tenant_id` | ref | |
| `entity_or_field_ref` | string | e.g. `Party`, `Party.roles.customer`, `Document.work_order` — always a KRN-04 metadata reference, never a database column name |
| `override_text` | object | `{locale_id → text}` — one override may carry text per enabled locale |
| `source` | enum | `manifest` \| `tenant_admin` |
| `namespace` | enum | Always `tnt` (§7 above) |

**`format_policy`**:

| Field | Type | Notes |
|---|---|---|
| `scope` | object | `{level: tenant\|locale, ref_id}` |
| `number_format` | enum | `indian` (lakh/crore grouping) \| `international` |
| `date_format` | string | e.g. `DD-MM-YYYY` |
| `currency_display` | object | `{symbol_or_code, decimal_places}` |

## 5. State machines

**`locale.status`:** `enabled ↔ disabled`, tenant-toggleable, no terminal
state — a locale disabled today may be re-enabled without data loss (its
`translation` rows are never deleted on disable, only hidden from selection).

**`translation.status`:** `machine_translated → draft → approved`, with
`approved → draft` permitted on correction. Only `approved` translations are
guaranteed to render in production by default; a tenant/manifest may opt to
accept `machine_translated` text where no human review capacity exists (see
Open Question 3), but the fallback behaviour (KRN-19-FR-003) applies
identically either way once a key has no translation row at all for the
active locale.

`terminology_override` and `format_policy` carry no state machine — they are
declarative configuration, versioned only via the universal `version` field
and audit trail (KRN-10), not a workflow.

## 6. Standard functional requirements

- `KRN-19-FR-001` English, Hindi and Marathi at launch, with a framework for ten more. *(Vol 1, verbatim)*
- `KRN-19-FR-002` Indian number formatting (lakh, crore), date formats, and currency display are locale-driven. *(Vol 1, verbatim)*
- `KRN-19-FR-003` Untranslated keys fall back predictably and are reported, never rendered as raw keys. *(Vol 1, verbatim)*
- `KRN-19-FR-004` Terminology overrides apply platform-wide — every screen (KRN-13), report (INS-01..04), notification (KRN-09) and document/export renders the overridden term consistently, not only the primary UI, so a single manifest line changes "Party" to "Patient" everywhere that word would otherwise appear.
- `KRN-19-FR-005` Terminology overrides are namespace `tnt` and scoped to a specific entity/field/role reference (Vol 2 §1.1/§1.7); the underlying `sys` entity name, field name and API contract are never renamed by an override — only the label a human sees changes, so cross-module references, integrations and Studio-generated artefacts referencing `Party` continue to resolve correctly regardless of what a given tenant calls it on screen.

## 7. Differentiating requirements

- `KRN-19-DR-001` Terminology overrides are manifest-driven: "Party" becomes Patient, Passenger or Citizen across every screen, report and notification from a single manifest line. *(Vol 1, verbatim)*

## 8. Agents

None. KRN-19 is configuration and content data with no autonomous behaviour
of its own. (INT-07 Voice & Vernacular and INT-08 Onboarding Intelligence
both read KRN-19's catalogue, but KRN-19 registers no agent itself.)

## 9. Screens and flows

All screens KRN-13-generated (L6). Standard views:

- **Locale settings** (form) — PR-21: enable/disable locales, set tenant
  default.
- **Format policy** (form) — PR-21, PR-16 (currency/number format affects
  every financial screen and report they read).
- **Terminology overrides** (list + form) — PR-21 (tenant-initiated edits),
  PR-28 (manifest-sourced, provisioning window; edits after go-live are
  `tenant_admin`-sourced per the same screen).
- **Translation coverage report** — PR-21, PR-28: which keys are missing,
  machine-translated-only, or approved, per enabled locale (surfaces
  KRN-19-FR-003's "reported, never rendered as raw keys" requirement as an
  actionable list rather than only a runtime fallback).

## 10. API surface

Base per Vol 0 §42: `/api/v1/core/{entity}`. *(Vol 1 gives no explicit API
surface for KRN-19 — proposed by the implementer per Vol 6 §4/L13; flagged
in §17.)*

| Method | Path | Notes |
|---|---|---|
| CRUD | `/api/v1/core/locales` | Enable/disable is PR-21; the `platform_supported` locale catalogue itself is `sys`, platform-managed only |
| CRUD | `/api/v1/core/translations` | Filterable by `locale_id`, `key`, `status` |
| GET | `/api/v1/core/translations/missing` | Untranslated/fallback-triggering keys per locale — backs KRN-19-FR-003's reporting requirement |
| CRUD | `/api/v1/core/terminology-overrides` | Write restricted to PR-21 (tenant_admin source) and the COM-04 provisioning service account (manifest source) |
| CRUD | `/api/v1/core/format-policies` | PR-21 |
| GET | `/api/v1/core/labels/resolve` | `{entity_or_field_ref, locale_id}` → resolved display text after override + translation + fallback — the single call every rendering surface (KRN-13, INS, KRN-09, KRN-08) makes rather than each reimplementing the precedence rule |

All list endpoints: cursor pagination, declared filters, field selection.
All writes: idempotency key required.

## 11. Permission matrix by persona

Actions: `create`, `read`, `update`, `delete` (soft, SEC-07 only), `apply`
(manifest-sourced terminology application at provisioning), `export`.

| Persona | locale.enable/default | format_policy.update | terminology_override.create/update | translation.approve | translation.read |
|---|---|---|---|---|---|
| PR-21 System Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-01 Owner | ✓ (default only) | ✗ | ✗ | ✗ | ✓ |
| PR-16 CFO | ✗ | ✓ (currency/number format) | ✗ | ✗ | ✓ |
| PR-28 Implementation Partner | ✗ | ✗ | ✓ (own tenant, provisioning window; `source = manifest`) | ✗ | ✓ (own tenant) |
| All other internal/external personas | ✗ | ✗ | ✗ | ✗ | ✓ (implicit, via rendered screens — not a direct screen action) |

**Negative cases:**
- PR-28 (Implementation Partner) attempting `terminology_override.create`
  outside the provisioning window (after go-live, unless re-engaged) → 403,
  same pattern as KRN-01 §11's PR-28 negative case.
- Any persona attempting to set `terminology_override.entity_or_field_ref`
  to a value that would rename a `sys` field's underlying API contract
  (rather than only its display label) → rejected at validation
  (KRN-19-FR-005) — the write path only ever touches the label object.
- PR-16 (CFO) attempting `terminology_override.create` (out of their role's
  purpose — format policy, not terminology, is theirs) → 403.

## 12. Events emitted / consumed

**Emitted:**
- `core.locale.enabled` / `core.locale.disabled`
- `core.translation.updated`
- `core.terminology_override.applied`
- `core.format_policy.updated`

**Consumed:** `core.tenant.provisioned` (KRN-01) — on receipt, KRN-19 applies
the manifest's `terminology:` block (Vol 0 §30) as a set of `source: manifest`
`terminology_override` rows, in the same provisioning flow COM-04
orchestrates (a direct call during provisioning, not a lagging async
reaction, since the tenant's very first screen must already show the
correct terminology).

## 13. Reports and KPIs

- Translation coverage % per enabled locale (approved / total keys).
- Missing-key report (fallback events logged per KRN-19-FR-003) — trending
  to zero is the release-readiness signal for a new locale.
- Terminology override audit — what a manifest or tenant admin changed and
  when, useful during Industry OS pack certification (STU-08).

No statutory reports originate in KRN-19 itself.

## 14. Compliance touchpoints

- Number/date/currency `format_policy` feeds statutory document rendering
  (KRN-08) so a GST invoice displays amounts in the locally expected
  format — KRN-19 supplies the format declaration, KRN-08 renders it, CMP-01
  computes the amount, and no module hard-codes a formatting choice (L6/L7
  boundary preserved).
- Vernacular completeness (Hindi/Marathi coverage, KRN-19-FR-001) is a
  precondition for INT-07's voice capture to be usable by PR-04/05/07/09/13
  in the field — a gap here is functionally an accessibility/floor-adoption
  risk (Vol 0 §7.3 design rule), not merely a translation nicety.

## 15. Offline behaviour

**Profile: `read`.** KRN-19's own admin screens (locale settings, format
policy, terminology override authoring) are `online`-only administrative
actions. However, the *resolved label bundle* (translations +
terminology overrides + format policy, for the tenant's enabled locales) is
cached on-device for every offline-`full` module (Vol 0 §9.2 list — SCM-02,
SCM-03, MFG-04, MFG-06, SLS-10, DLV-05, DLV-07, PPL-05, OPS-10) so PR-04,
PR-05, PR-07, PR-09 and PR-13 see correct vernacular, terminology-overridden
labels while working with no connectivity. There is no conflict policy to
declare, since the bundle is read-only on-device and reconciled by simple
replacement on next sync, never merged.

## 16. Acceptance criteria (Given/When/Then)

**KRN-19-FR-001 — three launch locales, framework for more**
> Given a tenant with `en-IN`, `hi-IN` and `mr-IN` all enabled
> When a user switches their working locale to `mr-IN`
> Then every KRN-13-rendered screen the user next opens shows Marathi labels wherever an `approved` or `machine_translated` translation exists, and the platform's locale registry accepts registering a thirteenth non-launch locale via the same `locale` entity without a code change (the "framework for ten more" claim).

**KRN-19-FR-002 — locale-driven number, date and currency format**
> Given `format_policy.number_format = indian` for tenant `T1` and `international` for tenant `T2`, both viewing the amount ₹12,345,678
> When each tenant's UI renders that figure
> Then `T1` displays `₹1,23,45,678` (lakh/crore grouping) and `T2` displays `₹12,345,678` (international grouping), from the same underlying stored value with no per-module formatting logic.

**KRN-19-FR-003 — predictable, reported fallback**
> Given `translation_key` `screen.mfg_job_card.title` has no `translation` row for locale `mr-IN`
> When a Marathi-locale user opens that screen
> Then the `default_text` (English fallback) renders instead of the raw key `screen.mfg_job_card.title`, and the missing-key report (§13) logs exactly one entry for `{key: screen.mfg_job_card.title, locale: mr-IN}` rather than silently doing nothing.

**KRN-19-FR-004 — terminology override applies platform-wide**
> Given a Healthcare-manifested tenant with `terminology_override: {entity_or_field_ref: "Party", override_text: {en-IN: "Patient"}}`
> When a user views the Party list screen (KRN-13), a KPI scorecard referencing party counts (INS-04), a WhatsApp notification template mentioning "Party" (KRN-09), and an exported CSV column header
> Then all four surfaces render "Patient," none renders the underlying primitive name "Party," and a Manufacturing-manifested tenant with no such override continues to show "Party"/"Customer" unaffected.

**KRN-19-FR-005 — override changes label only, never the contract**
> Given the same "Party → Patient" override from the prior scenario
> When SLS-02 (Contacts) calls the `P-01 Party` API or an integration reads the `party` entity schema
> Then the field names, entity name and API contract are unchanged (`party_type`, `roles`, etc. remain as Vol 2 §P-01 defines them) — only `KRN-04's` resolved display label differs, so no cross-module reference or integration breaks because of a terminology choice.

**KRN-19-DR-001 — one manifest line, every surface (full form of Vol 1's sample)**
> Given a VDL manifest's `terminology:` block declaring `Party.customer: Customer`, `Resource: Machine`, `Document.work_order: Job Card` (Vol 0 §30 example)
> When COM-04 provisions a tenant from that manifest
> Then all three overrides are applied as `terminology_override` rows with `source: manifest` in the same provisioning transaction, and the tenant's very first login already shows "Job Card" (not "Work Order") on every relevant screen, report and notification — with zero code written to achieve it, and a different vertical's manifest achieving an entirely different vocabulary via the identical mechanism.

## 17. Open questions

Flagged per Vol 6 §4/L13:

1. **Field-level detail for all five owned entities** (§4.1) is not given in
   Vol 1 — only their names and purpose are stated. The fields proposed here
   are a reasonable minimum, not a verbatim source. Please confirm or amend.
2. **API surface and event names** (§10, §12) are not specified in Vol 1 for
   KRN-19 — proposed by the implementer per Vol 6 §4/L13. Please confirm or
   amend before contract tests are written against it.
3. **Translation approval workflow** — who reviews a `machine_translated`
   string before it is trusted as `approved`, and whether an unapproved
   machine translation is allowed to render in production at all (versus
   always falling back to English until approved), is not specified in Vol 0
   or Vol 1. This draft assumes a tenant/manifest may opt to accept
   machine-translated text live (common for smaller verticals without
   in-house Marathi/Hindi reviewers) but flags this as a real product
   decision, not an engineering default — confirm before KRN-19-FR-003's
   fallback logic is finalised.
4. **Whether a tenant/partner may register a locale beyond the
   platform-supported set** (the "framework for ten more" language in
   KRN-19-FR-001) is ambiguous on namespace: is a new locale itself `sys`
   (platform adds official support) or can `tnt`/Studio register one
   unofficially with looser QA? This draft's `locale.platform_supported`
   flag is a proposed way to represent that distinction, not a confirmed
   design. Confirm before STU-08 (Vertical Manifest Editor) needs to decide
   whether partners can add languages, not just terminology.
5. **Relationship to INT-07's vernacular vocabulary** — whether voice
   command recognition (INT-07) reads the same `translation`/
   `terminology_override` tables directly, or maintains its own phrase
   catalogue that must be kept in sync, is not addressed by Vol 0/1. Flagged
   for resolution before INT-07's Vol 3 file is drafted, since a divergence
   here would mean a screen and its voice command disagree on vocabulary.
