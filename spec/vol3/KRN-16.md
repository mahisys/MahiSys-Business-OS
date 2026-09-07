# KRN-16 · Sync & Offline Service

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-01, KRN-02, KRN-03, KRN-06, KRN-11, KRN-15, KRN-18

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-16)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

Local-first capture with deterministic conflict resolution (T12). This is
the kernel guarantee that makes PR-04, PR-05, PR-07, PR-09, PR-13, PR-19 and
PR-20 — the floor and field personas who represent the majority of daily
transaction volume in a manufacturing or distribution tenant (Vol 0 §7.3) —
able to use the system at all. Without KRN-16, offline is a per-app
afterthought each module reinvents badly; with it, offline is a declared
per-module contract (`full` / `read` / `online`) backed by one deterministic
mechanism (Vol 0 §11 KRN-16).

Not bought directly — `included` platform-fee substrate. There is no single
"buyer" persona: KRN-16 is invisible infrastructure to the floor and field
personas who benefit from it (they simply keep working with no signal bar),
and its operational surface belongs to PR-21 (System Administrator), who
monitors sync health and device sessions, plus whichever domain persona has
write authority over a record that lands in a queued-for-review conflict.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-04 Shop Floor Supervisor | Logs production offline; conflicts arising from concurrent online replanning are queued for their plant head to review |
| PR-05 Store / Warehouse Keeper | Moves stock offline via scanner; quantities always resolve server-authoritatively on sync |
| PR-07 Quality Inspector | Captures inspection readings offline |
| PR-09 Field Sales / Beat Rep | Captures outlet orders and visits offline, syncs on connectivity |
| PR-13 Field Service Technician | Captures job cards, parts consumption and signatures offline |
| PR-19 Employee | Marks attendance/leave via mobile self-service offline |
| PR-20 Contract Labour Supervisor | Captures gate/attendance headcount offline |
| PR-21 System Administrator | Monitors sync sessions, lag, conflict rate and the conflict-review queue; revokes a lost/decommissioned device's sync session |
| PR-03 Plant / Production Head, PR-08 Sales Manager, PR-16 CFO, and other domain approvers | Resolve queued-for-review conflicts within their own module's records — the persona who resolves a conflict is whoever already has write authority over that record type in the owning module (§17) |

## 3. Scope in / scope out

**In scope:** per-module offline profile declaration and enforcement; local
capture with event-time/transaction-time separation; deterministic conflict
resolution per Vol 0 §9.2's three policies (last-writer-wins,
server-authoritative, queued-for-review); resumable, bandwidth-aware,
crash-safe sync; device/session management; the rule that statutory
documents are captured offline but never issued offline (KRN-16-DR-001).

**Out of scope:** the local mobile app's UI/UX for capture screens — those
are KRN-13-generated per owning module, KRN-16 only provides the
local-write-then-sync mechanism beneath them. The business meaning of a
conflict (e.g. *which* production log is "correct") — KRN-16 provides the
policy engine, the queue and the audit; the human or process that resolves
a queued conflict belongs to the owning module's process (KRN-05). Document
numbering itself (KRN-11 issues the number) and reversal of an applied
change (KRN-18 owns the reversal handle) — KRN-16 calls both, it does not
duplicate either.

## 4. Entities owned; entities consumed

**Owned:** `sync_session`, `sync_batch`, `change_record`, `conflict`,
`offline_profile`.

