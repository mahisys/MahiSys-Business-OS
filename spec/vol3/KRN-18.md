# KRN-18 · Undo & Compensation

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-01 (tenant/entity scope), KRN-05 (approval matrix — value-gated second approval on large reversal batches, per D-28), KRN-06 (event bus/event store — `P-08 Event.reversal_handle` is written here, in the same transaction as the mutation), KRN-10 (audit — every reversal is itself audited)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-18)
per Vol 6 §4/L13, for human review and approval. Reworked 2026-09-07 per
D-28 (value-gated second approval on large reversal batches) — see
`/spec/decisions-taken.md`. Not binding until fully approved (remaining
open questions in §17).

---

## 1. Purpose and buyer

The mechanism behind T10 ("every mutation is reversible — compensating
transactions designed in, not retrofitted," Vol 0 §4) and the specific
reason an owner-led business will permit agent autonomy at all (Vol 0 §27.3
commercial-significance note; §28 wow-catalogue item 11, "Undo the day").
Every mutation in the platform registers a `reversal_handle` at write time
(L5); KRN-18 is what turns that registration into a real, cascade-aware,
previewable, auditable reversal operation — up to and including "reverse
everything a specific agent did today, across every module it touched."

Not bought directly — `included` platform-fee substrate (Vol 0 §11). No
persona buys it, but it is the single capability sales conversations with
PR-01 (Owner) most directly depend on: without a credible undo, no owner
grants an agent L3/L4 trust (Vol 0 §27.3).

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-01 Owner / Director | Reviews and confirms an agent-day reversal preview; holds the tenant's kill switch (Vol 0 §27.3) |
| PR-21 System Administrator | Initiates and confirms reversal batches on behalf of the tenant; registers `compensation_definition`s at module deploy time (system-account action, not a screen task) |
| PR-16 Finance Controller / CFO | Confirms financial-scope reversal batches (ledger postings, payment allocations); reviews reversal audit trail during close |
| PR-15 Accountant | Reverses a single mutation within their own permission scope (e.g. their own unposted journal entry) — the everyday, non-cascade case |
| PR-06 Purchase Officer / PR-05 Store Keeper / other transacting personas | Reverse a single document or transaction they own, within scope, via the contextual "Undo" action on that record |
| PR-25 External CA / Auditor | Reads the reversal audit trail as evidence during a filing or an audit (read-only, scoped) |

`PR-29 Agent` is never the *initiator* or *approver* of a reversal of its own
actions (L9 — an agent may not act above its ceiling, promote itself, or
grant itself permission; reversing itself would be functionally identical to
self-approval). Agents only ever appear here as the *subject* of a reversal
batch a human initiates.

## 3. Scope in / scope out

**In scope:** reversal-handle registration contract (what every other module
calls at write time); compensation-definition registry (the declarative
"how to reverse this mutation type," per module); single-mutation reversal;
cascade-aware multi-mutation reversal; scoped batch reversal ("everything
this agent did today," "everything in this document chain," "everything in
this date range"); preview-before-execute; irreversible-action detection and
correction-action proposal; reversal audit.

**Out of scope:** the business logic of what a compensating transaction
actually does inside a module (e.g. exactly how FIN-01 reverses a ledger
posting, or how SCM-02 reverses a stock movement) — each module authors its
own `compensation_definition` against KRN-18's contract; KRN-18 sequences
and executes, it does not know GL or stock rules (L3). Soft-delete and data
retention (SEC-07) — a reversal is a new forward action that undoes a
mutation's *effect*; it is not the same mechanism as a tenant's
right-to-erasure data deletion. General audit search and evidence export
(KRN-10) — KRN-18 writes into the audit trail, it does not own the audit
search surface. Agent trust-level promotion/demotion (INT-04) — KRN-18
supplies the "zero unreversed errors" signal INT-04's promotion condition
depends on (Vol 0 §27.3), but does not itself decide trust levels.

## 4. Entities owned; entities consumed

**Owned:** `reversal_handle`, `compensation_definition`, `reversal_batch`,
`reversal_log` (Vol 1, verbatim list).

**Consumed (by ID):** `P-08 Event` — `reversal_handle` is the object
`Event.reversal_handle` (Vol 2 Part 2, P-08) points to; every mutating
module's own entities by reference only (a `reversal_handle` names a
`{module_id, entity_type, entity_id}`, it never reads that module's table);
`P-06 Transaction.reversal_of_id` and `is_reversed` (Vol 2 §P-06) are the
fields a financial/material compensating transaction sets, written by the
owning module's compensation logic, not by KRN-18 directly. **KRN-05**
`approval_matrix`/`approval_request` (D-28, addition) — a `reversal_batch`
whose `estimated_financial_impact` exceeds the tenant's configured ceiling
requests a second approval through KRN-05's existing approval-matrix
mechanism, with `reversal_batch` as the approval subject type, exactly the
same pattern SLS-07 uses for discount-approval routing. KRN-18 does not
store or interpret the ceiling value itself — that is a tenant-configured
KRN-05 approval-matrix rule — it only asks KRN-05 for a decision and waits
for it (L3: no new parallel approval mechanism where KRN-05 already owns
one).

### 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every entity below.

**`reversal_handle`** (extrapolated from KRN-18-FR-001/003/006; not
field-detailed in Vol 1 — flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `mutation_ref` | object | `{module_id, entity_type, entity_id, event_id}` — the exact mutation this handle can undo |
| `compensation_definition_id` | ref | Which declared compensation applies |
| `reversible` | boolean | `false` when the mutation type is declared irreversible by real-world constraint (KRN-18-FR-003) |
| `window_expires_at` | timestamptz, nullable | Set when reversibility is time-bound (e.g. e-invoice IRP cancellation window, bank cut-off) — addition, KRN-18-FR-006 |
| `irreversibility_reason` | string, nullable | Human-readable reason, required when `reversible = false` or after `window_expires_at` passes |
| `status` | enum | `available` \| `expired` \| `consumed` |

**`compensation_definition`**:

| Field | Type | Notes |
|---|---|---|
| `module_id` | ref | Owning module (registers this at deploy time, not per-tenant) |
| `mutation_type` | string | e.g. `mfg.job_work.dispatched` |
| `compensating_action` | JSONB | Declarative step spec the module's own reversal handler executes |
| `cascade_dependencies` | list | `{depends_on_mutation_type, order}` — what must reverse before/after this one (KRN-18-FR-002) |
| `registered_at` | timestamptz | Must exist before the mutation type can be written anywhere (L5 gate) |

**`reversal_batch`**:

| Field | Type | Notes |
|---|---|---|
| `initiated_by` | actor ref | Always a human or a service account acting for a human — never the subject agent itself |
| `scope` | object | `{agent_id?, actor_id?, date_range?, module_scope?, handles[]}` — one of several selection modes |
| `preview` | list, child | Computed consequence per `reversal_handle` in scope, before execution |
| `status` | enum | `previewing` \| `confirmed` \| `awaiting_second_approval` \| `approved` \| `executing` \| `completed` \| `partially_completed` \| `failed` \| `rejected` |
| `irreversible_items` | list | `{reversal_handle_id, reason, proposed_correction_action}` |
| `confirmed_at`, `confirmed_by` | | The initiator's own confirmation (§9 "single confirm" step) |
| `estimated_financial_impact` | Money | **Addition, D-28.** Computed at preview time: sum of the absolute value of every in-scope financial transaction the batch would reverse. Zero for batches touching only non-financial mutations (e.g. only sent messages). |
| `approval_request_id` | ref, nullable | **Addition, D-28.** Set only when `estimated_financial_impact` exceeds the tenant's KRN-05 approval-matrix ceiling for the `reversal_batch` subject type; points to the KRN-05 `approval_request` instance. Null for batches under the ceiling — those never enter `awaiting_second_approval`. |
| `second_approved_by`, `second_approved_at` | actor ref, timestamptz, nullable | **Addition, D-28.** Set from the KRN-05 approval outcome; always a different actor from `confirmed_by` (KRN-18-FR-007's maker-checker guarantee). |

**`reversal_log`**:

| Field | Type | Notes |
|---|---|---|
| `reversal_batch_id` | ref | |
| `reversal_handle_id` | ref | |
| `outcome` | enum | `reversed` \| `skipped_irreversible` \| `failed` |
| `new_transaction_ids` | list<ref> | The compensating transactions created (never overwrites the original — Vol 2 §1.3, always soft/additive) |
| `audited_at` | timestamptz | Written to KRN-10 in the same transaction |

## 5. State machines

**`reversal_handle.status`:** `available → consumed` (on successful
execution) or `available → expired` (window closes per `window_expires_at`,
KRN-18-FR-006). `consumed` and `expired` are both terminal — a
`reversal_handle` is never reused; a second reversal need is a new forward
action against the compensating transaction, per KRN-18-FR-004.

**`reversal_batch.status`:** `previewing → confirmed → executing →
completed`, with `executing → partially_completed` when some items in scope
are irreversible (KRN-18-FR-003) or individually fail, and `executing →
failed` only for a batch-level failure before any item executes (once
execution starts, an already-executing batch resolves to `completed` or
`partially_completed`, never silently drops items — see FR-005 below).
`previewing → confirmed` requires an explicit confirming action distinct
from the preview request itself (KRN-18-FR-005, addition).

**Value-gated second approval (D-28, KRN-18-FR-007, addition):** when
`estimated_financial_impact` exceeds the tenant's configured KRN-05
approval-matrix ceiling for `reversal_batch`, `confirmed` transitions to
`awaiting_second_approval` instead of directly to `executing`; a KRN-05
`approval_request` is raised at that point. `awaiting_second_approval →
approved → executing` on a distinct approver's grant, or
`awaiting_second_approval → rejected` (terminal — the initiator must start
a new batch, not retry the same one) on denial. Batches under the ceiling
skip straight from `confirmed` to `executing`, unchanged from the original
design — the new states only exist on the above-ceiling path.

## 6. Standard functional requirements

- `KRN-18-FR-001` Every mutation registers a reversal handle at the time it is written (L5). A mutation without one fails review. *(Vol 1, verbatim)*
- `KRN-18-FR-002` Compensation is cascade-aware: reversing a dispatch reverses its stock movement, invoice, e-way bill and ledger postings in correct order. *(Vol 1, verbatim)*
- `KRN-18-FR-003` Where a real-world action cannot be undone (an e-invoice past its cancellation window, a sent message), the system states this explicitly in the preview and offers the correct compensating action instead of failing silently. *(Vol 1, verbatim)*
- `KRN-18-FR-004` Every reversal is itself audited and is not itself reversible except as a new forward action. *(Vol 1, verbatim)*
- `KRN-18-FR-005` Every reversal batch requires an explicit preview step, separate from and prior to execution; no batch executes on a single request, and no batch's scope may silently change between preview and confirm — a scope change invalidates the preview and requires a new one.
- `KRN-18-FR-006` A reversal handle carries a declared time window (`window_expires_at`) where the underlying real-world action is only reversible for a bounded period (e-invoice IRP cancellation window, bank settlement cut-off, statutory return filing lock); the window is declared data on the handle, not logic duplicated per module.
- `KRN-18-FR-007` A reversal batch whose `estimated_financial_impact` exceeds the tenant's configured KRN-05 approval-matrix ceiling for the `reversal_batch` subject type requires a second approval from an actor distinct from the one who confirmed it, before execution begins; a batch under the ceiling requires no second approval and proceeds directly from confirm to execution. *(Addition — D-28, per human decision: mirrors how agent financial ceilings already work, Vol 0 §27.2/§27.3, applied to the act of reversing rather than only to the act of acting.)*

## 7. Differentiating requirements

- `KRN-18-DR-001` "Reverse everything this agent did today, across modules" is a supported, single operation with a preview of consequences before execution. *(Vol 1, verbatim — the headline wow-catalogue item, §28 item 11.)*

## 8. Agents

None. KRN-18 registers no agent of its own — it is the substrate every other
module's agents rely on for reversibility, and per L9/§2 an agent may never
reverse or approve the reversal of its own actions.

## 9. Screens and flows

All screens KRN-13-generated (L6). Standard views:

- **Contextual Undo** — appears on any single document/transaction screen
  the viewing persona owns or has scope over; a single-click preview →
  confirm flow for a single `reversal_handle`.
- **"Undo this agent's day"** — PR-01, PR-21: select an agent (and
  optionally a date range narrower than "today"), see the full preview
  (reversible items, irreversible items with proposed corrections,
  `estimated_financial_impact`), confirm or cancel. If the impact exceeds
  the tenant's ceiling, confirming routes to `awaiting_second_approval`
  instead of executing immediately, with the same visible preview carried
  through to the second approver's screen (below) rather than requiring
  them to reconstruct it.
- **Second-approval queue** — the KRN-05 `my-approvals` surface, filtered
  to `reversal_batch` requests (D-28); shows the same preview the initiator
  saw, `estimated_financial_impact`, and who confirmed it, so the second
  approver is deciding on full information, not a bare batch ID.
- **Reversal batch history** — PR-01, PR-21, PR-16: audited list of past
  batches, their outcome, and drill-through to each `reversal_log` entry.
- **Compensation definition registry** (read-only view; write is a module
  deploy-time action, not a tenant screen) — PR-21: which mutation types in
  this tenant's active modules have a registered compensation, surfaced as a
  build-completeness signal, not a tenant-editable list.

## 10. API surface

Base per Vol 0 §42: `/api/v1/core/{entity}`. *(Vol 1 gives no explicit API
surface for KRN-18 — proposed by the implementer per Vol 6 §4/L13; flagged
in §17.)*

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/core/reversal-handles` | Called synchronously, in-transaction, by the mutating module's own write path — never end-user-callable directly (KRN-18-FR-001) |
| GET | `/api/v1/core/reversal-handles/{id}` | |
| POST | `/api/v1/core/compensation-definitions` | Service-account only, module deploy time |
| POST | `/api/v1/core/reversals/preview` | `{scope: {agent_id?, actor_id?, date_range?, module_scope?, handles[]?}}` → returns a `reversal_batch` in `previewing` state with computed `preview` and `irreversible_items` |
| POST | `/api/v1/core/reversals/{batch_id}/confirm` | Transitions `previewing → confirmed`, then immediately `→ executing` if under the tenant's ceiling, or `→ awaiting_second_approval` if over it (KRN-18-FR-007); rejects if the batch's underlying scope has changed since preview (KRN-18-FR-005) |
| POST | `/api/v1/core/reversals/{batch_id}/approve` | **Addition, D-28.** Second approver only, must differ from `confirmed_by`; transitions `awaiting_second_approval → approved → executing`. Thin wrapper over the underlying KRN-05 `approval_request` decision — KRN-18 does not duplicate approval-routing logic. |
| POST | `/api/v1/core/reversals/{batch_id}/reject` | **Addition, D-28.** Second approver only; transitions `awaiting_second_approval → rejected` (terminal). |
| GET | `/api/v1/core/reversals/{batch_id}` | Batch status, `estimated_financial_impact`, approval state where applicable, and `reversal_log` entries |
| GET | `/api/v1/core/reversals` | List, filterable by `initiated_by`, `agent_id`, `status`, date range |

All writes: idempotency key required. All list endpoints: cursor pagination,
declared filters, field selection.

## 11. Permission matrix by persona

Actions: `single_reverse` (preview+confirm on one's own record), `batch_preview`,
`batch_confirm` (scoped), `batch_confirm_agent_day` (the full cross-module
agent-day operation), `batch_second_approve` (D-28, addition), `read_audit`.

| Persona | single_reverse (own record) | batch_preview | batch_confirm (own scope) | batch_confirm_agent_day | batch_second_approve | read_audit |
|---|---|---|---|---|---|---|
| PR-01 Owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-21 System Admin | ✓ | ✓ | ✓ | ✓ (delegated per KRN-05 matrix) | ✓ | ✓ |
| PR-16 CFO | ✓ (financial records) | ✓ (financial scope) | ✓ (financial scope) | ✗ | ✓ (financial-scope batches only) | ✓ |
| PR-15 Accountant | ✓ (own unposted entries only) | ✗ | ✗ | ✗ | ✗ | ✓ (own entity scope) |
| PR-06/PR-05/other transacting personas | ✓ (own records, within permission scope) | ✗ | ✗ | ✗ | ✗ | ✗ |
| PR-25 External CA/Auditor | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ (scoped, read-only) |
| PR-29 Agent | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

**Negative cases:**
- `PR-29` (Agent) attempting to call `reversals/preview` or `confirm` against
  its own `agent_id`, at any trust level including L4 → 403, unconditionally
  (L9 — an agent may never modify its own standing, and self-reversal is
  functionally equivalent to grading its own work).
- PR-15 (Accountant) attempting `single_reverse` on a posted (not their own
  unposted) journal entry, or one outside their fiscal-period write scope
  (KRN-01-FR-003) → 403; a closed-period reversal is rejected exactly as a
  closed-period posting is.
- Any persona attempting `batch_confirm` on a batch whose preview has expired
  or whose scope no longer matches (e.g. a new mutation occurred in-scope
  after preview) → rejected, new preview required (KRN-18-FR-005).
- PR-16 (CFO) attempting `batch_confirm_agent_day` → 403; that operation is
  reserved to PR-01/PR-21 per this matrix — a CFO can confirm a
  financially-scoped batch but not an unrestricted whole-agent-day batch
  that may span non-financial modules outside their authority.
- **(D-28, addition)** The actor who called `confirm` (`confirmed_by`)
  attempting to also call `approve` on the same batch → 403, unconditionally
  — `batch_second_approve` requires a distinct actor from `confirmed_by` by
  construction (KRN-18-FR-007's maker-checker guarantee), not merely by
  convention; the API rejects a matching actor even if that actor otherwise
  holds `batch_second_approve` permission in general.
- **(D-28, addition)** Any persona attempting `execute` (transition out of
  `awaiting_second_approval`) directly, bypassing `approve` → rejected; a
  batch above the ceiling has no path to `executing` except through a
  successful, distinct-actor `approve` call.

## 12. Events emitted / consumed

**Emitted:**
- `core.reversal_handle.registered` — emitted by the *mutating* module in
  the same transaction as its own event, not by KRN-18 asynchronously
  (KRN-18-FR-001 requires this be synchronous, in-transaction).
- `core.reversal_batch.previewed`
- `core.reversal_batch.confirmed`
- `core.reversal_batch.second_approval_requested` — **addition, D-28**, emitted when `estimated_financial_impact` exceeds the tenant's ceiling and a KRN-05 `approval_request` is raised
- `core.reversal_batch.second_approved` / `.rejected` — **addition, D-28**
- `core.reversal.executed` (per item, carrying `reversal_log` outcome)
- `core.reversal_batch.completed`
- `core.reversal_batch.partially_completed`
- `core.compensation_definition.registered`

**Consumed:** `core.tenant.suspended` / `core.tenant.closed` (KRN-01) —
in-flight reversal batches for a suspended/closed tenant are held, not
silently executed. KRN-18 does **not** subscribe to every module's mutation
events to *discover* reversal handles after the fact — registration is a
synchronous call each module makes at write time (KRN-18-FR-001), which is
precisely what guarantees a mutation without a handle fails review rather
than merely being un-audited later.

## 13. Reports and KPIs

- Reversal batch volume and outcome mix (`completed` / `partially_completed`
  / `failed`) per period — PR-21.
- Per-agent reversal-triggered rate — the specific signal INT-04's Trust
  Ladder demotion condition ("zero unreversed errors in window," Vol 0
  §27.3) consumes; KRN-18 supplies the count, INT-04 owns the demotion
  decision.
- Irreversible-action rate — should trend toward zero as modules register
  better-windowed handles rather than hard `reversible: false` ones.
- Mean time from preview to confirm — a proxy for how much a batch needed
  human deliberation before trust in the preview itself.

## 14. Compliance touchpoints

- KRN-18-FR-004 ("every reversal is itself audited") is the direct
  implementation of L5's spirit extended to the reversal itself — a
  reversal is a new, fully auditable forward action, never a quiet rollback.
- KRN-18-FR-003's irreversible-action handling is the load-bearing mechanism
  for CMP-02 (e-invoice cancellation window) and CMP-03 (e-way bill
  cancellation window) — KRN-18 does not decide *when* those windows close
  (CMP-02/03 own that statutory rule, L7), it only carries the declared
  window on the `reversal_handle` and refuses to pretend a reversal succeeded
  once it has passed.
- A reversal that would post into a closed fiscal period (KRN-01-FR-003) is
  rejected exactly as a forward posting would be — KRN-18 does not create a
  side channel around period-close controls.

## 15. Offline behaviour

**Profile: `online`.** Reversal is a corrective/administrative action, not a
field-capture task, and always requires connectivity — none of the
offline-first personas initiate a reversal from an offline device. Records
originally captured offline (KRN-16) still receive a `reversal_handle` once
synced and posted; the reversal action against them, when it happens, is
always an online operation. No conflict policy needed for KRN-18 itself.

## 16. Acceptance criteria (Given/When/Then)

**KRN-18-FR-001 — reversal handle registered at write time**
> Given module `MFG-05` writes a `mfg.job_work.dispatched` mutation
> When the write transaction commits
> Then a `reversal_handle` referencing that exact mutation exists in the same transaction, with `status = available`, and a build attempting to ship a mutation type with no registered `compensation_definition` fails review before merge (L5), not at reversal time.

**KRN-18-FR-002 — cascade-aware compensation**
> Given a job-work dispatch that produced a stock movement (`at_subcontractor`), a delivery challan, an e-way bill and a provisional ledger posting
> When that dispatch is reversed
> Then the stock movement, challan, e-way bill (if within its cancellation window) and ledger posting are each reversed in the dependency order declared in their `compensation_definition.cascade_dependencies`, and no downstream reversal (e.g. the ledger posting) executes before its declared predecessor (the stock movement) has reversed successfully.

**KRN-18-FR-003 — irreversible action stated explicitly with a correction offered**
> Given an e-invoice past its 24-hour IRP cancellation window, and a WhatsApp payment-reminder message already sent to a customer
> When a reversal batch covering both is previewed
> Then both are listed as `irreversible_items` with a stated reason each ("cancellation window closed at IRP" / "message already delivered"), each carries a `proposed_correction_action` (a credit note against the e-invoice; a correction message for the WhatsApp thread) rather than being silently omitted or the preview failing outright, and the reversible items in the same batch proceed to preview normally alongside them.

**KRN-18-FR-004 — reversal is itself audited and not itself reversible**
> Given a confirmed and completed reversal batch that reversed a payment allocation
> When PR-16 (CFO) reviews the audit trail
> Then the reversal appears as a fully attributed, timestamped audit entry (KRN-10) alongside the original mutation; and an attempt to "reverse the reversal" is rejected by the API — the only path to restoring the original state is a new forward action (e.g. re-applying the allocation), which itself registers its own new `reversal_handle`.

**KRN-18-FR-005 — preview required before execution, scope-locked**
> Given a reversal batch scoped to `agent_id = SLS-AG-05` for `2027-04-02`, previewed at `10:00`
> When a new mutation by that same agent occurs at `10:05`, before the batch is confirmed
> Then confirming the stale preview is rejected with a machine error indicating the scope has changed, and a fresh preview (now including the `10:05` mutation) must be generated before the batch can be confirmed.

**KRN-18-FR-006 — declared reversibility window**
> Given a `reversal_handle` for an e-way bill generation with `window_expires_at` set to the statutory cancellation deadline
> When a reversal is attempted after that timestamp
> Then the handle's `status` is `expired`, the reversal is refused with the stated reason, and the same handle before that timestamp would have succeeded — the boundary is enforced from the declared field, not from ad hoc logic inside CMP-03.

**KRN-18-FR-007 — value-gated second approval**
> Given the tenant's KRN-05 approval-matrix ceiling for `reversal_batch` is set to ₹5,00,000, and PR-16 (CFO) confirms a batch with `estimated_financial_impact = ₹8,20,000`
> When the batch is confirmed
> Then it transitions to `awaiting_second_approval` rather than `executing`, a KRN-05 `approval_request` is raised naming eligible second approvers (PR-01, PR-21, per §11), no reversal executes until one of them calls `approve`, PR-16 (the confirmer) is rejected with 403 if they themselves attempt to call `approve` on this batch even though they generally hold `batch_second_approve` permission, and once PR-01 approves, the batch transitions `approved → executing` and proceeds exactly as an under-ceiling batch would from that point. A second batch confirmed the same day with `estimated_financial_impact = ₹50,000` (under the ceiling) transitions `confirmed → executing` directly, with no approval step and no `core.reversal_batch.second_approval_requested` event.

**KRN-18-DR-001 — reverse the day, across modules, with preview (full form of Vol 1's sample)**
> Given the Collections Chaser (`FIN-AG-*`, at trust level L3) sent 40 follow-up messages and applied 12 payment allocations across `FIN-04` and `KRN-09` today
> When the owner (PR-01) selects "undo this agent's day"
> Then a single preview lists all 52 actions in one screen: the 40 sent messages marked `irreversible` with a proposed correction message per recipient, and the 12 payment allocations marked reversible with their exact resulting ledger entries shown; the owner confirms once; execution reverses all 12 allocations (each producing a new compensating `P-06 Transaction`, cascade-ordered against any dependent postings), leaves the 40 messages untouched but queues the 40 proposed corrections for the owner's separate one-tap send-or-edit decision; and the entire operation — all 52 items, both outcomes — is recorded as exactly one audited `reversal_batch`, queryable as a single unit in the batch history, with `status = partially_completed` and a `reversal_log` entry per item.

## 17. Open questions

Flagged per Vol 6 §4/L13:

1. **Field-level detail for all four owned entities** (§4.1) is not given in
   Vol 1 — only their names and purpose, plus the one acceptance sample, are
   stated. The fields proposed here (particularly `reversal_batch.scope`'s
   several selection modes and `reversal_handle.window_expires_at`) are a
   reasonable minimum inferred from FR-002/003/006 and the DR-001 sample,
   not a verbatim source. Please confirm or amend.
2. **API surface and event names** (§10, §12) are not specified in Vol 1 for
   KRN-18 — proposed by the implementer per Vol 6 §4/L13. Please confirm or
   amend before contract tests are written against it.
3. ~~**Second-approver requirement on `batch_confirm_agent_day`.**~~
   **RESOLVED — D-28.** Value-gated second approval via KRN-05's approval
   matrix, `reversal_batch` as subject type; see §4.1, §6 (`KRN-18-FR-007`),
   §16. The actual ceiling *value* is a tenant-configured KRN-05
   approval-matrix rule, not a KRN-18 field — confirming a sensible default
   ceiling (and whether it is a platform default or must be set per tenant
   at provisioning) is a Tier-2-style follow-up for COM-04's provisioning
   design, not re-opened here.
4. **What happens to a `reversal_handle` when its owning module is later
   deprecated or a tenant's entitlement to that module is suspended
   (KRN-20)** is not addressed anywhere in Vol 0/1. This draft assumes the
   handle and its audit trail persist and remain traceable (consistent with
   L12 and KRN-20-DR-001's "data contracts persist" principle) even if the
   module's *forward* functionality is gated off. Confirm this is intended.
5. **Cross-tenant or cross-isolation-tier reversal** — whether a reversal
   batch behaves identically across `row`/`schema`/`dedicated` isolation
   tiers (KRN-01-DR-001) is assumed but not explicitly tested by any Vol 0/1
   text. Flagged for the isolation-tier promotion test suite (KRN-01 §16)
   to include a reversal-batch scenario explicitly.
