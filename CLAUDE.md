# MahiSys Business OS — Volume 6
## Build Runbook

**Document ID:** BOS-VOL6
**Version:** 1.0
**Status:** Binding. This document governs implementation.

> **Place this file at the repository root as `CLAUDE.md`.**
> It is the first thing read in every session. Volume 0 says what to build.
> This says how, and what may never be done. Where any other document
> conflicts with this one on a matter of construction, this one wins.

---

## 1. Session protocol

**At the start of every session, before writing any code:**

1. Read this file.
2. Read `/spec/vol0-master.md` §42 (conventions) and §43 (decision log).
3. Read the Vol 3 file for the module you are building.
4. Read `/spec/state.md` — the current build state: what is complete, what is in progress, what is blocked.
5. Confirm the module's dependencies are all marked complete in `state.md`. If any is not, **stop** (§4).

**At the end of every session:**

1. Update `/spec/state.md`: module status, tests passing, open issues, next step.
2. Record any decision you were forced to make that Vol 0 did not cover, in `/spec/decisions-taken.md`, with the reasoning. Flag it for human review.
3. Do not leave a module half-built without recording exactly where it stands.

`state.md` is the memory of this project across sessions. Treat it as
load-bearing. A session that ends without updating it has failed regardless
of how much code it wrote.

---

## 2. The fifteen laws

These are absolute. There is no task urgent enough to justify breaking one.

**L1 — Never write to the `sys` namespace on behalf of a tenant.**
Platform artefacts live in `sys`. Tenant artefacts live in `tnt`. The platform
never writes to `tnt`; a tenant may never modify or remove anything in `sys`.

**L2 — Never define a business object that duplicates a primitive.**
Everything resolves to P-01..P-12 (Vol 0 §6). If you believe you need a
thirteenth primitive, stop and ask. You almost certainly need an extension of
an existing one.

**L3 — Never let a module read or write another module's tables.**
Cross-module communication happens through published APIs and events. No
exceptions, not for performance, not for convenience.

**L4 — Never emit a state change without an event.**
Every mutation publishes to the event bus (KRN-06). Audit, analytics,
automation, agents, simulation and undo all depend on this.

**L5 — Never implement a mutation without a reversal path.**
Every mutation registers its compensating transaction with KRN-18 at the time
it is written, not later.

**L6 — Never hard-code a screen, label, workflow, permission or report.**
All of it is metadata (T1). If you find yourself writing a form in code, you
are building the wrong thing.

**L7 — Never hard-code tax logic outside CMP-01.**
No module computes GST. It asks CMP-01. The same applies to e-invoicing
(CMP-02), e-way bill (CMP-03) and TDS (CMP-04).

**L8 — Never let an AI failure block a business transaction.**
If the model gateway is down, every process must still complete manually
(T15). Intelligence is additive, never load-bearing.

**L9 — Never let an agent act above its registered trust ceiling**, modify
its own ceiling, promote itself, or grant permissions. Ceilings are enforced
in INT-04, not in agent code.

**L10 — Never write customer-specific code into the core repository.**
Ever. Use configuration, then `tnt` artefacts, then a VDL manifest. If none of
those work, stop and raise it.

**L11 — Never bypass the permission layer.** No query executes without
tenant, role and row scope applied. This includes analytics, exports,
agent queries and the semantic graph.

**L12 — Never remove or rename anything a tenant may reference.**
Deprecate with a sunset date and a migration path.

**L13 — Never write code before its acceptance tests exist.**
Given/When/Then criteria come from the Vol 3 file. If they are missing or
ambiguous, stop and ask (§4).

**L14 — Never mark a module done because its own tests pass.**
It is done when every journey it participates in (Vol 0 §8) passes end to end.

**L15 — Never invent an ID.** Module, entity, persona, journey, agent and
process IDs come from Vol 0. If you need one that does not exist, stop and ask.

---

## 3. Dependency gating

Build order is Vol 0 §39. Within it:

