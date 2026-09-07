# MahiSys Business OS — Volume 1
## Platform Kernel SRS

**Document ID:** BOS-VOL1
**Version:** 1.0
**Depends on:** Vol 0 (charter, conventions), Vol 2 (data model)
**Governed by:** Vol 6 (build runbook)

> The kernel is built first and completely. Nothing in L2 is implemented
> before its kernel dependencies pass contract tests (Vol 6 §3). The
> temptation to build a visible application module early is the single most
> damaging thing that can happen to this project.

---

# PART 1 — STACK AND FOUNDATIONS

## 1.1 Technology stack — recommendation pending D-12

Contracts in this volume are stack-independent. The following is recommended;
overriding it changes implementation in the sections marked **[stack-bound]**
and nothing else.

| Concern | Recommendation | Reasoning |
|---|---|---|
| Datastore | PostgreSQL 16+ | JSONB for `tnt` extensions without per-tenant DDL; native row-level security for T11; `pgvector` for INT-01; one database to operate rather than four |
| Language | TypeScript (Node 22+) | Same language across API, workers and web; strong typing suits contract-first development; largest ecosystem for an AI implementer |
| Data access | Query builder (Kysely or Drizzle) | A full ORM fights a metadata-driven schema; raw SQL loses type safety |
| Queue / jobs | Postgres-backed (pgmq or River) | Avoids operating Kafka at Phase 0; migrate to a broker only when volume demands |
| Cache | Redis | Sessions, rate limits, computed metadata |
| Object storage | S3-compatible | KRN-08 |
| Search | Postgres FTS + pgvector | Defer a separate search cluster |
| Frontend | React + a metadata renderer | Screens are generated from metadata, not hand-built (L6) |
| Mobile | React Native | Shared renderer with web; offline store required |

**Rationale for one datastore at Phase 0.** MahiSys' constraint is delivery
capacity (Vol 0 §40), not throughput. Every additional piece of
infrastructure is operational burden taken from module building. Postgres
covers relational, document, queue, search and vector needs to well beyond
the Phase 4 scale target.

## 1.2 Kernel-wide conventions

**API.** REST at `/api/v1/{module}/{entity}`. Every endpoint accepts an
idempotency key on writes. Every list endpoint supports cursor pagination,
declared filters and field selection. Errors carry a stable machine code, a
human message, and a `trace_id`.

**Authorisation.** Every request resolves to an actor (Vol 2 §1.2), a tenant
and an entity scope before any data access. No query runs without them (L11).

**Events.** Every mutation emits an event within the same transaction as the
write, using the transactional outbox pattern. An event that is not durably
recorded means the mutation did not happen.

**Metadata caching.** Entity, layout and permission metadata is read on
almost every request. It is cached per tenant with explicit invalidation on
metadata change. **[stack-bound]**

---
---

# PART 2 — KERNEL MODULE SPECIFICATIONS

Each module below follows the Vol 3 template in abbreviated form: purpose,
entities owned, key requirements, API surface, events, and acceptance
criteria. Full Given/When/Then sets live in `/spec/vol3/`.

---

## KRN-01 · Tenancy & Organisation Model

**Purpose.** Defines the container everything else lives in: tenant, legal
entity, division, branch, cost centre, and the isolation tier the tenant runs
under.

**Entities owned:** `tenant`, `legal_entity`, `org_unit`, `cost_centre`,
`fiscal_calendar`, `isolation_assignment`.

**Key fields — tenant:** `code`, `name`, `status` (`trial` | `active` |
`suspended` | `closed`), `isolation_tier` (`row` | `schema` | `dedicated`),
`region`, `manifest_id` (the VDL pack applied), `plan_id`, `provisioned_at`.

**Key fields — legal_entity:** `tenant_id`, `legal_name`, `tax_registrations`,
`base_currency`, `reporting_currency`, `fiscal_year_start`, `address`,
`parent_entity_id`, `consolidation_method`.

**Requirements**
- `KRN-01-FR-001` A tenant may hold multiple legal entities with independent fiscal calendars, currencies and tax registrations.
- `KRN-01-FR-002` Org units form an unlimited hierarchy; every user, document and transaction resolves to exactly one entity and zero or more org units.
- `KRN-01-FR-003` Fiscal periods support open, closed and permanently-closed states; posting into a closed period is rejected.
- `KRN-01-DR-001` Isolation tier is a tenant attribute. Promotion from `row` to `schema` to `dedicated` occurs by migration without any change to application code or logical model.
- `KRN-01-FR-004` Tenant lifecycle transitions (`trial → active → suspended → closed`) are process-governed and emit events consumed by COM-04 and KRN-20.