**Consumed (by ID):** `KRN-02` (`device`, `user` — a sync session belongs to
a registered device and an authenticated actor), `KRN-11` (document number
allocation at issue time, KRN-16-DR-001), `KRN-15` (large/long-running batch
application executes as a `job_run`, §17), `KRN-18` (every applied
`change_record` still registers its own reversal handle through the owning
module's normal write path — KRN-16 does not bypass L5). Consumed by
reference only, per L3 — KRN-16 never writes into an owning module's tables
directly; it applies a `change_record` by calling that module's own write
path (the same API/service call an online client would make), so every
normal invariant, permission check and event emission that path already
enforces still applies to an offline-originated change.

### 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every entity below. Not
field-detailed in Vol 1 — all of §4.1 is extrapolated; flagged in §17.

**`offline_profile`**:

| Field | Type | Notes |
|---|---|---|
| `module_id` | string | e.g. `MFG-04` |
| `entity_type` | string, nullable | Null = applies to the whole module; set = per-entity override within a module |
| `profile` | enum | `full` \| `read` \| `online` (KRN-16-FR-001) |
| `field_conflict_policy` | JSONB, nullable | Per-field override of the module-level default (e.g. most fields inherit `last_writer_wins`, `quantity` fields are pinned `server_authoritative`) |
| `local_retention_days` | integer | TTL for locally cached data on the device |
| `manifest_override_allowed` | boolean | Whether a VDL manifest (Vol 0 §30 `offline_profiles`) may override this per vertical without a code change |

**`sync_session`**:

| Field | Type | Notes |
|---|---|---|
| `device_id` | ref | `KRN-02.device` |
| `user_id` | actor ref | |
| `app_version` | string | |
| `platform` | enum | `android` \| `ios` \| `web_pwa` |
| `opened_at`, `last_sync_at` | timestamptz | |
| `status` | enum | `active` \| `stale` \| `revoked` |

**`sync_batch`**:

| Field | Type | Notes |
|---|---|---|
| `sync_session_id` | ref | |
| `batch_seq` | integer | Monotonic per session, for ordering and resumability (KRN-16-FR-005) |
| `submitted_at` | timestamptz | Device local clock — untrusted for authority, used only for UX/diagnostics |
| `received_at` | timestamptz | Server transaction time |
| `status` | enum | `pending` \| `applying` \| `applied` \| `partially_applied` \| `failed` |
| `change_record_count` | integer | |
| `network_condition` | string, nullable | Declared bandwidth class, for adaptive batching (KRN-16-FR-005) |
| `checksum` | string | Integrity check on the batch payload |

**`change_record`**:

| Field | Type | Notes |
|---|---|---|
| `sync_batch_id` | ref | |
| `entity_type`, `entity_id` | string, ref | `entity_id` is a device-generated UUIDv7 even for offline-created records — collision-safe by construction, so no server-side ID remapping is required (§17) |
| `operation` | enum | `create` \| `update` \| `delete` |
| `field_diffs` | JSONB | `{field: {old, new}}` — the unit `last_writer_wins` resolves over, per field, not per record |
| `occurred_at` | timestamptz | Event time — when captured on the device (Vol 2 §1.6) |
| `recorded_at` | timestamptz | Transaction time — set on server apply, never on the device |
| `device_sequence_no` | integer | Per-device monotonic ordering, independent of `batch_seq` |
| `idempotency_key` | string | Client-generated; a retried batch never double-applies (KRN-16-FR-008 addition) |
| `status` | enum | `pending` \| `applied` \| `conflicted` \| `rejected` |
| `applied_reference` | ref, nullable | The resulting `P-06 Transaction`/event once posted through the owning module's write path |
| `geo_stamp` | GeoStamp, nullable | Vol 2 §1.4 |

**`conflict`**:

| Field | Type | Notes |
|---|---|---|
| `change_record_id` | ref | |
| `conflict_type` | enum | `concurrent_field_update` \| `stock_or_financial_authority` \| `deleted_upstream` \| `statutory_reissue_blocked` |
| `server_version_snapshot`, `device_version_snapshot` | JSONB | Full context for review (KRN-16-FR-004) |
| `resolution_policy` | enum | `last_writer_wins` \| `server_authoritative` \| `queued_for_review` |
| `status` | enum | `open` \| `resolved` |
| `resolved_by` | actor ref, nullable | |
| `resolved_at` | timestamptz, nullable | |
| `resolution` | enum, nullable | `accepted_device` \| `accepted_server` \| `merged` \| `rejected` |
| `review_note` | string, nullable | |

## 5. State machines

**`sync_session.status`:** `active → stale` (no sync within a declared
inactivity window) `→ active` (resumes on next successful sync) or `→
revoked` (explicit admin action, e.g. a lost device — KRN-16-FR-006
addition). `revoked` is terminal; a revoked session's device must
re-register (KRN-02) to sync again, and any of its unapplied local data is
never silently trusted on re-registration — it is re-submitted as new
batches subject to the same conflict evaluation.

**`sync_batch.status`:** `pending → applying`, then `applying → applied`
(all `change_record`s applied cleanly), `applying → partially_applied`
(some conflicted/rejected, the rest applied — KRN-16-FR-009 addition), or
`applying → failed` (transport/integrity failure, e.g. checksum mismatch —
retried as a fresh submission, not resumed mid-batch).

**`change_record.status`:** `pending → applied` (clean), or `pending →
conflicted` (a `conflict` row is created; from there `queued_for_review`
policy holds it until a human resolves it, while `last_writer_wins` and
`server_authoritative` resolve immediately and the `change_record` still
ends in `applied` or a determined-`rejected` state — see §15), or `pending →
rejected` (e.g. permission check fails on apply, KRN-03 scope has since
changed).

**`conflict.status`:** `open → resolved`, only reachable for
`queued_for_review` conflicts through an explicit human resolution
(KRN-16-FR-004); `last_writer_wins` and `server_authoritative` conflicts are
recorded for audit but resolve programmatically and do not sit `open`.

## 6. Standard functional requirements

- `KRN-16-FR-001` Every module declares an offline profile: `full`, `read` or `online`. *(Vol 1, verbatim)*
- `KRN-16-FR-002` Offline capture records event time separately from transaction time (Vol 2 §1.6). *(Vol 1, verbatim)*
- `KRN-16-FR-003` Conflict policy per Vol 0 §9.2: last-writer-wins for independent fields; server-authoritative for stock and financial quantities; queued-for-review where a machine should not decide. *(Vol 1, verbatim)*
- `KRN-16-FR-004` Queued conflicts are presented with both versions and full context; resolution is audited. *(Vol 1, verbatim)*
- `KRN-16-FR-005` Sync is resumable, bandwidth-aware and safe across app termination. *(Vol 1, verbatim)*
- `KRN-16-FR-006` A device's `sync_session` can be revoked by an administrator (e.g. a lost or decommissioned device), after which its data no longer syncs without re-registration through KRN-02, and any pending local changes it later attempts to submit are re-evaluated under current permission and conflict rules rather than trusted as already-authorised. *(Addition — necessary for SEC-01/SEC-07 device-loss handling, not itemised in Vol 1.)*
- `KRN-16-FR-007` Locally cached data on a device is bounded by a declared retention TTL per `offline_profile`, so a device does not accumulate unbounded sensitive data while offline for an extended period. *(Addition — an NFR/storage-and-privacy consequence of local-first capture that Vol 1's abbreviated section does not spell out.)*
- `KRN-16-FR-008` Every `change_record` carries a client-generated idempotency key; a retried batch (e.g. after a connection drop mid-submission) never applies the same change twice. *(Addition — the offline-specific instance of KRN-15-FR-001's general idempotency contract, necessary because a device cannot know whether its last submission was received before retrying.)*
- `KRN-16-FR-009` A `sync_batch` applies partially: `change_record`s with no conflict are applied even when others in the same batch conflict, rather than the whole batch failing together. *(Addition — required for a usable floor/field UX; a single stale-reassignment conflict must not block an entire shift's production log from posting.)*

## 7. Differentiating requirements

- `KRN-16-DR-001` Statutory documents (invoices, e-way bills) are never issued offline; they are captured offline and issued on sync, with the number allocated at issue. *(Vol 1, verbatim.)* This is the mechanism that keeps KRN-11's gapless-sequence guarantee intact under offline capture: a device may fully compose an invoice offline (lines, amounts, customer) but it is held in a pre-issue state with no `document_number` until the sync that reaches KRN-11 succeeds — an offline device is structurally incapable of allocating a statutory number, by construction, not by policy discipline alone.
- `KRN-16-DR-002` Offline profile is declared per module but is itself a manifest-overridable attribute (Vol 0 §30 `offline_profiles`), the same way isolation tier is a tenant attribute (KRN-01-DR-001) rather than a deployment decision. A vertical manifest may promote a module's default profile (e.g. `OPS-10` shipping `read` by default but declared `full` in the Manufacturing manifest's `offline_profiles: {MFG-04: full, MFG-06: full, SCM-02: full, OPS-10: full}`, Vol 0 §30) without any KRN-16 code change — only declared data differs. *(Addition, generalising the pattern KRN-01-DR-001 already establishes for isolation tier.)*

## 8. Agents

None registered by KRN-16 itself. It is, however, the acquisition layer
several agents' input ultimately passes through: `MFG-AG-05` (Job Work
Ageing Watchdog) reasons over material-sent/received data that PR-05/PR-07
frequently capture offline at a subcontractor site; `SCM-AG-01` (Stockout
Forecaster) and `SCM-AG-02` (Dead Stock Detector) consume stock movements
that may originate from an offline-`full` `SCM-02` capture. KRN-16 does not
gate or filter what those agents see — a synced, applied `change_record`
becomes an ordinary event on KRN-06 indistinguishable from an online one,
which is precisely the point (§15).

## 9. Screens and flows

All screens are KRN-13-generated from KRN-04 metadata (L6).

- **Sync status indicator** (mobile app, persistent) — every offline
  persona: online/offline/syncing state, pending batch count, last
  successful sync time.
- **Sync & device health** (web) — PR-21 only: active sessions per device,
  lag, conflict rate, revoke-device action.
- **Conflict review inbox** — surfaced *inside the owning module's own
  screen*, not a separate KRN-16 screen: e.g. a work order shows a "sync
  conflict pending your review" banner to PR-03, a beat-plan visit shows
  one to PR-08. KRN-16 provides the queue, the both-versions context
  (KRN-16-FR-004) and the audit; the reviewing persona and the surface it
  appears on is domain-specific (§17).

## 10. API surface

Base per Vol 0 §42: `/api/v1/core/{entity}`.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/core/sync/sessions` | Opens a session for a registered device (KRN-02); returns `sync_session` |
| DELETE | `/api/v1/core/sync/sessions/{id}` | Revokes a session (PR-21, or the device's own user for self-service device removal) |
| POST | `/api/v1/core/sync/batches` | The core sync endpoint — device submits a `sync_batch` of `change_record`s; idempotent by `sync_batch.checksum` + `batch_seq` |
| GET | `/api/v1/core/sync/batches/{id}` | Status, per-`change_record` outcome |
| GET | `/api/v1/core/sync/conflicts` | Filterable by `status`, `entity_type`, `resolution_policy`; scoped to the caller's KRN-03 authority over the underlying record |
| POST | `/api/v1/core/sync/conflicts/{id}/resolve` | `{resolution, review_note}` — only for `queued_for_review` conflicts still `open` |
| GET | `/api/v1/core/offline-profiles` | Read the resolved (manifest-applied) profile per module/entity |

All list endpoints: cursor pagination, declared filters, field selection.
All writes: idempotency key required (Vol 1 §1.2) — `sync/batches` doubly
so, given KRN-16-FR-008.

## 11. Permission matrix by persona

Actions: `sync.submit` (own device/session only), `sync.session.read` (own),
`sync.session.revoke`, `conflict.read` (scoped to records they have write
authority over), `conflict.resolve`.

| Persona | sync.submit | sync.session.read | sync.session.revoke | conflict.read (own scope) | conflict.resolve (own scope) |
|---|---|---|---|---|---|
| PR-04, PR-05, PR-07, PR-09, PR-13, PR-19, PR-20 (offline personas) | ✓ (own device/session) | ✓ (own) | ✗ | ✓ (conflicts on records they authored, read-only) | ✗ |
| PR-03 Plant Head, PR-08 Sales Manager, and other domain approvers with write authority over the conflicted record's module | ✗ | ✗ | ✗ | ✓ (within their module scope) | ✓ (within their module scope) |
| PR-21 System Administrator | ✗ (not a device) | ✓ (all) | ✓ | ✓ (all) | ✗ (resolution is a domain decision, not an admin one — PR-21 may reassign a stuck conflict but does not adjudicate its content) |
| All other personas | ✗ | ✗ | ✗ | ✗ | ✗ |

**Negative cases:**
- A device submitting a batch under a `sync_session` that has been revoked
  → 401/403, the batch is rejected outright (not queued), and the client is
  forced through KRN-02 re-registration.
- A `stock_or_financial_authority` conflict never appears in anyone's
  `conflict.resolve` queue — by definition it is `server_authoritative` and
  resolves programmatically; a persona attempting to manually resolve one
  via the API → 409 (not applicable, already resolved).
- PR-04 (the supervisor who authored a conflicted production log) attempting
  to resolve their own conflict → 403; resolution authority belongs to the
  persona with approval standing over that record (PR-03), not the
  originator, to preserve segregation of concerns.
- PR-21 attempting `conflict.resolve` directly → 403 per the row above;
  PR-21's remedy is reassignment/escalation, not adjudication.

## 12. Events emitted / consumed

**Emitted:**
- `core.sync.session_opened`
- `core.sync.session_revoked`
- `core.sync.batch_received`
- `core.sync.batch_applied`
- `core.sync.batch_partially_applied`
- `core.sync.batch_failed`
- `core.sync.conflict_raised`
- `core.sync.conflict_resolved`

KRN-16 does **not** emit the underlying business events for an applied
change (e.g. `mfg.production.logged`, `scm.stock.moved`) — those are
emitted by the owning module's own write path at the moment KRN-16 calls it
to apply a `change_record` (L3, L4). This is deliberate: a downstream
subscriber to `mfg.production.logged` should never need to know or care
whether the production log arrived online or via offline sync — the event
looks identical either way, only its `occurred_at`/`recorded_at`
divergence (KRN-16-FR-002) tells the story.

**Consumed:** none via subscription. Inbound is exclusively the device's
sync batch payload via the `sync/batches` API — KRN-16 is invoked, it does
not listen for triggers, mirroring KRN-01's pattern of foundational modules
that initiate rather than react.

## 13. Reports and KPIs

- Sync lag, p50/p95: `occurred_at` (device capture) to `recorded_at`
  (server apply).
- Conflict rate per module and per `conflict_type`.
- Conflict resolution SLA (time `open` before `resolved`), per resolving
  persona/team.
- Active offline sessions and device count, by platform.
- Batch failure/partial-application rate.
- Local storage/bandwidth per sync (device-reported), for `local_retention_days`
  tuning.

## 14. Compliance touchpoints

- KRN-16-DR-001 is itself a compliance control: it is structurally
  impossible for CMP-02 (e-invoicing) or CMP-03 (e-way bill) to issue a
  statutory document offline, because the number allocation KRN-11 performs
  requires the sync round-trip.
- CMP-06 (Regulated Records) tenants depend on `occurred_at`/`recorded_at`
  separation (KRN-16-FR-002) to keep a validated record's *true* event time
  intact even when capture and posting are hours apart — a GxP or clinical
  record's meaning depends on when the observation actually happened, not
  when the device finally had signal.
- SEC-07 (DPDP): `local_retention_days` (KRN-16-FR-007) bounds how long
  personal data sits unencrypted-in-practice risk on a device; a lost
  device's session revocation (KRN-16-FR-006) is the operational control
  that pairs with it.
- Every applied `change_record` still carries its originating `source =
  offline_sync` (Vol 2 §1.2 universal field) into the resulting record, so
  KRN-10 audit and any statutory evidence trail can always show a
  transaction was captured offline and when it was actually posted.

## 15. Offline behaviour

This section is the module's core subject matter, not boilerplate — KRN-16
*is* the offline behaviour of the platform.

### 15.1 The offline profile contract

Every module declares exactly one of three profiles (KRN-16-FR-001), and
the profile is what every other module's Vol 3 §15 section will cite by
reference rather than restate:

| Profile | Meaning | Example |
|---|---|---|
| `full` | Capture and read work fully offline; changes queue and sync when connectivity returns | MFG-04, MFG-06, SCM-02, SCM-03, SLS-10, DLV-05, DLV-07, PPL-05, OPS-10 (Vol 0 §9.2 launch list) |
| `read` | Cached read only; no offline capture | e.g. KRN-14 search results (§17 of KRN-14.md) |
| `online` | Requires connectivity for both read and write | e.g. KRN-01 tenant/entity administration |

A module's declared default may be overridden per vertical by a VDL
manifest (KRN-16-DR-002) — e.g. `OPS-10` (Visitor & Gate Management) is
declared `full` specifically in the Manufacturing manifest (Vol 0 §30),
reflecting that a factory gate genuinely needs offline gate-pass capture
even where a services-vertical manifest might leave it `read`.

### 15.2 Conflict policy, worked

Vol 0 §9.2 sets three policies; KRN-16-FR-003 binds them to field
categories, not to whole records — a single `change_record` can have some
fields resolve one way and others another:

**Last-writer-wins (independent fields).** A field with no cross-cutting
business consequence — a contact's preferred-channel flag, a free-text
note, a UI preference. *Worked example:* PR-09 updates an outlet's
"preferred delivery day" offline at 10:00; a telecaller updates the same
field online at 11:00 while PR-09 is still offline. On sync at 14:00, the
11:00 (later) value wins because timestamp ordering is the entire policy —
no review, no queue.

**Server-authoritative (stock and financial quantities).** A field where an
offline device's view, by definition, cannot be current — inventory
on-hand, a ledger balance, a credit limit consumed. *Worked example:*
PR-05 issues 40 units offline against a bin the server shows holding 35 at
sync time (another movement posted online in the meantime). The device's
*movement* (issue of 40) is still applied — quantities are not silently
dropped — but it is applied against the server's current on-hand state at
apply time, and if that would drive the bin negative outside a tenant's
permitted variance, the movement is rejected with a clear reason rather
than corrupting the balance; the device is never treated as authoritative
for a quantity it could not have observed live.

**Queued-for-review (a machine should not decide).** Anything with business
judgement attached — a reassignment that conflicts with offline progress
already logged against the original assignment, a status transition
disagreement, a deletion upstream of an offline edit. This is where the
Vol 1 acceptance sample lives (reproduced in full at KRN-16-FR-003 below):
production quantities post (they are the server-authoritative, unambiguous
part), the reassignment is preserved (it happened validly online), and the
*conflict between them* — should this work order's plan really have
changed mid-shift — is queued for PR-03 to look at with both versions in
front of them, never auto-resolved.

### 15.3 Device and session lifecycle offline

A device holds an active `sync_session` for as long as its user is
registered and the session is not stale/revoked. Capture continues locally
regardless of connectivity; `change_record`s accumulate with
`device_sequence_no` ordering so that, even if batches arrive out of network
order, application order within a device is reconstructable. A device that
has been offline for longer than `local_retention_days` on a given
`offline_profile` degrades its local read cache (older cached read data is
purged) without affecting its ability to keep capturing new records — the
TTL bounds *cached-for-reading* data, not queued-for-sync writes, which are
never dropped by a retention policy (only by an explicit local-clear action
the app itself would gate behind a warning, out of KRN-16's scope).

### 15.4 Resumability and partial application

A batch is chunked and checksummed so a dropped connection mid-transfer
resumes from the last acknowledged chunk rather than restarting (KRN-16-FR-005).
Once received, a batch applies `change_record` by `change_record`
(KRN-16-FR-009): a floor supervisor's six-hour shift log of forty production
entries, one of which conflicts, posts thirty-nine cleanly and queues one —
never the reverse of blocking thirty-nine valid entries behind one disputed
one.

## 16. Acceptance criteria (Given/When/Then)

**KRN-16-FR-001 — declared offline profile per module**
> Given `SCM-02` (Inventory) is declared `full` and `KRN-01` (Tenancy) is declared `online`
> When a device attempts to capture a stock movement while offline, and separately attempts to open a new legal entity while offline
> Then the stock movement is accepted locally and queued for sync, while the legal-entity creation is blocked at the app layer with a "requires connectivity" state, consistent with each module's declared profile.

**KRN-16-FR-002 — event time recorded separately from transaction time**
> Given a supervisor logs a production quantity at 14:05 while offline, and the device syncs at 19:30
> When the `change_record` is applied
> Then the resulting record's `occurred_at` reads 14:05 and its `recorded_at` reads 19:30, both persisted, and any report grouping "today's production by hour" places the entry at 14:05, not 19:30.

**KRN-16-FR-003 — conflict policy: server-authoritative and queued-for-review together (Vol 1 acceptance sample, expanded)**
> Given a supervisor logs 6 hours of production offline against work order `WO-1001` while a planner reassigns `WO-1001`'s remaining operations to a different work centre online
> When the device syncs
> Then the production quantities post against `WO-1001`'s original booked operation (server-authoritative for the quantity — no stock is double-counted), the online reassignment is preserved as-is, a `conflict` with `resolution_policy = queued_for_review` is raised showing both the supervisor's logged operation context and the planner's reassignment, and it is not auto-resolved — it remains `open` until PR-03 reviews and resolves it, at which point the resolution is recorded in KRN-10.

**KRN-16-FR-004 — queued conflicts show full context, resolution audited**
> Given the `conflict` from the scenario above, still `open`
> When PR-03 opens the conflict review inbox
> Then both `server_version_snapshot` (the planner's reassignment) and `device_version_snapshot` (the supervisor's offline production context) are shown in full, and once PR-03 submits a resolution, `resolved_by`, `resolved_at` and `review_note` are recorded and visible in KRN-10's audit trail.

**KRN-16-FR-005 — resumable, bandwidth-aware, crash-safe sync**
> Given a device has transmitted 3 of 5 chunks of a `sync_batch` when connectivity drops, and the app is then force-closed
> When the app reopens and connectivity returns
> Then the sync resumes from chunk 4 rather than retransmitting chunks 1-3 or losing the batch, and no `change_record` already acknowledged by the server is resubmitted.

**KRN-16-FR-006 — device session revocation**
> Given a field technician's tablet is reported lost and PR-21 revokes its `sync_session`
> When the tablet later regains connectivity and attempts to submit a queued batch
> Then the submission is rejected with an authentication/re-registration requirement, and no data from that device applies until a new session is established through KRN-02 under proper device re-verification.

**KRN-16-FR-007 — bounded local retention**
> Given `offline_profile.local_retention_days = 14` for `SLS-10`'s cached outlet list
> When a beat rep's device has been offline for 20 days
> Then cached outlet read data older than 14 days is purged from the device's local read cache on next app launch, while any of the rep's own unsynced captured orders from those 20 days remain queued and intact, unaffected by the read-cache TTL.

**KRN-16-FR-008 — idempotent change application**
> Given a `change_record` with idempotency key `K1` is applied successfully, and the device — unaware the acknowledgement was lost in transit — resubmits the same batch containing `K1`
> When the resubmission is processed
> Then no second stock movement, production log, or any other duplicate effect occurs for `K1`; the server recognises the key and returns the original outcome.

**KRN-16-FR-009 — partial batch application**
> Given a `sync_batch` of 40 `change_record`s where 1 raises a `queued_for_review` conflict and 39 apply cleanly
> When the batch is processed
> Then the batch reaches `partially_applied` status, all 39 clean records are posted and visible immediately, and only the 1 conflicting record is held — the supervisor's shift is not blocked waiting on one disputed entry.

**KRN-16-DR-001 — statutory documents never issued offline**
> Given a route salesman composes a tax invoice offline, fully priced and lined, while out of network coverage
> When the device is offline
> Then no `document_number`, IRN, or e-way bill number is allocated, the document sits in a pre-issue captured state locally, and only once the device syncs and KRN-11 allocates the number in sequence does the invoice become an issued statutory document — at no point does an offline device hold or generate a valid statutory number itself.

**KRN-16-DR-002 — manifest-overridable offline profile**
> Given `OPS-10` ships with a platform default profile of `read`, and the Manufacturing VDL manifest (Vol 0 §30) declares `offline_profiles: {OPS-10: full}`
> When a tenant provisioned under the Manufacturing manifest opens `OPS-10`'s gate-pass capture screen while offline
> Then it behaves as `full` (capture works offline) for that tenant, while a tenant provisioned under a manifest with no such override sees `OPS-10` behave as `read` (capture blocked offline) — with zero KRN-16 code difference between the two tenants, only declared manifest data.

## 17. Open questions

Flagged per Vol 6 §4/L13:

1. **Field-level detail for `sync_session`, `sync_batch`, `change_record`,
   `conflict`, `offline_profile`** (§4.1) is not given in Vol 1 — only
   entity names and purpose, plus the one acceptance sample. Please confirm
   or amend.
2. **Who resolves a queued-for-review conflict is domain-specific and not
   stated in Vol 1.** This draft assumes the persona with existing write/
   approval authority over the conflicted record's owning module resolves
   it (e.g. PR-03 for a `MFG-04` work-order conflict, PR-08 for an `SLS-10`
   beat-plan conflict), surfaced inside that module's own screen rather
   than a generic KRN-16 inbox. Each offline-`full` module's own Vol 3 file
   should confirm or override this assignment explicitly in its own §11/§15
   as it is written, so KRN-16 and the owning module do not disagree.
3. **Local storage encryption-at-rest and the exact retention TTL default**
   (KRN-16-FR-007) are not specified in Vol 0/1. This draft proposes a
   declared-per-profile TTL with device-level encryption assumed as a
   platform baseline (consistent with SEC-02/SEC-07) rather than something
   KRN-16 itself implements. Confirm the baseline belongs to KRN-02/SEC and
   not to KRN-16.
4. **Offline record identity strategy.** This draft assumes a device
   generates a UUIDv7 for any record created entirely offline (e.g. a new
   outlet visit), which is collision-safe by construction and needs no
   server-side ID remapping on sync. Vol 1 does not state this explicitly;
   confirm this is the intended mechanism rather than a temporary local ID
   with server-side remapping (which would complicate any offline reference
   from one new record to another created in the same offline session).
5. **Batch application execution substrate.** This draft assumes small
   batches apply synchronously within the `sync/batches` request, while
   large batches (a full day's capture from a device that was offline for
   an extended period) enqueue as a KRN-15 `job_run` instead, to avoid an
   unbounded-duration API request. Vol 1 does not state a threshold or
   confirm this split; confirm before load-testing (Vol 0 §36) targets are
   set for the sync endpoint.
6. **Server-authoritative rejection UX.** The worked example in §15.2
   assumes a server-authoritative quantity conflict that would drive a
   balance outside a permitted variance is *rejected* with a reason rather
   than silently clamped or force-applied. Vol 1's acceptance sample (now
   KRN-16-FR-003) only covers the case where the quantity posts cleanly;
   the rejection path is this draft's extrapolation and should be confirmed
   against SCM-02's own Vol 3 file once written, since inventory owns the
   actual variance-tolerance rule (L7-adjacent: KRN-16 should not invent
   business tolerance logic that belongs to the owning module).
