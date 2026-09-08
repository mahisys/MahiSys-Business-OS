# KRN-03 · Access Control

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-01 (org-unit/entity scope) · KRN-02 (identity — the subject of every grant) · KRN-04 (entity/field registry — the target of every grant and policy)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-03)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

Role-based and attribute-based authorisation, enforced down to the field
and the row, applied identically to humans, agents and integrations. Where
KRN-02 answers "who is making this request", KRN-03 answers "what may that
identity see or do" — and it answers that question at exactly one place in
the stack (the data-access layer, KRN-03-FR-005), so that every consumer of
data — screens, the API, exports, the Copilot, the semantic graph, agent
queries, scheduled reports — is provably subject to the same answer. This
is the literal mechanism behind L11: no query executes without tenant, role
and row scope applied, with no exceptions carved out for convenience.

Not bought directly — `included` platform-fee substrate, structurally
inseparable from the kernel (Vol 0 §33.2: unbundling KRN-03 would mean
every module reimplementing permissions, collapsing the one-brain claim).
The direct "user" of its admin surface is PR-21 (System Administrator); the
direct beneficiaries of its guarantees are every other module and every
other persona, most concretely PR-25 (External CA/Auditor) and PR-26
(Regulator), whose entire persona definition — "scoped, read-mostly" /
"scoped, read-only" (Vol 0 §7.2) — exists only because KRN-03 can express
and enforce exactly that shape.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Defines roles, permission sets, data scope rules and field policies; grants and revokes `permission_grant`s; is the only persona with unrestricted write access to this module's own entities |
| PR-01 Owner / Director | Approves the highest-privilege grants (e.g. financial `post`/`reverse` actions) where delegated by KRN-05's approval matrix; opens the "what can this agent see" viewer (KRN-03-DR-002) before approving a Trust Ladder promotion in INT-04 |
| PR-16 Finance Controller / CFO | Defines `field_policy` for salary, cost and margin fields (KRN-03-FR-003); approves finance-team delegation during absence |
| PR-17 HR Manager | Defines `field_policy` alongside CFO for PII and salary-adjacent fields owned by PPL modules; manages delegation for HR approvals during leave |
| PR-02 Functional Head (CXO) | Proposes org-unit-scoped role assignments for their team via KRN-05; initiates delegation to a peer while travelling |
| PR-25 External CA/Auditor, PR-26 Regulator | The concrete proof of `data_scope_rule` + `field_policy` working together: their entire access is a standing, narrow, read-only scope, never hand-adjusted per query |
| PR-28 Implementation Partner | Configures role/scope templates during onboarding (VDL manifest via STU-08 tooling; KRN-03 stores the resulting `role`/`permission_set` records), scoped to the provisioning window |
| PR-29 Agent | A permission *subject*, never an actor on KRN-03's own entities — every agent execution resolves an effective permission set exactly as a human does (KRN-03-DR-002), and never grants, widens or reads anyone else's scope (L9) |
| Every other internal persona (PR-03..15, 18..20) | Self-service `delegation.create` bounded to a permission set they themselves hold, while everything else in this module is invisible to them |

## 3. Scope in / scope out

**In scope:** role and permission-set definition; `{entity, action, scope}`
permission grants; row-level data scope (own, org-unit, org-unit-and-below,
entity, tenant, rule-based); field-level policy (hidden, masked, read-only);
bounded, audited, self-expiring delegation; the single effective-permission
resolution path every consumer calls; enforcement at the data-access layer
rather than in application controllers.

**Out of scope:**
- **Who the actor is** (KRN-02) — KRN-03 references `user`/`agent_identity`/
  `service_account` by ID as the `subject` of a `permission_grant`; it does
  not authenticate anyone.
- **What entities and fields exist** (KRN-04, Entity & Metadata Engine) —
  `permission_set.grants[].entity_ref` and `field_policy.field_ref` point
  at `entity_definition`/`field_definition` records KRN-04 owns. This is
  the literal mechanism behind `KRN-03-DR-001`: because KRN-03 resolves
  against KRN-04's live registry rather than holding its own copy of "the
  list of entities," a Studio-generated `tnt` entity is automatically a
  valid target with no KRN-03 configuration step required for its mere
  existence to be governed (a *grant* still has to be authored for anyone
  to see it — see the default-deny behaviour in §16).