**API:** `/api/v1/core/tenants`, `/legal-entities`, `/org-units`,
`/cost-centres`, `/fiscal-periods`.

**Events:** `core.tenant.provisioned`, `.activated`, `.suspended`, `.closed`,
`core.legal_entity.created`, `core.fiscal_period.closed`.

**Acceptance (sample)**
> Given a tenant on `row` isolation with 40,000 records
> When the tenant is promoted to `schema` isolation
> Then all records remain accessible, IDs are unchanged, no application code path differs, and a `core.tenant.isolation_changed` event is emitted.

---

## KRN-02 · Identity & Authentication

**Purpose.** Every actor that can touch the system: human users, service
accounts, external portal users, and agents.

**Entities owned:** `user`, `credential`, `session`, `service_account`,
`agent_identity`, `device`, `login_attempt`.

**Key fields — user:** `party_id` (nullable; links to P-01 for employees and
portal users), `user_type` (`full` | `light` | `self_service` | `external` —
drives licensing per Vol 0 §33.4), `login_id`, `status`, `locale`,
`mfa_enrolments`, `last_login_at`.

**Key fields — agent_identity:** `agent_code`, `agent_version`,
`owning_module`, `credential_ref`, `trust_ceiling`, `status`.

**Requirements**
- `KRN-02-FR-001` Authentication supports password, email OTP, phone OTP, SSO (SAML 2.0, OIDC) and Google Workspace.
- `KRN-02-FR-002` Sessions carry device binding, configurable idle and absolute timeouts, and can be revoked individually or in bulk.
- `KRN-02-FR-003` Impersonation by an administrator is possible, always audited, always visibly banner-marked, and never permitted for financial posting.
- `KRN-02-DR-001` Agents hold real, versioned identities. Every action is attributable to a specific agent build, not to "the system".
- `KRN-02-FR-004` Failed login handling includes progressive delay and lockout; credential material is never logged.
- `KRN-02-FR-005` External portal users (PR-22..27) authenticate through the same mechanism with a restricted scope; no separate identity system exists.

**API:** `/api/v1/identity/auth/*`, `/users`, `/sessions`,
`/service-accounts`, `/agent-identities`, `/devices`.

**Events:** `identity.user.created`, `.deactivated`, `identity.session.started`,
`.revoked`, `identity.agent.registered`, `.version_changed`.

**Acceptance (sample)**
> Given an agent at version 3 that posted 20 transactions
> When the agent is upgraded to version 4
> Then the audit trail for those 20 transactions continues to attribute them to version 3, and version 4 starts with its own telemetry baseline.

---

## KRN-03 · Access Control

**Purpose.** Role-based and attribute-based authorisation down to field and
row, applied uniformly to humans, agents and integrations.

**Entities owned:** `role`, `permission_set`, `permission_grant`,
`data_scope_rule`, `field_policy`, `delegation`.

**Requirements**
- `KRN-03-FR-001` Permissions are expressed as `{entity, action, scope}` where action ∈ create, read, update, delete, approve, export, post, reverse.
- `KRN-03-FR-002` Data scope supports: own records, org-unit, org-unit-and-below, entity, tenant, and rule-based (expression over record fields).
- `KRN-03-FR-003` Field-level policies support hidden, masked and read-only per role — required for salary, cost and margin fields.
- `KRN-03-DR-001` Studio-generated `tnt` entities inherit enforcement automatically; no generated entity can exist outside the permission model.
- `KRN-03-DR-002` Agent scopes are expressed in the same language as human scopes, so "what can this agent see" is answerable in one screen.
- `KRN-03-FR-004` Delegation transfers a bounded permission set for a bounded period, is fully audited, and expires automatically.
- `KRN-03-FR-005` Authorisation decisions are evaluated at the data-access layer, not in controllers. **[stack-bound: Postgres RLS + policy layer]**

**API:** `/api/v1/access/roles`, `/permission-sets`, `/scopes`,
`/delegations`, `/effective-permissions?user_id=`.

**Events:** `access.role.granted`, `.revoked`, `access.delegation.started`,
`.expired`, `access.policy.changed`.

