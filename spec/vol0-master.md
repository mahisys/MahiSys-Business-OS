# MahiSys Business OS
## Master Specification — Volume 0 (Complete)

**Document ID:** BOS-VOL0-MASTER
**Version:** 2.0 — supersedes BOS-VOL0 Draft 1
**Owner:** Mukul Thuse, MahiSys (OPC) Private Limited
**Date:** September 2026
**Status:** Baseline for implementation

> This is the root specification. Every downstream volume, every module SRS,
> and every instruction issued to an AI implementer references identifiers
> defined here. Nothing downstream may invent a module ID, an entity, a
> persona, a journey or a dependency that does not appear in this document.

---

# TABLE OF CONTENTS

**PART A — CHARTER & STRATEGY**
1. Document set and reference discipline
2. Product charter
3. Why this is not another application
4. Architecture theses
5. Layer model

**PART B — FOUNDATIONS**
6. The twelve primitives
7. Persona model
8. Cross-module journeys
9. Channel, mobile and offline strategy
10. Document rendering and template layer

**PART C — APPLICATION CATALOGUE**
11. Kernel · 12. Compliance & Integration · 13. Intelligence · 14. Studio
15. Commerce · 16. Sales · 17. Marketing · 18. Digital · 19. Supply Chain
20. Manufacturing · 21. Delivery · 22. Operations · 23. Finance
24. People · 25. Insights · 26. Security

**PART D — INTELLIGENCE**
27. Agent architecture and the Trust Ladder
28. The wow catalogue
29. AI unit economics

**PART E — VERTICALS**
30. Vertical Definition Language
31. Industry OS catalogue

**PART F — COMMERCIAL**
32. Signup and provisioning journey
33. SKU, pricing and billing architecture

**PART G — ENGINEERING GOVERNANCE**
34. Upgrade safety and customisation policy
35. Testing and acceptance strategy
36. Non-functional requirements
37. Security and certification roadmap
38. Migration strategy
39. Build order and phasing
40. Delivery capacity model
41. Risk register
42. Conventions
43. Decision log

---
---

# PART A — CHARTER & STRATEGY

## 1. Document set and reference discipline

| Vol | Title | Contents |
|-----|-------|----------|
| **0** | This document | Charter, primitives, personas, journeys, full application catalogue, verticals, commercial model, engineering governance |
| **1** | Platform Kernel SRS | Kernel modules specified to field and API level |
| **2** | Canonical Data Model | The twelve primitives to field level; extension rules |
| **3** | Module SRS (×185) | One file per application, fixed template |
| **4** | Industry OS Packs | One VDL manifest per vertical |
| **5** | Cross-Cutting Specs | Compliance, integrations, security, NFR detail |
| **6** | Build Runbook | Sequenced implementation instructions for Claude Code |

**Reference discipline.** A module SRS states what it owns and what it
consumes *by ID*. It never restates a consumed definition. If `FIN-04` needs
a customer, it references `P-01 Party`. This one rule is what keeps 185
specifications coherent when written and implemented over months.

**Template for every Vol 3 module file:**

```
ID · Name · Family · Layer · SKU tier · Depends on
1.  Purpose and buyer
2.  Personas and their jobs
3.  Scope in / scope out
4.  Entities owned; entities consumed (by ID)
5.  State machines
6.  Standard functional requirements   (MODULEID-FR-NNN)
7.  Differentiating requirements        (MODULEID-DR-NNN)
8.  Agents                              (MODULEID-AG-NN)
9.  Screens and flows
10. API surface
11. Permission matrix by persona
12. Events emitted / consumed
13. Reports and KPIs
14. Compliance touchpoints
15. Offline behaviour
16. Acceptance criteria (Given/When/Then)
17. Open questions
```

---

## 2. Product charter

### 2.1 Definition

A multi-tenant, metadata-driven Business Operating System delivered as an
à-la-carte suite of applications, packaged and sold as purpose-built Industry
Operating Systems. One kernel, one data model, one intelligence layer, many
faces.

### 2.2 What it is not

- Not an ERP with a chatbot bolted on.
- Not a federated set of applications sharing a login page.
- Not a product line where each industry is a separate codebase.
- Not a low-code toolkit sold to developers. It is finished software that
  happens to be reconfigurable by its owner in plain language.

### 2.3 Primary buyer, Phase I

Owner-led Indian SMBs in manufacturing, distribution and FMCG. Turnover
₹5 Cr to ₹250 Cr, 20 to 500 employees, currently running Tally plus five to
twelve disconnected tools plus a very large amount of WhatsApp and Excel.
The decision maker is the owner or a family director, not a CIO. The sale is
won on time-to-value and lost on onboarding friction.

### 2.4 Positioning

> Zoho gave you forty apps. Odoo gave you a toolkit. SAP gave you a project.
> We give you one operating system that already knows your industry, sets
> itself up from your existing data, and runs the parts of your business you
> keep forgetting to run.

### 2.5 The three provable claims

1. **One brain.** Because it is one platform rather than a set of
   integrations, the intelligence layer reasons across the entire business at
   once. Structurally unavailable to a federated competitor.
2. **It configures itself.** Onboarding is an AI task, not a consulting
   engagement. Days, not quarters.
3. **Autonomy you can trust.** Agents earn the right to act, per tenant, on
   evidence, with complete reversibility.

---

## 3. Why this is not another application

Six structural choices, each of which a conventional build would get wrong.

**One data model, not integrations.** Competing suites federate. A customer
in their CRM is a different row from the customer in their accounting app,
reconciled by an integration that breaks. Here a Party is one object. This is
unglamorous and it is the entire foundation of the intelligence claim.

**Metadata to the core.** No hand-written screen exists that a tenant could
not also have generated. Ten verticals therefore cost authoring effort, not
engineering effort. A hand-coded product would need ten codebases.

**Event-sourced.** Every state change is an immutable fact. This gives
automation, agents, audit, analytics, simulation and undo from one mechanism
instead of five bolted-on subsystems.

**Agents as registered actors.** An agent has an identity, a version, a
permission scope, a trust level, an audit trail and a rollback path — exactly
like a human user. Not a prompt embedded in a screen.

**Trust earned, not granted.** The Trust Ladder converts the hardest
objection in the sale — "I am not letting software touch my invoices" —
into a demonstration.

**Compliance as a kernel service.** GST, e-invoicing, e-way bill and TDS are
not features inside Finance. They are services any module can consume, which
is why a Manufacturing job-work challan and a Distribution stock transfer
both get e-way bills without either module knowing how.

---

## 4. Architecture theses

Decisions, not options. Downstream volumes inherit them without renegotiation.

| # | Thesis |
|---|--------|
| **T1** | **Metadata-driven core.** Entities, fields, forms, views, state machines, permissions, reports and navigation are data, not code. |
| **T2** | **Twelve primitives, no more.** Every business object in every industry resolves to one of twelve kernel primitives. Modules extend; they never define parallels. |
| **T3** | **Event-sourced spine.** Every state change emits an immutable event. Modules communicate through events, never by reaching into each other's tables. |
| **T4** | **Semantic graph alongside the relational store.** Records, documents, transcripts, emails and messages are indexed into one tenant-scoped graph. |
| **T5** | **Agents are first-class actors.** Registered, versioned, permissioned, audited, reversible. |
| **T6** | **The Trust Ladder governs all autonomy.** No agent acts beyond the level it has earned for that specific tenant. |
| **T7** | **Composition over configuration over customisation.** A vertical requiring new code has failed the architecture. |
| **T8** | **Compliance is a layer, not a module.** |
| **T9** | **WhatsApp and voice are clients, not channels.** The system must be fully operable by a floor supervisor in Marathi by voice and by a route salesman entirely inside WhatsApp. |
| **T10** | **Every mutation is reversible.** Compensating transactions designed in, not retrofitted. |
| **T11** | **Isolation tiers.** Row-level by default; schema-level or dedicated instance where regulation demands. |
| **T12** | **Offline-tolerant.** Local-first capture with deterministic conflict resolution is a kernel service. |
| **T13** | **Upgrade safety is a first-class constraint.** Tenant customisations live in a namespace the platform never writes to. Platform upgrades may add, never mutate or remove, tenant-extended structures. |
| **T14** | **Specification-driven implementation.** Acceptance criteria and contract tests are written before code. An AI implementer builds against tests, not prose. |
| **T15** | **Degrade, never block.** If the AI layer is unavailable, every business process must still complete manually. Intelligence is additive; it is never load-bearing for a transaction. |

---

## 5. Layer model

```
┌───────────────────────────────────────────────────────────────┐
│ L5  INDUSTRY OS PACKS        VDL manifests — zero code        │
│     Manufacturing · Distribution · Services · Healthcare      │
│     Pharma · Telecom · BFSI · Aviation · 3PL · Government     │
├───────────────────────────────────────────────────────────────┤
│ L4  STUDIO                   generate the product from language│
├───────────────────────────────────────────────────────────────┤
│ L3  INTELLIGENCE             graph · agents · simulation       │
├───────────────────────────────────────────────────────────────┤
│ L2  APPLICATIONS             Sales · Finance · SCM · MFG · …   │
├───────────────────────────────────────────────────────────────┤
│ L1  COMPLIANCE & INTEGRATION SERVICES                          │
├───────────────────────────────────────────────────────────────┤
│ L0  KERNEL                   primitives · events · process · IAM│
└───────────────────────────────────────────────────────────────┘
```

Nothing in a higher layer may be depended upon by a lower one. The Studio
generates applications; no application may call the Studio.

---
---

# PART B — FOUNDATIONS

## 6. The twelve primitives

| ID | Primitive | Definition | Absorbs |
|----|-----------|-----------|---------|
| **P-01** | **Party** | Any legal or natural person the business has a relationship with | Lead, contact, customer, vendor, employee, candidate, patient, passenger, student, subscriber, borrower, dealer, distributor, contractor, regulator, citizen |
| **P-02** | **Item** | Anything sellable, buyable, consumable or stockable | SKU, raw material, service, plan, drug, lab test, seat, tariff, course, policy, spare, asset class |
| **P-03** | **Resource** | A capacity-constrained thing that gets booked or utilised | Machine, bed, aircraft, technician, doctor, room, truck, chair, tower, mould, tool, dock |
| **P-04** | **Location** | A place within a hierarchy | Plant, warehouse, bin, branch, ward, route, territory, airport, site, store, zone |
| **P-05** | **Document** | A business paper with a lifecycle and legal identity | Quotation, PO, invoice, work order, GRN, challan, prescription, AWB, claim, loan file, gate pass |
| **P-06** | **Transaction** | An atomic movement of value or material | GL entry, payment, stock move, credit note, journal, adjustment |
| **P-07** | **Process** | A state machine plus approvals plus SLA | Pipeline, ticket lifecycle, hiring flow, routing, discharge, adjudication, file movement |
| **P-08** | **Event** | An immutable fact that something happened | Every state change in the system |
| **P-09** | **Record** | A longitudinal file about a Party or Resource | Patient chart, machine history, aircraft logbook, employee file, KYC file, customer 360 |
| **P-10** | **Agreement** | A binding term set with a validity window | Contract, SLA, AMC, subscription, rate card, policy, lease, scheme |
| **P-11** | **Measurement** | A recorded observation with unit and tolerance | QC reading, lab result, sensor value, meter reading, vitals, inspection, score |
| **P-12** | **Rule** | A declarative condition-action policy | Pricing, credit limit, eligibility, discount, reorder, compliance check, approval threshold |

### 6.1 Decomposition proof