- **Approval routing mechanics** (KRN-05, Process Engine) — KRN-03 governs
  whether an actor is even eligible to hold the `approve` action on an
  entity; KRN-05 owns the approval matrix, sequencing and escalation that
  decides *whose* approval a given instance needs.
- **Agent trust ceiling — how autonomously a permitted action may be taken**
  (INT-04, Trust Ladder & Governance). This is deliberately a second,
  independent axis from KRN-03: a `permission_grant` answers "can this
  actor ever perform this action"; the trust ceiling answers "may it do so
  without a human in the loop, right now, for this tenant." Neither
  substitutes for the other — an agent can hold a full `create` grant on
  Purchase Orders and still be capped at L2 (Draft), meaning it prepares
  but never commits (see `KRN-03-FR-006` in §6). Vol 1 does not state this
  composition explicitly; flagged in §17.
- **Audit log storage** (KRN-10) — KRN-03 emits into it; it does not own
  retrieval or retention.
- **The semantic graph's own indexing and query mechanics** (INT-01) — L11
  requires INT-01 to call KRN-03 for every result; KRN-03 does not embed
  or traverse the graph itself.

## 4. Entities owned; entities consumed

**Owned:** `role`, `permission_set`, `permission_grant`, `data_scope_rule`,
`field_policy`, `delegation`.

**Consumed (by ID):** `KRN-02` `user`, `agent_identity`, `service_account`
(the `subject` of every `permission_grant` and `delegation`); `KRN-01`
`org_unit`, `legal_entity`, `tenant` (`data_scope_rule`'s org-unit and
org-unit-and-below scopes resolve against KRN-01's hierarchy — reusing the
ancestor-chain resolution KRN-01-FR-002 already establishes, not
reimplementing it); `KRN-04` `entity_definition`, `field_definition` (the
target of every grant and field policy, per §3 above).

**Note on primitives (L2).** None of this module's six owned entities is a
business object and none duplicates a primitive. `data_scope_rule`'s
`rule_based` scope type in particular is *not* a parallel rule engine: its
`expression` field reuses the same structured condition-tree shape as
`P-12 Rule.conditions` (Vol 2 §P-12), exactly as KRN-01's `legal_entity`
reuses `P-01 Party.tax_registrations`'s shape rather than inventing a
different one. `role`, `permission_set`, `permission_grant` and
`field_policy` are kernel access-control plumbing in the same sense that
KRN-01's `org_unit` and `cost_centre` are kernel structural plumbing — real
entities, but not primitives and not business objects a tenant transacts
against.

### 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every entity below and are not
repeated per field table. **Unlike KRN-01 and KRN-02, Vol 1's KRN-03
section gives no "key fields" subsection at all** — only the entities-owned
list and the requirement text. Every field table below is therefore this
draft's extrapolation from the FR text and from the field-shape patterns
established elsewhere in Vol 1/Vol 2, flagged collectively and prominently
in §17.

**`role`**:

| Field | Type | Notes |
|---|---|---|
| `code`, `name`, `description` | string | |
| `namespace` | enum | `sys` (platform-defined) \| `tnt` (tenant-defined) — per Vol 2 §1.1 |
| `is_assignable_to_agent` | boolean | Whether this role may be the target of a `permission_grant` whose subject is an `agent_identity` |
| `permission_set_ids` | list\<ref\> | **Added during implementation** — the original field table had no field connecting a `role` to any `permission_set` at all, even though §9 explicitly says the Roles screen lets PR-21 "define `sys`/`tnt` roles, attach `permission_set`s." Without this, a `permission_grant` whose `role_id` is set (no `permission_set_id`) would resolve to zero `{entity, action, scope}` grants — making `KRN-03-FR-001` unsatisfiable for role-based grants, the object-graph question §17 item 2 left open. This closes it: a `role`'s effective grants are the union of every attached `permission_set`'s `grants` |
| `status` | enum | `active` \| `deprecated` |