**Acceptance (sample)**
> Given a user with org-unit scope on Deals
> When they query the deals list, export deals, ask the Copilot about pipeline, and receive an INT-10 narrative report
> Then all four return the same record set, and none reveals a deal outside their scope.

---

## KRN-04 · Entity & Metadata Engine

**Purpose.** The registry of every entity, field, relationship and validation.
The foundation of T1 and the reason ten verticals are affordable.

**Entities owned:** `entity_definition`, `field_definition`,
`relationship_definition`, `validation_rule`, `computed_field`,
`schema_version`, `extension_point`.

**Key fields — entity_definition:** `code`, `namespace` (`sys` | `tnt`),
`primitive_id` (P-01..P-12 — **mandatory**, enforcing T2), `owning_module`,
`label_key`, `is_document`, `state_machine_id`, `semantic_index_policy`,
`offline_profile`, `version`.

**Key fields — field_definition:** `entity_id`, `code`, `namespace`,
`data_type`, `is_required`, `default`, `validation`, `is_indexed`,
`is_sensitive`, `semantic_role` (`identifier` | `meaningful` | `excluded`),
`deprecated_at`, `sunset_at`.

**Requirements**
- `KRN-04-FR-001` Every entity declares a primitive. An entity without one cannot be created.
- `KRN-04-DR-001` `sys` and `tnt` namespaces are strictly separated. The platform never writes `tnt`; a tenant never modifies `sys`. Enforced at the engine, not by convention.
- `KRN-04-FR-002` `tnt` fields are stored in the `ext` JSONB column with declared type and validation, indexed only where declared.
- `KRN-04-FR-003` Field deprecation requires a sunset date and a migration path; removal without one is rejected (L12).
- `KRN-04-FR-004` Computed fields are declarative expressions evaluated consistently in API, reports, exports and the semantic index.
- `KRN-04-FR-005` Extension points are declared per entity; extension attempted anywhere else is blocked, not merely discouraged.
- `KRN-04-DR-002` A metadata change is versioned, diffable and reversible, and can be rehearsed against a shadow tenant before promotion (STU-10).

**API:** `/api/v1/metadata/entities`, `/fields`, `/relationships`,
`/validations`, `/schema-versions`, `/diff`.

**Events:** `metadata.entity.created`, `.deprecated`, `metadata.field.added`,
`.deprecated`, `metadata.schema.version_promoted`.

**Acceptance (sample)**
> Given a tenant that has added 14 `tnt` fields and 2 `tnt` entities
> When a platform upgrade adds 3 `sys` fields and deprecates 1
> Then all 14 `tnt` fields and both entities remain functional, the deprecated field continues to resolve until its sunset date, and the upgrade rehearsal reports the diff before promotion.

---

## KRN-05 · Process Engine

**Purpose.** State machines, approvals, SLAs and escalation for every module
(P-07).

**Entities owned:** `process_definition`, `process_state`, `process_transition`,
`process_instance`, `approval_matrix`, `approval_request`, `sla_policy`,
`escalation_rule`, `state_history`.

**Requirements**
- `KRN-05-FR-001` Definitions are versioned and effective-dated; running instances complete on the version they started under.
- `KRN-05-FR-002` Transitions support guards (rule expressions), pre/post actions, and role or agent authorisation.
- `KRN-05-FR-003` Approval matrices support sequential, parallel, quorum and conditional routing, with delegation and out-of-office handling.
- `KRN-05-FR-004` SLA clocks respect business calendars, holidays and pauses; breach and near-breach both emit events.
- `KRN-05-DR-001` A transition may nominate an agent as approver at a declared trust level; the agent's decision is recorded with confidence and evidence, and is reversible.
- `KRN-05-FR-005` Tenant-added states carry `namespace: tnt` and must fit the declared transition set, keeping customised workflows upgrade-safe.
- `KRN-05-FR-006` State history is append-only and includes actor, timestamp, duration in prior state, and reason.

**API:** `/api/v1/process/definitions`, `/instances`, `/transitions`,
`/approvals`, `/my-approvals`.

**Events:** `process.instance.started`, `.state_changed`, `.completed`,
`process.approval.requested`, `.granted`, `.rejected`, `process.sla.at_risk`,
`.breached`.

**Acceptance (sample)**
> Given an approval matrix routing discounts above 15% to the sales head
> When an agent at L3 approves a 12% discount and a human must approve an 18% one
> Then the 12% approval is recorded with the agent's identity, version, confidence and rollback handle, and the 18% request appears in the sales head's queue with full context.

