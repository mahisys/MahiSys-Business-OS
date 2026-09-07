# KRN-10 · Audit & Immutable Log

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-02 (Identity & Authentication — actor attribution, including agent version), KRN-04 (Entity & Metadata Engine — `is_sensitive` field declarations that drive `KRN-10-FR-003`), KRN-06 (Event Bus — the source stream `audit_entry` derives from)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-10)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

Who did what, when, and why — for humans and agents alike. KRN-10 is the
mechanism behind auditability across the entire platform: every mutation any
module makes is attributable, tamper-evident, and — for agent actions —
carries the reasoning trace and rollback handle that make autonomy
inspectable rather than a black box (Vol 0 §3, T5). It is the record every
other audit-dependent capability (statutory evidence, agent trust
promotion, undo, security investigation) reads from and never bypasses.

Not bought directly — `included` platform-fee substrate (Vol 0 §11),
security- and compliance-critical (this task's framing note; also implied by
`CMP-06`'s dependency on immutable, evidentiary records). Its direct
"users" are narrow and mostly read-only: PR-21 (System Administrator) for
platform-wide audit search; PR-16 (CFO) for financial-close evidence;
PR-25/PR-26 (External CA/Auditor, Regulator/Inspector) via scoped,
read-only evidence access that never grants system access. Nearly every
other persona is a *subject* of KRN-10 (their actions are recorded) rather
than a direct user of its screens.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Searches the audit trail platform-wide, verifies the hash chain, generates evidence packs, manages `access_log` visibility |
| PR-16 Finance Controller / CFO | Reviews financial-mutation audit trails for period close and statutory filing support |
| PR-01 Owner / Director | Reviews "what an agent did today" — the audit view behind KRN-18's undo-the-day capability (Vol 0 §28 item 11) |
| PR-17 HR Manager | Reviews read-access logs on sensitive employee records (payroll, medical fitness) when investigating a suspected breach |
| PR-25 External CA / Auditor | Consumes scoped evidence packs for statutory audit, read-mostly, never raw system access |
| PR-26 Regulator / Inspector | Consumes scoped, read-only evidence for a regulatory inspection |
| PR-29 Agent | Subject, not user — every agent action generates an `audit_entry` carrying reasoning trace, confidence and rollback handle (`KRN-10-DR-001`); agents do not read their own audit history through this module |
| All other internal and external personas | Subjects only — their mutations and, where the entity is sensitive, their reads, are recorded without any KRN-10 screen of their own |

## 3. Scope in / scope out

**In scope:** capturing before/after values, actor, timestamp, IP, device,
source and `trace_id` for every mutation platform-wide; tamper-evident
hash-chain storage and on-demand verification; agent-specific audit detail
(reasoning trace, confidence, evidence references, rollback handle); logging
read access to declared-sensitive entities; queryable/exportable evidence
packs for scoped external access; statutory-floor retention.

**Out of scope:** the persona-facing audit *application* — search UI,
finding management, evidence-pack campaign workflow for external auditors
(`SEC-06` Audit & Evidence, a Layer-2 Security application; see §17.1 for
the drawn boundary, mirroring how COM-04 wraps KRN-01); the reversal
*execution* itself (`KRN-18` Undo & Compensation owns compensating
transactions and their execution — KRN-10 only stores the reference to the
reversal handle, never performs a reversal); deciding which fields on which
entities are `is_sensitive` (`KRN-04` — a field-level metadata declaration
KRN-10 consumes, per L3, never redefines); anomaly detection over audit
patterns (`INT-09` Anomaly & Signal Detection consumes KRN-10's streams,
does not live inside KRN-10).

## 4. Entities owned; entities consumed

**Owned:** `audit_entry`, `audit_chain_seal`, `access_log`.

**Consumed (by ID):**
- Every mutable entity in the platform, by reference (`subject_type`,
  `subject_id`) — KRN-10 does not own or duplicate any module's tables
  (L3); it stores a pointer plus the before/after snapshot at the moment of
  mutation.
- `P-08 Event` (KRN-06) — the source stream `audit_entry` is derived from
  (see §17.2 for the synchronous-vs-derived design assumption).
- `actor` reference (KRN-02, Vol 2 §1.2) — `{type: user|agent|service, id,
  version}`, mandatory on every `audit_entry`.
- `field_definition.is_sensitive` (KRN-04) — the declaration that triggers
  `access_log` writes on read (`KRN-10-FR-003`).
- `reversal_handle` (KRN-18) — referenced, not owned; see §17.3 for the
  phasing note on this cross-reference.

## 5. State machines

None. `audit_entry`, `audit_chain_seal` and `access_log` are append-only,
mirroring `P-08 Event`'s own rule (Vol 2 §P-08 — "append-only. Never updated,
never deleted"). No entity in KRN-10 has mutable state once written; this
absence of a state machine is itself the point of the module — an audit
record that could transition states would not be an audit record.

## 6. Standard functional requirements

- `KRN-10-FR-001` Every mutation records before and after values, actor (with agent version), timestamp, IP, device, source and `trace_id`. *(Vol 1, verbatim)*
- `KRN-10-FR-002` Entries are tamper-evident via a hash chain, verifiable on demand. *(Vol 1, verbatim)*
- `KRN-10-FR-003` Read access to sensitive entities (payroll, medical records, KYC) is itself logged. *(Vol 1, verbatim)*
- `KRN-10-FR-004` Audit data is queryable and exportable as an evidence pack for auditors (PR-25, PR-26) without granting them system access. *(Vol 1, verbatim)*
- `KRN-10-FR-005` Retention meets the longest applicable statutory requirement and cannot be shortened by a tenant below that floor. *(Vol 1, verbatim)*
- `KRN-10-FR-006` *(addition)* Periodic chain seals (`audit_chain_seal`) checkpoint the hash chain (e.g. a Merkle root over a time window) and are stored so that tamper-evidence (`KRN-10-FR-002`) is verifiable even against a scenario where the live database itself were compromised — Vol 1 lists `audit_chain_seal` as an owned entity but states no requirement describing what it does; this item fills that gap.
- `KRN-10-FR-007` *(addition)* Examining the audit trail is itself auditable: querying another actor's audit history, generating an evidence pack, or exporting entries records who did so, when, and what scope was accessed — extending `KRN-10-FR-003`'s "read access to sensitive entities is itself logged" principle to the audit log's own read surface, since the audit trail of payroll mutations is itself sensitive.
- `KRN-10-FR-008` *(addition)* Every `audit_entry` for a mutation (not only agent-authored ones) carries a reference to that mutation's `reversal_handle` (KRN-18) once registered, so any mutation — human or agent — is traceable from its audit record to its compensating transaction, consistent with L5's "every mutation registers its compensating transaction... at the time it is written." `KRN-10-DR-001` states this only for agent entries; this item extends the same field to human-actor entries, matching L5's unconditional scope.

## 7. Differentiating requirements

- `KRN-10-DR-001` Agent entries additionally carry the reasoning trace, confidence score, input evidence references and the exact rollback handle — making autonomy auditable rather than mysterious. *(Vol 1, verbatim)*

## 8. Agents

None. KRN-10 records but does not itself run autonomous agents. `INT-09`
Anomaly & Signal Detection's Guardian-class agents (continuous — access
anomalies, duplicate vendors, circular billing per Vol 0 §27.1) consume
`audit_entry` and `access_log` as their primary data source, but are
registered and owned by INT-09, not by KRN-10 (L3 — KRN-10 exposes a
read API; INT-09 never reads its tables directly).