**`permission_set`**:

| Field | Type | Notes |
|---|---|---|
| `code`, `name` | string | |
| `namespace` | enum | `sys` \| `tnt` |
| `grants` | list | `{entity_ref: KRN-04 entity_definition id, action: create\|read\|update\|delete\|approve\|export\|post\|reverse, scope_rule_id: ref, nullable}` — the literal shape of `KRN-03-FR-001` |

**`permission_grant`**:

| Field | Type | Notes |
|---|---|---|
| `subject_type` | enum | `user` \| `agent_identity` \| `service_account` |
| `subject_id` | ref | Into the KRN-02 entity matching `subject_type` |
| `role_id` | ref, nullable | At least one of `role_id`/`permission_set_id` required |
| `permission_set_id` | ref, nullable | |
| `scope_override_id` | ref, nullable | Narrows (never widens) the role/permission-set's default scope for this specific grant instance |
| `granted_at`, `granted_by` | timestamptz, actor ref | |
| `expires_at` | timestamptz, nullable | |
| `status` | enum | `active` \| `revoked` \| `expired` |

**`data_scope_rule`** (`KRN-03-FR-002`, verbatim shape):

| Field | Type | Notes |
|---|---|---|
| `scope_type` | enum | `own` \| `org_unit` \| `org_unit_and_below` \| `entity` \| `tenant` \| `rule_based` |
| `org_unit_id` | ref, nullable | For `org_unit`/`org_unit_and_below` |
| `entity_scope_id` | ref, nullable | `KRN-01 legal_entity`, for the `entity` type |
| `expression` | JSONB | Structured condition tree, same shape as `P-12 Rule.conditions` — only for `rule_based` |
| `applies_to_entity_ref` | ref, nullable | `KRN-04 entity_definition`; generic scope types (e.g. `org_unit`) are reusable across entities, `rule_based` ones are typically entity-specific |

**`field_policy`** (`KRN-03-FR-003`, verbatim shape):

| Field | Type | Notes |
|---|---|---|
| `entity_ref`, `field_ref` | ref | Into `KRN-04 entity_definition`/`field_definition` |
| `role_id` | ref | Which role this policy applies to |
| `policy` | enum | `hidden` \| `masked` \| `read_only` |
| `mask_strategy` | enum, nullable | Proposed: `partial` \| `full` \| `computed_substitute` — only when `policy: masked`; not sourced, flagged in §17 |

**`delegation`** (`KRN-03-FR-004`, verbatim shape):

| Field | Type | Notes |
|---|---|---|
| `from_subject_id`, `to_subject_id` | ref, `KRN-02 user` | |
| `permission_set_id` | ref, nullable | The bounded set delegated; if null, the delegate temporarily exercises the delegator's own current effective scope (this draft's assumption — flagged in §17) |
| `period` | Period (Vol 2 §1.4) | `{from, to}` |
| `reason` | string | |
| `status` | enum | `pending` \| `active` \| `expired` \| `revoked` |

## 5. State machines

**`role.status`:** `active → deprecated`. `deprecated` is not deletion — a
deprecated `sys` role follows KRN-04-FR-003's sunset-and-migrate pattern
(L12); a deprecated `tnt` role simply stops appearing for new grants.

**`permission_grant.status`:** `active → (expired | revoked)`. `expired` is
a system transition driven by `expires_at`; `revoked` is human-initiated.
Both are terminal for that grant instance — re-granting creates a new
record, preserving the audit trail of who held what, when (mirrors KRN-01's
append-only philosophy for state history).

**`delegation.status`:** `pending → active → (expired | revoked)`.
`expired` fires automatically at `period.to` (KRN-03-FR-004: "expires
automatically" — no human action required, unlike `permission_grant`'s
`revoked` path which always is).

**`data_scope_rule`/`field_policy`:** versioned and effective-dated like
KRN-04 metadata and KRN-05 process definitions (this draft's assumption,
for STU-10 upgrade-rehearsal consistency — flagged in §17): `active →
superseded`, with the superseding version taking a new ID rather than
mutating the old one in place.

## 6. Standard functional requirements