---

## KRN-06 · Event Bus & Event Store

**Purpose.** The immutable spine (T3, P-08). Audit, analytics, automation,
agents, simulation and undo all derive from it.

**Entities owned:** `event`, `event_schema`, `subscription`,
`delivery_attempt`, `dead_letter`, `outbox`.

**Requirements**
- `KRN-06-FR-001` Every mutation writes its event to the outbox within the same database transaction as the write. A mutation whose event is not durably recorded must not commit.
- `KRN-06-FR-002` Events are append-only. No update or delete path exists in code.
- `KRN-06-FR-003` Ordering is guaranteed per subject; global ordering is not required.
- `KRN-06-FR-004` Delivery is at-least-once; subscribers declare idempotency keys.
- `KRN-06-FR-005` Schemas are versioned with forward compatibility; a subscriber on version N tolerates events at version N+1.
- `KRN-06-FR-006` Replay is supported by subject, time range, correlation and event type, without side effects on non-targeted subscribers.
- `KRN-06-DR-001` `causation_id` and `correlation_id` allow any journey (J-01..J-14) to be reconstructed end to end. This is what makes causal answers and journey testing possible.
- `KRN-06-FR-007` Dead letters are visible, diagnosable and re-drivable by an administrator.

**API:** `/api/v1/events` (read, filtered), `/subscriptions`, `/replay`,
`/dead-letters`.

**Acceptance (sample)**
> Given order O-1042 that moved through quote, order, production, dispatch and invoice
> When the journey is reconstructed by `correlation_id`
> Then every event appears in causal order across five modules, each with its actor, and the chain is complete with no orphan events.

---

## KRN-07 · Rules Engine

**Purpose.** Declarative condition-action policies (P-12) consumed by pricing,
credit, reorder, eligibility, approval and compliance.

**Entities owned:** `rule_set`, `rule`, `rule_version`, `evaluation_log`.

**Requirements**
- `KRN-07-FR-001` Conditions are structured expression trees over declared entity fields — never free text, never executable code.
- `KRN-07-FR-002` Rules are priority-ordered, effective-dated and scoped by entity, location, party segment and item category.
- `KRN-07-DR-001` Rules authored in natural language (STU-05) compile to an inspectable expression tree and retain their original phrasing. They never execute as opaque model behaviour.
- `KRN-07-FR-003` A rule set can be simulated against historical records before activation, reporting which records would change outcome.
- `KRN-07-FR-004` Every evaluation that affects a business outcome is logged with inputs, matched rule, and result, so a price or a credit block is always explainable.

**API:** `/api/v1/rules/sets`, `/rules`, `/evaluate`, `/simulate`,
`/evaluation-log`.

**Events:** `rules.set.activated`, `rules.rule.version_created`.

---

## KRN-08 · Document Service

**Purpose.** File storage, versioning, templates and print-accurate rendering
(Vol 0 §10) — an under-estimated subsystem and a frequent cause of rejected
implementations in India.

**Entities owned:** `file`, `file_version`, `print_template`,
`template_binding`, `render_job`, `signature_block`.

**Requirements**
- `KRN-08-FR-001` Files support versioning, checksums, virus scanning, retention policy and legal hold.
- `KRN-08-FR-002` Templates render to A4, A5, thermal 2" and 3", and dot-matrix, with print-accurate preview.
- `KRN-08-FR-003` Templates support QR and barcode blocks, digital signature blocks, conditional sections driven by rules, watermarks (draft, duplicate, triplicate), and multi-script output.
- `KRN-08-DR-001` Statutory Indian layouts ship pre-built per document type; per-customer template overrides are configuration, never development.
- `KRN-08-FR-004` Every document-producing module references a template ID. Hard-coded layouts are rejected at review (L6).
- `KRN-08-FR-005` Bulk generation is asynchronous, resumable and progress-reported.

**API:** `/api/v1/documents/files`, `/templates`, `/render`, `/bulk-render`.

**Events:** `documents.file.uploaded`, `.version_added`,
`documents.render.completed`, `.failed`.

**Acceptance (sample)**
> Given a tax invoice for a customer with a bespoke template override
> When it is rendered for thermal 3" and for A4
> Then both carry the correct IRN QR, the customer's override layout, statutory fields in required positions, and identical amounts.

---