| Apparent "module" | Actual composition |
|---|---|
| Bed Management | Resource + Process + Record + Measurement |
| Laboratory Management | Item + Resource + Measurement + Record + Document |
| Formulation | Item + Rule + Measurement |
| Roster | Resource + Process + Rule |
| Learning Management | Item + Party + Record + Process |
| Booking | Resource + Process + Agreement |
| Facility Management | Location + Resource + Process + Agreement |
| Aircraft Maintenance | Resource + Record + Measurement + Process |
| Loan Origination | Party + Document + Process + Rule + Agreement |
| Network Site Operations | Resource + Location + Process + Measurement |
| Government File Movement | Document + Process + Party + Record |

Each is a **manifest**, not a codebase. This table is the economic argument
for the entire architecture.

---

## 7. Persona model

Personas drive permissions, layouts, mobile surfaces, agent escalation paths
and pricing tiers. Every module SRS must state which personas use it.

### 7.1 Internal personas

| ID | Persona | Primary surface | Characteristic need |
|----|---------|-----------------|---------------------|
| PR-01 | Owner / Director | Mobile + web | Exception-only view; approve, not operate |
| PR-02 | Functional Head (CXO) | Web | Cross-module visibility in own function |
| PR-03 | Plant / Production Head | Web + floor tablet | Schedule, capacity, bottleneck |
| PR-04 | Shop Floor Supervisor | Mobile, voice, vernacular, offline | Log production without typing |
| PR-05 | Store / Warehouse Keeper | Mobile + scanner | Fast stock movement, few taps |
| PR-06 | Purchase Officer | Web | Compare, negotiate, follow up |
| PR-07 | Quality Inspector | Mobile + offline | Capture readings against spec |
| PR-08 | Sales Manager | Web + mobile | Pipeline, forecast, team |
| PR-09 | Field Sales / Beat Rep | Mobile-only, offline, WhatsApp | Order capture on the move |
| PR-10 | Inside Sales / Telecaller | Web | Call list, script, disposition |
| PR-11 | Marketing Executive | Web | Campaigns, content, attribution |
| PR-12 | Project Manager | Web | Plan, resource, margin |
| PR-13 | Field Service Technician | Mobile-only, offline | Job card, parts, signature |
| PR-14 | Support Agent | Web | Queue, SLA, knowledge |
| PR-15 | Accountant | Web | Entry accuracy, reconciliation |
| PR-16 | Finance Controller / CFO | Web | Close, cash, compliance |
| PR-17 | HR Manager | Web | Lifecycle, compliance, cases |
| PR-18 | Payroll Officer | Web | Cycle accuracy, statutory |
| PR-19 | Employee | Mobile self-service | Attendance, leave, payslip, claims |
| PR-20 | Contract Labour Supervisor | Mobile | Headcount, gate, attendance |
| PR-21 | System Administrator | Web | Users, roles, integrations, agents |

### 7.2 External personas

| ID | Persona | Surface | Need |
|----|---------|---------|------|
| PR-22 | Customer | Portal + WhatsApp | Order status, statement, ticket, payment |
| PR-23 | Dealer / Distributor | Portal + mobile | Order, scheme, claim, stock |
| PR-24 | Vendor | Portal | PO, ASN, invoice, payment status |
| PR-25 | External CA / Auditor | Scoped web, read-mostly | Books, evidence, filings |
| PR-26 | Regulator / Inspector | Scoped read-only | Records, trail, evidence |
| PR-27 | Job Candidate | Portal | Apply, status, offer |
| PR-28 | Implementation Partner | Studio + admin | Configure, author manifests |

### 7.3 Non-human personas

| ID | Persona | Note |
|----|---------|------|
| PR-29 | Agent | Registered actor with identity, version, trust level, audit trail |
| PR-30 | Integration Service Account | Scoped, rotating credentials, rate limited |

**Design rule.** PR-04, PR-05, PR-07, PR-09, PR-13, PR-19, PR-20 are
mobile-first, often offline, frequently vernacular, and in several cases
functionally non-literate in English. They represent the majority of daily
transactions in a manufacturing or distribution tenant. Any design that
serves PR-01 and PR-15 well but these poorly has failed.

---

## 8. Cross-module journeys

Modules are nouns. Journeys are verbs. A journey is what makes this an
operating system rather than 185 applications sharing a login. Each journey
below becomes an integration test suite in Vol 6, and each is a demo script.

| ID | Journey | Spans | Personas |
|----|---------|-------|----------|
| **J-01** | **Enquiry to Cash** | SLS-01 → SLS-07 → SCM-02 → MFG-04 → SCM-06 → FIN-04 → CMP-02 → FIN-05 | PR-08, PR-03, PR-05, PR-15 |
| **J-02** | **Procure to Pay** | SCM-04 → SCM-05 → SCM-02 → MFG-06 → FIN-03 → CMP-05 → FIN-05 | PR-06, PR-05, PR-07, PR-15 |
| **J-03** | **Plan to Produce** | SCM-07 → MFG-03 → MFG-01 → MFG-04 → MFG-06 → MFG-08 | PR-03, PR-04, PR-07 |
| **J-04** | **Hire to Retire** | PPL-03 → PPL-04 → PPL-05 → PPL-08 → PPL-10 → PPL-04 | PR-17, PR-18, PR-19 |
| **J-05** | **Lead to Customer** | MKT-01 → WEB-05 → SLS-01 → SLS-04 → SLS-07 → SLS-03 | PR-11, PR-10, PR-08 |
| **J-06** | **Issue to Resolution** | OPS-01 → OPS-07 → DLV-07 → SCM-02 → FIN-04 | PR-14, PR-13, PR-22 |
| **J-07** | **Stock to Shelf** | SCM-08 → SLS-10 → SCM-06 → FIN-02 → MKT-08 | PR-09, PR-23, PR-05 |
| **J-08** | **Contract to Renewal** | OPS-06 → FIN-12 → OPS-07 → SLS-04 | PR-02, PR-16, PR-22 |
| **J-09** | **Record to Report** | FIN-01 → FIN-07 → FIN-08 → CMP-05 → INS-04 | PR-15, PR-16, PR-25 |
| **J-10** | **Job Work Out and Back** | MFG-05 → CMP-03 → SCM-02 → MFG-06 → FIN-03 | PR-06, PR-05, PR-07 |
| **J-11** | **Signup to Value** | COM-01 → COM-02 → COM-04 → INT-08 → COM-05 | PR-01, PR-21 |
| **J-12** | **Compliance Calendar** | CMP-01..05 → PPL-09 → FIN-08 → SEC-06 | PR-15, PR-16, PR-25 |
| **J-13** | **Complaint to Recall** | OPS-01 → SCM-10 → MFG-06 → SCM-09 → CMP-06 | PR-14, PR-07, PR-02 |
| **J-14** | **Idea to Live Module** | STU-01 → STU-02 → STU-10 → deployed | PR-21, PR-28 |

**Rule for implementation.** A module is not "done" when its own tests pass.
It is done when every journey it participates in passes end to end.

---

## 9. Channel, mobile and offline strategy

### 9.1 Four clients, one system

| Client | Who | Scope |
|--------|-----|-------|
| **Web** | PR-01..03, 06, 08, 10..12, 14..18, 21..28 | Full functionality |
| **Mobile app** | PR-01, 04, 05, 07, 09, 13, 19, 20, 23 | Role-scoped task surfaces; offline-first |
| **WhatsApp** | PR-01, 09, 19, 22, 23, 24 | Conversational transactions, approvals, notifications, order capture |
| **Voice** | PR-04, 05, 07, 09, 13 | Vernacular capture, hands-busy contexts |

### 9.2 Offline contract

Modules declare an offline profile: `full` (capture and read work offline),
`read` (cached read only), or `online` (requires connectivity). Sync is
last-writer-wins for independent fields, server-authoritative for stock and
financial quantities, and queued-with-review for conflicts a machine should
not resolve. Every offline-capable module SRS must state its conflict policy.

Offline-`full` modules at launch: SCM-02, SCM-03, MFG-04, MFG-06, SLS-10,
DLV-05, DLV-07, PPL-05, OPS-10.

### 9.3 WhatsApp as a client

Not a notification channel. Supported interactions: order capture from text
or photo, approval with one tap, dispatch confirmation, payment reminder and
UPI link, ticket raise and status, attendance mark, leave request, daily
brief delivery. Session, identity and permission all resolve to the same
kernel objects as web.

---

## 10. Document rendering and template layer

Underestimated in every Indian business software project, and a frequent
cause of rejected implementations. Indian invoices, challans, job cards,
salary slips and gate passes are heavily formatted, legally particular, and
customer-specific.

**KRN-08 sub-system requirements:** template designer with print-accurate
preview; multi-format output (A4, A5, thermal 2" and 3", DOT-matrix); QR and
barcode; digital signature block; multi-lingual and multi-script; conditional
sections by rule; watermarks for draft, duplicate and triplicate copies;
statutory layouts pre-shipped per document type; per-customer template
override; and bulk generation.

Every document-producing module must reference a named template ID rather
than hard-coding a layout.

---
---

# PART C — APPLICATION CATALOGUE

**How to read this section.** Every application has a permanent ID, a layer,
an SKU disposition, a purpose, its standard (table-stakes) capability set,
its differentiating capability set, and its agents. `Included` means bundled
into the platform fee and not separately priced. Agent trust ceilings are
shown as L0–L4 per §27.

---

## 11. Kernel (KRN) — Layer 0, always present, never separately priced

**KRN-01 · Tenancy & Organisation Model** — `included`
Defines tenant, legal entity, division, branch and cost centre hierarchy, and the isolation tier a tenant runs under.
*Standard:* multi-entity hierarchy; fiscal calendars per entity; base and reporting currency; inter-entity relationships; tenant lifecycle states.
*Differentiating:* isolation tier is a tenant attribute, not a deployment decision — a tenant can be promoted from row-level to schema-level to dedicated instance without re-implementation, which is what makes regulated verticals sellable on the same codebase.

**KRN-02 · Identity & Authentication** — `included`
Every actor that can touch the system: human users, service accounts, external portal users and agents.
*Standard:* email/phone login, OTP, SSO (SAML, OIDC), Google Workspace, session policy, device registration, impersonation with audit.
*Differentiating:* agents hold real identities with versioned credentials, so an agent action is attributable to a specific agent build, not to "the system".

**KRN-03 · Access Control** — `included`
Role-based and attribute-based authorisation down to field and row.
*Standard:* roles, permission sets, record ownership, hierarchy-based visibility, field-level masking, delegation during absence.
*Differentiating:* policies are metadata, so Studio-generated entities inherit enforcement automatically; and agent scopes are expressed in the same language as human scopes, making "what can this agent see" answerable in one screen.

**KRN-04 · Entity & Metadata Engine** — `included`
The registry of every entity, field, relationship and validation in the system. The foundation of T1.
*Standard:* entity definition, field types, lookups, computed fields, validation rules, uniqueness, cascade behaviour, schema versioning.
*Differentiating:* platform namespace and tenant namespace are strictly separated (T13), which is the mechanism that lets a heavily customised tenant take a platform upgrade without breaking.

**KRN-05 · Process Engine** — `included`
State machines, approval matrices, SLAs and escalation for every module.
*Standard:* states and transitions, guards, parallel and sequential approvals, delegation, escalation timers, SLA clocks with business calendars, reassignment.
*Differentiating:* a process can nominate an agent as an approver at a defined trust level, so routine approvals disappear entirely while exceptions still reach a human.

**KRN-06 · Event Bus & Event Store** — `included`
The immutable spine (T3).
*Standard:* event publication, subscription, ordering guarantees, replay, dead-letter handling, retention policy.
*Differentiating:* the event store is the source for audit, analytics, simulation, agent triggers and undo simultaneously — one mechanism where competitors have five.

**KRN-07 · Rules Engine** — `included`
Declarative condition-action policies (P-12) used by pricing, credit, reorder, eligibility and compliance.
*Standard:* rule sets, priority, effective dating, simulation against historical data, versioning.
*Differentiating:* rules are authorable in natural language via STU-05 and always compile to inspectable declarative form — never to opaque model behaviour.

