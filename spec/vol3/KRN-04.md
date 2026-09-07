# KRN-04 · Entity & Metadata Engine

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:**
KRN-01 (tenant/legal-entity scoping for the universal `tenant_id`/`entity_id`
fields carried by every definition record); otherwise foundational — every
other kernel and application module depends on KRN-04, not the reverse.

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-04)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

The registry of every entity, field, relationship and validation in the
system. This is the literal mechanism behind T1 (metadata-driven, not
hand-coded) and T2 (everything resolves to a primitive): no entity can be
created in this platform without declaring which of `P-01`..`P-12` (Vol 0 §6)
it specialises, and no field exists outside a schema this engine knows about.
KRN-04 is also the mechanism behind Vol 0 §34's upgrade-safety guarantee —
strict `sys`/`tnt` namespace separation (T13) is enforced here, at the
engine, not left to convention (KRN-04-DR-001).

Not bought directly — it is the `included` platform substrate every module,
screen (KRN-13), report (STU-04) and API response depends on (Vol 0 §11). No
persona uses KRN-04 as a destination in itself; it is consumed indirectly by
every persona through the screens KRN-13 renders from what KRN-04 describes,
and directly by the small set of personas who extend or inspect the schema.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Extends `sys` entities with `tnt` fields, creates tenant-authored entities via STU-01, reviews upgrade diffs before accepting a platform release |
| PR-28 Implementation Partner | Authors `tnt` entities and fields during tenant provisioning (COM-06) and in VDL manifests (STU-08), scoped to the tenant/manifest being built |
| PR-01 Owner / Director | Reads the entity/field catalogue only incidentally, through Studio's summary of "what was added for you"; approves nothing at this layer directly (approval, where required, is a KRN-05 process on top of a Studio change request) |
| PR-02 Functional Head (CXO) | Requests a new field or entity via STU-01 in natural language; does not touch KRN-04's API directly |

Every other persona in the system consumes KRN-04 indirectly and constantly:
every screen they see is KRN-13-rendered from an `entity_definition` and its
`field_definition`s, every report is built against the same catalogue
(STU-04), and every permission check (KRN-03) resolves field sensitivity
(`is_sensitive`) declared here. No engineering role external to Studio
authors metadata by hand — that would violate L6.

## 3. Scope in / scope out

**In scope:** entity and field definition (types, defaults, validation,
uniqueness); relationships between entities within a module; computed
fields; declared extension points and their bounded constraints; schema
versioning, diffing and promotion; strict `sys`/`tnt` namespace enforcement
and the JSONB `ext` representation of `tnt` fields (Vol 2 §1.1); field
deprecation with mandatory sunset and migration path (L12).

**Out of scope:** rendering a screen, menu or dashboard from this metadata
(KRN-13 — Layout & Navigation Engine); the natural-language authoring
experience itself (STU-01 App Builder, STU-03 Form & View Designer — KRN-04
is the API they call, not the UI they present); evaluating a condition
expression's own grammar (KRN-07 Rules Engine owns the expression language;
KRN-04's `validation_rule` and `computed_field` records reference it,
they do not reimplement it); enforcing who may read or write a record once
its schema is defined (KRN-03 Access Control — KRN-04 declares
`is_sensitive`, KRN-03 enforces masking); defining a record's lifecycle
states and transitions (KRN-05 Process Engine — `entity_definition` may
*reference* a `state_machine_id`, it does not define one); the actual
business data stored under a schema (owned by each module per L3, not by
KRN-04, which stores only the description of that data); event schema
versioning for the event bus itself (KRN-06 owns `event_schema` — KRN-04's
`schema_version` versions entity/field metadata, a related but distinct
concern); sandbox/promotion tooling and its approval workflow (STU-10 —
KRN-04 produces the diff STU-10 rehearses and promotes, it does not run the
pipeline).

## 4. Entities owned; entities consumed

**Owned:** `entity_definition`, `field_definition`, `relationship_definition`,
`validation_rule`, `computed_field`, `schema_version`, `extension_point`.

**Consumed (by ID):** `P-01`..`P-12` — every `entity_definition` must declare
exactly one (KRN-04-FR-001); this is a referential requirement, not a data
dependency, since the primitives are a fixed catalogue in Vol 0 §6 rather
than records another module writes. `STU-10` (Sandbox & Change Control) is
the consumer, not a dependency, of the diff KRN-04 produces (KRN-04-DR-002) —
cited here because the acceptance criteria in §16 assume it exists;
KRN-04 does not call STU-10, STU-10 calls KRN-04's `/diff` endpoint.