## KRN-09 · Notification & Communication Hub

**Purpose.** One routing layer for email, WhatsApp, SMS, push and in-app
(T9). WhatsApp is a bidirectional client here, not a marketing channel.

**Entities owned:** `notification_template`, `notification`, `channel_config`,
`delivery_record`, `preference`, `consent_record`, `inbound_message`,
`conversation_session`.

**Requirements**
- `KRN-09-FR-001` Templates are channel-specific, localised, and variable-bound to entity data.
- `KRN-09-FR-002` Per-user channel preference, quiet hours, batching and digest are respected; statutory and safety notifications override quiet hours.
- `KRN-09-DR-001` Inbound WhatsApp messages resolve to an authenticated actor and can execute actions — an approval sent as a notification is granted in the same thread and lands as an authenticated, audited action.
- `KRN-09-FR-003` Conversation sessions maintain context across turns and expire on policy.
- `KRN-09-FR-004` Consent and opt-out are recorded per channel per purpose and enforced before send (SEC-07).
- `KRN-09-FR-005` Delivery status is tracked per message with retry and fallback chains.

**API:** `/api/v1/comms/templates`, `/send`, `/inbound`, `/preferences`,
`/delivery-status`.

**Events:** `comms.notification.sent`, `.delivered`, `.failed`,
`comms.inbound.received`, `comms.action.executed_via_channel`.

---

## KRN-10 · Audit & Immutable Log

**Purpose.** Who did what, when and why — humans and agents alike.

**Entities owned:** `audit_entry`, `audit_chain_seal`, `access_log`.

**Requirements**
- `KRN-10-FR-001` Every mutation records before and after values, actor (with agent version), timestamp, IP, device, source and `trace_id`.
- `KRN-10-FR-002` Entries are tamper-evident via a hash chain, verifiable on demand.
- `KRN-10-DR-001` Agent entries additionally carry the reasoning trace, confidence score, input evidence references and the exact rollback handle — making autonomy auditable rather than mysterious.
- `KRN-10-FR-003` Read access to sensitive entities (payroll, medical records, KYC) is itself logged.
- `KRN-10-FR-004` Audit data is queryable and exportable as an evidence pack for auditors (PR-25, PR-26) without granting them system access.
- `KRN-10-FR-005` Retention meets the longest applicable statutory requirement and cannot be shortened by a tenant below that floor.

**API:** `/api/v1/audit/entries`, `/verify-chain`, `/evidence-pack`.

---

## KRN-11 · Numbering & Sequencing

**Purpose.** Statutory-grade document numbering.

**Entities owned:** `number_series`, `series_assignment`, `sequence_state`,
`cancelled_number`.

**Requirements**
- `KRN-11-FR-001` Series are scoped by legal entity, document type, location, and fiscal year, with configurable prefix, suffix and width.
- `KRN-11-FR-002` Statutory series are gapless. A cancelled number is recorded as cancelled, never reused, never silently skipped.
- `KRN-11-FR-003` Number allocation is transactional; a failed document does not consume a statutory number.
- `KRN-11-FR-004` Fiscal-year rollover resets series where configured, on the entity's own fiscal calendar.
- `KRN-11-FR-005` Concurrent allocation under load produces no duplicates and no gaps. **[stack-bound: advisory lock or sequence table]**

**Acceptance (sample)**
> Given 200 concurrent invoice creations in a gapless series
> When 6 of them fail validation after number allocation
> Then the issued numbers are contiguous, the 6 are recorded as cancelled with reasons, and no number is reused.

---

## KRN-12 · Masters & Reference Data

**Purpose.** The shared reference layer every module consumes.

**Entities owned:** `uom`, `uom_conversion`, `currency`, `exchange_rate`,
`tax_code`, `hsn_sac`, `country`, `state`, `district`, `pincode`,
`calendar`, `holiday`, `bank`, `industry_code`.

**Requirements**
- `KRN-12-FR-001` Reference data is versioned and effective-dated; historical transactions resolve against the values valid at their date.
- `KRN-12-DR-001` HSN/SAC, GST rate schedules, pin-code mappings and state codes are platform-maintained and centrally updated, so tenants never carry stale statutory data.
- `KRN-12-FR-002` Tenants may add `tnt` reference values (custom UoM, custom calendars) without altering platform sets.
- `KRN-12-FR-003` UoM conversions support multi-step resolution with defined precision and rounding.

---