**KRN-08 · Document Service** — `included`
File storage, versioning, templates and rendering (§10).
*Standard:* upload, versioning, retention, template designer, multi-format print, barcode/QR, bulk generation, preview.
*Differentiating:* statutory Indian layouts ship pre-built per document type; per-customer template overrides are configuration, not development.

**KRN-09 · Notification & Communication Hub** — `included`
One routing layer for email, WhatsApp, SMS, push and in-app.
*Standard:* templates, per-user channel preference, quiet hours, batching, delivery tracking, opt-out, throttling.
*Differentiating:* WhatsApp is a bidirectional client here (T9), so an approval sent as a notification can be granted in the same thread and lands as an authenticated action.

**KRN-10 · Audit & Immutable Log** — `included`
Who did what, when, and why — for humans and agents alike.
*Standard:* full mutation trail, before/after values, IP and device, tamper-evident storage, retention, export.
*Differentiating:* agent entries carry the reasoning trace, confidence score, input evidence and the exact rollback handle, making autonomy auditable rather than mysterious.

**KRN-11 · Numbering & Sequencing** — `included`
Statutory-grade document numbering.
*Standard:* per-entity, per-document-type series; fiscal year rollover; prefixes and suffixes; gapless sequences for statutory documents; branch-wise series; reservation and cancellation handling.

**KRN-12 · Masters & Reference Data** — `included`
The shared reference layer: UoM and conversions, currencies and rates, tax codes, HSN/SAC, state and country, pin codes, calendars and holidays, bank master.
*Differentiating:* HSN/SAC, GST rate schedules and pin-code mappings are platform-maintained and updated centrally, so tenants never carry stale statutory data.

**KRN-13 · Layout & Navigation Engine** — `included`
Metadata-driven screens, menus and personalisation.
*Standard:* list, form, kanban, calendar, timeline and dashboard views; saved filters; column personalisation; role-based navigation; responsive layout.
*Differentiating:* layouts are vertical-aware — the same module presents different default screens under a Manufacturing manifest and a Healthcare manifest with no code difference.

**KRN-14 · Search & Semantic Index** — `included`
Full-text and vector indexing across records, documents and communications.
*Standard:* global search, scoped search, permission-filtered results, fuzzy matching, recent and suggested.
*Differentiating:* the same index feeds INT-01, so "search" and "ask" are the same substrate rather than two systems.

**KRN-15 · Scheduler & Job Runtime** — `included`
Cron, queues, long-running jobs, retries, idempotency, backpressure and job observability.

**KRN-16 · Sync & Offline Service** — `included`
Local-first capture with deterministic conflict resolution (§9.2).
*Differentiating:* offline is a kernel guarantee with a declared per-module contract, not a per-app afterthought — which is why floor and field roles are usable at all.

**KRN-17 · Data Platform** — `included`
Warehouse, CDC, lineage, retention and the analytical substrate behind INS and INT.
*Standard:* incremental materialisation, semantic layer, row-level security carried into analytics, historical snapshots.

**KRN-18 · Undo & Compensation** — `included`
The mechanism behind T10.
*Standard:* reversal handles on every mutation, compensating transaction definitions, cascade-aware reversal, reversal audit.
*Differentiating:* "undo everything this agent did today, across modules" is a supported operation. No comparable platform offers it, and it is the reason owners will permit autonomy at all.

**KRN-19 · Localisation & Terminology** — `included`
Language packs and vertical terminology overrides.
*Standard:* English, Hindi, Marathi at launch; number, date and currency formats; Indian numbering (lakh, crore).
*Differentiating:* terminology is manifest-driven — "Party" becomes Patient, Passenger or Citizen across every screen, report and notification from a single manifest line.

**KRN-20 · Licensing & Entitlement** — `included`
Enforces what a tenant has bought, at the metadata layer.
*Standard:* SKU registry, feature flags, seat counts, usage metering, grace periods, trial states.
*Differentiating:* unpurchased modules are invisible in navigation and rejected at the API boundary while their data contracts still exist, so an upgrade is instantaneous and requires no migration.

---

## 12. Compliance & Integration (CMP, ITG) — Layer 1

**CMP-01 · GST Engine** — `included`
Tax determination as a service consumed by every transacting module.
*Standard:* place-of-supply logic, intra/inter-state determination, CGST/SGST/IGST/cess, reverse charge, composition, exempt and nil-rated, HSN/SAC mapping, ITC eligibility, rate effective-dating.
*Differentiating:* one engine means a job-work challan, a stock transfer and a POS bill all determine tax identically; no module reimplements GST.

**CMP-02 · E-Invoicing (IRP)** — `included`
*Standard:* IRN generation, signed QR, schema validation, cancellation within window, bulk generation, IRP failover, amendment handling.
*Differentiating:* pre-submission validation catches schema failures before the IRP does, which is where most implementations bleed time.

**CMP-03 · E-Way Bill** — `included`
*Standard:* generation, Part-B vehicle update, extension, consolidation, cancellation, distance validation, multi-vehicle.
*Differentiating:* generated automatically from dispatch events across Sales, Manufacturing job work and Warehouse transfers, because it subscribes to events rather than living inside one module.

**CMP-04 · TDS / TCS** — `included`
Section-wise rates, threshold tracking across the year, lower-deduction certificates, challan generation, Form 16A/27D data, 26AS reconciliation.

**CMP-05 · Statutory Filings** — `Core`
GSTR-1, 3B and 9 preparation; GSTR-2B reconciliation; returns calendar; ITC matching; annual filing support; filing evidence archive.
*Agents:* `CMP-AG-01` Reconciliation Agent (L3) — matches 2B against purchase register, resolves what it can, presents only genuine mismatches.

**CMP-06 · Regulated Records** — `Add-on`
The kernel capability that makes Pharma, BFSI, Aviation and Healthcare sellable. Validated audit trail, record immutability, electronic records with meaning, change control with evidence, periodic review, and controlled retention. Built in Phase I even though those verticals ship in Phase III (§39).

**CMP-07 · Electronic Signature** — `Add-on`
Aadhaar eSign, DSC, signature meaning and intent capture, signature audit binding, multi-party signing flows.

**CMP-08 · Data Residency & Sovereignty** — `Add-on`
Region pinning, isolation tier enforcement, cross-border transfer controls, DPDP-aligned processing records.

**ITG-01 · Connector Framework** — `included`
Auth (OAuth, API key, mTLS), rate limiting, retry with backoff, field mapping, transformation, webhook ingress and egress, replay, connector health monitoring.

**ITG-02 · Tally Bridge** — `Core`
The single most important migration path in the Indian market.
*Standard:* two-way sync of masters, vouchers and ledgers; conflict handling; historical import; ongoing mirror mode.
*Differentiating:* INT-08 uses this to infer chart of accounts, item masters, customer and vendor lists and even approval habits from years of existing Tally data — turning migration into onboarding.

**ITG-03 · Payment Gateways** — `Core`
Razorpay, PayU, Cashfree, UPI, cards, netbanking, mandates and autopay, payment links, settlement reconciliation.

**ITG-04 · Banking APIs** — `Add-on`
Statement feeds, payout initiation, virtual accounts for receivables identification, balance polling, bulk transfer files.

**ITG-05 · Channel & Marketplace** — `Add-on`
Amazon, Flipkart, quick-commerce, retailer EDI, distributor portals; catalogue push, order pull, inventory sync, settlement reconciliation.

**ITG-06 · Telephony & CTI** — `Add-on`
Click-to-call, call recording, IVR, call disposition, transcript capture into INT-01.

**ITG-07 · Government APIs** — `Core`
GSTN, MCA, EPFO, ESIC, DGFT, Vahan, IRP, NIC e-way bill.
*Differentiating:* GSTIN lookup at signup returns legal name, trade name, address, constitution and registration status — the form fills itself (see §32).

**ITG-08 · IoT & Device Gateway** — `Add-on`
Machine telemetry, weighbridge, barcode and RFID readers, biometric attendance devices, sensors, energy meters. Buffering, device identity, and offline replay.

---

## 13. Intelligence (INT) — Layer 3

This layer is the product. It is present in every SKU at trust levels L0–L2
and upgraded by tier.

**INT-01 · Semantic Graph** — `included`
One tenant-scoped knowledge graph over every entity, event, document, email, message and call transcript.
*Differentiating:* this is the moat. A federated suite cannot build it because its data lives in twelve systems with twelve identity models. Every other intelligence capability in this section is downstream of it.

**INT-02 · Copilot** — `included`
Conversational interface to the entire business, permission-scoped to the asking user.
*Standard:* natural-language query, record creation, navigation, summarisation, in-context help.
*Differentiating:* causal traversal — "why did Nashik margin drop last quarter" walks deals → pricing → vendor POs → freight → returns → call transcripts and answers with the chain, not a number. Answers respect the asker's permissions exactly; a supervisor and an owner asking the same question get different, correct answers.

**INT-03 · Agent Runtime & Registry** — `included`
Agent identity, versioning, scheduling, tool binding, execution, telemetry and cost accounting (§27).

**INT-04 · Trust Ladder & Governance** — `included`
Per-tenant, per-agent autonomy levels with evidence-based promotion, financial and risk ceilings, demotion on error, kill switch, and full provenance (§27.3).
*Differentiating:* nothing comparable exists in the market. It is the answer to the objection that blocks every AI sale to an owner-led business.

**INT-05 · Simulation & Digital Twin** — `Intelligence tier`
"What if" against the tenant's own history.
*Standard:* price change impact, capacity change, headcount change, credit policy change, payment-terms change, product-mix shift.
*Differentiating:* runs on the event store, so scenarios are grounded in the tenant's actual behaviour rather than generic models. An owner can test a decision before making it — a capability their current stack simply does not have.

**INT-06 · Document Intelligence** — `Core`
Photo, PDF, scan or handwriting to structured, validated, posted record.
*Standard:* vendor invoice, PO, GRN, LR/AWB, cheque, bank statement, prescription, handwritten order.
*Differentiating:* extraction is validated against the tenant's own masters before posting, and confidence below threshold routes to a human rather than posting a guess. A route salesman photographs a handwritten order and a confirmed sales order comes back.

**INT-07 · Voice & Vernacular** — `Core`
Speech in, action out, in Hindi, Marathi and English at launch.
*Standard:* voice command, voice data capture, voice notes transcribed into records, text-to-speech briefings.
*Differentiating:* designed for PR-04, PR-05, PR-07, PR-09 and PR-13 — floor and field roles who will never type into a form. Works offline for capture, syncs when connected. This alone changes who in an Indian SMB can use business software.

**INT-08 · Onboarding Intelligence** — `included`
Reads existing Tally data, Excel files and an inbox; infers chart of accounts, item masters, customers, vendors, price lists, approval habits and workflows; then asks roughly a dozen confirmation questions.
*Differentiating:* the anti-friction weapon. Onboarding is where Indian SMB software dies, and making it an AI task rather than a consulting engagement is worth more commercially than ten modules.

**INT-09 · Anomaly & Signal Detection** — `Intelligence tier`
Continuous cross-module scanning for margin leakage, duplicate vendors, circular billing, approval patterns that are too fast, discount patterns tracking one salesperson, stockout risk, attrition risk, collection deterioration.
*Differentiating:* only visible with one dataset. A federated stack cannot see that a vendor and a customer share a bank account.

**INT-10 · Narrative Reporting** — `Intelligence tier`
Numbers to written explanation with causal traversal; the daily and weekly brief; board-pack narrative; variance commentary.

**INT-11 · Knowledge & RAG** — `Core`
SOPs, manuals, contracts, policies, drawings and past tickets made answerable, permission-scoped.
*Differentiating:* observes how work actually flows through the event store and drafts the SOP the business is really following, then offers to enforce it as a process.

