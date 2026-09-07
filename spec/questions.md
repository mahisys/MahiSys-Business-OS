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

**Status:** OPEN. Awaiting Vol 0 (master), Vol 1 (kernel SRS), Vol 2 (data
model) from the human. No module implementation, kernel implementation, or
stack-specific scaffolding beyond repository layout (§7) will proceed until
these are supplied and this question is closed.