## KRN-13 · Layout & Navigation Engine

**Purpose.** Metadata-driven screens (L6). No hand-written form exists that a
tenant could not also have generated.

**Entities owned:** `layout`, `view_definition`, `field_placement`,
`navigation_node`, `saved_filter`, `personalisation`.

**Requirements**
- `KRN-13-FR-001` View types: list, form, kanban, calendar, timeline, dashboard, and mobile task surface.
- `KRN-13-FR-002` Layouts support sections, conditional visibility, field-level read-only logic, and responsive breakpoints.
- `KRN-13-DR-001` Layouts are vertical-aware: the same module presents different default screens under a Manufacturing manifest and a Healthcare manifest with no code difference.
- `KRN-13-FR-003` Navigation is filtered by entitlement (KRN-20) and permission (KRN-03); an unpurchased or unpermitted module is invisible, not merely disabled.
- `KRN-13-FR-004` Users may personalise columns, filters and dashboard widgets within limits set by their role.
- `KRN-13-FR-005` Every generated screen meets WCAG 2.2 AA.

---

## KRN-14 · Search & Semantic Index

**Purpose.** Full-text and vector indexing across records, documents and
communications. The substrate INT-01 is built on.

**Entities owned:** `index_document`, `embedding`, `index_policy`,
`index_job`.

**Requirements**
- `KRN-14-FR-001` Results are permission-filtered at query time, never post-filtered.
- `KRN-14-DR-001` The same index serves keyword search and semantic retrieval, so "search" and "ask" share one substrate rather than diverging into two systems.
- `KRN-14-FR-002` Each entity declares its semantic index policy (Vol 2 §3.5): which fields are identifiers, which carry meaning, which are excluded as sensitive.
- `KRN-14-FR-003` Sensitive fields (salary, medical content, KYC identifiers) are excluded from embeddings by declaration.
- `KRN-14-FR-004` Indexing is incremental, event-driven and lag-monitored.

---

## KRN-15 · Scheduler & Job Runtime

**Purpose.** Cron, queues, long-running jobs and the execution substrate for
agents.

**Entities owned:** `job_definition`, `job_run`, `schedule`, `job_lock`,
`retry_policy`.

**Requirements**
- `KRN-15-FR-001` Jobs are idempotent by contract; every job declares its idempotency key.
- `KRN-15-FR-002` Scheduling respects tenant timezone and business calendar.
- `KRN-15-FR-003` Retries use exponential backoff with a declared ceiling; exhausted jobs land in a visible failure queue.
- `KRN-15-FR-004` Long-running jobs report progress and are cancellable.
- `KRN-15-FR-005` Per-tenant concurrency limits prevent one tenant starving others.

---

## KRN-16 · Sync & Offline Service

**Purpose.** Local-first capture with deterministic conflict resolution (T12).
Without this, the floor and field personas — most of the actual transaction
volume — cannot use the system.

**Entities owned:** `sync_session`, `sync_batch`, `change_record`,
`conflict`, `offline_profile`.

**Requirements**
- `KRN-16-FR-001` Every module declares an offline profile: `full`, `read` or `online`.
- `KRN-16-FR-002` Offline capture records event time separately from transaction time (Vol 2 §1.6).
- `KRN-16-FR-003` Conflict policy per Vol 0 §9.2: last-writer-wins for independent fields; server-authoritative for stock and financial quantities; queued-for-review where a machine should not decide.
- `KRN-16-FR-004` Queued conflicts are presented with both versions and full context; resolution is audited.
- `KRN-16-FR-005` Sync is resumable, bandwidth-aware and safe across app termination.
- `KRN-16-DR-001` Statutory documents (invoices, e-way bills) are never issued offline; they are captured offline and issued on sync, with the number allocated at issue.

**Acceptance (sample)**
> Given a supervisor logs 6 hours of production offline while a planner reassigns the same work order online
> When the device syncs
> Then production quantities post against the original work order, the reassignment is preserved, the conflict is queued for review rather than auto-resolved, and no stock quantity is double-counted.

---

## KRN-17 · Data Platform

**Purpose.** Warehouse, CDC, lineage and the analytical substrate behind INS
and INT.

**Entities owned:** `dataset`, `materialisation`, `lineage_edge`,
`retention_policy`, `snapshot`.