**INT-12 · Model Gateway** — `included`
Routing across models, caching, small-model routing for cheap tasks, per-tenant token budgets and hard ceilings, PII redaction, fallback chains, and an on-premise model option for regulated tenants. Directly governs §29.

---

## 14. Studio (STU) — Layer 4

**STU-01 · App Builder** — `Core`
Natural language to a working application: entity, fields, form, list view, state machine, permissions and report.
*Differentiating:* the honest answer to "any business, any industry". "I need a gate pass workflow for job-work returns approved by the plant head" produces a working, permissioned, reportable module. Generated artefacts land in the tenant namespace (T13) and are therefore upgrade-safe.

**STU-02 · Workflow Designer** — `Core`
Visual and natural-language state machine authoring; approval matrices; SLA and escalation; simulation of a workflow against historical records before activation.

**STU-03 · Form & View Designer** — `Core`
Layout, sections, conditional visibility, field-level logic, validation, mobile layout, print layout binding.

**STU-04 · Report Builder** — `Core`
Metadata-driven reports and dashboards; natural-language report creation; scheduled distribution; drill-through.

**STU-05 · Automation Builder** — `Core`
Trigger-condition-action authoring in natural language, compiling to inspectable declarative rules (never opaque model behaviour).

**STU-06 · Integration Builder** — `Add-on`
Connector authoring, endpoint mapping, transformation, test harness, credential management.

**STU-07 · Agent Builder** — `Add-on`
Define an agent: trigger, tools, data scope, trust ceiling, financial ceiling, escalation path, rollback procedure, success metric. Test against historical events before activation.

**STU-08 · Vertical Manifest Editor** — `Add-on / Partner`
Author, fork and version VDL packs (§30). The tool that turns implementation partners into a distribution channel.

**STU-09 · Theme & Branding** — `Core`
White-label, tenant identity, portal theming, document branding.

**STU-10 · Sandbox & Change Control** — `Add-on`
Dev/test/production environments, promotion pipeline, configuration diff, rollback, approval on promotion, and the change-control evidence required by CMP-06.

---

## 15. Commerce (COM) — the platform's own go-to-market surface

**COM-01 · Storefront & Signup** — `platform`
Public site, industry OS landing pages, progressive discovery form (§32), saved configurations.
*Differentiating:* GSTIN lookup as the first field returns legal name, address and constitution — the form completes itself and the first impression is that the software already knows the customer.

**COM-02 · Package Recommender** — `platform`
Turns discovery inputs into a provisioning manifest and presents it three ways.
*Differentiating:* the free-text "special request" field is a real input. "We do job work for auto components and struggle tracking material sent out" visibly pulls MFG-05 and J-10 into the recommendation and says why. This is the difference between a pricing calculator and something that understood you.

**COM-03 · Pricing & Quote Engine** — `platform`
Bundle pricing, tier pricing, seat and usage metering, discounting rules, proposal generation, GST on subscription, multi-year terms.

**COM-04 · Tenant Provisioning & Lifecycle** — `platform`
Instantiates a manifest: seeds masters, generates roles, creates the admin, spins up agents at L0, applies terminology, loads demo data. Idempotent and reversible. Also handles suspension, upgrade, downgrade, module addition, export and deletion.
*Note:* consistently underestimated. Treated here as a first-class application with its own SRS.

**COM-05 · Trial, Conversion & Dunning** — `platform`
Demo-seeded sandbox, trial state, conversion, invoicing, payment retry, dunning ladder, churn signals.
*Differentiating:* the sandbox is a working tenant preloaded with realistic data for the customer's own industry, so an owner clicks through *their* OS before paying. Worth more than any landing-page copy.

**COM-06 · Partner & Reseller Channel** — `platform`
Partner accounts, deal registration, commission, co-branded portals, manifest certification, partner-managed tenants.

---

## 16. Sales (SLS)

**SLS-01 · Leads** — `Core`
Capture, qualify, score, assign, convert. Multi-source ingestion (web forms, WhatsApp, calls, marketplaces, imports), duplicate detection, routing rules, SLA on first response.
*Differentiating:* enrichment from the graph and public sources; lead scoring learned from the tenant's own conversion history rather than a generic model.
*Agents:* `SLS-AG-01` Lead Response Watchdog (L3) — escalates when first-response SLA is at risk. `SLS-AG-02` Enrichment Agent (L3).

**SLS-02 · Contacts** — `Core`
Person master: roles, relationships, communication preferences, consent, interaction history, org mapping.
*Differentiating:* one Contact object shared with Support, Finance and Delivery — no duplicate customer records anywhere in the business.

**SLS-03 · Accounts** — `Core`
Company master: hierarchy (group, entity, site), GSTIN validation, credit limit, payment terms, price list, assigned team.
*Differentiating:* GSTIN-verified identity and automatic detection of the same buyer entering under multiple names.

**SLS-04 · Deals & Pipeline** — `Core`
Opportunity management: stages, values, probability, competitor, loss reason, multi-currency, team selling.
*Differentiating:* stage progression is validated against evidence in the graph — a deal cannot sit at "negotiation" with no activity for six weeks without the pipeline flagging it as fiction. Forecast is grounded in behaviour, not optimism.
*Agents:* `SLS-AG-03` Stall Detector (L2). `SLS-AG-04` Next-Best-Action (L1).

**SLS-05 · Activities** — `Core`
Calls, meetings, emails, visits, notes, tasks; timeline across every entity; auto-capture from email, telephony and WhatsApp.
*Differentiating:* call transcripts and WhatsApp threads are indexed into INT-01, so commitments made in conversation become searchable and can be checked against what was delivered.

**SLS-06 · Call Script Runner** — `Core`
Guided calling: dynamic scripts, branching, objection handling, disposition capture, call lists.
*Differentiating:* live assistance during the call — surfaces the objection response, the customer's outstanding balance and their last complaint while the caller is still speaking; post-call summary written automatically.

**SLS-07 · CPQ — Configure, Price, Quote** — `Core`
Product configuration, rule-driven pricing, discount approval matrix, quote versioning, template output, e-signature, validity and expiry.
*Differentiating:* margin floors enforced before a quote can leave; configuration validated against BOM feasibility for manufacturers, so nobody quotes something the plant cannot make.
*Agents:* `SLS-AG-05` Margin Watchdog (L3) — holds a below-floor quote before it is sent.

**SLS-08 · Territory & Quota** — `Core`
Territory definition by geography, product, segment or named account; quota assignment and tracking; attainment; realignment history.

**SLS-09 · Sales Forecasting** — `Core`
Pipeline-based, run-rate and seasonal forecasting; commit/best-case/pipeline categories; variance analysis.
*Differentiating:* forecast blends pipeline with the tenant's historical conversion behaviour per rep, per product and per season, and states its own confidence.

**SLS-10 · Field Sales & Beat Plan** — `Core`
Route and beat planning, journey cycles, check-in with geotag, outlet-wise order capture, van sales, competitor tracking, market survey. Offline-`full`.
*Differentiating:* mobile-only, offline-first, voice-capable, WhatsApp-integrated — built for PR-09, who is the single highest-volume user in a distribution business and the persona every ERP ignores.
*Agents:* `SLS-AG-06` Beat Adherence Watchdog (L2). `SLS-AG-07` Outlet Drop-off Detector (L2).

**SLS-11 · Dealer & Channel Management** — `Core`
Dealer onboarding, agreements, credit, schemes, claims, secondary sales capture, stock visibility, performance scorecards.
*Differentiating:* scheme calculation and claim settlement automated end to end — historically a spreadsheet swamp and a major source of channel disputes.

**SLS-12 · Customer 360** — `Core`
The complete longitudinal view (P-09): orders, payments, complaints, visits, conversations, credit position, profitability, risk.
*Differentiating:* true 360 because it is one dataset. Includes computed customer profitability after discounts, freight, returns and collection cost — a number most SMBs have never seen.

---

## 17. Marketing (MKT)

**MKT-01 · Campaign Manager** — `Core` — Multi-channel campaign definition, audience, budget, schedule, A/B testing, approval, performance. *Differentiating:* campaign audiences are built from live business data (payment behaviour, purchase recency, service history), not a stale exported list.

**MKT-02 · Email Marketing** — `Core` — Templates, personalisation, sending domains, deliverability, bounce and complaint handling, drip sequences. *Differentiating:* suppression is business-aware — a customer with an open complaint or an overdue dispute is automatically excluded from promotional sends.

**MKT-03 · WhatsApp Marketing** — `Core` — Template management and approval, opt-in ledger, broadcast, conversational campaigns, catalogue sharing, click tracking. *Differentiating:* a promotional thread converts into an order thread inside the same conversation, posting a real sales order (T9).

**MKT-04 · SMS & RCS** — `Add-on` — DLT template registration, transactional and promotional routing, sender ID management, delivery reporting.

**MKT-05 · Social Media Management** — `Add-on` — Scheduling, multi-account publishing, inbox unification, listening, response. *Differentiating:* an inbound social complaint opens a real ticket in OPS-01 with the customer already identified.

**MKT-06 · Surveys** — `Core` — Survey design, distribution across channels, NPS/CSAT, logic branching, anonymity options, response analysis. *Differentiating:* detractor responses trigger a ticket and, at higher trust, an owner alert with the full customer history attached.

**MKT-07 · Events & Webinars** — `Add-on` — Event setup, registration, ticketing, check-in, agenda, sponsor management, follow-up sequencing.

**MKT-08 · Loyalty & Referral** — `Add-on` — Points, tiers, rewards, redemption, referral tracking, channel loyalty for dealers and retailers, expiry.

**MKT-09 · Segmentation & Journeys** — `Core` — Dynamic segments, lifecycle journeys, triggers, wait states, branch logic, exit criteria. *Differentiating:* segments query the semantic graph, so "customers who complained about delivery twice and still order monthly" is a valid, live segment.

**MKT-10 · Attribution & Marketing Analytics** — `Core` — Source tracking, multi-touch attribution, cost per lead and per order, channel ROI, cohort analysis. *Differentiating:* attribution runs to realised cash, not to a lead — because Finance is in the same system.

---

## 18. Digital Studio (WEB)

**WEB-01 · Website Builder** — `Core` — Page builder, sections, templates, responsive design, forms, SEO fields, publishing, custom domain, CDN. *Differentiating:* generate a full industry-appropriate site from the tenant's own catalogue and profile in minutes.

**WEB-02 · Landing Pages** — `Core` — Standalone campaign pages, variants, A/B testing, conversion tracking, direct binding to MKT-01 and SLS-01.

**WEB-03 · CMS** — `Core` — Structured content, blog, media, taxonomy, multilingual, scheduling, roles and editorial workflow.

**WEB-04 · eCommerce Builder** — `Core` — Catalogue, cart, checkout, payment, shipping rules, tax, order management, coupons, B2B price lists, GST-compliant invoicing. *Differentiating:* inventory, pricing and invoicing are the same objects the rest of the business uses — no storefront-to-ERP sync to break.

**WEB-05 · Forms & Capture** — `Core` — Form designer, conditional logic, file upload, spam protection, routing to any entity, embedded and hosted modes.

**WEB-06 · SEO Workbench** — `Add-on` — Search Console integration, keyword tracking, on-page audit, sitemap, structured data, competitor tracking, content briefs.

**WEB-07 · Traffic & Behaviour Analytics** — `Add-on` — Sessions, sources, funnels, heatmap-style event capture, goal tracking, privacy-aware measurement.

**WEB-08 · Customer Portal** — `Core` — Order status, documents, statements, payment, ticket raise, reorder, contract view. Persona PR-22. *Differentiating:* self-service that reduces the inbound WhatsApp load that consumes Indian SMB office staff.