- `KRN-03-FR-001` Permissions are expressed as `{entity, action, scope}` where action ∈ create, read, update, delete, approve, export, post, reverse. *(Vol 1, verbatim)*
- `KRN-03-FR-002` Data scope supports: own records, org-unit, org-unit-and-below, entity, tenant, and rule-based (expression over record fields). *(Vol 1, verbatim)*
- `KRN-03-FR-003` Field-level policies support hidden, masked and read-only per role — required for salary, cost and margin fields. *(Vol 1, verbatim)*
- `KRN-03-FR-004` Delegation transfers a bounded permission set for a bounded period, is fully audited, and expires automatically. *(Vol 1, verbatim)*
- `KRN-03-FR-005` Authorisation decisions are evaluated at the data-access layer, not in controllers. **[stack-bound: Postgres RLS + policy layer]** *(Vol 1, verbatim)*
- `KRN-03-FR-006` A permission check on an agent action consults two independent gates in sequence: the `permission_grant` (can this agent ever perform this action) and, separately, its currently effective trust ceiling from INT-04 (may it do so without escalation, right now, for this tenant). A grant with no corresponding trust ceiling headroom results in the agent preparing but not committing the action (Draft-level behaviour), never in the grant being silently treated as sufficient on its own. **Addition beyond Vol 1** — grounded in Vol 0 L9 and §27.3; Vol 1 does not state how KRN-03 and INT-04 compose for an agent's own actions, and this is the module boundary most likely to be assumed differently by two independently-built specs if left unstated (see §17).

## 7. Differentiating requirements

- `KRN-03-DR-001` Studio-generated `tnt` entities inherit enforcement automatically; no generated entity can exist outside the permission model. *(Vol 1, verbatim)*
- `KRN-03-DR-002` Agent scopes are expressed in the same language as human scopes, so "what can this agent see" is answerable in one screen. *(Vol 1, verbatim)*
- `KRN-03-DR-003` The effective-permission resolution path (`/api/v1/access/effective-permissions`) is the single source every consumer of tenant data calls — UI navigation, the API, exports, the Copilot, scheduled analytics, agent queries, and the semantic graph. None of these consumers computes or caches an independent copy of "what can this actor see." **Addition beyond Vol 1** — this makes L11 ("This includes analytics, exports, agent queries and the semantic graph") testable as a concrete architectural requirement of this module rather than remaining only a general law in Vol 6, and is the requirement Vol 1's own acceptance sample (§16, `KRN-03-FR-005`) most directly demonstrates.

## 8. Agents

None. KRN-03 is the mechanism every other module's agents are checked
against on every action (`KRN-03-FR-006`), but it registers no agent of
its own — consistent with KRN-01 and KRN-02, none of which carry
autonomous behaviour; autonomy lives in INT-03/INT-04 and the owning
module of each individual agent (Vol 0 §27.4).

## 9. Screens and flows

All screens are KRN-13-generated from KRN-04 metadata (L6). Standard
views:

- **Roles** (list + form) — PR-21: define `sys`/`tnt` roles, attach
  `permission_set`s, mark agent-assignability.
- **Permission sets** (list + form) — PR-21: author `{entity, action,
  scope}` grants; the entity/field pickers are populated live from KRN-04's
  registry (the concrete UI expression of `KRN-03-DR-001`).
- **Field policy matrix** (fields × roles grid) — PR-21 broadly; PR-16/17
  specifically for the finance- and HR-sensitive fields they own the
  policy for.
- **Delegation** — self-service "delegate my approvals while I'm away" for
  every internal persona holding a delegable set; an oversight list for
  PR-21/PR-02 within their scope.
- **Effective permissions viewer** — PR-21, PR-01: "what can this
  user/agent see" in one screen (`KRN-03-DR-002`), the same layout for a
  human `user` and an `agent_identity`.
- **Permission grants** (list, per subject or per role) — PR-21: audit
  view of who/what currently holds what.

## 10. API surface

Base per Vol 1 (verbatim paths shown), Vol 0 §42: `/api/v1/access/{entity}`.