**Requirements**
- `KRN-17-FR-001` Row-level security carries into analytics; an analytical query cannot reveal what a transactional query would not (L11).
- `KRN-17-FR-002` Materialisations are incremental and freshness-reported.
- `KRN-17-FR-003` Historical snapshots support point-in-time reporting and simulation baselines (INT-05).
- `KRN-17-FR-004` Lineage is queryable: any number in a report can be traced to its source transactions.

---

## KRN-18 · Undo & Compensation

**Purpose.** The mechanism behind T10 and the reason owners will permit
autonomy at all.

**Entities owned:** `reversal_handle`, `compensation_definition`,
`reversal_batch`, `reversal_log`.

**Requirements**
- `KRN-18-FR-001` Every mutation registers a reversal handle at the time it is written (L5). A mutation without one fails review.
- `KRN-18-FR-002` Compensation is cascade-aware: reversing a dispatch reverses its stock movement, invoice, e-way bill and ledger postings in correct order.
- `KRN-18-DR-001` "Reverse everything this agent did today, across modules" is a supported, single operation with a preview of consequences before execution.
- `KRN-18-FR-003` Where a real-world action cannot be undone (an e-invoice past its cancellation window, a sent message), the system states this explicitly in the preview and offers the correct compensating action instead of failing silently.
- `KRN-18-FR-004` Every reversal is itself audited and is not itself reversible except as a new forward action.

**Acceptance (sample)**
> Given the Collections Chaser at L3 sent 40 follow-ups and applied 12 payment allocations today
> When the owner selects "undo this agent's day"
> Then a preview lists all 52 actions, marks the 40 sent messages as not reversible with a proposed correction message, reverses the 12 allocations with their ledger entries, and records the whole operation as one audited reversal batch.

---

## KRN-19 · Localisation & Terminology

**Purpose.** Language packs and vertical terminology overrides.

**Entities owned:** `locale`, `translation_key`, `translation`,
`terminology_override`, `format_policy`.

**Requirements**
- `KRN-19-FR-001` English, Hindi and Marathi at launch, with a framework for ten more.
- `KRN-19-FR-002` Indian number formatting (lakh, crore), date formats, and currency display are locale-driven.
- `KRN-19-DR-001` Terminology overrides are manifest-driven: "Party" becomes Patient, Passenger or Citizen across every screen, report, notification and export from a single manifest line.
- `KRN-19-FR-003` Untranslated keys fall back predictably and are reported, never rendered as raw keys.

---

## KRN-20 · Licensing & Entitlement

**Purpose.** Enforces what a tenant has bought, at the metadata layer.

**Entities owned:** `plan`, `sku`, `entitlement`, `seat_assignment`,
`usage_meter`, `usage_record`, `grace_state`.

**Requirements**
- `KRN-20-FR-001` Entitlements are checked at the metadata layer, so an unpurchased module is invisible in navigation, absent from search, and rejected at the API boundary.
- `KRN-20-DR-001` Data contracts for unpurchased modules still exist, so an upgrade is instantaneous and requires no migration.
- `KRN-20-FR-002` Seats are metered by user type (Vol 0 §33.4): full, light, self-service and external, priced differently.
- `KRN-20-FR-003` Usage meters record billable events (transactions, documents, inference tokens) without themselves becoming a performance cost.
- `KRN-20-FR-004` Grace states degrade rather than lock: an expired tenant retains read access and export for a defined period before suspension.
- `KRN-20-FR-005` Inference budgets (Vol 0 §29.2) are enforced here; exceeding one degrades AI features but never blocks a business transaction (L8).

---
---

# PART 3 — KERNEL ACCEPTANCE GATE

Phase 0 does not close until all of the following pass:

- [ ] All 20 kernel modules meet Vol 6 §5 definition of done
- [ ] Contract tests pass for every kernel API and event schema
- [ ] A `tnt` customisation survives a simulated platform upgrade (KRN-04)
- [ ] Tenant isolation tests pass under all three isolation tiers (KRN-01)
- [ ] Gapless numbering holds under 200-way concurrency (KRN-11)
- [ ] Offline conflict scenarios resolve per declared policy (KRN-16)
- [ ] A cross-module reversal executes correctly with preview (KRN-18)
- [ ] Permission parity across API, export, search and analytics (KRN-03, KRN-17)
- [ ] Audit chain verification passes on a tampered-record test (KRN-10)
- [ ] Event outbox guarantees hold under induced failure (KRN-06)

**No L2 application module begins before this gate closes.**

---

*End of Volume 1.*