**WEB-09 · Partner & Dealer Portal** — `Core` — Ordering, scheme visibility, claim submission, credit position, stock declaration, target tracking. Persona PR-23.

**WEB-10 · Digital Asset Manager** — `Add-on` — Central media library, rights and usage, variants, brand kit, distribution to channels and dealers.

---

## 19. Supply Chain (SCM)

**SCM-01 · Product Catalogue / PIM** — `Core` — Item master, variants, attributes, UoM and conversions, HSN/SAC, categories, images, documents, lifecycle, alternates and substitutes. *Differentiating:* one Item object serves manufacturing BOMs, sales catalogues, e-commerce listings, purchase and accounting — no reconciliation between five catalogues.

**SCM-02 · Inventory** — `Core` — Multi-location stock, batch and serial, valuation (FIFO, weighted average, standard), reservations, stock transfers, adjustments, cycle counting, ageing, reorder levels. Offline-`full`. *Differentiating:* live valuation visible to the owner on mobile, with the composition of the number explainable in one tap.
*Agents:* `SCM-AG-01` Stockout Forecaster (L3) — drafts POs to the currently-fastest vendor, not the nominally cheapest. `SCM-AG-02` Dead Stock Detector (L2).

**SCM-03 · Warehouse Management** — `Core` — Bin and zone structure, putaway and picking strategies, wave picking, packing, dock and gate, barcode/RFID, cycle count, labour tracking. Offline-`full`.

**SCM-04 · Procurement & Purchase** — `Core` — Indent, RFQ, quotation comparison, PO, amendment, GRN, quality hold, three-way match, blanket orders, import purchase.
*Differentiating:* automated three-way match with exception-only human review; vendor comparison includes historical on-time and quality performance, not just price.
*Agents:* `SCM-AG-03` Three-Way Match Agent (L3). `SCM-AG-04` Price Variance Watchdog (L2).

**SCM-05 · Vendor Management** — `Core` — Vendor master, onboarding and KYC, categorisation, rate contracts, performance scorecards, compliance documents with expiry tracking, vendor portal access.

**SCM-06 · Logistics & Dispatch** — `Core` — Dispatch planning, load building, transporter allocation, LR/AWB, freight costing, delivery tracking, POD capture, e-way bill trigger (CMP-03), and delivery exception handling.

**SCM-07 · Demand Planning** — `Intelligence tier` — Statistical and ML forecasting, seasonality, promotion uplift, new-product proxies, consensus planning, forecast accuracy tracking. *Differentiating:* forecast accuracy is measured and reported back, so the tenant learns whether to trust it.

**SCM-08 · Distribution & Secondary Sales** — `Core` — Primary and secondary sales capture, distributor stock and claims, scheme settlement, retailer coverage, market share estimation. Essential for VRT-02.

**SCM-09 · Returns & Reverse Logistics** — `Core` — Return authorisation, pickup, inspection and disposition, credit note, restocking, scrap, warranty linkage, expiry and damage returns.

**SCM-10 · Batch, Serial & Traceability** — `Core` — Batch genealogy, serial tracking, expiry and shelf life, forward and backward trace, recall execution, certificate of analysis. Foundation for J-13 and for VRT-05.

**SCM-11 · Import / Export & Trade** — `Add-on` — Shipping documents, BOE, customs duty, LC handling, landed cost computation, DGFT schemes, export incentives, foreign currency exposure.

---

## 20. Manufacturing (MFG) — promoted to Core; the Phase I differentiator

**MFG-01 · Bill of Materials** — `Core` — Multi-level BOM, alternates, scrap and yield factors, phantom assemblies, engineering change control, version effectivity, where-used, costed BOM. *Differentiating:* engineering change flows through open work orders, purchase commitments, quotations and costing simultaneously, with the impact quantified before approval.

**MFG-02 · Routing & Work Centres** — `Core` — Operation sequences, work centre capacity and calendars, setup and run times, tooling, alternate routings, subcontract operations, cost rates.

**MFG-03 · Production Planning / MRP** — `Core` — Demand netting, MPS, MRP run, capacity check, planned order generation, pegging, what-if planning, shortage reporting. *Differentiating:* re-plans automatically when a machine goes down or material slips, and shows the owner the delivery-date consequence per customer order rather than an abstract exception list.
*Agents:* `MFG-AG-01` Replan Agent (L3). `MFG-AG-02` Shortage Escalation (L2).

**MFG-04 · Work Orders & Shop Floor** — `Core` — Work order lifecycle, operation booking, material issue and backflush, production confirmation, downtime and reason codes, rework, WIP tracking, operator terminal. Offline-`full`. *Differentiating:* the floor terminal is voice- and vernacular-driven (INT-07) — a supervisor speaks production in Marathi rather than typing. This is the single feature most likely to determine whether a plant actually adopts the system.
*Agents:* `MFG-AG-03` Idle Machine Watchdog (L2). `MFG-AG-04` Order Slippage Detector (L3).

**MFG-05 · Job Work & Subcontracting** — `Core` — Job work challan (GST 143), material sent and received, 180-day tracking with ITC reversal, subcontractor rates and reconciliation, scrap accounting, multi-stage job work. *Differentiating:* the 180-day exposure and the reconciliation of material sent versus received is the single most common source of unnoticed loss in the Pune engineering belt, and it is normally tracked in a notebook.
*Agents:* `MFG-AG-05` Job Work Ageing Watchdog (L3) — escalates before the 180-day window closes.

**MFG-06 · Quality Management** — `Core` — Inspection plans, incoming/in-process/final inspection, sampling plans, non-conformance, CAPA, gauge calibration, supplier quality, control charts. Offline-`full`. *Differentiating:* measurements captured by voice or device (ITG-08); statistical drift detected before tolerance is breached rather than after rejection.
*Agents:* `MFG-AG-06` Process Drift Detector (L2).

**MFG-07 · Maintenance** — `Core` — Preventive schedules, breakdown reporting, work orders, spare consumption, MTBF/MTTR, machine history (P-09), condition-based triggers from telemetry.

**MFG-08 · Costing** — `Core` — Standard and actual costing, work-order cost roll-up, variance analysis (material, labour, overhead), job costing, product profitability. *Differentiating:* true per-order margin including scrap, rework, overtime and expedited freight — a number most SMB manufacturers genuinely do not have.

**MFG-09 · Formulation & Recipe** — `Core` — Formula and recipe management for process manufacturing, potency and assay-based calculation, batch sizing and scaling, co-products and by-products, yield reconciliation, version control. Serves FMCG, food, chemicals and Pharma.

**MFG-10 · Machine Telemetry** — `Add-on` — Machine connectivity, OEE computation, downtime capture, energy monitoring, condition monitoring, alerting. Consumes ITG-08.

---

## 21. Delivery & Projects (DLV)

**DLV-01 · Projects & Plans** — `Core` — WBS, tasks, dependencies, milestones, baselines, Gantt and kanban views, budget versus actual, risk and issue log.

**DLV-02 · Project Templates** — `Core` — Reusable project structures, phase libraries, checklist templates, auto-instantiation from a sales order.

**DLV-03 · Roadmap & Portfolio** — `Add-on` — Multi-project view, capacity across portfolio, prioritisation, dependency mapping, portfolio health.

**DLV-04 · Tasks & Delegation** — `Core` — Assignment, checklists, recurring tasks, escalation, delegation chains, mobile task surface. *Differentiating:* delegation for floor and field workers who do not use email — assignment and completion by WhatsApp and voice.

**DLV-05 · Time Tracking** — `Core` — Timesheets, timers, project and task allocation, billable classification, approval, utilisation. Offline-`full`.

**DLV-06 · Resource Allocation** — `Core` — Skill-based allocation, capacity planning, conflict detection, bench visibility, cost and bill rates.

**DLV-07 · Field Service Management** — `Core` — Job scheduling and dispatch, technician mobile app, parts consumption, service checklist, customer signature, photo evidence, SLA tracking, travel and route optimisation. Offline-`full`. *Differentiating:* the technician's mobile app works fully offline, guides diagnosis from INT-11 knowledge, and generates the service report and invoice on site.
*Agents:* `DLV-AG-01` Dispatch Optimiser (L3). `DLV-AG-02` SLA Breach Watchdog (L3).

**DLV-08 · Solution & Service Catalogue** — `Core` — Service definitions, deliverables, standard pricing, effort estimates, prerequisites, linkage to CPQ.

---

## 22. Operations (OPS)

**OPS-01 · Ticketing & Helpdesk** — `Core` — Multi-channel intake (email, WhatsApp, portal, phone, social), categorisation, priority, SLA, assignment, escalation, resolution, CSAT. *Differentiating:* every ticket opens with the customer's orders, payments, past complaints and service history already attached; suggested resolutions drawn from INT-11.
*Agents:* `OPS-AG-01` Triage Agent (L3). `OPS-AG-02` SLA Watchdog (L3). `OPS-AG-03` Deflection Agent (L2).

**OPS-02 · Calendar & Scheduling** — `Core` — Personal and shared calendars, resource calendars, meeting scheduling, external calendar sync, business hours and holidays.

**OPS-03 · Booking & Appointments** — `Core` — Bookable resources, availability rules, slot management, online booking pages, reminders, rescheduling, no-show handling, waitlists. The horizontal primitive behind hospital beds, lab slots, service bays and consultation rooms.

**OPS-04 · Asset Management** — `Core` — Asset register, categories, custody and location, transfers, depreciation link (FIN-10), AMC linkage, maintenance history, disposal, barcode tagging, audit.

**OPS-05 · Facility Management** — `Add-on` — Space and floor management, occupancy, utilities, housekeeping schedules, safety and inspection rounds, permits to work.

**OPS-06 · Contract & Agreement Management** — `Core` — Contract repository, clause library, obligation tracking, renewal and expiry alerts, amendments, approval workflow, e-signature. *Differentiating:* obligations are extracted from the contract and become live tasks and alerts, so committed SLAs and volume rebates are actually tracked rather than filed.
*Agents:* `OPS-AG-04` Renewal Watchdog (L2). `OPS-AG-05` Obligation Extractor (L2).

**OPS-07 · Service Management / AMC** — `Core` — Service contracts, entitlement checking, preventive service scheduling, coverage validation, renewal, profitability per contract.

**OPS-08 · Travel Management** — `Add-on` — Travel request, approval, booking record, advance, itinerary, expense linkage (FIN-06), policy enforcement.

**OPS-09 · Fleet Management** — `Add-on` — Vehicle master, driver management, trip records, fuel, maintenance, permits and insurance with expiry alerts, GPS integration, cost per km.

**OPS-10 · Visitor & Gate Management** — `Add-on` — Visitor pre-registration and check-in, material gate pass (inward and outward), vehicle gate entry, weighbridge integration, security log. Offline-`full`. *Differentiating:* material gate passes reconcile against POs, job work challans and dispatch documents, closing a real leakage point in manufacturing.

**OPS-11 · Document Management** — `Core` — Folder and taxonomy structure, versioning, check-in/check-out, retention, access control, full-text and semantic search, expiry tracking for statutory documents.

**OPS-12 · Pricing & Rate Cards** — `Core` — Price lists by customer, channel, region, quantity and validity; discount structures; scheme pricing; landed-cost-based pricing; approval on deviation. *Differentiating:* price simulation (INT-05) before publishing a revision.

---

## 23. Finance (FIN)

**FIN-01 · Chart of Accounts & General Ledger** — `Core` — COA structure, cost centres, journals, recurring entries, period control, year-end close, multi-entity postings, audit trail. *Differentiating:* COA inferred from existing Tally data at onboarding rather than built from scratch.

**FIN-02 · Accounts Receivable** — `Core` — Customer ledger, ageing, credit limits and blocks, dunning, disputes, write-offs, interest on delay, statements.