### 4.1 Field-level detail

Universal fields (Vol 2 §1.2 — `id`, `tenant_id`, `namespace`, `ext`,
`created_at/by`, `updated_at/by`, `version`, `deleted_at/by`, `source`,
`trace_id`) apply to every entity below and are not repeated per field
table. **`tenant_id` is never null, including on `namespace: sys`
records** (D-34, extending D-18's identical choice for KRN-12): every
`sys` definition is physically replicated per tenant, each tenant holding
its own real row seeded identically at provisioning and updated by
platform-release fan-out — not one shared platform-wide row. `code`
(scoped to `(tenant_id, namespace, owning_module)` for `entity_definition`,
and the equivalent per-parent-entity scoping for `field_definition` etc.)
is the stable identity a `sys` record is "the same definition" by *across*
tenants; a record's own `id` is specific to that tenant's physical copy
and is never shared or compared across tenants. Fan-out to every tenant is
platform-release-pipeline orchestration external to KRN-04 (see D-34) —
every write below takes `tenant_id` as an explicit input, exactly like
every KRN-01/KRN-02 write does, never derived by KRN-04 reading another
module's table (L3).

**`entity_definition`** (Vol 1 §KRN-04, verbatim, plus a `status` field —
extrapolated, flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `code` | string | Unique within `(tenant_id, namespace, owning_module)` (D-34: `sys` rows are per-tenant physical copies, so uniqueness is scoped per tenant like every other record); immutable once `status` leaves `draft` |
| `namespace` | enum | `sys` \| `tnt` |
| `primitive_id` | ref | `P-01`..`P-12` — **mandatory** (KRN-04-FR-001), enforcing T2 |
| `owning_module` | ref | Module ID this entity belongs to (L3 boundary — no other module's code may read/write its tables directly) |
| `label_key` | string | Localisation key (KRN-19); never a hard-coded label (L6) |
| `is_document` | boolean | True when this entity specialises `P-05 Document` and therefore carries the Document universal fields (Vol 2 §P-05: `document_number`, `process_id`, `statutory`, etc.) |
| `state_machine_id` | ref, nullable | The `KRN-05 process_definition` governing this entity's lifecycle, when it has one — this is how `P-07 Process` composes with any other primitive |
| `semantic_index_policy` | enum | Governs whether and how records feed `KRN-14 Search & Semantic Index` |
| `offline_profile` | enum | `full` \| `read` \| `online` (Vol 0 §9.2) — the contract KRN-16 enforces at sync time |
| `schema_version_id` | ref, nullable | The `schema_version` this definition currently belongs to — renamed from Vol 1's literal `version` during implementation (found while writing the Zod contract): a bare `version` field here would collide with the universal `version` field (Vol 2 §1.2's per-row optimistic-lock counter), which every entity already carries via the universal fields and which means something different. Flagged inline per Vol 6 §4/L13 rather than silently guessing which meaning callers wanted |
| `deprecated_at`, `sunset_at` | timestamptz nullable, date nullable | **Added during implementation** — §5's state machine already required these ("`active → deprecated` requires `sunset_at` to be set in the same write"), but this table never declared them; the original field list simply omitted the fields its own state-machine section assumed. Mirrors `field_definition`'s identical two-field shape below: `sunset_at` is required whenever `deprecated_at` is set (KRN-04-FR-003 at entity granularity) |
| `status` | enum | Extrapolated — see §5 and §17.2 |

**`field_definition`** (Vol 1 §KRN-04, verbatim):

| Field | Type | Notes |
|---|---|---|
| `entity_id` | ref | Parent `entity_definition` |
| `code` | string | Unique within the parent entity |
| `namespace` | enum | `sys` \| `tnt` |
| `data_type` | string | e.g. `string`, `text`, `integer`, `decimal`, `boolean`, `date`, `timestamptz`, `enum`, `ref`, `money`, `quantity`, `json` — extended set is manifest-declarable |
| `is_required` | boolean | |
| `default` | any | Type-matched |
| `validation` | object | Inline expression, or a reference to a `validation_rule` record |
| `is_indexed` | boolean | A `tnt` field is indexed only where declared, keeping the JSONB `ext` column bounded (Vol 2 §1.1) |
| `is_sensitive` | boolean | Declares the field for masking; `KRN-03` reads this to enforce field-level policy — KRN-04 never enforces access itself (L11 stays with KRN-03) |
| `semantic_role` | enum | `identifier` \| `meaningful` \| `excluded` — governs `KRN-14` indexing weight |
| `deprecated_at` | timestamptz, nullable | |
| `sunset_at` | date, nullable | Required whenever `deprecated_at` is set (KRN-04-FR-003) |

**`relationship_definition`** (extrapolated from KRN-04-FR-006 — an addition
beyond Vol 1's literal text; not field-detailed in Vol 1, flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `entity_id` | ref | Owning (source) entity |
| `target_entity_id` | ref | Must share `owning_module` with `entity_id` (KRN-04-FR-006) — a cross-module relationship is not representable here at all (Vol 2 §1.3: cross-module references are by ID only, integrity enforced by contract tests) |
| `code`, `name` | string | |
| `cardinality` | enum | `one_to_one` \| `one_to_many` \| `many_to_many` |
| `cascade_behaviour` | enum | `restrict` \| `cascade_soft_delete` \| `set_null` |
| `namespace` | enum | `sys` \| `tnt` |

**`validation_rule`** (extrapolated; not field-detailed in Vol 1, flagged in
§17):

| Field | Type | Notes |
|---|---|---|
| `entity_id` | ref | Scope of the rule |
| `field_id` | ref, nullable | Null when the rule is cross-field/entity-level |
| `expression` | string | Declarative condition (KRN-07 grammar), evaluated identically in API, UI, import and export (KRN-04-FR-004's consistency guarantee, applied here to validation) |
| `error_message_key` | string | Localisation key (KRN-19) |
| `severity` | enum | `block` \| `warn` |
| `namespace` | enum | `sys` \| `tnt` |

**`computed_field`** (Vol 1 names the requirement, not the field table;
extrapolated, flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `field_id` | ref | The `field_definition` this computation backs |
| `expression` | string | Declarative (KRN-04-FR-004); never opaque model behaviour |
| `recompute_policy` | enum | `on_write` \| `on_read` \| `scheduled` (via `KRN-15`) |
| `depends_on` | list<ref> | Fields/relationships the expression reads — used to order recomputation and to detect circular dependencies |

**`schema_version`** (extrapolated; not field-detailed in Vol 1, flagged in
§17):

| Field | Type | Notes |
|---|---|---|
| `version_no` | integer | Monotonic within its scope (per tenant) |
| `release_id` | uuid, nullable | **D-34.** Set only for `namespace: sys` versions — shared across every tenant's own physical copy of "the same platform release," correlating them for reporting/audit. `null` for a `tnt` version (a tenant's own metadata change has no cross-tenant counterpart to correlate with). Never used as a lifecycle gate — each tenant's copy progresses independently (see §5) |
| `status` | enum | Extrapolated — see §5 and §17.3 |
| `diff` | JSONB | Machine-readable added/changed/deprecated entities and fields, referenced by `code` path (D-34 — stable across tenants), not by internal `id` (KRN-04-DR-002, and KRN-04-DR-003 below) |
| `rehearsed_against` | ref, nullable | The shadow tenant used for STU-10's rehearsal |
| `promoted_at` | timestamptz, nullable | |
| `promoted_by` | actor ref, nullable | |

**`extension_point`** (Vol 1 names the requirement, not the field table;
extrapolated, flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `entity_id` | ref | The `sys` entity this extension point is declared on |
| `code` | string | e.g. `before_save`, `computed_slot_1`, `custom_state_set` |
| `kind` | enum | `hook_before` \| `hook_after` \| `computed_slot` \| `custom_state` \| `custom_field_group` |
| `constraints` | JSONB | e.g. the bounded transition set a `custom_state` extension must fit within (mirrors KRN-05-FR-005) |

## 5. State machines

**`entity_definition.status`** (extrapolated — Vol 1 states only that fields
carry `deprecated_at`/`sunset_at`; this draft lifts the same discipline to
the entity itself and is flagged in §17.2): `draft → active → deprecated →
retired`. `active → deprecated` requires `sunset_at` to be set in the same
write (mirroring KRN-04-FR-003 at entity granularity). `retired` is terminal
and reachable only after `sunset_at` has passed with no live records
referencing the entity — consistent with L12's spirit that nothing a tenant
may reference disappears without a sunset and a migration path.

**`field_definition`** deprecation: `active → deprecated → retired`. A field
never has a `draft` state of its own — it is added directly to whatever
state its parent `entity_definition` is in. `deprecated` requires `sunset_at`
(KRN-04-FR-003, verbatim rule). A deprecated field continues to resolve on
every surface — API, reports, exports, the semantic index — until
`sunset_at`, after which it becomes `retired`: resolvable for historical
reads, rejected for new writes, never hard-deleted (L12).

**`schema_version.status`** (extrapolated, flagged in §17.3): `draft →
validated → rehearsed → promoted`, with `promoted → superseded` when a later
version is promoted over it, and a rollback path `promoted → rolled_back`
that restores the immediately prior `promoted` version — this is what makes
KRN-04-DR-002's "reversible" concrete rather than aspirational. A version
cannot reach `promoted` without first reaching `rehearsed` (the STU-10
shadow-tenant diff step); the engine enforces this ordering itself, the same
enforcement stance KRN-04-DR-001 takes toward namespace separation.
**Per D-34, this state machine is evaluated independently per tenant's own
physical copy of a `schema_version` row** — for a `sys` release fanned out
across every tenant (sharing one `release_id`), one tenant reaching
`promoted` never gates or is gated by another's; a tenant unreachable
during fan-out simply catches up on the next attempt, mirroring
`KRN-12-DR-003`'s identical guarantee for reference-data sync.

## 6. Standard functional requirements

- `KRN-04-FR-001` Every entity declares a primitive. An entity without one cannot be created. *(Vol 1, verbatim)*
- `KRN-04-FR-002` `tnt` fields are stored in the `ext` JSONB column with declared type and validation, indexed only where declared. *(Vol 1, verbatim)*
- `KRN-04-FR-003` Field deprecation requires a sunset date and a migration path; removal without one is rejected (L12). *(Vol 1, verbatim)*
- `KRN-04-FR-004` Computed fields are declarative expressions evaluated consistently in API, reports, exports and the semantic index. *(Vol 1, verbatim)*
- `KRN-04-FR-005` Extension points are declared per entity; extension attempted anywhere else is blocked, not merely discouraged. *(Vol 1, verbatim)*
- `KRN-04-FR-006` **Addition, not in Vol 1.** Relationship definitions declare cardinality and cascade behaviour and are scoped strictly within one `owning_module` — a `relationship_definition` may never target another module's entity, since cross-module integrity is a contract-test concern, not an engine-enforced foreign key (Vol 2 §1.3).

## 7. Differentiating requirements

- `KRN-04-DR-001` `sys` and `tnt` namespaces are strictly separated. The platform never writes `tnt`; a tenant never modifies `sys`. Enforced at the engine, not by convention. *(Vol 1, verbatim)*
- `KRN-04-DR-002` A metadata change is versioned, diffable and reversible, and can be rehearsed against a shadow tenant before promotion (STU-10). *(Vol 1, verbatim)*
- `KRN-04-DR-003` **Addition, not in Vol 1.** The diff produced for a `schema_version` is machine-readable (added/changed/deprecated entities and fields, structured, not prose) via the `/diff` API — this is the literal artefact STU-10's promotion pipeline and upgrade-rehearsal reporting (Vol 0 §34) consume, not a document a human compiles by hand.

## 8. Agents

None. KRN-04 is structural/registry data with no autonomous behaviour of its
own — it is the substrate tenant-authored agents (`STU-07`) and every module
agent (`SLS-AG-*`, `MFG-AG-*`, etc., Vol 0 §27.4) act *through*, by reading
and writing entities this engine describes, but KRN-04 registers no agent
of its own.

## 9. Screens and flows

KRN-04 exposes no hand-built screen (L6). Its own administrative surfaces are
themselves KRN-13-generated views over KRN-04's own `entity_definition`,
`field_definition` and `schema_version` records — the engine describes
itself. This is not circular at runtime: KRN-04's own `sys` definitions for
`entity_definition`, `field_definition`, etc. are seeded at platform
bootstrap, before any tenant or Studio session exists.

- **Entity catalogue** (list, filterable by `namespace`, `owning_module`,
  `primitive_id`) — PR-21, PR-28 read-only inspector; the actual
  create/extend flow for `tnt` entities happens through STU-01 (App Builder),
  not this screen.
- **Field inspector** (detail view under an entity) — PR-21, PR-28
  read-only; edits route through STU-01/STU-03.
- **Schema version & diff viewer** — PR-21: reviews an upgrade diff before
  accepting it; embeds inside STU-10's promotion screen rather than
  standing alone.
- **Extension point browser** — PR-28: what a manifest may legally extend on
  a given `sys` entity, consulted while authoring a VDL pack (STU-08).

## 10. API surface

Base per Vol 0 §42: `/api/v1/metadata/{entity}`.

| Method | Path | Notes |
|---|---|---|
| CRUD | `/api/v1/metadata/entities` | `sys` writes restricted to the platform release pipeline service account, never end-user- or tenant-admin-callable (mirrors KRN-01's `tenant.create` restriction pattern); `tnt` writes scoped to the authoring tenant, called by STU-01/STU-03 on the user's behalf |
| CRUD | `/api/v1/metadata/fields` | Same namespace restriction as above; `data_type`, `primitive_id`-derived constraints are immutable once the field leaves `draft` |
| CRUD | `/api/v1/metadata/relationships` | Rejects any `target_entity_id` outside the caller's `owning_module` (KRN-04-FR-006) |
| CRUD | `/api/v1/metadata/validations` | |
| CRUD | `/api/v1/metadata/computed-fields` | |
| CRUD | `/api/v1/metadata/extension-points` | `sys`-writable only — a tenant cannot declare where it may extend a platform entity, only use what is declared (KRN-04-FR-005) |
| GET/POST | `/api/v1/metadata/schema-versions` | POST creates a `draft` version, always tenant-scoped (D-34) — for a `sys` release, the platform release pipeline calls this once per tenant, passing the same `release_id` each time to correlate the copies; further lifecycle moves are explicit sub-actions below |
| POST | `/api/v1/metadata/schema-versions/{id}/validate` | `draft → validated`, one tenant's copy |
| POST | `/api/v1/metadata/schema-versions/{id}/rehearse` | `validated → rehearsed`; invokes STU-10's shadow-tenant apply; one tenant's copy |
| POST | `/api/v1/metadata/schema-versions/{id}/promote` | `rehearsed → promoted`; rejected if not rehearsed; one tenant's copy — KRN-04 never iterates "every tenant" itself (D-34; L3), the caller (platform release pipeline) invokes this once per tenant |
| POST | `/api/v1/metadata/schema-versions/{id}/rollback` | `promoted → rolled_back`, restoring the prior promoted version; one tenant's copy |
| GET | `/api/v1/metadata/diff` | `{from_version, to_version}` → structured diff (KRN-04-DR-003), referencing entities/fields by `code` path (D-34 — stable across a `sys` release's per-tenant copies, unlike internal `id`) |

All list endpoints: cursor pagination, declared filters, field selection
(Vol 1 §1.2). All writes: idempotency key required.

## 11. Permission matrix by persona

Actions: `entity.read`, `entity.create_tnt`/`update_tnt`,
`field.create_tnt`/`update_tnt`, `sys.write` (platform release pipeline
only — no human role holds this), `schema_version.promote`,
`schema_version.rollback`, `diff.read`.

| Persona | entity.read | entity/field.*_tnt | sys.write | schema_version.promote | schema_version.rollback | diff.read |
|---|---|---|---|---|---|---|
| PR-21 System Admin | ✓ | ✓ (own tenant) | ✗ | ✓ (own tenant `tnt` versions; `sys` promotion is platform-only) | ✓ (own tenant) | ✓ |
| PR-28 Implementation Partner | ✓ (own tenant, provisioning window) | ✓ (own tenant, provisioning window) | ✗ | ✗ | ✗ | ✓ (own tenant) |
| PR-01 Owner | ✓ (summary view only) | ✗ | ✗ | ✗ | ✗ | ✓ (own tenant, summary) |
| PR-02 Functional Head | ✓ (own function's entities) | ✗ (proposes via STU-01, does not call the API directly) | ✗ | ✗ | ✗ | ✗ |
| All other internal personas | ✓ (implicitly, resolved through KRN-13-rendered screens — not a direct API grant) | ✗ | ✗ | ✗ | ✗ | ✗ |
| Platform release pipeline (service account, `PR-30`) | ✓ | ✗ | ✓ | ✓ (`sys` versions) | ✓ (`sys` versions) | ✓ |

**Negative cases:**
- Any human role, including PR-21, attempting `sys.write` directly → 403,
  regardless of tenant-admin status, since no human role holds this grant at
  all — only the platform release pipeline service account does (KRN-04-DR-001).
- PR-21 attempting to change a `sys` field's `data_type` on a published,
  non-draft field → 403 — this would break every tenant's `tnt` extensions
  and reports built against it (Vol 0 §34 upgrade rule: add, never mutate a
  referenceable shape).
- PR-28 attempting any metadata write outside the provisioning window (after
  the tenant leaves `trial`/pre-`active`, mirroring KRN-01's equivalent
  negative case) → 403.
- A `relationship_definition` write naming a `target_entity_id` outside the
  caller's `owning_module` → rejected at the engine (KRN-04-FR-006), not
  merely discouraged in review.
- `schema_version.promote` attempted on a version whose `status` is not
  `rehearsed` → rejected, regardless of caller's role.

## 12. Events emitted / consumed

**Emitted** (Vol 1, verbatim, plus additions):
- `metadata.entity.created`
- `metadata.entity.deprecated`
- `metadata.field.added`
- `metadata.field.deprecated`
- `metadata.schema.version_promoted`
- `metadata.field.updated` *(addition, not in Vol 1 — needed since
  `field_definition` supports non-breaking updates such as `validation` or
  `default` changes that are not deprecation, and L4 requires every mutation
  to emit an event)*
- `metadata.schema.version_rolled_back` *(addition, not in Vol 1 — the event
  counterpart of KRN-04-DR-002's "reversible" and the `rollback` API action
  in §10)*
- `metadata.relationship.created`, `metadata.validation_rule.created`,
  `metadata.computed_field.created`, `metadata.extension_point.created`
  *(added during implementation — Vol 1's event list, and this draft's own
  first pass at it, named events for only 3 of the 7 owned entities'
  mutations; L4 ("never emit a state change without an event") applies to
  every owned entity's create, not only the ones Vol 1 happened to name.
  These four close that gap the same way `metadata.field.updated` and
  `metadata.schema.version_rolled_back` already did above)*
- `metadata.entity.activated`, `metadata.entity.retired`,
  `metadata.field.retired`, `metadata.schema.version_validated`,
  `metadata.schema.version_rehearsed`, `metadata.schema.version_superseded`
  *(added during implementation — a second pass over §5's state machines
  found five more state transitions with no corresponding event:
  `entity_definition`'s `draft→active` and `deprecated→retired`,
  `field_definition`'s `deprecated→retired`, and `schema_version`'s
  `draft→validated`, `validated→rehearsed`, and the `promoted→superseded`
  side-effect a new promotion causes on the version it replaces. L4 is
  unconditional — it does not exempt a transition just because Vol 1 never
  named an event for it. `schema_version`'s `superseded→promoted` path
  (the version a `rollback` restores) reuses the existing
  `metadata.schema.version_promoted` event rather than inventing a new
  one, since restoring a version to `promoted` is, semantically, a
  promotion of that version — consistent with KRN-02's `revokeDevice`
  precedent of emitting one event per affected row for a cascading
  mutation, not inventing a new event name for every distinct trigger)*

Every event above carries a real `tenant_id` and is emitted per tenant
(D-34) — for a `sys` release fanned out across every tenant, one
`metadata.schema.version_promoted` event is emitted per tenant's own copy
reaching `promoted`, each carrying that release's shared `release_id` in
its payload for correlation, mirroring `KRN-12-DR-001`'s identical
per-tenant `masters.reference_data.sync_completed` pattern rather than one
platform-wide event.

**Consumed:** none. KRN-04 is foundational (Layer 0) and initiates schema
state rather than reacting to other modules' events. It *receives* writes
synchronously via direct API call from STU-01, STU-03 and STU-08 (not event
subscription — a metadata write must be validated and reflected before the
caller's next request can rely on it, the same synchronous-call pattern
KRN-01 uses for COM-04 provisioning).

## 13. Reports and KPIs

- Entity/field count by namespace (`sys` vs `tnt`) per tenant — platform-
  internal, product/ops visibility into customisation depth.
- Fields approaching `sunset_at` — a compliance-style worklist for PR-21,
  surfaced before a deprecated field becomes unresolvable.
- Schema version promotion history and diff size per release — platform-
  internal, feeds the upgrade-risk conversation ahead of a release.
- Extension point utilisation — how many tenants have used each declared
  extension point, informing which extension points the platform should
  widen versus which are dead weight (Vol 0 R-04 mitigation).

No statutory reports originate in KRN-04 (statutory filings are CMP-05).

## 14. Compliance touchpoints

- Namespace separation (KRN-04-DR-001) is the concrete enforcement mechanism
  behind L1, L10 and Vol 0 §34's upgrade-safety guarantee — every other
  compliance and audit statement about "customisation without forking" rests
  on this engine, not on process discipline.
- `field_definition.is_sensitive` is the flag `KRN-03` reads to apply
  field-level masking on salary, cost and margin fields — KRN-04 declares
  sensitivity, it computes no access decision itself (L11 stays with KRN-03).
- `schema_version`'s versioned/diffable/reversible/rehearsed record
  (KRN-04-DR-002/DR-003) is the change-control evidence `CMP-06` (Regulated
  Records) requires for a validated tenant's metadata history — KRN-04
  produces the evidence, CMP-06 governs its retention policy for regulated
  verticals.
- KRN-04 computes no tax, e-invoicing, e-way bill or TDS logic itself (L7 is
  not implicated directly), but it is the engine that lets `hsn_sac` and
  `TaxContext` (Vol 2 §1.4) exist as typed, validated fields on every
  document-producing entity — the plumbing CMP-01 relies on being correctly
  typed, not the tax logic itself.

## 15. Offline behaviour

**Profile: `online`** for KRN-04's own authoring and administrative surface —
entity, field and schema-version definitions are platform/tenant
configuration, not field-capture data; none of the offline-first personas
(PR-04/05/07/09/13/19/20, Vol 0 §7.3) author metadata directly.

KRN-04's *read* API is, however, the source every offline-capable module's
client caches locally (via `KRN-16`) to render forms and screens with no
connectivity. This creates no conflict-policy obligation for KRN-04 itself:
metadata reads are versioned and effectively immutable once `promoted` — a
device simply holds a cached `schema_version` until its next successful
sync, at which point a newer promoted version supersedes it. There is no
concurrent-write case to resolve, because no offline-first persona writes
metadata.

## 16. Acceptance criteria (Given/When/Then)

**KRN-04-FR-001 — every entity declares a primitive**
> Given a tenant author attempting to create a `tnt` entity via STU-01 with no `primitive_id` supplied
> When the create request reaches KRN-04
> Then the write is rejected with a stable machine error code, no `entity_definition` row is created, and no `metadata.entity.created` event is emitted.

**KRN-04-FR-002 — `tnt` fields live in `ext` with declared type/validation**
> Given a `tnt` field `warranty_months` declared on a `sys` entity `item` with `data_type: integer` and `is_indexed: true`
> When a record of that entity is created with `ext.warranty_months = 24`
> Then the value is stored in the `ext` JSONB column, is queryable via an index because indexing was declared, and a record with `ext.warranty_months = "twenty-four"` (wrong type) is rejected at write time.

**KRN-04-FR-003 — field deprecation requires sunset and migration path**
> Given a `sys` field `legacy_tax_code` with no `sunset_at`
> When a platform release attempts to deprecate it without supplying `sunset_at` and a migration path
> Then the deprecation is rejected; the field remains `active`; when the same request supplies both, `field_definition.status` moves to `deprecated`, `sunset_at` is recorded, and the field continues to resolve in API, reports, exports and the semantic index until that date.

**KRN-04-FR-004 — computed fields evaluate consistently everywhere**
> Given a computed field `margin_pct` with expression `(sale_price - cost) / sale_price`
> When the same underlying record is read via the REST API, included in a STU-04 report, exported to CSV, and surfaced in the KRN-14 semantic index
> Then all four surfaces return an identical computed value for the same record at the same point in time.

**KRN-04-FR-005 — extension attempted outside a declared point is blocked**
> Given a `sys` entity `sales_order` with one declared extension point `computed_slot_1`
> When a tenant attempts, via STU-01, to add a `before_save` hook that is not declared on `sales_order`
> Then the request is rejected at the engine with a stable machine error code, not merely flagged for review, and no `extension_point` usage is recorded.

**KRN-04-FR-006 — relationship definitions are module-scoped (addition)**
> Given `entity_id` belonging to `owning_module: SCM-02` and a candidate `target_entity_id` belonging to `owning_module: FIN-01`
> When a `relationship_definition` is submitted naming that pair
> Then the write is rejected at the engine (not merely at contract-test time), since KRN-04-FR-006 permits relationships only within one `owning_module`.

**KRN-04-DR-001 — namespace separation enforced at the engine**
> Given a tenant with 14 `tnt` fields and 2 `tnt` entities added under `sys` entity `item`
> When a platform upgrade adds 3 `sys` fields and deprecates 1, and separately a tenant admin attempts to edit a `sys` field's `data_type` directly
> Then the platform upgrade succeeds and all 14 `tnt` fields and both `tnt` entities remain functional, while the tenant admin's attempted `sys` edit is rejected regardless of role — the boundary is enforced by the engine, not by permission configuration alone.

**KRN-04-DR-002 — metadata change is versioned, diffable, reversible, rehearsed**
> Given tenant `T-acme`'s own physical copy of `schema_version` `V12` (`release_id: R-2026-09`, D-34) is in `status: rehearsed` against shadow tenant `T-shadow`, and tenant `T-globex`'s copy of the same `release_id` is still `validated`
> When `T-acme`'s `V12` is promoted
> Then `T-acme`'s copy's `status` moves to `promoted`, its previous version moves to `superseded`, a `metadata.schema.version_promoted` event carrying `release_id: R-2026-09` is emitted for `T-acme` alone, `T-globex`'s copy is untouched and continues toward `rehearsed` independently, and a subsequent `rollback` call on `T-acme`'s copy restores its prior version's `status` to `promoted` and its `V12` copy to `rolled_back`, with `metadata.schema.version_rolled_back` emitted for `T-acme` alone.

**KRN-04-DR-003 — diff is machine-readable (addition)**
> Given tenant `T-acme`'s copy of `schema_version` `V12` differs from its `V11` by 3 added `sys` fields and 1 deprecated `sys` field
> When STU-10 calls `GET /api/v1/metadata/diff?from_version=V11&to_version=V12` scoped to `T-acme`
> Then the response is a structured JSON object enumerating exactly those 4 changes by entity and field `code` (D-34 — not internal `id`, which is specific to `T-acme`'s own physical copy and not meaningful to compare across tenants), and STU-10's promotion screen renders it without any additional interpretation step.

## 17. Open questions

Flagged per Vol 6 §4/L13 — these are gaps in Vol 1's field-level detail that
this draft filled by reasonable extrapolation from the stated purpose and
requirements. Items 1-6 below were Tier-2 routine drafting gaps, bulk-
approved per D-31 (see `/spec/decisions-taken.md`) — this file is
APPROVED per `/spec/state.md`. **Not covered by that bulk approval:** this
draft's §4.1 originally stated `tenant_id` is null for `sys` records,
which directly contradicted D-18 (decided after this file's first draft,
never revisited here) and the shared `UniversalFieldsSchema` contract.
That was a genuine spec/spec inconsistency, not a Tier-2 gap, put to the
human separately and resolved as D-34 — `sys` metadata is now physically
replicated per tenant, exactly like D-18's KRN-12 model. §4.1, §5, §10,
§12 and the DR-002/DR-003 acceptance criteria above already reflect D-34.

1. **Field tables for `relationship_definition`, `validation_rule`,
   `computed_field`, `schema_version` and `extension_point`** (§4.1) are not
   given at field level in Vol 1 — only their existence and, for some, the
   requirement they satisfy are stated. The fields proposed here are a
   reasonable minimum consistent with KRN-04-FR-004/FR-005/FR-006 and
   KRN-04-DR-002/DR-003, not a verbatim source. Please confirm or amend.
2. **`entity_definition.status` lifecycle** (§5) is invented — Vol 1 only
   states that *fields* carry `deprecated_at`/`sunset_at`; this draft lifts
   the same discipline to the entity level (`draft → active → deprecated →
   retired`). Confirm entities need their own lifecycle distinct from their
   fields', or whether an entity is simply "deprecated" the moment all its
   fields are.
3. **`schema_version.status` lifecycle** (§5) — the five-state chain
   `draft → validated → rehearsed → promoted → (superseded | rolled_back)`
   is this draft's proposal for making KRN-04-DR-002's "versioned, diffable,
   reversible, rehearsed" concrete. Vol 1 does not specify the states by
   name. Confirm this shape, in particular whether `rollback` should be
   available indefinitely or only within a bounded window after promotion.
4. **`KRN-04-FR-006`** (relationship cardinality/cascade behaviour,
   module-scoped) is an addition beyond Vol 1's literal FR list, inferred
   from the fact that `relationship_definition` is a named owned entity with
   no corresponding requirement text in Vol 1. Confirm the cascade options
   proposed (`restrict` / `cascade_soft_delete` / `set_null`) are the
   intended set, and that cross-module relationships are correctly
   disallowed outright rather than merely unenforced.
5. **`KRN-04-DR-003`** (machine-readable diff as STU-10's literal input) is
   an addition beyond Vol 1's literal DR-002 text, which only says a change
   is "diffable." Confirm this is the intended division of labour between
   KRN-04 (produces the diff) and STU-10 (consumes it for the promotion UI
   and pipeline), since STU-10's own Vol 3 file has not yet been drafted.
6. **Boundary with KRN-13 for layout metadata.** `entity_definition` as
   specified here carries no layout/view configuration field (default list
   columns, form sections, etc.) — this draft assumes that lives entirely in
   KRN-13's own entities, with KRN-13 referencing `entity_id`/`field_id`
   from KRN-04 rather than KRN-04 carrying any presentation concern.
   Confirm this split before KRN-13's Vol 3 file is drafted, so the two
   modules do not each assume the other owns default-view configuration.