## 9. Screens and flows

All screens are KRN-13-generated from KRN-04 metadata (L6). KRN-10's own
screens are deliberately minimal — the persona-facing audit *application*
is `SEC-06` (§17.1):

- **Audit Trail Search** (filter by entity, actor, action, date range,
  tenant-scoped) — PR-21, PR-16 (own function's financial mutations).
- **Chain Verification** (run/display hash-chain integrity check, last-seal
  timestamp, break location if any) — PR-21.
- **Evidence Pack Generator** (scope selection, date range, output format,
  generates a bounded export without granting broader access) — PR-21,
  used on behalf of PR-25/PR-26 for a specific audit or inspection.
- **Agent Action Detail** (reasoning trace, confidence, evidence, rollback
  handle for one `audit_entry`) — PR-21, PR-01 (reviewing what an agent did,
  Vol 0 §28 item 11), any approver reviewing a specific agent decision
  in context on the record it touched.
- **Sensitive Access Log** (who read payroll/medical/KYC records and when)
  — PR-21, PR-17 (HR-sensitive records), PR-16 (financial-sensitive
  records), each scoped to their own domain.

## 10. API surface

Base per Vol 0 §42: `/api/v1/audit/{entity}`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/audit/entries` | Filterable by `subject_type`, `subject_id`, `actor`, `action`, date range; itself access-logged when the underlying entity is sensitive (`KRN-10-FR-007`) |
| GET | `/api/v1/audit/entries/{id}` | Single entry detail, including agent reasoning trace/rollback handle where present |
| GET | `/api/v1/audit/access-logs` | Filterable the same way; who read what, when |
| GET | `/api/v1/audit/verify-chain` | Runs/returns hash-chain integrity status, optionally scoped to a time window |
| POST | `/api/v1/audit/evidence-pack` | `{scope, date_range, format}` — async (KRN-15) for large scopes; itself generates an `audit_entry`/event (`KRN-10-FR-007`) |
| GET | `/api/v1/audit/chain-seals` | `audit_chain_seal` list, for verification tooling |

All list endpoints: cursor pagination, declared filters, field selection
(Vol 1 §1.2). No write/CRUD endpoints exist for `audit_entry` or
`access_log` — they are system-generated only (§11); there is no
authorable path, by design.

## 11. Permission matrix by persona

Actions: `read` (own-scope vs. cross-tenant-forbidden always), `export`
(evidence pack), `verify` (chain). **No persona holds a `create`, `update`
or `delete` action on `audit_entry` or `access_log` at any level** — these
are system-generated exclusively, from the data-access layer at the moment
of mutation or sensitive read, never authored by a human or an agent acting
as itself (this is the point of an audit log: the record must not be
something its subject can edit).

| Persona | audit_entry.read (own actions) | audit_entry.read (cross-persona, own scope) | access_log.read | evidence_pack.export | chain.verify |
|---|---|---|---|---|---|
| PR-21 System Admin | ✓ | ✓ (tenant-wide) | ✓ (tenant-wide) | ✓ | ✓ |
| PR-16 CFO | ✓ | ✓ (financial-mutation scope) | ✓ (financial-sensitive entities) | ✓ (financial scope) | ✗ |
| PR-17 HR Manager | ✓ | ✓ (HR-mutation scope) | ✓ (HR-sensitive entities: payroll, medical) | ✓ (HR scope) | ✗ |
| PR-01 Owner | ✓ | ✓ (agent-action summary, "what did an agent do today") | ✗ | ✗ | ✗ |
| PR-25 External CA / Auditor | ✗ (no direct query access) | ✗ | ✗ | ✓ (received evidence pack only, generated on their behalf by PR-21/16, scoped, read-mostly per Vol 0 §7.2) | ✗ |
| PR-26 Regulator / Inspector | ✗ | ✗ | ✗ | ✓ (received evidence pack only, scoped read-only) | ✗ |
| All other internal personas | ✓ (their own actions, e.g. "history" tab on a record they own, scoped by KRN-03 record permission) | ✗ | ✗ | ✗ | ✗ |
| PR-29 Agent | ✗ (subject only, per §2) | ✗ | ✗ | ✗ | ✗ |

**Negative cases:**
- Any persona, including PR-21, attempting a direct `POST`/`PATCH`/`DELETE`
  against `audit_entry` or `access_log` → 405/403 at the API boundary; no
  such endpoint exists (§10) — this is architectural, not a permission
  grant that could be extended.
- PR-25 (External CA) attempting to query `/api/v1/audit/entries` directly
  rather than receiving a generated evidence pack → 403; external auditors
  never get raw system query access (`KRN-10-FR-004`'s explicit "without
  granting them system access").
- PR-16 (CFO) attempting to read `access_log` entries for HR-sensitive
  records (medical) outside the financial-sensitive scope → 403, and the
  attempt itself is logged (`KRN-10-FR-007`).
- PR-01 (Owner) attempting to modify or suppress an audit entry describing
  their own action → 403; ownership of the tenant confers no write path to
  its own audit trail.

## 12. Events emitted / consumed

**Emitted:** Vol 1 states no `Events:` line for KRN-10 — unlike every other
kernel module section — which this draft treats as a deliberate design
point requiring an explicit assumption (flagged in §17.4). This draft's
position: `audit_entry` creation itself does **not** emit a new domain
event (it would recursively require auditing the audit log's own writes,
which KRN-06's append-only event store already implicitly covers since
`audit_entry` derives from the same events). KRN-10 **does** emit for
meaningful actions other systems may react to:
- `audit.chain_seal.completed` *(addition)*
- `audit.evidence_pack.generated` *(addition — lets SEC-06 or a security
  dashboard react to an evidence-pack export, itself worth knowing about)*
- `audit.chain.verification_failed` *(addition — a tamper-evidence break is
  exactly the kind of event that must not depend on a human noticing a
  dashboard; this should page someone)*

**Consumed:** every event on `P-08 Event`/KRN-06 platform-wide (a wildcard
subscription — KRN-10 is the one legitimate cross-module "reads everything"
consumer, since auditing every mutation is its entire purpose, distinct
from L3's prohibition on modules reading each other's *tables*, which
KRN-10 does not do — it consumes the published event stream, the sanctioned
channel).

## 13. Reports and KPIs

- Audit entry volume by module and action type (platform health, PR-21).
- Chain integrity status: last successful verification, time since last
  seal, any unresolved break (PR-21, alerting on `audit.chain.
  verification_failed`).
- Sensitive-entity access frequency by user (feeds `INT-09` anomaly
  candidates — e.g. one user reading far more payroll records than their
  role typically requires).
- Agent action audit summary: agreement rate, reversal frequency per agent
  (feeds `INT-04` Trust Ladder promotion evidence, Vol 0 §27.3).
- Evidence pack generation log: who requested what scope, when (PR-21,
  security review).

No statutory reports originate in KRN-10 itself — `SEC-06` and `CMP-05`
consume its data for their own filings and evidence archives.

## 14. Compliance touchpoints

- `KRN-10-FR-005`'s statutory retention floor is the backstop for every
  regulated vertical's audit requirement (`CMP-06` Regulated Records, GxP
  validated audit trail for Pharma; RBI records for BFSI; DGCA change
  control for Aviation) — CMP-06's "validated audit trail... electronic
  records with meaning" is built directly on KRN-10, not a parallel
  mechanism.
- `KRN-10-FR-003`'s sensitive-read logging is the primary technical control
  behind DPDP accountability (`SEC-07`) for personal data access — who
  looked at whose KYC or medical record is answerable on demand.
- `KRN-10-DR-001`'s reasoning-trace-plus-rollback-handle is what makes
  `INT-04`'s Trust Ladder evidence-based promotion possible at all (Vol 0
  §27.3) — promotion/demotion decisions read agreement rate directly from
  KRN-10's agent entries.
- Tamper-evidence (`KRN-10-FR-002`) is a prerequisite for any statutory
  filing evidence archive (`CMP-05`) to be defensible under audit — an
  auditor's first question about a digital record is always whether it
  could have been altered after the fact.

## 15. Offline behaviour

**Profile: `online`, by nature of what it records.** KRN-10 does not itself
run on a device — it is the server-side record of mutations, which for
offline-`full` modules (Vol 0 §9.2: `SCM-02`, `SCM-03`, `MFG-04`, `MFG-06`,
`SLS-10`, `DLV-05`, `DLV-07`, `PPL-05`, `OPS-10`) are captured locally with
event time distinct from transaction time (Vol 2 §1.6) and only become
`audit_entry` records once synced. A mutation captured offline at 14:05 and
synced at 19:30 produces an audit entry whose `occurred_at`/event-time
reflects 14:05 while `recorded_at`/transaction-time reflects 19:30 — both
preserved, never collapsed into one timestamp, since the gap itself is
sometimes evidentially relevant (e.g. a disputed delivery time). No
conflict-resolution policy is needed here beyond what the originating
module already declares — KRN-10 is a downstream recorder, never a party
to the conflict.

## 16. Acceptance criteria (Given/When/Then)

**KRN-10-FR-001 — full mutation capture**
> Given a stock adjustment transaction changing Item I-40's on-hand quantity from 120 to 95 at Warehouse W-2
> When the mutation commits
> Then an `audit_entry` records `before: {quantity: 120}`, `after: {quantity: 95}`, the actor (user or agent, with version if agent), timestamp, source IP, device, `source` (ui/api/agent/offline_sync), and `trace_id`, all within the same transaction as the mutation itself.

**KRN-10-FR-002 — tamper-evident hash chain**
> Given 10,000 audit entries recorded over a week, chained by hash
> When PR-21 runs chain verification
> Then the check passes end to end; when a single historical entry's `after` value is hypothetically altered outside the application (e.g. direct database tampering), the next verification run identifies the exact entry where the chain breaks.

**KRN-10-FR-003 — sensitive read logging**
> Given an employee payroll record marked `is_sensitive` at the field level (KRN-04)
> When PR-17 (HR Manager) opens that record to view salary detail
> Then an `access_log` entry is written recording PR-17, the record, the timestamp and the fields viewed — with no corresponding entry for a non-sensitive field view elsewhere in the same session, keeping the sensitive-access signal precise rather than noisy.

**KRN-10-FR-004 — scoped evidence pack, no system access granted**
> Given PR-25 (External CA) needs six months of FIN-04 invoice mutation evidence for a statutory audit
> When PR-21 generates an evidence pack scoped to that entity type and date range and shares it with PR-25
> Then PR-25 receives a complete, verifiable export without ever being issued login credentials or query access to the live system, and the pack's own generation is itself logged (`KRN-10-FR-007`).

**KRN-10-FR-005 — retention floor cannot be shortened**
> Given a tenant attempting to configure audit retention at 3 years
> When the statutory floor for the relevant record class (e.g. GST-linked financial mutations) is longer
> Then the configuration is rejected and the effective floor is enforced regardless of tenant preference, exactly mirroring `KRN-08-FR-008`'s pattern for rendered documents.

**KRN-10-FR-006 — periodic chain seals**
> Given the hash chain accumulating entries continuously
> When the scheduled sealing job (KRN-15) runs at its configured interval
> Then an `audit_chain_seal` is written capturing a checkpoint (e.g. a Merkle root) over the entries since the last seal, `audit.chain_seal.completed` emits, and a subsequent `verify-chain` call can confirm integrity against the seal even if it needed to re-derive the full chain from scratch.

**KRN-10-FR-007 — auditing the audit trail's own access**
> Given PR-21 runs an evidence-pack export scoped to PR-16's financial mutations for the last quarter
> When the export completes
> Then a new `audit_entry` (or `access_log` entry, per the entity involved) records that PR-21 performed this export, its scope and timestamp — so a later question "who examined the CFO's audit trail" is itself answerable.

**KRN-10-FR-008 — reversal handle referenced for every mutation, not only agent actions**
> Given a human-initiated credit note reversal registered with KRN-18 at the time it is written (L5)
> When the corresponding `audit_entry` is created
> Then it carries a reference to that mutation's `reversal_handle`, identical in shape to how an agent-authored entry carries one under `KRN-10-DR-001` — so "show me how to undo this" works the same way regardless of whether a human or an agent made the change.

**KRN-10-DR-001 — agent entries carry reasoning, confidence, evidence, rollback handle**
> Given `MFG-AG-05` (Job Work Ageing Watchdog, L3) escalates a job-work challan approaching its 180-day ITC reversal window and, within its trust ceiling, drafts a reconciliation adjustment
> When the action is recorded
> Then the `audit_entry` carries the agent's identity and version, its reasoning trace (why this challan was flagged, what evidence — the 180-day rule, the challan's dispatch date — it used), a confidence score, references to the specific input evidence, and the exact rollback handle that would reverse this specific action, all retrievable together on the Agent Action Detail screen without needing to separately query KRN-18 or the agent's own logs.

## 17. Open questions

Flagged per Vol 6 §4/L13 — gaps in Vol 1's field-level detail this draft
filled by reasonable extrapolation. Confirm or correct before this file is
binding:

1. **Scope boundary with `SEC-06` Audit & Evidence.** Vol 0 §26 describes
   SEC-06 as "audit trail search and export, evidence packs for auditors...
   tamper-evidence verification, scoped auditor access (PR-25, PR-26)" —
   almost identical wording to KRN-10's own capability description and API
   surface in Vol 1. This draft assumes KRN-10 is the kernel-layer engine
   (storage, hash chain, low-level query/export API, as specified in Vol 1
   Part 2) and SEC-06 is the Layer-2, separately-priced application that
   provides the persona-facing search UI, finding/campaign workflow and
   richer evidence-pack authoring on top of KRN-10's API — mirroring how
   `COM-04` wraps `KRN-01`. Vol 0's one-line SEC-06 description does not
   make this layering explicit; confirm before SEC-06's own Vol 3 file is
   drafted, since both files should agree on which one owns which API path.
2. **Synchronous write vs. event-derived audit trail.** Vol 1 does not
   state the mechanism by which `audit_entry` comes to exist — whether it
   is written directly, within the same database transaction as the
   mutation (mirroring `KRN-06-FR-001`'s outbox pattern for events), or
   derived asynchronously by KRN-10 subscribing to KRN-06's event stream
   after commit. This draft assumes **synchronous, same-transaction
   write** for `audit_entry` (a security/compliance-critical log cannot
   tolerate an async lag between a mutation committing and its audit
   record existing) while `access_log` (a read-time record, since reads do
   not emit KRN-06 mutation events) is written directly by the data-access
   layer at query time, as a separate mechanism. Confirm this dual design
   is intended, since it affects whether `audit_entry` shares the outbox
   table/transaction with `event` or is a fully separate write.
3. **`reversal_handle` cross-reference and phasing.** `KRN-10-DR-001`
   requires storing "the exact rollback handle" for agent actions — a
   concept owned by `KRN-18` Undo & Compensation. Per Vol 0 §39, KRN-10 is
   built in Phase 0 while KRN-18 is Phase 1 (`KRN-15..20`). This draft
   assumes `audit_entry.reversal_handle` is simply an opaque, nullable
   reference field at Phase 0 — populated once KRN-18 exists and absent
   (not an error) for entries recorded before KRN-18 ships. Confirm this
   phasing is acceptable, or whether `KRN-10-DR-001`/`KRN-10-FR-008`'s
   rollback-handle-storage requirement should itself be deferred to
   Phase 1 alongside KRN-18, since an "exact rollback handle" that cannot
   yet be exercised is a field with no verifiable meaning until then.
4. **No `Events:` line in Vol 1 for KRN-10.** Every other kernel module
   section in Vol 1 Part 2 lists an `Events:` line; KRN-10's section does
   not. This draft assumes this was deliberate (an audit-log-of-the-audit-
   log would be circular) rather than an oversight, and has proposed three
   addition events (`audit.chain_seal.completed`,
   `audit.evidence_pack.generated`, `audit.chain.verification_failed`) for
   meaningful, non-circular cases where other systems genuinely need to
   react. Confirm this reading, or whether Vol 1's omission should instead
   be read as "KRN-10 emits nothing, ever," which would remove all three
   proposed events.
5. **Field-level detail for `audit_entry`, `audit_chain_seal`, `access_log`**
   (§4) beyond what FR-001/002/003 state inline — this draft's proposed
   shapes (e.g. `audit_chain_seal`'s Merkle-root-over-a-window structure)
   are a reasonable minimum, not verbatim source, and should be confirmed
   against the actual hash-chain algorithm chosen at implementation time
   (a `[stack-bound]`-flavoured decision Vol 1 leaves open for KRN-10
   specifically, unlike KRN-11's explicit `[stack-bound]` tag elsewhere).