**FIN-03 · Accounts Payable** — `Core` — Vendor ledger, invoice booking, three-way match linkage, payment scheduling, TDS at source, advance adjustment, debit notes.

**FIN-04 · Invoicing & Billing** — `Core` — Tax invoice, proforma, credit and debit notes, recurring invoices, milestone billing, consolidated invoicing, e-invoice (CMP-02), print templates. *Differentiating:* invoice generated directly from the dispatch or work-order event, with GST determined by CMP-01 and IRN obtained before the vehicle leaves.

**FIN-05 · Payments & Collections** — `Core` — Receipt recording, allocation, payment links and UPI, mandates, bank payouts, cheque management, PDC tracking, collection follow-up.
*Differentiating:* collection sequencing driven by each customer's actual payment behaviour rather than fixed 30/60/90 buckets.
*Agents:* `FIN-AG-01` Collections Chaser (L3) — schedules and sends follow-ups within a defined tone and frequency ceiling; escalates disputes to a human.

**FIN-06 · Expense Management** — `Core` — Claim submission with photo capture (INT-06), policy rules, approval matrix, reimbursement, advances, corporate card reconciliation, GST ITC on expenses.

**FIN-07 · Banking & Reconciliation** — `Core` — Bank accounts, statement import and feeds (ITG-04), auto-matching, unreconciled ageing, cash book, fund transfers.
*Agents:* `FIN-AG-02` Bank Reconciliation Agent (L3).

**FIN-08 · Financial Statements** — `Core` — Trial balance, P&L, balance sheet, cash flow, schedules, comparative and consolidated statements, Schedule III format, audit-ready export.

**FIN-09 · Budgeting & Forecasting** — `Add-on` — Budget preparation by cost centre and account, versions, variance analysis, rolling forecast, commitment tracking against budget.

**FIN-10 · Fixed Assets & Depreciation** — `Core` — Asset capitalisation, Companies Act and Income Tax depreciation, componentisation, revaluation, disposal, CWIP, asset register reconciliation.

**FIN-11 · Point of Sale** — `Add-on` — Billing terminal, offline mode, barcode, multiple tender types, returns, day close, shift and cash drawer management, thermal printing, GST compliance.

**FIN-12 · Subscription & Recurring Billing** — `Add-on` — Plans, subscriptions, proration, upgrades and downgrades, usage-based billing, mandates and auto-collection, dunning, revenue recognition.

**FIN-13 · Credit & Collections Risk** — `Intelligence tier` — Credit scoring from internal payment behaviour and external signals, exposure limits, risk-based terms, early-warning indicators, provisioning. *Differentiating:* predicts which customer is about to stop paying, weeks before the ageing report shows it.
*Agents:* `FIN-AG-03` Credit Deterioration Detector (L2).

**FIN-14 · Multi-Entity & Consolidation** — `Add-on` — Inter-company transactions and eliminations, transfer pricing, consolidated reporting, currency translation, entity-level access control.

**FIN-15 · Cash Flow Management** — `Core` — Cash position, receivable and payable projections, working capital cycle, scenario planning (INT-05), bank balance aggregation. *Differentiating:* a thirteen-week cash forecast built from actual order, dispatch and payment behaviour — the number every owner-led SMB worries about and almost none can produce.

---

## 24. People (PPL)

**PPL-01 · Organisation & Department Structure** — `Core` — Departments, designations, grades, reporting hierarchy, org chart, position management, cost centre mapping.

**PPL-02 · Employee Records** — `Core` — Employee master and lifecycle, personal and employment data, documents with expiry, skills and qualifications, family and nominee details, service history (P-09).

**PPL-03 · ATS / Recruitment** — `Add-on` — Requisition and approval, job posting, candidate pipeline, screening, interview scheduling and feedback, offer management, candidate portal. *Differentiating:* resume screening against the actual performance profile of successful hires in that role at that tenant.

**PPL-04 · Onboarding & Offboarding** — `Core` — Pre-joining formalities, document collection, induction checklist, asset and access provisioning, probation tracking; exit clearance, full and final settlement, knowledge transfer, access revocation. *Differentiating:* provisioning and revocation touch KRN-02, KRN-03 and OPS-04 automatically — the leaving employee's access genuinely closes.

**PPL-05 · Attendance & Time** — `Core` — Biometric and mobile punch, geofencing, shift-wise attendance, overtime, regularisation, muster roll. Offline-`full`.

**PPL-06 · Leave Management** — `Core` — Leave types and policies, accrual, encashment, carry-forward, holiday calendars, approval, balance, leave without pay handling.

**PPL-07 · Shift & Roster** — `Core` — Shift patterns, roster planning, skill and coverage constraints, swap requests, night-shift rules, statutory rest compliance. *Differentiating:* rostering under constraints is the same engine whether it is a plant, a hospital ward or an airline crew — the strongest single proof of the primitive model.
*Agents:* `PPL-AG-01` Coverage Gap Watchdog (L2).

**PPL-08 · Payroll** — `Core` — Salary structures, earnings and deductions, arrears, reimbursements, loans and advances, multi-entity payroll, payroll run and lock, bank transfer files, payslip generation. *Differentiating:* payroll and attendance share one dataset, so overtime, absence and contract-labour cost land in production costing (MFG-08) without re-entry.

**PPL-09 · Statutory & Compliance** — `Core` — PF, ESI, professional tax, labour welfare fund, gratuity, bonus, TDS on salary, Form 16, statutory registers, ECR and challan generation, integration with EPFO/ESIC.

**PPL-10 · Performance & Evaluation** — `Add-on` — Goals and KRAs, self and manager evaluation, 360 feedback, review cycles, calibration, competency mapping, development plans.

**PPL-11 · Learning & Development** — `Add-on` — Course catalogue, assignment, tracking, assessments, certification with expiry, compliance training, skill matrix. *Differentiating:* skill gaps identified from quality and rework data, and training assigned to the operators who actually need it.

**PPL-12 · Contract Labour Management** — `Core` — Contractor master, licence and compliance tracking, worker registry, gate attendance, wage and compliance verification, principal-employer liability tracking, bill processing. *Differentiating:* addresses a genuine legal exposure that most manufacturing SMBs manage entirely on paper.

**PPL-13 · HR Documents & Letters** — `Core` — Offer, appointment, confirmation, increment, transfer, warning and relieving letters; template library; bulk generation; e-signature; personnel file.

**PPL-14 · Employee Self Service** — `Core` — Mobile self-service for PR-19: attendance, leave, payslip, tax declaration, claims, documents, directory, requests — in vernacular, over app and WhatsApp.

**PPL-15 · Workforce Analytics** — `Add-on` — Headcount, cost, attrition and retention analysis, absenteeism patterns, overtime trends, productivity per head, diversity of skills.

---

## 25. Insights (INS)

**INS-01 · Report Library** — `Core` — Pre-built statutory and operational reports per module and per vertical, parameters, scheduling, export, distribution.

**INS-02 · Dashboards** — `Core` — Role-based dashboards, widget library, drill-through, real-time and periodic refresh, mobile dashboards, TV/floor display mode.

**INS-03 · Ad-hoc Analytics** — `Core` — Self-service exploration, joins across modules, pivots, filters, saved analyses. *Differentiating:* questions asked in plain language (INT-02) and answered from one dataset with permissions applied.

**INS-04 · KPI & Scorecards** — `Core` — KPI definitions per vertical, targets, thresholds, trend, cascading scorecards by department and person.

**INS-05 · BI Connector & Export** — `Add-on` — Read-only warehouse access, Power BI and Tableau connectors, scheduled extracts, API access, row-level security preserved downstream.

---

## 26. Security & Governance (SEC)

**SEC-01 · Identity & Access Governance** — `Core` — Access review campaigns, segregation-of-duties rules, privileged access management, orphan account detection, access certification.

**SEC-02 · Multi-Factor Authentication** — `Core` — TOTP, SMS and email OTP, push approval, hardware key, step-up authentication for sensitive actions, per-role enforcement policy.

**SEC-03 · Password & Secret Vault** — `Add-on` — Shared credential vault, secret rotation, API key management, access logging. *Note:* the platform never asks a user to enter third-party banking credentials into a form; integrations use tokenised, revocable authorisation.

**SEC-04 · Policy Management** — `Core` — Policy repository, versioning, acknowledgement tracking, review cycles, exception register, mapping of policy to enforcing control.

**SEC-05 · Compliance Management** — `Add-on` — Framework mapping (ISO 27001, SOC 2, DPDP, GDPR where relevant), control register, evidence collection, internal audit, findings and remediation.

**SEC-06 · Audit & Evidence** — `Core` — Audit trail search and export, evidence packs for auditors, tamper-evidence verification, scoped auditor access (PR-25, PR-26).

**SEC-07 · Data Privacy & DPDP** — `Core` — Consent management, purpose limitation, data subject requests, retention enforcement, anonymisation, processing records, breach register.

**SEC-08 · Testing & Release Log** — `Add-on` — Test case registry, execution records, defect log, release notes, validation evidence for CMP-06, sign-off records.

**SEC-09 · Backup & Disaster Recovery** — `included` — Backup schedule and verification, point-in-time restore, RPO/RTO per tier, tenant-level export, DR drills with evidence.

---
---

# PART D — INTELLIGENCE

## 27. Agent architecture and the Trust Ladder

### 27.1 Agent taxonomy

| Class | Trigger | Example |
|---|---|---|
| **Watchdog** | Event stream | Below-floor quote held before it is sent |
| **Forecaster** | Schedule | Stockout predicted; PO drafted to the fastest vendor |
| **Chaser** | Time + behaviour | Collections sequenced by actual payment pattern |
| **Reconciler** | Data arrival | Bank lines, GRNs, e-way bills, GSTR-2B matched |
| **Scribe** | Document arrival | Photographed handwritten order becomes a sales order |
| **Analyst** | Question | Graph traversal explains why a number moved |
| **Planner** | Constraint change | Production re-sequenced when a machine goes down |
| **Guardian** | Continuous | Access anomalies, duplicate vendors, circular billing |

### 27.2 Agent contract

Every agent declares: identity · owning module · version · trigger · tools it
may call · data scope · trust ceiling · financial impact ceiling · confidence
model · escalation path · rollback procedure · success metric · telemetry
schema · token budget. Registered in INT-03, governed by INT-04, audited in
KRN-10, reversible via KRN-18.

### 27.3 The Trust Ladder

Autonomy is per-agent and per-tenant, and is **earned on evidence**.

| Level | Behaviour | Promotion condition |
|---|---|---|
| **L0 Observe** | Runs silently; logs what it *would* have done | Default on provisioning |
| **L1 Suggest** | Surfaces a recommendation in context | Owner opts in |
| **L2 Draft** | Prepares the artefact; human reviews and commits | ≥ 50 shadow decisions logged |
| **L3 Act-within-limits** | Executes below a value and risk ceiling; escalates exceptions | ≥ 95% agreement over rolling sample; owner approves promotion |
| **L4 Autonomous** | Acts freely in scope; reports by exception | ≥ 99% agreement, zero unreversed errors in window, explicit sign-off |

Governing rules: promotion is always proposed by the system and approved by a
human, never automatic. Demotion is automatic on error-rate breach. Every
tenant has a global kill switch. Every L3/L4 action is reversible in one
click and carries visible provenance. Financial ceilings are absolute and
per-agent. An agent may never promote itself, modify its own ceiling, or
grant permissions.

**Commercial significance.** An owner-led business will not grant blanket AI
permissions. It will grant them to a specific agent that has visibly earned
them on its own data. This converts the hardest objection in the sale into a
demonstration, and it is the single most defensible idea in the product.

### 27.4 Agent registry (launch set)