- A module may be implemented only when **every** module in its `depends on`
  column is marked complete in `state.md` **and** its contract tests pass.
- Contract tests for a module are written and passing **before** any dependent
  module begins.
- If a dependency is incomplete, do not stub it and proceed. Stubs become
  permanent. Stop and report the blockage.

**Kernel first, always.** Nothing in L2 (applications) is built before its
L0 kernel dependencies exist. The temptation to build a visible module early
for demonstration purposes is the single most damaging thing that can happen
to this project.

---

## 4. When to stop and ask

Stop. Do not proceed on your own judgement. Record the question in
`/spec/questions.md` and end the session cleanly.

- A Vol 0 decision in §43.2 is still open and your task depends on it.
- The Vol 3 spec is ambiguous, contradictory, or missing acceptance criteria.
- You need an ID that does not exist in Vol 0.
- You believe a law in §2 must be broken to complete the task.
- You need a thirteenth primitive.
- A dependency is incomplete and stubbing it would be the only way forward.
- The spec asks for something that conflicts with a statutory requirement.
- Implementing as specified would require customer-specific code in core.

Guessing on any of these costs more to unwind than asking costs to resolve.

---

## 5. Definition of done

A module is complete when **all** of the following hold:

- [ ] Every `FR` and `DR` requirement in its Vol 3 file is implemented
- [ ] Contract tests written and passing
- [ ] Unit tests for all rules, calculations and state transitions
- [ ] Acceptance criteria (Given/When/Then) all passing
- [ ] Every journey it participates in passes end to end
- [ ] Every persona listed in its spec can complete its tasks on its assigned client
- [ ] Its declared offline profile behaves as specified, including conflict resolution
- [ ] Events emitted match the declared schema exactly
- [ ] Permission matrix enforced and tested per persona, including negative cases
- [ ] Reversal path registered with KRN-18 and tested
- [ ] Its agents replay cleanly against historical events with agreement rate recorded
- [ ] Statutory behaviour tested against published cases where applicable
- [ ] Upgrade test passes against a tenant with `tnt` customisations on this module
- [ ] `state.md` updated

Twelve of fourteen is not done. Partial completion is recorded as in-progress,
never as complete.

---

## 6. Test-first protocol

1. Read the Vol 3 acceptance criteria.
2. Write the contract test (API shape, event schema).
3. Write the acceptance tests as failing tests.
4. Write the permission tests, including negative cases.
5. Then implement.
6. Then run the journey tests for every journey the module touches.

Statutory tests carry zero tolerance. GST determination, e-invoice schema,
TDS thresholds, PF/ESI computation and depreciation must be tested against
published cases and worked examples, not against your own understanding.

---

## 7. Code organisation

```
/core        L0 kernel. Highest review bar. Changes here affect everything.
/compliance  L1 CMP. Statutory logic lives here and nowhere else.
/integration L1 ITG.
/intelligence L3 INT.
/studio      L4 STU.
/modules     L2 applications, one directory per family
/commerce    COM
/manifests   VDL packs (data, not code)
/spec        Vol 0-6, state.md, decisions-taken.md, questions.md
/tests       contract, unit, journey, persona, statutory, upgrade, security
```

Rules: a module directory contains no reference to another module's internals.
Shared logic goes to `/core` or is exposed as an API. Duplication across two
modules is a signal that something belongs in the kernel — raise it rather
than copying.

---

## 8. Naming

Follow Vol 0 §42 exactly.

| Thing | Form | Example |
|---|---|---|
| Module | `PREFIX-NN` | `MFG-05` |
| Requirement | `MODULEID-FR-NNN` / `-DR-NNN` | `MFG-05-FR-012` |
| Entity | `P-NN` or `MODULEID-E-NN` | `P-01`, `MFG-05-E-02` |
| Process | `PRC-PREFIX-NN` | `PRC-MFG-01` |
| Agent | `PREFIX-AG-NN` | `MFG-AG-05` |
| Journey | `J-NN` | `J-10` |
| Persona | `PR-NN` | `PR-04` |
| Event | `module.entity.verb_past` | `mfg.job_work.dispatched` |
| API | `/api/v1/{module}/{entity}` | `/api/v1/mfg/job-work-challan` |
| Namespace | `sys` / `tnt` | |

