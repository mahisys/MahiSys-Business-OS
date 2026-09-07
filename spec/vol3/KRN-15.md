# KRN-15 · Scheduler & Job Runtime

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-01, KRN-06, KRN-12

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-15)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

Cron, queues, long-running jobs, retries, idempotency, backpressure and job
observability (Vol 0 §11) — and, critically, the execution substrate every
registered agent (Vol 0 §27) runs on. A Watchdog agent triggered by an event,
a Forecaster agent triggered on a schedule, a Chaser agent triggered by
time-plus-behaviour (Vol 0 §27.1) — all of them execute as a `job_run` on
this module. Without KRN-15, INT-03 (Agent Runtime & Registry) has nothing
to run agents on, and every statutory batch process (GSTR-2B reconciliation,
PF/ESI challan generation, e-way bill extension sweeps) has nowhere to live.

Not bought directly — `included` platform-fee substrate. The direct user of
its operational surface is PR-21 (System Administrator), who monitors job
health and replays failures; business personas who own a scheduled outcome
(PR-16 CFO scheduling a monthly statement export, PR-18 Payroll Officer
watching a payroll run) see a thin, module-embedded status view rather than
this module's own screens.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Monitors queue depth, job success rate and the dead-letter/failure queue; replays or cancels jobs; manages per-tenant concurrency limits |
| PR-16 Finance Controller / CFO, PR-15 Accountant | Schedules recurring report/statement distribution (via STU-04) and watches its run status |
| PR-18 Payroll Officer | Watches the payroll-run job's progress and outcome |
| PR-28 Implementation Partner | Views job status for the tenant they are provisioning, scoped to the provisioning window |
| PR-29 Agent | Is the *subject* of most `job_run` executions, not a screen user — every Watchdog, Forecaster, Chaser, Reconciler, Scribe, Analyst, Planner and Guardian agent (Vol 0 §27.1) executes here |

Every other persona benefits from KRN-15 invisibly: any module's background
process, scheduled report, or agent action they eventually see the result of
ran through this substrate.

## 3. Scope in / scope out

**In scope:** job definition registration; cron and interval scheduling
respecting tenant timezone and business calendar; job execution, retry,
backoff and dead-lettering; per-key mutual exclusion (locking); progress
reporting and cancellation for long-running jobs; per-tenant concurrency
limiting and backpressure; job observability (queue depth, duration,
failure rate).

**Out of scope:** *what* a job does — that is owned entirely by the module
that registered the `job_definition` (L3: KRN-15 never reaches into a
module's tables to do its work; it invokes the module's own registered
handler). Agent identity, versioning, trust ceiling and promotion (INT-03,
INT-04) — KRN-15 runs the job an agent triggers; it does not decide whether
that agent is allowed to. Event publication semantics and the event store
itself (KRN-06) — a job may emit events as part of its work, using KRN-06
directly, not a KRN-15-specific mechanism. Statutory batch *logic* (CMP-01
GST, CMP-04 TDS thresholds) — KRN-15 schedules and runs the batch; the
compliance module owns what it computes (L7).

## 4. Entities owned; entities consumed

**Owned:** `job_definition`, `job_run`, `schedule`, `job_lock`,
`retry_policy`.