| Method | Path | Notes |
|---|---|---|
| CRUD | `/api/v1/access/roles` | *(Vol 1, verbatim path)* |
| CRUD | `/api/v1/access/permission-sets` | *(Vol 1, verbatim path)* |
| CRUD | `/api/v1/access/scopes` | Maps to `data_scope_rule`. *(Vol 1, verbatim path)* |
| CRUD | `/api/v1/access/permission-grants` | Grant/revoke a role or permission set to a subject |
| CRUD | `/api/v1/access/field-policies` | Not named in Vol 1's abbreviated API list but required by `KRN-03-FR-003`; follows the same path convention |
| CRUD | `/api/v1/access/delegations` | *(Vol 1, verbatim path)* |
| GET | `/api/v1/access/effective-permissions?user_id=` | *(Vol 1, verbatim path)*; also accepts `?agent_id=` and `?service_account_id=` per `KRN-03-DR-002` |

All list endpoints: cursor pagination, declared filters, field selection.
All writes: idempotency key required (Vol 1 §1.2).

## 11. Permission matrix by persona

Actions on KRN-03's own entities: `create`, `read`, `update`,
`grant`/`revoke` (on `permission_grant`), `delegate` (self vs on behalf of
others).

| Persona | role.create/update | permission_set.create/update | data_scope_rule / field_policy.create/update | permission_grant.grant/revoke | delegation.create (self) | delegation.create (on behalf of others) | effective_permissions.read (self) | effective_permissions.read (others) |
|---|---|---|---|---|---|---|---|---|
| PR-21 System Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-01 Owner | ✗ | ✗ | ✗ | ✓ (approve high-privilege grants where routed via KRN-05) | ✓ | ✗ | ✓ | ✓ |
| PR-16 CFO | ✗ | ✗ | ✓ (finance-owned fields only) | ✗ | ✓ | ✓ (own function, via KRN-05 approval) | ✓ | ✗ |
| PR-17 HR Manager | ✗ | ✗ | ✓ (HR/PII-owned fields only) | ✗ | ✓ | ✓ (own function, via KRN-05 approval) | ✓ | ✗ |
| PR-02 Functional Head | ✗ | ✗ | ✗ | ✗ (propose only, via KRN-05) | ✓ | ✓ (own function only) | ✓ | ✓ (own function, read-only) |
| PR-25 External CA/Auditor, PR-26 Regulator | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ (their own scope, read-only) | ✗ |
| PR-29 Agent | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ (own, read-only, via INT-03 tooling) | ✗ |
| All other internal personas | ✗ | ✗ | ✗ | ✗ | ✓ (bounded to a set they hold) | ✗ | ✓ | ✗ |

