# KRN-13 · Layout & Navigation Engine

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-04 (entity/field metadata it renders), KRN-03 (permission enforcement in rendered layouts), KRN-20 (entitlement-filtered navigation), KRN-19 (terminology overrides for labels), KRN-06 (event bus)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-13)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

The mechanism behind L6 ("Never hard-code a screen, label, workflow,
permission or report"). Every list, form, kanban board, calendar, timeline,
dashboard and mobile task surface the platform shows is resolved from
metadata by KRN-13 at request time — no application module ships a
hand-written screen. This is what makes the same module present a different
default screen under a Manufacturing manifest and a Healthcare manifest with
no code difference (KRN-13-DR-001), and it is the mechanism that lets STU-01
("speak a module into existence," Vol 0 §28 item 9) and STU-03 (Form & View
Designer) generate a fully working, permissioned screen from natural
language or a visual designer with nothing further to build.

Not bought directly — `included` platform-fee substrate. There is no direct
"buyer" persona in the transactional sense; every persona is a *consumer* of
what KRN-13 renders on every screen they touch, and the practical *authors*
of layout and navigation metadata are PR-21 (System Administrator, for
navigation structure) and PR-28 (Implementation Partner) via STU-03 (Studio,
Layer 4 — see §3 for the KRN-13/STU-03 boundary).

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Configures navigation structure; resets a user's broken personalisation; publishes a `tnt` layout variant |
| PR-28 Implementation Partner | Authors and adjusts layouts during onboarding via STU-03, which writes into the metadata KRN-13 serves |
| Every internal and external persona (PR-01..30) | Consumes KRN-13's output on every screen they open — the resolved layout, the filtered navigation tree, their own saved filters and personalisation |
| PR-04, PR-05, PR-07, PR-09, PR-13, PR-19, PR-20 (mobile-first, offline, often vernacular) | Specifically depend on KRN-13's `mobile_task` view type and WCAG 2.2 AA compliance (KRN-13-FR-005) to have a usable surface at all — these are the personas the design rule in Vol 0 §7.3 exists to protect |

## 3. Scope in / scope out

**In scope:** view-type definitions (list, form, kanban, calendar, timeline,
dashboard, mobile task surface); layout composition (sections, field
placement, conditional visibility, field-level read-only logic, responsive
breakpoints); resolving the *effective* layout for a given entity, view
type, user, role and active vertical manifest at request time; entitlement-
and permission-filtered navigation; per-user personalisation (columns,
filters, dashboard widgets) within role-set limits; accessibility conformance
of every generated screen.

**Out of scope, and the boundary with adjacent modules:**
- **What can be shown** (which entities/fields exist, their types and
  validation) is KRN-04's concern; KRN-13 renders what KRN-04 declares, it
  does not declare entities or fields itself.
- **Who can see or edit a given field or record** is KRN-03's concern;
  KRN-13 applies KRN-03's decision when composing a screen, it does not make
  the authorisation decision itself (KRN-13-FR-003 explicitly delegates to
  KRN-03 and KRN-20).
- **Authoring** a layout through a visual designer or natural language is
  STU-03/STU-01 (Layer 4, Studio) — those tools write `tnt`-namespace layout
  metadata through KRN-13's own API (§10); KRN-13 is the rendering/serving
  engine underneath them, not the author-facing product itself. A Studio
  (higher layer) depending on the Kernel (lower layer) is the normal
  direction of dependency in Vol 0 §5's layer model; KRN-13 must never
  depend back on STU-03.
- **What label text a field or menu item shows** in a given locale/vertical
  is KRN-19 (Localisation & Terminology) — KRN-13 stores a `label_key`
  reference, never literal label text, and resolves it through KRN-19 at
  render time.
- **How a document prints** (as opposed to how it is worked on-screen) is
  KRN-08 — a form view may *bind* to a KRN-08 `print_template_id`, but
  KRN-13 does not render print output itself.

## 4. Entities owned; entities consumed

**Owned:** `layout`, `view_definition`, `field_placement`,
`navigation_node`, `saved_filter`, `personalisation`.

**Consumed (by ID):**
- `KRN-04` `entity_definition`, `field_definition` — every `layout` targets
  an `entity_definition`; every `field_placement` targets a
  `field_definition`. KRN-13 renders these, it never defines them.
- `KRN-03` `permission_grant`, `field_policy` — resolved at render time to
  decide which fields/actions a given user's rendered screen actually
  exposes (masked/hidden/read-only fields never reach the client, per
  KRN-03-FR-003).
- `KRN-20` entitlement/plan data — resolved at render time to decide which
  navigation nodes exist at all for a given tenant's purchased modules
  (KRN-13-FR-003).
- `KRN-19` `label_key` resolution — every human-readable string on a
  rendered screen (section titles, field labels, navigation labels) is
  resolved through KRN-19, never stored as literal text in `layout`.
- `KRN-08` `print_template_id` — an optional binding on a form/detail
  `view_definition` for document-producing entities (`P-05 Document`).

## 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every entity below and are not
repeated per field table.

**`layout`** (extrapolated from KRN-13-FR-001/002/DR-001; not field-detailed
in Vol 1 — flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `entity_id` | ref | `KRN-04 entity_definition` this layout renders |
| `view_type` | enum | `list` \| `form` \| `kanban` \| `calendar` \| `timeline` \| `dashboard` \| `mobile_task` (KRN-13-FR-001) |
| `namespace` | enum | `sys` (platform default) \| `tnt` (tenant-added variant) — a `tnt` layout never replaces the `sys` default in place; it is selected by `manifest_id`/`role_scope` matching, keeping the platform default upgrade-safe |
| `manifest_id` | ref, nullable | Vertical-specific override (KRN-13-DR-001) — null means "applies regardless of manifest" |
| `role_scope` | ref, nullable | Role-specific variant (e.g. a simplified mobile form for PR-04 vs. the full desk form for PR-03 on the same entity) |
| `is_default` | boolean | Exactly one layout may be `is_default: true` per `{entity_id, view_type, manifest_id, role_scope}` combination |
| `version` | integer | |
| `status` | enum | `draft` \| `published` \| `deprecated` |

**`view_definition`** (child of `layout`; extrapolated — flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `layout_id` | ref | |
| `sections` | ordered list | `{code, label_key, collapsed_by_default}` |
| `sort_default`, `group_by_default`, `filter_default` | config | List/kanban/calendar defaults before any personalisation is applied |
| `responsive_breakpoints` | config | Section/column behaviour per breakpoint (KRN-13-FR-002) |
| `print_template_id` | ref, nullable | Optional KRN-08 binding for document-type forms |

**`field_placement`** (child of `view_definition`; extrapolated — flagged in
§17):

| Field | Type | Notes |
|---|---|---|
| `view_definition_id` | ref | |
| `field_id` | ref | `KRN-04 field_definition` |
| `section_code`, `order` | string, int | |
| `visibility_rule` | ref, nullable | `KRN-07` rule expression — conditional visibility (KRN-13-FR-002) |
| `read_only_rule` | ref, nullable | `KRN-07` rule expression — field-level read-only logic (KRN-13-FR-002), evaluated *after* KRN-03's field policy, never overriding it |
| `mobile_visible` | boolean | Whether this placement participates in the `mobile_task` variant |

**`navigation_node`** (extrapolated from KRN-13-FR-003; not field-detailed in
Vol 1 — flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `parent_node_id` | ref, nullable | Tree structure |
| `label_key` | ref | Resolved via KRN-19 |
| `icon` | string | |
| `target_entity_id` / `target_view_id` | ref, nullable | What the node navigates to |
| `order` | integer | |
| `required_module_id` | ref | Entitlement gate (KRN-20) — node is invisible, not merely disabled, if unentitled (KRN-13-FR-003) |
| `required_permission` | ref, nullable | Permission gate (KRN-03) — same invisible-not-disabled rule |
| `manifest_id` | ref, nullable | Vertical-specific navigation entry |
| `namespace` | enum | `sys` \| `tnt` |

**`saved_filter`**:

| Field | Type | Notes |
|---|---|---|
| `entity_id` | ref | |
| `owner_user_id` | ref, nullable | Null when `sharing_scope` is broader than personal |
| `sharing_scope` | enum | `self` \| `org_unit` \| `role` \| `tenant` — broader scopes require an elevated permission to create (§11) |
| `name`, `filter_expression`, `sort` | string, expr, config | |
| `is_default_for_owner` | boolean | |

**`personalisation`**:

| Field | Type | Notes |
|---|---|---|
| `user_id` | ref | Always self-scoped — personalisation is never shared (KRN-13-FR-004) |
| `view_definition_id` | ref | |
| `column_order`, `hidden_columns` | list | List-view personalisation |
| `widget_layout` | config | Dashboard-view personalisation |
| `saved_at` | timestamptz | |

## 5. State machines

**`layout.status`:** `draft → published → deprecated`. A `draft` layout is
visible only to its author (typically via STU-03's preview) and never served
to end users. `published → deprecated` follows the same
sunset-and-migration-path discipline as `KRN-04-FR-003` (L12) — a deprecated
layout continues resolving for any manifest still pinned to it until its
sunset date, never disappearing abruptly under a tenant that references it.
There is no `deprecated → published` transition; a reinstated layout is
republished as a new version.

No other KRN-13 entity carries a process state machine — `navigation_node`,
`saved_filter` and `personalisation` are declarative configuration, not
process-governed documents, consistent with how KRN-01's own configuration
entities (org unit, cost centre) carry no state machine either.

## 6. Standard functional requirements

- `KRN-13-FR-001` View types: list, form, kanban, calendar, timeline, dashboard, and mobile task surface. *(Vol 1, verbatim)*
- `KRN-13-FR-002` Layouts support sections, conditional visibility, field-level read-only logic, and responsive breakpoints. *(Vol 1, verbatim)*
- `KRN-13-FR-003` Navigation is filtered by entitlement (KRN-20) and permission (KRN-03); an unpurchased or unpermitted module is invisible, not merely disabled. *(Vol 1, verbatim)*
- `KRN-13-FR-004` Users may personalise columns, filters and dashboard widgets within limits set by their role. *(Vol 1, verbatim)*
- `KRN-13-FR-005` Every generated screen meets WCAG 2.2 AA. *(Vol 1, verbatim)*
- `KRN-13-FR-006` An entity resolves to exactly one effective layout per `{view_type, manifest, role_scope}` at render time, selected by specificity (role-scoped beats manifest-scoped beats the tenant-wide `sys` default); a tenant may define additional `tnt` layout variants without altering or removing the platform default, consistent with T13. *(Addition — makes KRN-13-DR-001's "no code difference" claim mechanically precise: this is *how* vertical-aware default selection resolves, which Vol 1 states as an outcome but not as a mechanism.)*
- `KRN-13-FR-007` The same `layout`/`view_definition` metadata renders on both the web client and the React Native mobile client (Vol 1 §1.1) through a shared renderer; a screen is authored once, not once per client. *(Addition — grounded in the D-12 stack decision that mobile shares the metadata renderer with web.)*

## 7. Differentiating requirements

- `KRN-13-DR-001` Layouts are vertical-aware — the same module presents different default screens under a Manufacturing manifest and a Healthcare manifest with no code difference. *(Vol 1, verbatim)*
- `KRN-13-DR-002` Because `layout` carries no literal label text (only `label_key`, resolved via KRN-19 at render time), the same layout metadata renders correctly in English, Hindi and Marathi, and under a vertical's terminology override (e.g. "Party" → "Patient"), without a second copy of the layout being authored per language or per terminology set. *(Addition — makes explicit the mechanism behind Vol 0 §28 item 9's "speak a module into existence" actually working across languages, and behind KRN-19's own differentiating claim in Vol 0 §11.)*

## 8. Agents

None. KRN-13 is not in Vol 0 §27.4's launch agent registry. Screen rendering
and navigation resolution are deterministic metadata operations; there is no
autonomous behaviour here for the Trust Ladder to govern (T15 is trivially
satisfied — KRN-13 never depends on the AI layer being available at all).

## 9. Screens and flows

Unlike most Vol 3 modules, KRN-13 owns very few end-user *screens of its
own* — it is the engine that renders every other module's screens, not a
destination screen itself. What it does own directly:

- **Navigation admin** (tree editor) — PR-21: reorders, adds or hides
  `tnt`-namespace navigation nodes; cannot edit `sys` nodes (§11).
- **Personalisation reset** (guarded action, per user) — PR-21: clears a
  user's broken or overgrown personalisation back to the role default,
  needed occasionally when a user's saved column/filter state becomes
  invalid after an upgrade adds or deprecates a field.
- **Layout publish/rollback** (via STU-03, calling into KRN-13's API) — the
  authoring surface itself belongs to STU-03, not KRN-13, per §3.

**The render resolution flow** (the mechanism, not a screen, but the
functional core of the module): on every screen request, KRN-13 resolves,
in order — (1) the entity and view type requested, (2) the active vertical
manifest for the tenant, (3) the requesting user's role, (4) the most
specific matching `layout` (KRN-13-FR-006), (5) KRN-03's field policy and
KRN-20's entitlement for every field and action the layout would otherwise
show, stripping what is not permitted or not entitled rather than disabling
it, (6) KRN-19 label resolution for every `label_key`, (7) the user's own
`personalisation` overlay. The result is the rendered screen specification
returned to the client — the same pipeline for web and mobile (KRN-13-FR-007).

## 10. API surface

Base per Vol 0 §42: `/api/v1/layout/{entity}`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/layout/resolve` | `{entity_id, view_type, role?}` → the fully resolved, permission- and entitlement-filtered screen specification (§9's render flow) — the endpoint every client actually calls on screen load |
| CRUD | `/api/v1/layout/layouts` | Authoring surface used by STU-03; `tnt` namespace only for tenant/partner callers, `sys` namespace writable only by the platform's own release process |
| CRUD | `/api/v1/layout/view-definitions`, `/field-placements` | |
| POST | `/api/v1/layout/layouts/{id}/publish` | `draft → published` |
| POST | `/api/v1/layout/layouts/{id}/deprecate` | `{sunset_at}` — required, per L12 |
| GET/PATCH | `/api/v1/layout/navigation` | The navigation tree; `PATCH` restricted to `tnt` nodes |
| CRUD | `/api/v1/layout/saved-filters` | Sharing-scope-gated per §11 |
| GET/PUT | `/api/v1/layout/personalisations/me` | Always self-scoped; no `user_id` parameter accepted from the client — resolved from the authenticated actor |
| POST | `/api/v1/layout/personalisations/{user_id}/reset` | Admin-only reset action (§9) |

All list endpoints: cursor pagination, declared filters, field selection
(Vol 1 §1.2).

*Flagged in §17: Vol 1 gives no API surface for KRN-13. The above is this
draft's proposal.*

## 11. Permission matrix by persona

Actions: `layout.author` (`tnt` create/update via STU-03), `layout.publish`,
`navigation.configure` (`tnt` nodes), `saved_filter.create.self`,
`saved_filter.create.shared` (`org_unit`/`role`/`tenant` scope),
`personalisation.self`, `personalisation.reset.other`.

| Persona | layout.author | layout.publish | navigation.configure | saved_filter.create.shared | personalisation.self | personalisation.reset.other |
|---|---|---|---|---|---|---|
| PR-21 System Admin | ✓ (via STU-03) | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-28 Implementation Partner | ✓ (own tenant, provisioning window only) | ✓ (own tenant, provisioning window only) | ✓ (own tenant, provisioning window only) | ✗ | ✓ | ✗ |
| PR-02 Functional Head | ✗ | ✗ | ✗ | ✓ (own function scope) | ✓ | ✗ |
| PR-16 CFO | ✗ | ✗ | ✗ | ✓ (tenant-wide, Finance screens) | ✓ | ✗ |
| All other internal/external personas (PR-01, 03..15, 17..27) | ✗ | ✗ | ✗ | ✗ (self-scope only) | ✓ | ✗ |
| PR-29 Agent | ✗ | ✗ | ✗ | ✗ | ✗ (agents have no personalised screen state) | ✗ |

**Negative cases:**
- Any actor, PR-21 included, attempting to `PATCH` a `sys`-namespace
  `layout` or `navigation_node` directly (bypassing the platform release
  process) → 403 — the same `sys`/`tnt` write boundary as every other
  kernel module (L1, KRN-04-DR-001).
- A user attempting to add a `field_placement` referencing a field they do
  not hold `read` permission on (KRN-03) to their own personalisation's
  visible-columns set → rejected; personalisation can hide a permitted
  column, it can never surface one the user is not permitted to see.
- PR-04 (Shop Floor Supervisor) requesting the navigation tree while their
  tenant has not purchased MFG-07 (Maintenance) → the MFG-07 node is
  entirely absent from the response, not present-and-disabled
  (KRN-13-FR-003, tested as a genuine negative case, not merely a UI
  affordance).
- Any actor attempting `PUT /personalisations/me` with a `user_id` in the
  payload that differs from their authenticated identity → rejected; the
  endpoint is deliberately identity-derived, not parameterised, to make
  writing another user's personalisation structurally impossible rather
  than merely permission-checked.

## 12. Events emitted / consumed

**Emitted** (not given in Vol 1 — proposed per Vol 0 §42 convention,
flagged in §17):
- `layout.layout.published`, `.deprecated`
- `layout.navigation.updated`
- `layout.saved_filter.created`, `.shared`
- `layout.personalisation.saved`

**Consumed:**
- `metadata.field.deprecated` (`KRN-04`) — triggers a check for
  `field_placement` rows referencing the deprecated field, and for any
  user `personalisation` column set referencing it, so a field's
  deprecation degrades gracefully in every screen that shows it rather
  than breaking rendering.
- `access.policy.changed` (`KRN-03`) — invalidates cached resolved-layout
  results for affected roles, since a permission change must be reflected
  on the next render, not only on next login.
- `metadata.schema.version_promoted` (`KRN-04`) — invalidates layout
  resolution cache tenant-wide on a schema promotion.

## 13. Reports and KPIs

- **Screen render latency** (p95, per view type) — feeds the platform NFR
  target in Vol 0 §36 (< 400 ms record read, < 1.5 s filtered list),
  platform-internal, not tenant-facing.
- **Personalisation adoption** — how many users have customised columns or
  dashboard widgets, a platform-internal product signal.
- **Accessibility audit report** — automated WCAG 2.2 AA conformance
  scanning result per published layout, surfaced to PR-21/PR-28 before a
  `tnt` layout is published, and to MahiSys' own release process for `sys`
  layouts (Vol 0 §36, §37 security/certification roadmap touchpoint).
- **Navigation node reachability** — flags `tnt` navigation nodes that
  target an entity or view no longer resolvable (e.g. after a deprecation),
  a data-quality signal for PR-21.

## 14. Compliance touchpoints

- **WCAG 2.2 AA** (Vol 0 §36 NFR table) is KRN-13's primary compliance
  obligation — every screen it generates, across every module and every
  vertical manifest, is a rendering coming out of this one engine, which is
  what makes platform-wide accessibility conformance achievable through one
  point of control rather than 185 modules each getting it right or wrong
  independently.
- Correct label rendering under multi-script and vernacular output
  (English, Hindi, Marathi at launch — Vol 0 §36) depends on KRN-13 never
  storing literal label text (§4.1, `label_key`) and always resolving
  through KRN-19, including correct `lang` attribute propagation for screen
  reader compatibility, which is itself part of WCAG conformance.
- No statutory (GST/labour/tax) compliance touchpoint exists in KRN-13
  itself — it renders whatever a document-producing module and CMP place in
  front of it, and never alters compliance-relevant content in the process.

## 15. Offline behaviour

**Profile: `read`.** Resolved layout and navigation metadata for the
declared `mobile_task` view type (KRN-13-FR-001) is cached on-device via
KRN-16 so offline-`full` modules (SCM-02, SCM-03, MFG-04, MFG-06, SLS-10,
DLV-05, DLV-07, PPL-05, OPS-10 — Vol 0 §9.2) can render a working screen
with no connectivity. Layout/navigation metadata itself is never *written*
from an offline device — a tenant admin configuring navigation or a partner
authoring a layout via STU-03 requires connectivity. `personalisation` and
`saved_filter` changes made offline (e.g. a field rep reordering their beat
list columns) queue and sync last-writer-wins on reconnect (Vol 0 §9.2's
default for independent, low-risk fields) — a genuine concurrent edit to the
same user's own personalisation from two devices is rare and low-stakes
enough that queued-for-review is not warranted.

## 16. Acceptance criteria (Given/When/Then)

**KRN-13-FR-001 — full view-type coverage**
> Given the entity `SLS-04 Deal` needs a pipeline board and `MFG-04 Work Order` needs an operator terminal
> When layouts are resolved for `Deal` with `view_type: kanban` and for `Work Order` with `view_type: mobile_task`
> Then both resolve successfully from the same KRN-13 engine with no view-type-specific code path outside the declared seven types (list, form, kanban, calendar, timeline, dashboard, mobile_task).

**KRN-13-FR-002 — sections, conditional visibility, read-only logic, responsive breakpoints**
> Given a form layout on `P-05 Document` with a "Statutory" section whose `eway_bill_no` field is placed with `visibility_rule: totals.total > eway_bill_threshold` and `read_only_rule: status != draft`
> When the form is rendered for a document below the threshold in `draft` status, and again for one above the threshold in `issued` status
> Then the first render omits the `eway_bill_no` field entirely, the second shows it as read-only, and on a narrow (mobile) breakpoint the "Statutory" section collapses per its declared responsive behaviour while remaining fully reachable.

**KRN-13-DR-001 — vertical-aware default layout**
> Given the `P-07 Process`-governed entity that VRT-01's manifest terms "Job Card" and VRT-04's manifest terms "Discharge Summary" (both the same underlying `sys` entity, different manifests)
> When a form view is resolved for a tenant on the Manufacturing manifest and, separately, for a tenant on the Healthcare manifest
> Then each tenant sees its manifest-appropriate default layout and terminology with zero difference in the module's underlying code, satisfying KRN-13-FR-006's specificity resolution (manifest-scoped layout selected over the tenant-wide default).

**KRN-13-FR-003 — entitlement- and permission-filtered navigation, invisible not disabled**
> Given a tenant that has not purchased MFG-07 (Maintenance), and a user without `read` permission on `OPS-04` (Asset Management)
> When that user requests their navigation tree
> Then neither the MFG-07 nor the OPS-04 node is present in the response at all — not present-and-greyed-out — and a direct API call to either module's endpoints independently returns 403, so the invisibility is not merely cosmetic.

**KRN-13-FR-004 — bounded personalisation**
> Given a role-set limit that permits column reordering and hiding but not adding a column referencing a field the role cannot read
> When a user personalises their list view, reordering visible columns and attempting to add a masked salary field
> Then the reorder succeeds and persists to their own `personalisation`, and the masked-field addition is rejected, leaving their other personalisation changes intact.

**KRN-13-FR-005 — WCAG 2.2 AA**
> Given any `sys` or published `tnt` layout, across any of the seven view types
> When it is scanned by the automated accessibility audit before publish (§13)
> Then it passes WCAG 2.2 AA conformance criteria (keyboard navigability, colour contrast, screen-reader label association, focus order), and a layout that fails is blocked from `publish` (KRN-13-FR-006's state machine) until corrected.

**KRN-13-FR-006 — specificity-ordered layout resolution**
> Given a `sys` tenant-wide default form layout for `Deal`, a `tnt` manifest-scoped variant for the Distribution manifest, and a further `tnt` role-scoped variant for PR-09 (Field Sales) under that same manifest
> When the layout is resolved for a PR-09 user on a Distribution-manifest tenant, and separately for a PR-08 (Sales Manager) user on the same tenant
> Then the PR-09 user receives the role-scoped variant, the PR-08 user receives the manifest-scoped (non-role) variant, and a tenant with no Distribution manifest active receives the tenant-wide `sys` default in both cases — with no application code differing across any of the three resolutions.

**KRN-13-FR-007 — one metadata, two clients**
> Given a `mobile_task` layout authored once for `MFG-04 Work Order` operator confirmation
> When it is rendered on the web client (desk supervisor override) and on the React Native mobile client (shop-floor tablet)
> Then both clients render the same section structure, field placements and visibility rules from the identical `view_definition`, with only the responsive breakpoint applied differing, and no second, mobile-specific layout definition exists anywhere in the metadata.

**KRN-13-DR-002 — locale- and terminology-independent layout**
> Given the layout from KRN-13-DR-001's Manufacturing-tenant scenario, authored with `label_key` references only
> When the same tenant's `preferred_language` (KRN-19, via `P-01 Party`) is switched from English to Marathi for a floor-supervisor user
> Then every label on the rendered screen — section titles, field labels, navigation entries — renders in Marathi from the same underlying layout metadata, with zero change to `layout`, `view_definition` or `field_placement` records.

## 17. Open questions

Flagged per Vol 6 §4/L13 — gaps in Vol 1's detail that this draft filled by
reasonable extrapolation. To be confirmed or corrected by the human before
this file is treated as binding:

1. **API surface and events** (§10, §12) are not given in Vol 1 for KRN-13 —
   Vol 1 Part 2's KRN-13 section has no `API:`/`Events:` lines. This draft
   proposes both from scratch, consistent with Vol 0 §42's conventions and
   the pattern every other Vol 1 module follows. Please review specifically,
   as there was no source text to expand from.
2. **`layout` / `view_definition` / `field_placement` / `navigation_node` /
   `saved_filter` / `personalisation` field tables** (§4.1) are not given at
   field level in Vol 1 — only the six entity names are listed. The split
   proposed here (a `layout` header entity, a child `view_definition`, a
   grandchild `field_placement`) is this draft's inference from KRN-13-FR-002
   ("sections, conditional visibility, field-level read-only logic"), not
   stated in Vol 1; confirm this is the intended composition, or whether a
   flatter or different structure was meant.
3. **KRN-13 vs. STU-03 authoring boundary** (§3, §9) — Vol 1 does not
   explicitly state that STU-03 (Layer 4) is the *authoring* surface writing
   through KRN-13's API while KRN-13 itself is only the *serving* engine.
   This draft infers the boundary from Vol 0 §5's layer model (Studio
   generates applications; applications may not call the Studio — implying
   the kernel underneath Studio must not depend on it either) and from
   STU-03's own Vol 0 §14 description ("layout, sections, conditional
   visibility... mobile layout, print layout binding" — nearly identical
   language to KRN-13-FR-002). Confirm this is the intended division of
   responsibility, since it determines whether KRN-13's own Vol 3 needs an
   authoring API at all versus only a read/resolve and low-level write API
   for STU-03 to call.
4. **Specificity resolution order** (KRN-13-FR-006, an addition) — Vol 1
   states the *outcome* ("vertical-aware... no code difference," KRN-13-
   DR-001) but not the *resolution mechanism*. This draft proposes
   role-scoped beats manifest-scoped beats tenant-wide default as the
   specificity order; an alternative ordering (e.g. manifest beats role) is
   equally plausible and would produce different results when both a
   manifest-scoped and a role-scoped variant exist for the same entity and
   view type. Confirm the intended precedence.
5. **`saved_filter` sharing-scope permission model** (§11) — Vol 1 does not
   describe saved filters at all beyond the entity name in the owned-entity
   list; this draft invents the `self`/`org_unit`/`role`/`tenant` sharing
   scopes and gates broader scopes behind a higher permission tier by
   analogy with `KRN-03-FR-002`'s data-scope levels. Confirm this is the
   intended shape, or whether saved filters were meant to be strictly
   personal with no sharing at all.
6. **Mobile-client rendering claim (KRN-13-FR-007)** rests on the D-12 stack
   decision (React Native "sharing the metadata renderer with web," Vol 1
   §1.1) but Vol 1 Part 2's KRN-13 section itself says nothing about mobile
   rendering specifically beyond listing `mobile_task` as a view type. This
   draft treats "one metadata renders on both clients" as a load-bearing
   requirement worth its own FR and acceptance criterion, given how central
   Vol 0 §7.3's design rule (offline/mobile-first personas are "most of the
   actual usage") makes this to the product; confirm it should be
   requirement-level rather than left implicit in the stack decision alone.