**Consumed (by ID):** `KRN-01` (`tenant.region`/timezone and
`fiscal_calendar` context for schedule resolution), `KRN-12`
(`calendar`/`holiday` for business-calendar-aware scheduling,
KRN-15-FR-002). Both consumed by reference only (IDs stored, values
resolved via each module's own API), never by direct table read (L3).

### 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every entity below. Not field-detailed
in Vol 1 for any KRN-15 entity — all of §4.1 is extrapolated; flagged in
§17.

**`job_definition`**:

| Field | Type | Notes |
|---|---|---|
| `owning_module` | string | Module ID that registered this job (e.g. `FIN`, `CMP`, or a specific agent's owning module) |
| `code` | string | Unique within `owning_module` |
| `name` | string | |
| `handler_ref` | string | Internal reference to the registered execution entry point — never a raw code string, to keep KRN-15 declarative about *which* job runs, not *what* it does |
| `namespace` | enum | `sys` (platform-registered) \| `tnt` (tenant-authored, e.g. a STU-07 agent or STU-04 scheduled report) |
| `idempotency_key_template` | string | How a `job_run`'s idempotency key is derived (KRN-15-FR-001) |
| `default_retry_policy_id` | ref | |
| `concurrency_key_template` | string, nullable | Drives `job_lock` — e.g. one active payroll run per `entity_id` |
| `timeout_seconds` | integer | |
| `default_priority` | enum | `low` \| `normal` \| `high` |
| `status` | enum | `active` \| `disabled` |

**`schedule`**:

| Field | Type | Notes |
|---|---|---|
| `job_definition_id` | ref | |
| `cron_expression` | string, nullable | Mutually exclusive with `interval_seconds` |
| `interval_seconds` | integer, nullable | |
| `timezone` | string | Defaults to the owning `legal_entity`'s timezone (KRN-01) |
| `business_calendar_id` | ref, nullable | `KRN-12.calendar` — schedule shifts to the next business day when it would otherwise fire on a holiday (KRN-15-FR-002) |
| `next_run_at` | timestamptz | |
| `enabled` | boolean | |
| `effective_from`, `effective_to` | timestamptz, nullable | |

**`job_run`**:

| Field | Type | Notes |
|---|---|---|
| `job_definition_id` | ref | |
| `schedule_id` | ref, nullable | Null for event-triggered or manually-triggered runs |
| `trigger_type` | enum | `schedule` \| `event` \| `manual` \| `agent` |
| `trigger_event_name`, `trigger_event_id` | string, ref, nullable | Set when `trigger_type = event` |
| `triggered_by` | actor ref | |
| `idempotency_key` | string | Derived per `job_definition.idempotency_key_template` (KRN-15-FR-001) |
| `status` | enum | `queued` \| `running` \| `succeeded` \| `failed` \| `dead_letter` \| `cancelled` |
| `attempt_no` | integer | |
| `progress_pct`, `progress_message` | number, string, nullable | KRN-15-FR-004 |
| `cancellation_requested_at` | timestamptz, nullable | |
| `started_at`, `completed_at` | timestamptz | |
| `input_payload` | JSONB | |
| `output_summary` | JSONB, nullable | |
| `error` | JSONB, nullable | `{code, message, retryable}` |

**`job_lock`**:

| Field | Type | Notes |
|---|---|---|
| `lock_key` | string | `{tenant_id}:{concurrency_key}` composite |
| `held_by_job_run_id` | ref | |
| `acquired_at`, `expires_at` | timestamptz | Lease-based — a crashed worker's lock expires rather than deadlocking the key forever (KRN-15-FR-007) |

**`retry_policy`**:

| Field | Type | Notes |
|---|---|---|
| `max_attempts` | integer | |
| `backoff_base_seconds`, `backoff_multiplier`, `backoff_ceiling_seconds` | number | Exponential backoff (KRN-15-FR-003) |
| `retry_on` | list<string> | Error classes considered retryable; others dead-letter immediately |

## 5. State machines

**`job_run.status`:** `queued → running`, then `running → succeeded`, or
`running → failed` with a retryable error re-entering `queued` (new
`attempt_no`, delayed per `retry_policy` backoff) until `max_attempts` is
exhausted, at which point it lands in `dead_letter` (KRN-15-FR-003) rather
than being silently dropped. `queued/running → cancelled` is permitted when
`cancellation_requested_at` is set and the handler supports cooperative
cancellation (KRN-15-FR-004). `dead_letter → queued` is permitted only as an
explicit operator replay (PR-21), never automatically.

**`job_lock` (implicit lifecycle, no persisted status field):** *free* (no
row) → *held* (row exists, `expires_at` in the future) → *released* (row
deleted on job completion) or *expired* (row's `expires_at` passes without
release, treated as free for the next acquirer, and the orphaned `job_run`
is marked `failed` with a lock-lost error).

## 6. Standard functional requirements

- `KRN-15-FR-001` Jobs are idempotent by contract; every job declares its idempotency key. *(Vol 1, verbatim)*
- `KRN-15-FR-002` Scheduling respects tenant timezone and business calendar. *(Vol 1, verbatim)*
- `KRN-15-FR-003` Retries use exponential backoff with a declared ceiling; exhausted jobs land in a visible failure queue. *(Vol 1, verbatim)*
- `KRN-15-FR-004` Long-running jobs report progress and are cancellable. *(Vol 1, verbatim)*
- `KRN-15-FR-005` Per-tenant concurrency limits prevent one tenant starving others. *(Vol 1, verbatim)*
- `KRN-15-FR-006` A `job_definition` may be registered by a platform module (`sys`) or, via STU-07 Agent Builder or STU-04 scheduled reports, be tenant-authored (`tnt`) — the runtime does not distinguish execution privilege by namespace; whether a specific agent's job may act is decided entirely by INT-04's trust ceiling, not by KRN-15 (L9). *(Addition — the namespace/trust boundary is architecturally necessary but not stated in Vol 1's abbreviated KRN-15 section.)*
- `KRN-15-FR-007` `job_lock` provides per-key mutual exclusion with lease expiry, so a crashed worker cannot deadlock a concurrency key permanently. *(Addition — implied by "long-running jobs" and general reliability requirements but not itemised in Vol 1.)*
- `KRN-15-FR-008` Dead-lettered jobs are visible in an operator failure queue with full input and error preserved, and are manually replayable by PR-21. *(Addition — makes Vol 1's "visible failure queue" phrase in FR-003 concrete and testable as its own requirement.)*
- `KRN-15-FR-009` Every `job_run` state transition emits an event on KRN-06 (`core.job_run.queued/started/succeeded/failed/dead_lettered/cancelled`), since L4 requires every state change to emit an event and a job run is a first-class state change, not internal noise. *(Addition.)*

## 7. Differentiating requirements

*(Vol 1 states no DR items for KRN-15 — all of §7 is an addition, inferred
from Vol 0 §11's KRN-15 catalogue entry — "backpressure and job
observability" — and from Vol 0 §27's agent architecture. Flagged in §17.)*

- `KRN-15-DR-001` One execution substrate serves both platform-scheduled batch jobs (statutory reconciliation, reindexing, payroll runs) and every registered agent's triggers across all eight agent classes (Vol 0 §27.1). An agent's telemetry, cost accounting and audit trail inherit the same `job_run` record rather than a parallel agent-only scheduler — which is why "what did this agent do today, across modules" (KRN-18-DR-001) has one place to look, not several. *(Addition.)*
- `KRN-15-DR-002` Admission is backpressure-aware: when a tenant's concurrency limit (KRN-15-FR-005) or the platform's own load ceiling is approached, lower-priority jobs queue and degrade gracefully rather than failing hard or blocking higher-priority work — consistent with T15 (never let AI/background load block a business transaction). A burst of agent-triggered jobs never starves a manual, user-initiated action queued behind it. *(Addition.)*

## 8. Agents

None registered by KRN-15 itself — it is structural execution infrastructure
with no autonomous behaviour of its own, exactly as KRN-01 registers none.
It is, however, explicitly **the execution substrate every registered agent
runs on**: `SLS-AG-01..07`, `SCM-AG-01..04`, `MFG-AG-01..06`, `FIN-AG-01..03`,
`OPS-AG-01..05`, `PPL-AG-01`, `DLV-AG-01..02`, `CMP-AG-01`, and any
tenant-authored agent via STU-07 (Vol 0 §27.4) each execute as a `job_run`
against a `job_definition` they registered. INT-03 (Agent Runtime &
Registry) is the layer that binds an agent's identity and version to its
`job_definition`; KRN-15 itself is agent-unaware — it schedules and runs
whatever was registered, by whichever module registered it.

## 9. Screens and flows

All screens are KRN-13-generated from KRN-04 metadata (L6).

- **Job monitor** — PR-21 only: list of `job_definition`s and their
  `schedule`s, live `job_run` status board (queued/running counts, queue
  depth), per-tenant concurrency utilisation.
- **Failure queue** — PR-21 only: dead-lettered `job_run`s with full input
  and error, one-click replay or permanent dismissal (audited).
- **Lock inspector** — PR-21 only, debug surface: currently-held
  `job_lock`s, useful when diagnosing a stuck concurrency key.
- **Module-embedded status widgets** — e.g. PR-18 sees "Payroll run:
  running, 340/512 employees processed" inside PPL-08's own screen, sourced
  from `job_run.progress_pct`/`progress_message` via API, not a KRN-15
  screen.

## 10. API surface

Base per Vol 0 §42: `/api/v1/core/{entity}`. *(Not given in Vol 1 for
KRN-15 — designed here per convention; flagged in §17.)*

| Method | Path | Notes |
|---|---|---|
| CRUD | `/api/v1/core/job-definitions` | Write access restricted to the owning module's service identity or STU-07/STU-04 tooling, never a direct end-user write |
| CRUD | `/api/v1/core/schedules` | |
| GET | `/api/v1/core/job-runs` | Filterable by `job_definition_id`, `status`, `trigger_type`, `entity_id` |
| GET | `/api/v1/core/job-runs/{id}` | Includes `progress_pct` for polling/streaming |
| POST | `/api/v1/core/job-runs/{id}/cancel` | Only where the handler declares itself cancellable (KRN-15-FR-004) |
| POST | `/api/v1/core/job-runs/{id}/replay` | PR-21 only; only from `dead_letter` |
| GET | `/api/v1/core/job-locks` | PR-21 only, debug/read-only |

All list endpoints: cursor pagination, declared filters, field selection.
All writes: idempotency key required (Vol 1 §1.2) — including, notably,
`job-runs` themselves, which is KRN-15-FR-001 applied to its own API.

## 11. Permission matrix by persona

Actions: `job_definition.manage` (register/edit — module/tooling identities,
not end users), `job_run.read` (own module/entity scope), `job_run.cancel`,
`job_run.replay` (dead-letter only), `job_lock.read` (debug).

| Persona | job_definition.manage | job_run.read (own scope) | job_run.cancel | job_run.replay | job_lock.read |
|---|---|---|---|---|---|
| PR-21 System Admin | ✓ | ✓ (all) | ✓ | ✓ | ✓ |
| PR-16 CFO, PR-15 Accountant, PR-18 Payroll Officer, and other module-owning internal personas | ✗ | ✓ (their own module's job runs only) | ✓ (their own triggered runs only, where cancellable) | ✗ | ✗ |
| PR-28 Implementation Partner | ✗ | ✓ (own tenant, provisioning window) | ✗ | ✗ | ✗ |
| PR-29 Agent | ✗ (never its own or another agent's `job_definition` — L9) | ✓ (its own `job_run`s only) | ✗ | ✗ | ✗ |
| All other personas | ✗ | ✗ | ✗ | ✗ | ✗ |

**Negative cases:**
- PR-29 (Agent) attempting to edit its own `job_definition` (e.g. widen its
  `concurrency_key` or raise its `default_priority`) → 403, audited — an
  agent may never modify its own operating parameters (L9), regardless of
  its trust level.
- PR-15 (Accountant) attempting to cancel a payroll `job_run` they did not
  trigger and do not own → 403.
- Any non-PR-21 persona attempting `job-runs/{id}/replay` → 403; replay from
  `dead_letter` is an explicit operator action only.
- A tenant-scoped actor attempting to read another tenant's `job_run`s via a
  crafted filter → 403/empty result, per row-level tenant isolation (L11).

## 12. Events emitted / consumed

**Emitted** (not given in Vol 1 for KRN-15 — designed here; flagged in
§17):
- `core.job_run.queued`
- `core.job_run.started`
- `core.job_run.succeeded`
- `core.job_run.failed`
- `core.job_run.dead_lettered`
- `core.job_run.cancelled`
- `core.schedule.created`
- `core.schedule.updated`

**Consumed:** not a fixed list. KRN-15 dispatches an event-triggered
`job_run` for any event named in a `job_definition`'s declared trigger list
(this is how Watchdog-class agents, Vol 0 §27.1, are invoked) — a
declarative subscription resolved at registration time, not a hard-coded
set. Individual `job_run`s that a module's handler performs may themselves
emit further business events (e.g. `mfg.production.logged`) directly on
KRN-06 as part of doing their work — those are the owning module's events,
not KRN-15's, and KRN-15 does not intermediate them (L3).

## 13. Reports and KPIs

- Queue depth and per-priority backlog age.
- Job success rate and duration, p50/p95/p99, per `job_definition`.
- Dead-letter count and age (platform-internal, PR-21-facing).
- Per-tenant concurrency utilisation against its limit.
- Backpressure incidents (admission delayed/degraded) per tenant per period.

No statutory reports originate in KRN-15 itself — it runs the batch that
produces them (CMP-05 owns the report content).

## 14. Compliance touchpoints

- Statutory batch timing (GSTR-2B reconciliation window, PF/ESI challan due
  dates, e-way bill extension windows) is scheduled here, but the statutory
  *logic* stays entirely inside CMP-01..05 (L7) — KRN-15 only guarantees the
  batch runs, retries on transient failure, and is visibly dead-lettered
  rather than silently missed if it cannot complete, which matters for
  filing deadlines.
- Each individual mutation a `job_run`'s handler performs (e.g. posting a
  reconciled ledger line) still registers its own KRN-18 reversal handle at
  write time (L5) — `job_run` cancellation/replay is a runtime-execution
  concept, not a substitute for per-mutation reversibility.
- CMP-06 (Regulated Records) tenants may require job execution evidence
  (who scheduled it, what ran, what changed) retained as validation
  evidence — satisfied by `job_run`'s full input/output/error retention
  plus KRN-10 audit of every state transition (KRN-15-FR-009).

## 15. Offline behaviour

**Profile: `online`.** KRN-15 is a server-side execution substrate; none of
the offline-first personas (PR-04/05/07/09/13/19/20) interact with it
directly. It is, however, the mechanism that eventually processes a device's
sync batch once connectivity is restored (KRN-16 §15 cross-reference) — the
*device's* capture is offline-capable; the *server-side application* of
that capture, when it involves a large or long-running batch, may run as a
KRN-15 `job_run`.

## 16. Acceptance criteria (Given/When/Then)

**KRN-15-FR-001 — idempotent by contract**
> Given a `job_definition` for "generate monthly GSTR-2B reconciliation" with `idempotency_key_template = {entity_id}:{period}`
> When the same `job_run` request for `entity_id=E1, period=2027-01` is submitted twice (e.g. due to a client retry after a timeout)
> Then exactly one `job_run` executes to completion for that key, and the second submission returns the first's result rather than starting a duplicate run.

**KRN-15-FR-002 — timezone and business calendar aware scheduling**
> Given a `schedule` with `cron_expression` firing daily at 09:00, `timezone = Asia/Kolkata`, and `business_calendar_id` pointing to a calendar where 26-Jan-2027 (Republic Day) is a holiday
> When the schedule would fire on 26-Jan-2027
> Then `next_run_at` shifts to the next business day at 09:00 IST, and a tenant on a different `business_calendar_id` without that holiday fires on 26-Jan-2027 as normal.

**KRN-15-FR-003 — exponential backoff with visible failure queue**
> Given a `retry_policy` with `max_attempts=5`, `backoff_base_seconds=30`, `backoff_multiplier=2`
> When a `job_run`'s handler fails with a retryable error on every attempt
> Then retries occur at approximately 30s, 60s, 120s, 240s intervals, the run lands in `dead_letter` after the 5th failure, and it is immediately visible in PR-21's failure queue with the full error from the last attempt.

**KRN-15-FR-004 — progress reporting and cancellation**
> Given a long-running payroll `job_run` processing 512 employees
> When it has processed 340 and PR-18 requests cancellation
> Then `progress_pct` reflects 66% at the time of the request, `cancellation_requested_at` is set, the handler stops after completing its current unit of work rather than mid-record, and the run's final status is `cancelled` with the 340 already-processed employees' results preserved, not rolled back silently.

**KRN-15-FR-005 — per-tenant concurrency limits**
> Given tenant `T1`'s concurrency limit is 10 simultaneous `job_run`s and `T1` currently has 10 running
> When an 11th job for `T1` is triggered
> Then it queues rather than running, and a concurrent job for a different tenant `T2` starts immediately, unaffected by `T1`'s saturation.

**KRN-15-FR-006 — namespace does not confer execution privilege**
> Given a tenant-authored (`tnt`) `job_definition` created via STU-07 for a new agent at trust level L1 (Suggest)
> When that agent's job attempts an action beyond L1 (e.g. committing a record without human review)
> Then KRN-15 executes the job as scheduled, but the attempted action is rejected by INT-04's trust ceiling enforcement, not by KRN-15 — KRN-15 never inspects or gates on trust level itself.

**KRN-15-FR-007 — lease-based locking survives a crashed worker**
> Given a `job_lock` held for key `T1:payroll-run:E1` by `job_run` `R1`, whose worker process crashes without releasing it
> When `R1`'s lock `expires_at` passes
> Then the lock is treated as free, a new payroll `job_run` `R2` for the same key may acquire it, and `R1` is marked `failed` with a lock-lost error rather than left `running` forever.

**KRN-15-FR-008 — dead-lettered jobs are visible and replayable**
> Given a `job_run` in `dead_letter` with its original `input_payload` and last `error` preserved
> When PR-21 reviews the failure queue and triggers `POST /job-runs/{id}/replay`
> Then a new `job_run` (new `attempt_no` sequence) starts with the same `input_payload`, and the replay action itself is recorded in KRN-10.

**KRN-15-FR-009 — every job_run transition emits an event**
> Given a `job_run` that goes `queued → running → succeeded`
> When each transition occurs
> Then `core.job_run.queued`, `core.job_run.started` and `core.job_run.succeeded` are each published on KRN-06 within the same transaction as the corresponding state write.

**KRN-15-DR-001 — one substrate for platform batches and every agent class**
> Given a scheduled statutory reconciliation batch (Reconciler class) and an event-triggered margin-floor Watchdog agent (`SLS-AG-05`)
> When both execute
> Then both produce a `job_run` record with the same shape, the same telemetry fields, and the same audit and cost-accounting surface — an operator reviewing "everything that ran today" sees both in one list, not two systems.

**KRN-15-DR-002 — graceful backpressure**
> Given a burst of 200 agent-triggered `job_run`s arrives for a tenant near its concurrency ceiling, and a manual, user-initiated export job is queued behind them
> When admission control applies backpressure
> Then lower-priority agent jobs queue and are throttled first, the user-initiated export is not indefinitely starved (admitted ahead of same-or-lower-priority backlog per its declared priority), and no job fails outright due to the burst — consistent with T15, degradation never blocks.

## 17. Open questions

Flagged per Vol 6 §4/L13:

1. **Field-level detail for `job_definition`, `schedule`, `job_run`,
   `job_lock`, `retry_policy`** (§4.1) is not given in Vol 1 at all — only
   entity names and purpose. Please confirm or amend.
2. **No Differentiating Requirements are stated in Vol 1 for KRN-15.** All
   of §7 (DR-001, DR-002) is inferred from Vol 0 §11's catalogue phrase
   "backpressure and job observability" and from Vol 0 §27's agent
   architecture, not derived from an explicit Vol 1 DR list. Confirm these
   are the intended differentiators, or that KRN-15 is meant to carry none.
3. **API surface and event names** (§10, §12) are not given in Vol 1 for
   KRN-15 — designed here from Vol 0 §42 conventions; first proposal only.
4. **KRN-15 / INT-04 trust-ceiling boundary** (KRN-15-FR-006, §3 scope-out).
   This draft assumes KRN-15 is entirely trust-unaware — it runs whatever
   `job_definition` was registered, and all L9 enforcement ("never act
   above its registered trust ceiling") happens inside INT-04 and the
   agent's own tool-call layer, not inside the scheduler. Vol 1 does not
   state this boundary explicitly. Confirm before INT-03/INT-04's Vol 3
   files are drafted, so the two do not disagree about who is responsible
   for stopping an over-reaching agent action (mirrors KRN-01's §17 #4
   pattern regarding FIN-01's close-checklist boundary).
5. **Tenant-authored schedules' namespace.** This draft assumes a
   tenant-configured recurring report (STU-04) or agent trigger (STU-07)
   is a `tnt`-namespaced `job_definition` referencing a `sys` handler,
   consistent with T13, rather than a separate tenant-schedule concept.
   Confirm.
6. **Backpressure priority algorithm** (KRN-15-DR-002) is described only at
   the policy level ("queues and degrades gracefully"); the actual
   admission-control algorithm (e.g. weighted fair queuing vs strict
   priority) is a stack-bound implementation detail Vol 1 does not specify.
   Flagged for the implementer, not for human decision, unless NFR targets
   (Vol 0 §36) require a specific guarantee.