`SLS-AG-01..07` · `SCM-AG-01..04` · `MFG-AG-01..06` · `FIN-AG-01..03` ·
`OPS-AG-01..05` · `PPL-AG-01` · `DLV-AG-01..02` · `CMP-AG-01` — plus
tenant-authored agents via STU-07. Each is specified in its module's Vol 3 file.

---

## 28. The wow catalogue

Capabilities that exist *because* this is one platform, and are therefore
structurally hard for a federated suite to copy.

| # | Capability | Why only here |
|---|---|---|
| 1 | **Ten-minute onboarding** from Tally, Excel and an inbox | INT-08 writes metadata directly; nothing hard-coded |
| 2 | **Causal answers** — margin drop traced through six modules to call transcripts | One graph, not twelve APIs |
| 3 | **Business simulation** on the tenant's own history | Event store + INT-05 |
| 4 | **WhatsApp as a full client** — order, approve, dispatch, collect, in-thread | KRN-09 is a routing layer, not a marketing feature |
| 5 | **Vernacular voice on the floor** — production logged in Marathi, offline | INT-07 + KRN-16 |
| 6 | **Photo to posted record** — handwritten order, vendor invoice, LR | INT-06 validated against tenant masters |
| 7 | **Self-writing SOPs** from observed event flows | Event store + INT-11 |
| 8 | **The morning brief** — what broke, what needs deciding, what an agent did, what it wants permission to do | INT-09 + INT-10 |
| 9 | **Speak a module into existence** | STU-01 over T1 |
| 10 | **Compliance that runs itself** — 2B reconciliation, e-way bills, PF challans queued for one tap | CMP as a kernel service |
| 11 | **Undo the day** — reverse an agent's actions across modules | KRN-18 designed in |
| 12 | **Cross-module anomaly detection** — vendor who is also a customer, discounts tracking one salesman | Only visible with one dataset |
| 13 | **Thirteen-week cash forecast** from real order and payment behaviour | FIN-15 + INT-05 |
| 14 | **True per-order margin** including scrap, rework, overtime, expedited freight | MFG-08 + FIN + PPL in one model |
| 15 | **Job-work exposure tracking** with 180-day ITC escalation | MFG-05 + CMP-01 |

---

## 29. AI unit economics

The wow layer is unsellable if inference cost exceeds tier margin. This is a
design constraint, not a finance exercise.

### 29.1 Cost control mechanisms (all in INT-12)

Small-model routing for classification, extraction and summarisation;
large-model use reserved for reasoning and causal traversal. Aggressive
caching of embeddings and repeated queries. Batch processing for scheduled
agents. Pre-computed graph summaries rather than live traversal for common
questions. Deterministic code paths wherever a rule can replace a model call.
Per-tenant hard token ceilings with graceful degradation, never a blocked
transaction (T15).

### 29.2 Budgeting model

Each SKU tier carries a monthly inference budget. Each agent carries a token
budget per execution and per month. Copilot carries a per-user daily budget.
Exceeding a budget degrades to cached or deterministic behaviour and notifies
the tenant admin; it never halts a business process.

### 29.3 Required calculation before Vol 1

Model, per persona, the expected monthly inference volume for a 50-user
manufacturing tenant at Professional tier, and confirm gross margin remains
above target at the intended Indian SMB price point. If it does not, the
Intelligence tier is separately priced and the Essential tier ships with
L0–L1 agents only. **This calculation gates the pricing model in §33.**

---
---

# PART E — VERTICALS

## 30. Vertical Definition Language

An Industry OS is a manifest, not a codebase. Vol 4 contains one instance per
vertical. Authoring effort per vertical: days. Engineering effort: zero.

```yaml
vertical:
  id: VRT-01
  name: Manufacturing OS
  segment: Discrete manufacturing, 20-500 employees
  status: phase-1

terminology:                      # KRN-19
  Party.customer: Customer
  Resource: Machine
  Document.work_order: Job Card

modules:
  required:    [KRN-*, CMP-01..04, SCM-01..06, MFG-01..08, FIN-01..08, PPL-01..09]
  recommended: [SLS-07, OPS-04, OPS-10, MFG-10, INS-01..04]
  excluded:    [FIN-11, WEB-04]

personas_enabled: [PR-01, PR-03, PR-04, PR-05, PR-06, PR-07, PR-15, PR-17, PR-21]

entity_extensions:
  Item:
    - {name: drawing_no,     type: string}
    - {name: material_grade, type: lookup(MaterialGrade)}

masters_preload:
  uom_set: engineering
  hsn_subset: [72, 73, 84, 85]
  work_centre_templates: [cnc, vmc, assembly, paint, inspection]

journeys_enabled: [J-01, J-02, J-03, J-10, J-12]

processes:
  - id: PRC-MFG-01
    name: Enquiry to Dispatch
    states: [enquiry, costing, quote, order, planned, in_production, qc, dispatch, invoiced]

agents: [MFG-AG-01, MFG-AG-03, MFG-AG-05, SCM-AG-01, SCM-AG-03, FIN-AG-01]

kpis: [oee, on_time_delivery, scrap_rate, wip_value, dso, capacity_utilisation]

compliance_pack: [gst, e_invoice, e_way_bill, job_work_143, factories_act, pf_esi]

layouts:
  home: manufacturing_owner_dashboard
  mobile_primary: shop_floor_capture

offline_profiles: {MFG-04: full, MFG-06: full, SCM-02: full, OPS-10: full}

demo_dataset: manufacturing_seed_v1     # for COM-05 sandbox
```

---

## 31. Industry OS catalogue

| ID | Industry OS | Modules beyond kernel | Distinctive manifest content | Phase |
|----|-------------|----------------------|------------------------------|-------|
| VRT-01 | **Manufacturing** | MFG, SCM, FIN, PPL, SLS-07 | Job cards, OEE, job work with 180-day tracking, factories act, gate passes | **I** |
| VRT-02 | **Distribution & FMCG** | SCM-08, SLS-10/11, FIN, MKT-08 | Beat plans, secondary sales, schemes and claims, van sales, expiry and batch | **I** |
| VRT-03 | **Services & Agencies** | DLV, FIN-12, SLS, PPL | Utilisation, retainers, SOW, timesheet billing, project margin | II |
| VRT-04 | **Healthcare & Diagnostics** | OPS-03/04, PPL-07, SCM-10, FIN | Beds and slots as Resource, charts as Record, vitals and results as Measurement, ABDM | II |
| VRT-05 | **Pharmaceutical** | MFG-06/09, SCM-10, CMP-06 | Batch genealogy, GxP validated records, stability, recall, CoA | III |
| VRT-06 | **Telecom** | OPS, DLV-07, FIN-12, SCM | Sites as Resource, tariffs as Item, field tickets, TRAI reporting | III |
| VRT-07 | **BFSI** | Process-heavy, CMP-06/07, SEC | Loan file as Document, KYC as Record, adjudication as Process, RBI reporting | III |
| VRT-08 | **Aviation** | OPS-04/09, MFG-07, CMP-06 | Aircraft as Resource, logbook as Record, DGCA change control, crew rostering | III |
| VRT-09 | **Supply Chain / 3PL** | SCM full, OPS-09, WEB-09 | Multi-principal, billing by movement, control tower | II |
| VRT-10 | **Government** | Process, OPS-11, SEC, WEB-08 | Citizen as Party, file movement, RTI, tender, GeM | IV |

**Regulated verticals note.** VRT-05..08 require no new modules but do require
kernel capabilities that must exist from Phase I: validated audit trail
(CMP-06), meaningful e-signature (CMP-07), immutable records, data residency
tiers (CMP-08), and documented change control (STU-10, SEC-08). Building
these late means rebuilding the kernel. They are **Phase I architecture,
Phase III go-to-market.**

---
---

# PART F — COMMERCIAL

## 32. Signup and provisioning journey (J-11)

### 32.1 The governing principle

**All three purchase routes resolve to the same artefact:** a provisioning
manifest plus an entitlement set. Preset is a published manifest. Starter is
a minimal manifest. Build-your-own is a generated manifest. Built as three
flows, you get three code paths, three billing models and three ways to be
wrong. Built as one, a fourth route (partner-led, tender, marketplace) costs
nothing later.

```
Landing → Discovery (3 fields) → Recommender → 3 framings of ONE manifest
                                                       ↓
                                          Manifest + entitlement set
                                                       ↓
                                    Demo-seeded sandbox provisioned instantly
                                                       ↓
                                       INT-08 offers "import your Tally"
                                                       ↓
                                              Convert to paid
```

### 32.2 Progressive disclosure

Ask three things before showing value: **industry, size band, and the
free-text request.** Show the packages. Take email to save the configuration.
Collect GSTIN, address, phone and tax details **only at checkout**. Asking for
tax details before the visitor has seen anything will cost most of the funnel.

**GSTIN is the first field, optional, with a skip path.** One entry returns
legal name, trade name, registered address, constitution, state and
registration date (ITG-07). The form largely fills itself; the first
impression is that the software already knows the customer; and you get a
verified tenant identity that kills duplicate signups and gives sales a real
company instead of a Gmail address.

**The free-text request is the most valuable field on the page.** It is a
real input to COM-02. "We do job work for auto components and struggle
tracking material sent out" must visibly pull MFG-05 and journey J-10 into
the recommendation, named on the card, with the reason shown.

### 32.3 The three routes, given distinct jobs

The original options 2 and 3 overlapped — "basic apps at flat prices" and
"à la carte" are both *pick what you want*, and users cannot tell them apart.
Corrected:

| Route | Job | Configurability |
|---|---|---|
| **Industry OS** *(anchor)* | Preconfigured, bundle-priced, "start Monday" — ships with masters, workflows, agents and dashboards already set up | Manifest defaults, adjustable |
| **Starter** | Low entry point. Fixed small module set, flat price | Deliberately not configurable |
| **Build your own** | Full à la carte: platform fee plus chosen modules | Fully |

Anchor on the recommended Industry OS with the other two as escape hatches.
Three equal-weight cards produce paralysis; a recommendation with alternates
converts.

### 32.4 Sandbox policy

The trial tenant is a **working tenant preloaded with realistic demo data for
the customer's own industry** (`demo_dataset` in the VDL). An owner clicking
through *their* OS with recognisable data in it is worth more than any
landing-page copy. One click converts the sandbox to a real tenant, or the
customer starts clean with INT-08 importing their Tally data.

---

## 33. SKU, pricing and billing architecture

### 33.1 Structure

```
PLATFORM FEE  (mandatory)
  Kernel + Compliance core + Copilot + Agent runtime at trust L0-L2
  Banded by size

+ APPLICATION SKUs  (à la carte or bundled)
  Sales · Marketing · Digital · Supply Chain · Manufacturing · Delivery
  Operations · Finance · People · Insights · Security
  each at Essential / Professional

+ INTELLIGENCE TIER  (upgrade)
  Trust L3-L4 · Simulation · Anomaly · Narrative · Demand planning · Credit risk

+ STUDIO  (add-on)

+ INDUSTRY OS PACK  (packaging discount, not a separate charge)
```

### 33.2 Why the kernel is never unbundled

If the kernel were sold separately, every module would reimplement
permissions and workflow, and the one-brain claim would collapse. Charging
once for the kernel and separately for applications gives the customer real
choice without fragmenting the architecture.

### 33.3 Billing metric — a warning

**Do not bill on self-reported revenue or employee count.** Both will be
understated the moment customers realise pricing keys off them; you would be
building an incentive to lie into your own signup form. Use those inputs for
*recommendation only*. Bill on something observable: seats by user type,
transaction volume, or entity count. Final metric is a §43 open decision
pending the §29.3 calculation.

### 33.4 User types

Not all seats are equal. Full user (PR-01..03, 06, 08, 11, 12, 14..18, 21),
Light user (PR-04, 05, 07, 09, 10, 13, 19, 20 — task surfaces only),
Self-service user (PR-19 employee, free above a threshold),
External user (PR-22..27 — portal access, priced per portal not per head).
Pricing floor-shop and field personas at full-seat rates would make the
system unaffordable exactly where its differentiation lives.