**Negative cases:**
- PR-29 (any agent identity) attempting `POST /api/v1/access/permission-grants`
  for itself or any other subject → 403, unconditionally and structurally
  — an agent is never a valid actor on this module's write endpoints,
  independent of any grant it otherwise holds (L9: "never act above its
  registered trust ceiling, modify its own ceiling, promote itself, or
  grant permissions" — the last clause applies directly to this module).
- A non-PR-21/16/17 persona attempting `field_policy.update` on a salary or
  margin field → 403.
- A user attempting `delegation.create` with a `permission_set_id` broader
  than any `permission_set` they themselves currently hold → 403 — a
  delegate can never end up with more access than the delegator had
  (`KRN-03-FR-004`'s "bounded" is enforced at write time, not merely
  documented).
- PR-25/26 attempting any `create`/`update`/`delete`/`post`/`reverse`
  action anywhere in the platform → 403 — their persona is defined as
  read-only at the `data_scope_rule` level, not merely by UI omission, so
  a direct API call is rejected identically to a UI attempt.
- A query against a Studio-generated `tnt` entity with no `permission_set`
  grant naming it → returns zero records (default-deny), not an error and
  not an implicit "not yet configured, allow" fallback (`KRN-03-DR-001`).

## 12. Events emitted / consumed

**Emitted** (Vol 1, verbatim, plus extensions):
- `access.role.granted` — a `permission_grant` is created (`role_id`- or
  `permission_set_id`-based; "role" is Vol 1's shorthand for "an access
  grant," not a literal restriction to `role_id`-based grants)
- `access.role.revoked` — a `permission_grant` transitions to `revoked`
- `access.permission_set.created`
- `access.permission_set.updated`
- `access.scope_rule.changed` — a `data_scope_rule` is created, or
  superseded by a new version
- `access.field_policy.changed` — a `field_policy` is created, or
  superseded by a new version
- `access.delegation.started` — a `delegation` transitions `pending →
  active`
- `access.delegation.expired`
- `access.delegation.revoked`
- `access.policy.changed` — emitted alongside `scope_rule.changed`/
  `field_policy.changed` (not instead of), as one name a generic
  cache-invalidation subscriber can listen to regardless of which
  sub-type changed; Vol 1 gives no further definition distinguishing it
  from the two specific events, so this draft does not invent a separate
  business meaning for it (flagged, not sourced further)
- `access.role.created`, `access.role.deprecated`,
  `access.permission_grant.expired`, `access.delegation.created`
  *(added during implementation — the same "check every state transition
  against the event list" sweep that produced KRN-04's D-35 found four
  more gaps here: `role` creation had no event of its own (every sibling
  owned entity's creation does); `role.status`'s `active → deprecated`
  had no event at all; `permission_grant.status`'s system-driven
  `expired` path was uncovered by the human-only `access.role.revoked`;
  and `delegation`'s own creation into `pending` — distinct from
  `access.delegation.started`'s `pending → active` transition — had no
  event of its own. L4 is unconditional)*

**Consumed:**
- `identity.user.deactivated`, `identity.agent.*` status changes to
  `retired` (KRN-02) — on receipt, every `permission_grant` whose
  `subject_id` matches is transitioned to `revoked`. This is the concrete
  mechanism, alongside KRN-02's own session revocation, behind Vol 0 §24's
  PPL-04 claim that "provisioning and revocation touch KRN-02, KRN-03 and
  OPS-04 automatically" — a deactivated identity's access closes without a
  separate manual step in this module.
- `metadata.entity.created`, `metadata.entity.deprecated`,
  `metadata.field.added`, `metadata.field.deprecated` (KRN-04) — KRN-03
  does not need these to *decide* whether an entity is governable (§3, it
  resolves live against KRN-04), but does consume them to invalidate any
  per-tenant cached join between `permission_set`/`field_policy` records
  and the entity/field metadata they reference (Vol 1 §1.2's metadata
  caching rule applies here as much as anywhere).

## 13. Reports and KPIs

- Role and permission-set counts, by namespace (`sys` vs `tnt`).
- Active delegations, with time remaining — surfaced to PR-21/PR-02 as an
  oversight list.
- Field-policy coverage: KRN-04 fields marked `is_sensitive` (Vol 1 §KRN-04)
  with no corresponding `field_policy` — a gap report, not a statutory one.
- Access-review readiness feed — the `permission_grant` and `delegation`
  history this module maintains is the direct data source for SEC-01's
  (Identity & Access Governance) access-certification campaigns; KRN-03
  exposes the data, SEC-01 owns the campaign workflow.

No statutory reports originate in KRN-03 itself.

## 14. Compliance touchpoints

- KRN-03 **is** the permission layer L11 requires never be bypassed — this
  is not a touchpoint so much as this module's entire reason for existing.
- SEC-01 (Identity & Access Governance) and SEC-06 (Audit & Evidence)
  consume `permission_grant`/`delegation` records directly for access
  review and evidence packs.
- CMP-06 (Regulated Records) — `field_policy` `hidden`/`masked` behaviour
  is part of what "electronic records with meaning" requires in a
  validated environment: a regulated record's sensitive fields must be
  provably inaccessible to the wrong role, not merely conventionally
  hidden in one screen.
- PR-25 (External CA/Auditor) and PR-26 (Regulator) — Vol 0 §7.2 defines
  these personas purely in terms of scope ("scoped web, read-mostly" /
  "scoped read-only"); KRN-03's `data_scope_rule` is the entire mechanism
  that makes these personas — and therefore the regulated verticals that
  depend on them (VRT-05..08) — sellable at all.
- No GST, e-invoicing, e-way bill or TDS touchpoint (L7 not applicable).

## 15. Offline behaviour

**Profile: `read`.** KRN-03 is not itself an offline-`full` module, but
every offline-`full` module (SCM-02, SCM-03, MFG-04, MFG-06, SLS-10,
DLV-05, DLV-07, PPL-05, OPS-10) depends on KRN-03 having already resolved
before the device went offline — Postgres RLS cannot evaluate a policy
against a database it cannot reach. The device caches the effective
permission set for its active session at last sync (the same resolution
`/effective-permissions` would return online) and enforces it client-side
for local capture.

**Conflict policy:** server-authoritative on reconnect, queued-for-review
on divergence — mirroring KRN-02's pattern for the identical underlying
reason. If a user's `permission_grant` was narrowed or revoked centrally
while their device was offline (a territory reassignment, a role change,
an emergency revocation), records captured locally under the now-stale
cached scope are not silently accepted on sync and not silently discarded;
they are queued for a human to confirm against the actor's current,
authoritative scope. A device's cached scope is never treated as
authoritative once connectivity returns.

## 16. Acceptance criteria (Given/When/Then)

**KRN-03-FR-001 — permission shape**
> Given a `permission_set` granting `{entity: SLS-04.Deal, action: read, scope: org_unit_and_below}` to a role
> When a user holding that role queries Deals
> Then only Deals whose owning org unit is the user's org unit or a descendant are returned, and the same user's attempt to `post` a Deal-linked financial transaction is rejected, since `post` was never granted.

**KRN-03-FR-002 — data scope types**
> Given the same user additionally holds `{entity: FIN-02.Invoice, action: read, scope: rule_based, expression: "party.owner_user_id == actor.id"}`
> When the user lists Invoices
> Then only invoices for parties they personally own are returned — a different mechanism from the org-unit scope above, expressed and enforced through the same `data_scope_rule` entity and the same resolution path.

**KRN-03-FR-003 — field-level policy**
> Given a role with `field_policy: masked` on `PPL-08.Payroll.gross_salary` and `field_policy: hidden` on `FIN-08.ProfitAndLoss.net_margin`
> When a user holding that role opens a payroll record and a P&L statement
> Then `gross_salary` renders masked per the declared strategy and `net_margin` does not appear in the response payload at all — not merely hidden in the UI — for every access path (API, export, report, Copilot).

**KRN-03-FR-004 — delegation**
> Given PR-02 grants a 5-day delegation of their own approval permission set to a peer starting Monday
> When Thursday (day 4) arrives and the peer approves a request within the delegated set
> Then the approval is recorded carrying both the peer's identity and the delegation reference; when day 6 arrives the delegation auto-expires with no human action required, the peer's next approval attempt is rejected, and the entire delegation window is visible in KRN-10.

**KRN-03-FR-005 — enforcement at the data-access layer (Vol 1's literal acceptance sample)**
> Given a user with org-unit scope on Deals (`SLS-04`)
> When they query the deals list via the API, export deals to CSV, ask the Copilot (`INT-02`) about pipeline, and receive a scheduled `INT-10` narrative report referencing deal counts
> Then all four return the same record set — because each resolves permission through the shared data-access-layer enforcement (Postgres RLS + policy layer) rather than separate controller-level logic — and none of the four reveals a deal outside the user's org-unit scope.

**KRN-03-FR-006 — permission and trust ceiling are independent gates (addition)**
> Given `SCM-AG-01` (Stockout Forecaster) holds a `permission_grant` of `{entity: SCM-04.PurchaseOrder, action: create, scope: entity}` and a trust ceiling of L2 (Draft) for this tenant
> When the agent determines a PO should be raised
> Then it may prepare the PO (permitted by the grant) but cannot commit it without human review (blocked by the L2 ceiling), and neither widening the grant nor raising its own ceiling is an action the agent can take on its own behalf.

**KRN-03-DR-001 — Studio-generated entities inherit enforcement**
> Given a tenant uses STU-01 to generate a new `tnt` entity `GatePassReturn` with three fields, one marked sensitive
> When the entity is saved and a role with no explicit `permission_set` grant for `GatePassReturn` queries it
> Then the query returns zero records by default-deny, exactly as it would for any `sys` entity with no grant — no additional KRN-03 configuration step was required for the new entity to be governed.

**KRN-03-DR-002 — one screen answers "what can this agent see"**
> Given `MFG-AG-05` (Job Work Ageing Watchdog) holds two `permission_grant`s and one `data_scope_rule`
> When PR-21 opens the effective-permissions viewer for that agent identity
> Then it renders in the same layout and `{entity, action, scope}` vocabulary used for a human user's effective-permissions view, with no agent-specific screen or terminology.

**KRN-03-DR-003 — single resolution source for every consumer (addition)**
> Given the same org-unit-scoped user from `KRN-03-FR-005`
> When `SLS-AG-03` (Stall Detector) runs its scheduled scan acting as itself, and separately `INT-01`'s semantic graph is queried on the user's behalf during a Copilot conversation
> Then both the agent's own scan (resolved against the agent's own scope) and the graph traversal (resolved against the user's scope) call `/api/v1/access/effective-permissions`, and neither INT-01 nor the agent runtime holds any bespoke or cached scope logic of its own.

## 17. Open questions

Flagged per Vol 6 §4/L13 — gaps in Vol 1's field-level detail that this
draft filled by reasonable extrapolation. They should be confirmed or
corrected before this Vol 3 file is treated as binding:

1. **Vol 1 gives no "key fields" section at all for KRN-03** — unlike
   KRN-01 and KRN-02, only the entities-owned list and requirement text
   exist. Every field table in §4.1 (`role`, `permission_set`,
   `permission_grant`, `data_scope_rule`, `field_policy`, `delegation`) is
   this draft's extrapolation. This is the single largest gap in this
   file; review §4.1 field-by-field before treating it as binding.
2. **Whether `permission_grant` sits between `role` and subject, or
   whether a subject can also be granted a bare `permission_set` without a
   `role` wrapper** (§4.1 allows both, mirroring how KRN-05 separates a
   process *definition* from an *instance*). Confirm the intended object
   graph, since it affects how the "effective permissions" resolution
   query is written.
3. **The `rule_based` expression grammar** for `data_scope_rule` (§4.1
   assumes reuse of `P-12 Rule.conditions`'s structured tree per Vol 2)
   — confirm reuse is intended, or whether KRN-07 (Rules Engine) should be
   the explicit owner of the expression evaluator KRN-03 calls into,
   rather than KRN-03 evaluating its own copy.
4. **`field_policy.mask_strategy` values** (`partial`/`full`/
   `computed_substitute`, §4.1) are proposed, not sourced. Confirm the
   minimum viable set for Phase 0, since `PPL-08` (Payroll) and `FIN-08`
   (Financial Statements) both depend on masking behaviour existing
   before either module is built.
5. **The KRN-03/INT-04 composition model for agent actions**
   (`KRN-03-FR-006`, §3) — inferred from L9 and Vol 0 §27.3, not stated
   explicitly in Vol 1. Confirm this two-gate model (grant, then ceiling)
   before INT-04's Vol 3 file is drafted, so the two specs agree on which
   module blocks an under-ceiling agent action rather than each assuming
   the other does.
6. **Whether `data_scope_rule` and `field_policy` are versioned and
   effective-dated** like KRN-04 metadata and KRN-05 process definitions
   (§5 assumes yes, for STU-10 upgrade-rehearsal consistency) — confirm,
   since if they are not versioned, a policy change mid-transaction has no
   clean "which version applied at the time" answer for audit purposes.
7. **Delegation's interaction with the delegator's own current scope**
   (§4.1's `delegation.permission_set_id`) — this draft assumes that when
   no explicit `permission_set_id` is set, the delegate temporarily
   exercises the delegator's *own current* effective scope (e.g. their
   specific org-unit) rather than a scope independently defined on the
   delegation record. Confirm, since the alternative changes
   `KRN-03-FR-004`'s acceptance criterion materially — under the
   alternative, a delegate approving on day 4 would need to be checked
   against a scope stored on the `delegation` record itself, not against
   whatever the delegator's scope happens to be on that day.