Every commit message references the module ID and requirement IDs it
implements. Every test names the requirement it verifies.

---

## 9. Anti-patterns

Things that will look reasonable in the moment and must not be done.

| Anti-pattern | Why it is fatal |
|---|---|
| Building a visible application module before the kernel is complete | Everything after it inherits a broken foundation; this is the most likely way the project fails |
| Stubbing an incomplete dependency "temporarily" | Stubs become permanent and the contract is never enforced |
| Writing a screen in code because metadata feels slower | Breaks T1, and with it the Studio, the verticals and the entire economic model |
| Computing GST inside a module | Breaks CMP as a service; guarantees divergent tax behaviour across modules |
| Reading another module's tables for performance | Breaks the event architecture and makes the module non-replaceable |
| Adding a field to `sys` on behalf of one tenant | Breaks upgrade safety; is the beginning of a fork |
| Letting an agent write without a reversal path | Makes autonomy unsellable |
| Implementing "for now" and planning to fix later | There is no later; record it in `questions.md` instead |
| Marking a module done with journey tests unwritten | Produces 185 apps that share a login rather than an operating system |
| Skipping the offline path because online works | Loses the floor and field personas, which is most of the actual usage |
| Inventing an ID rather than asking | Breaks reference discipline across 185 specs |

---

## 10. Phase gates

A phase closes only when all of the following pass:

| Gate | Requirement |
|---|---|
| Dependency | Every module in the phase meets §5 |
| Journey | Every journey enabled by the phase passes end to end |
| Upgrade | Platform upgrade applies cleanly to a heavily customised test tenant |
| Load | NFR targets in Vol 0 §36 met |
| Security | Access control, tenant isolation and privilege escalation tests pass |
| Statutory | All statutory tests in scope pass against published cases |
| State | `state.md` reconciles with reality |

Phase 4 additionally gates VRT-01 (Manufacturing) shipping.
Phase 6 additionally gates VRT-02 (Distribution) shipping.

---

## 11. The pilot slice

The first vertical slice is **J-10, Job Work Out and Back**:
`MFG-05` · `SCM-02` · `CMP-03` · `FIN-03`, plus the kernel modules they need.

It is deliberately small and deliberately chosen: it exercises the kernel,
the compliance layer, an agent (`MFG-AG-05`), an offline mobile surface, and
a real statutory obligation (180-day ITC reversal). If this slice builds
cleanly against the specification, the specification format works and scales
to the remaining modules. If it does not, that is learned on four modules
rather than ninety.

**Do not begin the pilot until Vol 1 and Vol 2 exist and D-11 through D-17
in Vol 0 §43.2 are closed.**

---

## 12. Files this runbook depends on

| File | Purpose | Status |
|---|---|---|
| `/spec/vol0-master.md` | Charter, catalogue, conventions, decisions | Exists |
| `/spec/vol1-kernel.md` | Kernel SRS | **Required before build** |
| `/spec/vol2-data-model.md` | Canonical data model | **Required before build** |
| `/spec/vol3/<module>.md` | Per-module SRS | Written per phase |
| `/spec/vol4/<vertical>.yaml` | VDL manifests | Phase 4 onward |
| `/spec/vol5-crosscutting.md` | Compliance, integration, NFR detail | Required by Phase 3 |
| `/spec/state.md` | Live build state | Created at Phase 0 start |
| `/spec/decisions-taken.md` | Decisions made during build, for review | Created at Phase 0 start |
| `/spec/questions.md` | Blocked items awaiting human answer | Created at Phase 0 start |

---

*End of Volume 6.*