### 33.5 Entitlement enforcement

KRN-20 gates at the metadata layer. Unpurchased modules are invisible in
navigation, absent from search and rejected at the API boundary, while their
data contracts still exist — so upgrades are instantaneous and require no
migration.

---
---

# PART G — ENGINEERING GOVERNANCE

## 34. Upgrade safety and customisation policy

This is the problem that has killed every metadata-driven platform that got
it wrong. Once Studio lets tenants generate entities, the platform must still
be able to ship upgrades.

**Namespace separation (T13).** Platform artefacts live in the `sys`
namespace; tenant artefacts in the `tnt` namespace. The platform never writes
to `tnt`. A tenant may extend a platform entity by adding `tnt` fields; it may
never modify or remove a `sys` field.

**Upgrade rules.** Platform upgrades may add entities, fields, states and
rules. They may not remove or rename anything a tenant may reference; instead
they deprecate with a defined sunset and a migration path. Breaking changes
require a major version, a compatibility shim and explicit tenant acceptance.

**Extension points.** Modules expose declared extension points (before/after
hooks, computed field slots, custom states within a bounded transition set).
Extending anywhere else is unsupported and blocked, not merely discouraged.

**Customisation ladder.** Configuration first; then Studio-generated
artefacts in `tnt`; then a partner-authored VDL manifest; and only then, as
the last resort, a platform feature request. **No customer-specific code
enters the core repository. Ever.**

**Upgrade rehearsal.** Every tenant upgrade runs first against a shadow copy
with the tenant's own configuration, and the diff is reported before
promotion (STU-10).

---

## 35. Testing and acceptance strategy

Critical, because an AI implementer builds against tests rather than prose (T14).

| Layer | What is tested | Gate |
|---|---|---|
| **Contract** | Every module's API and event schema | Must pass before dependents are built |
| **Unit** | Rules, calculations, state transitions | Per module |
| **Statutory** | GST determination, e-invoice schema, TDS thresholds, PF/ESI computation against published cases | Zero tolerance |
| **Journey** | J-01 to J-14 end to end | A module is not done until its journeys pass |
| **Persona** | Each persona completes its daily tasks on its assigned client and offline profile | Per release |
| **Agent** | Every agent replayed against historical events; agreement rate measured | Gates trust promotion |
| **Upgrade** | Platform upgrade applied to a tenant with heavy `tnt` customisation | Every release |
| **Load** | NFR targets in §36 | Per phase |
| **Security** | Access control, tenant isolation, injection, privilege escalation | Per phase + annual external |

**Rule for the implementer:** acceptance criteria are written before code, in
Given/When/Then form, in the module's Vol 3 file. Code that passes its own
tests but fails a journey test is not accepted. No module may be implemented
before every module in its dependency column exists and its contract tests pass.

---

## 36. Non-functional requirements

| Area | Requirement |
|---|---|
| Tenancy | Row-level default; schema-level and dedicated-instance tiers |
| Availability | 99.9% platform; 99.5% AI features, degrading gracefully (T15) |
| Performance | p95 < 400 ms record read; < 1.5 s filtered list; agents asynchronous by definition |
| Scale | 10,000 tenants; largest tenant 5,000 users and 50M transactions/year |
| Offline | Full capture for declared offline-`full` modules; deterministic conflict policy per module |
| Data residency | India default; region pinning for regulated tenants |
| AI cost | Per-tenant hard ceiling; caching; small-model routing; on-prem option |
| Auditability | Every mutation attributable to a human or a named agent version; immutable |
| Extensibility | No customer-specific code in core, ever |
| Accessibility | WCAG 2.2 AA on all generated screens |
| Languages | English, Hindi, Marathi at launch; framework for ten more |
| Recovery | RPO 15 min, RTO 4 h standard; RPO 5 min, RTO 1 h regulated tier |
| Print | Thermal, A4, A5 and dot-matrix output for every statutory document |

---

## 37. Security and certification roadmap

| Phase | Milestone |
|---|---|
| Phase 0–2 | Secure SDLC, dependency scanning, secrets management, tenant isolation tests, DPDP-aligned processing records |
| Phase 3–4 | External penetration test; VAPT remediation; DPDP compliance attestation |
| Phase 5–6 | ISO 27001 certification |
| Phase 7–8 | SOC 2 Type II |
| Phase 9 | Sector-specific: RBI cybersecurity for BFSI, GxP validation package for Pharma, DGCA evidence for Aviation |

Security certification is a **sales prerequisite** for regulated verticals,
not a compliance afterthought, and its lead time drives the phasing in §39.

---

## 38. Migration strategy

Migration is where the deal is won or lost, and it deserves more than one
line about Tally.

**Sources:** Tally (ITG-02), Busy, Marg, Excel, Google Sheets, existing CRMs,
paper and photographs (INT-06), and an email inbox.

**Approach:** INT-08 ingests and infers rather than requiring a mapping
exercise. It proposes a chart of accounts, item masters, customer and vendor
lists, price lists, opening balances and observed approval habits, then asks
for confirmation on roughly a dozen judgement calls.

**Parallel running.** Mirror mode keeps Tally authoritative for a defined
period while the OS runs alongside, with daily reconciliation reporting, and
cutover only when the owner is confident. Whether the OS becomes book of
record in year one is a §43 open decision.

**Migration acceptance:** opening trial balance matches to the rupee; stock
valuation matches; outstanding receivable and payable ageing matches; last
three months' GST returns reproduce identically. These are tests, not
assurances.

---

## 39. Build order and phasing

```
Phase 0   Kernel        KRN-01..14 · CMP-01..04 · ITG-01
Phase 1   Metadata      STU-01..05 · KRN-15..20
Phase 2   Intelligence  INT-01, 02, 03, 04, 12
Phase 3   Money+Material FIN-01..08 · SCM-01..06 · ITG-02, 03
Phase 4   Manufacturing MFG-01..08 · OPS-10        → VRT-01 SHIPS
Phase 5   People+Sales  PPL-01..09 · SLS-01..09 · INS-01..04
Phase 6   Distribution  SLS-10, 11 · SCM-07..11 · WEB-08, 09 → VRT-02 SHIPS
Phase 7   Wow layer     INT-05..11 · CMP-05..08
Phase 8   Breadth       OPS · DLV · MKT · WEB · remaining FIN, PPL, SEC
Phase 9   Verticals     VRT-03..10 as manifests
Commerce  COM-01..06 built in parallel from Phase 2 (needed to sell Phase 4)
```

**Dependency rule.** No module may be implemented before every module in its
`depends on` column exists and its contract tests pass.

**Regulated-kernel rule.** CMP-06, CMP-07, CMP-08, STU-10 and SEC-08 are
built in Phase 0–2 architecture even though their verticals ship in Phase III.

---

## 40. Delivery capacity model

The binding constraint on this plan is not architecture; it is capacity. This
section exists so that the plan is not silently assuming a team that does not
exist.

**Roles required beyond building:** product ownership per family, statutory
domain expertise (GST, payroll, labour law), QA and test authoring,
implementation and onboarding, support, security, and partner enablement.

**Leverage available:** AI implementation compresses build, not domain
judgement, testing, onboarding, or support. Assume compression on code and
none on the rest.

**Recommended structure:** one small core platform team owning L0–L1 and
holding architectural authority; application squads per family; a manifest
authoring function (small, high leverage) that produces verticals; and
partners (COM-06, STU-08) as the scaling mechanism for implementation.

**Sequencing consequence:** ship VRT-01 and VRT-02 with a narrow module set
and real depth rather than ten verticals at shallow depth. Breadth is a
manifest problem later; depth is a credibility problem now.

---

## 41. Risk register

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| R-01 | AI inference cost exceeds tier margin | Wow layer unsellable | §29 calculation before Vol 1; separately priced Intelligence tier as fallback |
| R-02 | Scope breadth outruns delivery capacity | Nothing ships at quality | Phase 4 and 6 vertical gates; depth over breadth (§40) |
| R-03 | Metadata engine under-designed | Upgrade breakage; rewrite | T13 namespace separation; upgrade rehearsal from Phase 1 |
| R-04 | Studio generates unmaintainable tenant sprawl | Support burden | Governance in STU-10; generated artefacts constrained to declared extension points |
| R-05 | Statutory change (GST, labour codes) | Rework, compliance exposure | Compliance as a service layer; platform-maintained rate and schema data |
| R-06 | Agent error damages tenant trust | Churn, reputational | Trust Ladder, ceilings, KRN-18 undo, automatic demotion |
| R-07 | Migration from Tally fails or under-delivers | Deals lost at the last step | Migration acceptance tests (§38); mirror mode |
| R-08 | Floor and field adoption fails | System becomes an office tool only | Vernacular voice, offline, WhatsApp; light-user pricing (§33.4) |
| R-09 | Regulated verticals need kernel rework | Phase III unshippable | CMP-06..08 built in Phase 0–2 |
| R-10 | Security incident in multi-tenant store | Existential | Isolation tiers, per-phase security testing, §37 roadmap |
| R-11 | Pricing gamed via self-reported inputs | Revenue leakage | Bill on observable metrics (§33.3) |
| R-12 | Partner-authored manifests damage quality | Brand risk | Certification in STU-08; sandboxed promotion |

---

## 42. Conventions

- **Module ID** `PREFIX-NN` — permanent, never reused
- **Requirement ID** `MODULEID-FR-NNN` (standard) / `-DR-NNN` (differentiating)
- **Entity ID** `P-NN` primitives; `MODULEID-E-NN` module entities
- **Process ID** `PRC-PREFIX-NN` · **Journey ID** `J-NN` · **Persona ID** `PR-NN`
- **Agent ID** `PREFIX-AG-NN` · **Vertical ID** `VRT-NN`
- **Event name** `module.entity.verb_past` — e.g. `mfg.work_order.completed`
- **API path** `/api/v1/{module}/{entity}`
- **Namespace** `sys` platform · `tnt` tenant

---

## 43. Decision log

### 43.1 Closed

| # | Decision |
|---|---|
| D-01 | Multi-tenant SaaS |
| D-02 | Studio in v1; metadata-driven from day one |
| D-03 | Hybrid autonomy, formalised as the Trust Ladder |
| D-04 | Manufacturing is Core, not a vertical pack |
| D-05 | VRT-01 and VRT-02 are the Phase I reference verticals |
| D-06 | Regulated-vertical kernel capabilities built in Phase I |
| D-07 | Three purchase routes resolve to one provisioning manifest |
| D-08 | Kernel is never unbundled |
| D-09 | Sandbox is demo-seeded, industry-specific |
| D-10 | No customer-specific code in core, ever |

### 43.2 Open — gating Volume 1

| # | Decision needed | Blocks |
|---|---|---|
| D-11 | **Book of record** — does the OS replace Tally in year one, or mirror it? | Migration design, FIN scope, sales narrative |
| D-12 | **Technology stack** | Metadata engine design; all of Vol 1 |
| D-13 | **Deployment model** — pure SaaS, or on-prem option for BFSI/Pharma? | Kernel packaging, INT-12 design |
| D-14 | **Ordder.io and Karyaflo** — absorbed as modules or federated against this kernel? | Product boundary, roadmap, brand |
| D-15 | **Billing metric** — seats, transactions, or entity count | COM-03, KRN-20 |
| D-16 | **AI unit economics** (§29.3 calculation) | Pricing model, Intelligence tier boundary |
| D-17 | **Partner strategy timing** — when does STU-08 open to partners? | COM-06, certification model |

---

*End of Volume 0 Master. Volume 1 (Platform Kernel SRS) begins once D-11
through D-17 are closed.*
