# Questions — blocked items awaiting human answer

Format: date raised, question, why it blocks, status.

---

## Q-001 — 2026-09-07 — Missing prerequisite specification volumes

**Question:** Volume 6 (Build Runbook) has been received and committed as
`CLAUDE.md`. Per its own §1 (Session protocol) and §12 (Files this runbook
depends on), the following are required and do not yet exist in this
repository:

- `/spec/vol0-master.md` — Charter, primitive catalogue (P-01..P-12), module
  catalogue, conventions (§42), decision log (§43). Marked "Exists" in the
  Vol 6 table but has not been supplied to this session.
- `/spec/vol1-kernel.md` — Kernel SRS. Marked "Required before build."
- `/spec/vol2-data-model.md` — Canonical data model. Marked "Required before
  build."

Vol 6 §11 additionally states: "Do not begin the pilot until Vol 1 and Vol 2
exist and D-11 through D-17 in Vol 0 §43.2 are closed."

**Why it blocks:** Per §1 step 5 and §4 (When to stop and ask): a Vol 0
decision or ID that does not exist blocks any dependent task. Without Vol 0
there is no primitive catalogue (L2), no module/entity/persona/journey/agent
ID registry (L15), and no conventions or decision log to check against.
Without Vol 1/Vol 2, no kernel (KRN) or data model exists for any L2
application module to build against (Kernel first, always — §3). Proceeding
to design or implement anything beyond repository scaffolding would risk
inventing IDs or primitives, both of which are forbidden (L2, L15).

**Status:** CLOSED — 2026-09-07. Vol 0, Vol 1 and Vol 2 supplied and committed
to `/spec/`. See Q-002 for the follow-on blocker this raised.

---

## Q-002 — 2026-09-07 — D-11 through D-17 are still open in Vol 0 §43.2

**Question:** Vol 0 §43 (Decision log) lists D-11 through D-17 under
"43.2 Open — gating Volume 1," and the document's own closing line states:
*"Volume 1 (Platform Kernel SRS) begins once D-11 through D-17 are closed."*
Vol 6 §11 repeats the same gate for the pilot slice.

However, Vol 1 (Kernel SRS) already exists and was supplied in this session.
Vol 1 §1.1 itself acknowledges the gap: its stack table is captioned
"recommendation pending D-12," i.e. Vol 1 was authored ahead of the decision
its own foundational section depends on.

The seven open decisions, and what each blocks per §43.2:

| # | Decision | Blocks |
|---|---|---|
| D-11 | Book of record — OS replaces Tally in year one, or mirrors it | Migration design, FIN scope, sales narrative |
| D-12 | Technology stack | Metadata engine design; all of Vol 1 |
| D-13 | Deployment model — pure SaaS, or on-prem option for BFSI/Pharma | Kernel packaging, INT-12 design |
| D-14 | Ordder.io and Karyaflo — absorbed as modules or federated against this kernel | Product boundary, roadmap, brand |
| D-15 | Billing metric — seats, transactions, or entity count | COM-03, KRN-20 |
| D-16 | AI unit economics (§29.3 calculation) | Pricing model, Intelligence tier boundary |
| D-17 | Partner strategy timing — when STU-08 opens to partners | COM-06, certification model |

**Why it blocks:** Per Vol 6 §4, a still-open Vol 0 §43.2 decision that a task
depends on is a stop-and-ask condition, not something to guess past. D-12
alone gates "all of Vol 1" by Vol 0's own text, meaning the kernel SRS just
supplied is formally provisional until it closes. Phase 0 (KRN-01..14,
CMP-01..04, ITG-01 per §39) should not begin — no kernel code will be
written — until this is resolved by the human, since Vol 0 §43.2, Vol 6 §11,
and Vol 6 §3 ("Kernel first, always") all say so independently.

**Status:** CLOSED — 2026-09-07. All seven decisions closed or deliberately
deferred with a stated revisit trigger; see `/spec/decisions-taken.md` for
each decision and its reasoning. D-11, D-12, D-13, D-15 closed on the
recommended defaults. D-14 and D-17 deferred (non-blocking for Phase 0).
D-16 deferred pending pricing targets (non-blocking for Phase 0).

---

## Q-003 — 2026-09-07 — No Vol 3 module SRS files exist for the kernel modules

**Question:** Vol 6 L13 states: *"Never write code before its acceptance
tests exist. Given/When/Then criteria come from the Vol 3 file. If they are
missing or ambiguous, stop and ask."* Vol 6 §6 (test-first protocol) begins
with "Read the Vol 3 acceptance criteria" before any contract or acceptance
test is written.

Vol 1 (Kernel SRS) Part 2 explicitly says each kernel module section is
*"the Vol 3 template in abbreviated form... Full Given/When/Then sets live
in `/spec/vol3/`"* — and gives exactly one **sample** acceptance criterion
per module (e.g. `KRN-01` has one Given/When/Then; a real module will need
many, covering every FR/DR, every persona's permission matrix including
negative cases, and every declared event schema). No `/spec/vol3/*.md` files
exist in this repository for any of the 20 kernel modules (or any other
module).

**Why it blocks:** Per L13 and Vol 6 §6, I cannot write kernel code without
full acceptance criteria to build against — doing so would mean building
against my own guess of what "done" means for e.g. KRN-03 Access Control's
permission matrix, which is precisely the kind of prose-driven, ambiguous
implementation Vol 0 T14 and Vol 6 exist to prevent.

**Status:** CLOSED — 2026-09-07. Human chose to have this session draft all
20 files for review. All 20 written (`/spec/vol3/KRN-01.md` through
`KRN-20.md`), each following the full Vol 0 §1 template, expanding every
Vol 1 FR/DR with complete Given/When/Then, field-level entity detail,
permission matrices and event lists. Every module/persona/primitive/
journey/agent ID cited across all 20 files was cross-checked by direct grep
audit against Vol 0's catalogue — zero invented IDs found (L15 compliance
confirmed, not just instructed).

This closure does **not** mean the drafts are binding. Per Vol 6 §4/L13,
each file's own §17 "Open questions" flags every gap where Vol 1 lacked
field/API/event-level detail and this draft had to extrapolate. 133 such
items exist across the 20 files; 12 of them are genuine cross-module
architectural questions (not just missing detail) consolidated in
`/spec/vol3-review-summary.md` §2 for human decision before Phase 0
contract tests are written. See that file and `/spec/state.md` for the
current review status and next steps.
