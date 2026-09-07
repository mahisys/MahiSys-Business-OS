# KRN-02 · Identity & Authentication

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-01 (tenant and legal-entity scope on every identity record)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-02)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

Defines every actor that can touch the system and how it proves who it is:
human users, external portal users, service accounts and agents. KRN-02
answers exactly one question — "who is making this request?" — and answers
it identically regardless of whether the requester is a person on a laptop,
a route salesman on WhatsApp, a nightly Tally sync job, or `MFG-AG-05`
executing its scheduled scan. What that identity is then *allowed* to do is
KRN-03's question, not this module's.

`user` is a technical identity, not a business relationship. It is
deliberately distinct from `P-01 Party` (Vol 2 §P-01): a Party is who the
business has a relationship with (a customer, an employee, a vendor); a
`user` is a credentialed actor that can log in. An employee typically has
both — a `P-01 Party` record (owned by PPL-02) and a `user` record (owned
here) linked by `user.party_id` — because the same person is simultaneously
"an employee we pay" and "an account that can authenticate." Keeping these
separate is what lets a portal customer (PR-22) authenticate without ever
becoming a Party-with-a-salary-record, and what lets a Party exist (a lead,
a prospect) long before anyone associated with it ever logs in. This is not
a thirteenth primitive (L2) — `user` and its sibling entities here are
kernel plumbing, exactly as `tenant` and `org_unit` are in KRN-01.

Not bought directly — `included` platform-fee substrate. The direct "user"
of its admin surface is PR-21 (System Administrator), who provisions and
retires every other actor. Every other persona in the system is a *subject*
of KRN-02 the moment they open the app, whether or not they ever see a
KRN-02 screen.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Creates/deactivates users, configures SSO/OIDC/SAML and MFA enrolment policy, registers service accounts, reviews login attempts and lockouts, performs impersonation (audited), manages device revocation |
| PR-01 Owner / Director | Reviews a security/login summary; is offered — but does not by default receive — impersonation rights, since KRN-02-FR-003 restricts impersonation's financial reach regardless of who performs it |
| PR-16 Finance Controller / CFO | Consumer of KRN-02-FR-003's guarantee: impersonation can never post a financial transaction, protecting FIN's audit integrity even when support staff impersonate a user for troubleshooting |
| PR-25 External CA / Auditor, PR-26 Regulator | Authenticate through the identical mechanism as an internal user (KRN-02-FR-005), scoped by KRN-03 rather than by a separate identity system; consume `login_attempt`/`session` history as evidence (SEC-06) |
| PR-22 Customer, PR-23 Dealer/Distributor, PR-24 Vendor, PR-27 Job Candidate | Authenticate on a portal (WEB-08, WEB-09) or in a supplier/candidate flow through the same login endpoint, `user_type: external` |
| PR-28 Implementation Partner | Registers/administers users during the provisioning window (COM-06), scoped to the tenant being onboarded, mirroring KRN-01's provisioning-window pattern |
| PR-29 Agent | Every registered agent build (Vol 0 §27.2) holds an `agent_identity` here — the mechanism behind KRN-02-DR-001. The agent class (STU-07/INT-03) is not defined by KRN-02; the identity record it runs as, is |
| PR-30 Integration Service Account | Registered as `service_account` — scoped, rate-limited, rotating credentials (Vol 0 §7.3) |
| PR-19 Employee (Self Service) and every other internal persona (PR-02..18, PR-20) | Authenticate via KRN-02 to obtain a `session` before any other module is reachable; self-manage their own MFA enrolment and active-device list |

## 3. Scope in / scope out

**In scope:** human user identity and lifecycle; credential material and its
verification (password, OTP, SSO assertion); session issuance, device
binding and revocation; service account identity and credential rotation;
agent identity registration and versioning; failed-login handling and
lockout; impersonation and its guardrails; external portal users
authenticating through the same substrate as internal users.

**Out of scope:**
- **What an authenticated actor may do** — role, permission, scope, field
  masking, delegation (KRN-03). KRN-02 establishes *who*; KRN-03 decides
  *what*.
- **Tenant, legal entity and org-unit structure** that identities are scoped
  into (KRN-01) — KRN-02 references these by ID on `user.entity_id`/
  `tenant_id` (Vol 2 §1.2 universal fields) but does not define them.
- **The business relationship a person represents** (`P-01 Party`, owned by
  SLS-03/SCM-05/PPL-02 depending on role) — KRN-02 only links to it via
  `user.party_id`.
- **Per-role policy on when step-up authentication is required** (SEC-02,
  Multi-Factor Authentication) — KRN-02 supplies the enrolment and
  verification mechanism (TOTP, SMS/email OTP, push, hardware key) that
  SEC-02's policy invokes; SEC-02 decides which actions demand it. Since
  SEC-02 ships in a later phase (Vol 0 §39 Phase 8) than KRN-02 (Phase 0),
  KRN-02 must ship a minimal always-available MFA mechanism on its own —
  flagged in §17.
- **Trust ceiling promotion, demotion and enforcement for agent identities**
  (INT-04, Trust Ladder & Governance) — KRN-02 stores `agent_identity` as
  the system-of-record for the identity itself, including its *current*
  `trust_ceiling` value, but INT-04 is the only writer of that field and
  the sole owner of the promotion/demotion decision (L9). KRN-02 no more
  decides an agent's trust ceiling than KRN-01 decides a tenant's isolation
  tier — both store the attribute; a governed process elsewhere changes it.
- **Delivery of the OTP message itself** (KRN-09, Notification &
  Communication Hub) — KRN-02 generates and verifies the OTP; KRN-09 sends
  it over email/SMS/WhatsApp.
- **Persistent audit storage and evidence packs** (KRN-10, SEC-06) — KRN-02
  emits identity events into the audit trail; it does not own long-term
  audit retrieval.

## 4. Entities owned; entities consumed

**Owned:** `user`, `credential`, `session`, `service_account`,
`agent_identity`, `device`, `login_attempt`.

**Consumed (by ID):** `P-01 Party` (via `user.party_id` — KRN-02 never
reads or writes Party fields beyond the ID reference); `KRN-01` `tenant`,
`legal_entity` (every identity entity carries `tenant_id`/`entity_id` per
Vol 2 §1.2 universal fields, resolved against KRN-01's records); `KRN-09`
(API call, not event subscription, to dispatch OTP/notification content);
`KRN-03` `permission_grant`/`role` are *consumers of* KRN-02 identities, not
the reverse — noted here only because the two modules are read together in
practice (see the cross-reference in KRN-03 §1).

### 4.1 Field-level detail

Universal fields (Vol 2 §1.2) apply to every entity below and are not
repeated per field table.

**`user`** (Vol 1 §KRN-02, verbatim):

| Field | Type | Notes |
|---|---|---|
| `party_id` | ref, nullable | Links to `P-01 Party`; null for accounts with no business-relationship counterpart (e.g. a break-glass admin account created before HR onboarding runs) |
| `user_type` | enum | `full` \| `light` \| `self_service` \| `external` — drives licensing (Vol 0 §33.4) |
| `login_id` | string | Email or phone; tenant-unique |
| `status` | enum | Proposed: `pending` \| `active` \| `suspended` \| `deactivated` — values not given in Vol 1, flagged in §17 |
| `locale` | ref | Drives KRN-19 language/terminology; defaults from tenant manifest |
| `mfa_enrolments` | list | `{method: totp\|sms_otp\|email_otp\|push\|hardware_key, enrolled_at, status}` |
| `last_login_at` | timestamptz | |

**`credential`** (extrapolated; not field-detailed in Vol 1 — flagged in
§17):

| Field | Type | Notes |
|---|---|---|
| `user_id` \| `service_account_id` \| `agent_identity_id` | ref, exactly one set | The subject this credential authenticates |
| `credential_type` | enum | `password_hash` \| `sso_link` \| `api_key_hash` \| `webauthn_key` |
| `value_hash` | string | Never the plaintext or reversible value — hash/reference only, per KRN-02-FR-004 |
| `rotation_due_at` | timestamptz, nullable | |
| `status` | enum | `active` \| `expired` \| `revoked` |
| `last_rotated_at` | timestamptz | |

**`session`** (extrapolated; not field-detailed in Vol 1 — flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `user_id` | ref | Sessions are issued to `user` subjects (human/portal); agent execution context is tracked separately by INT-03 — see §17 |
| `device_id` | ref | KRN-02-FR-002 device binding |
| `started_at`, `last_active_at` | timestamptz | |
| `idle_timeout_minutes`, `absolute_timeout_minutes` | integer | Configurable per `user_type`/role |
| `status` | enum | `active` \| `idle_timed_out` \| `absolute_timed_out` \| `revoked` \| `logged_out` |
| `revoked_by`, `revoked_reason` | ref, string, nullable | |
| `auth_method_used` | enum | `password` \| `otp` \| `sso` \| `google_workspace` |
| `is_impersonation` | boolean | KRN-02-FR-003 |
| `impersonated_by_user_id` | ref, nullable | Set only when `is_impersonation` |

**`service_account`** (extrapolated; not field-detailed in Vol 1 — flagged
in §17):

| Field | Type | Notes |
|---|---|---|
| `code`, `name` | string | |
| `owning_integration` | ref, nullable | ITG-01 connector this account serves, where applicable |
| `rate_limit` | object | `{requests_per_minute}` |
| `credential_rotation_policy_days` | integer | |
| `status` | enum | `active` \| `suspended` \| `retired` |

**`agent_identity`** (Vol 1 §KRN-02, verbatim):

| Field | Type | Notes |
|---|---|---|
| `agent_code` | ref | `PREFIX-AG-NN` (Vol 0 §42) — e.g. `MFG-AG-05` |
| `agent_version` | integer | Current version pointer; historical actions retain their own version via the actor-ref snapshot on the event/record itself (Vol 2 §1.2), not by re-reading this field |
| `owning_module` | ref | Module that registers this agent (Vol 0 §27.4 registry) |
| `credential_ref` | ref | Points to a `credential` record |
| `trust_ceiling` | enum | `L0`..`L4` (Vol 0 §27.3) — **written only by INT-04**, never by this module or by the agent itself (L9) |
| `status` | enum | Proposed: `registered` \| `active` \| `deprecated` \| `retired` — flagged in §17 |

**`device`** (extrapolated; not field-detailed in Vol 1 — flagged in §17):

| Field | Type | Notes |
|---|---|---|
| `user_id` | ref | |
| `platform` | enum | `ios` \| `android` \| `web` \| `whatsapp` |
| `device_fingerprint` | string | |
| `registered_at`, `last_seen_at` | timestamptz | |
| `push_token` | string, nullable | For KRN-09 delivery |
| `trust_status` | enum | `registered` \| `trusted` \| `revoked` |

**`login_attempt`** (extrapolated; not field-detailed in Vol 1 — flagged in
§17):

| Field | Type | Notes |
|---|---|---|
| `login_id` | string | The identifier attempted, not necessarily resolvable to a `user` (e.g. a typo) |
| `outcome` | enum | `success` \| `failed_credential` \| `failed_mfa` \| `locked_out` |
| `device_id`, `ip` | ref, string | |
| `occurred_at` | timestamptz | |
| Credential material | — | **Never stored on this or any record** (KRN-02-FR-004) |

## 5. State machines

**`user.status`:** `pending → active → suspended → deactivated`, with
`active ↔ suspended` both permitted (policy suspension, leave, reactivation).
`deactivated` is terminal — a returning employee gets a new `user` record
linked to the same `P-01 Party` rather than a resurrected `login_id`,
consistent with L12's spirit of never silently reviving a retired identity.

**`session.status`:** `active → (idle_timed_out | absolute_timed_out |
revoked | logged_out)`. All four end-states are terminal for that session
instance; reconnecting issues a new `session`. `idle_timed_out` and
`absolute_timed_out` are system-driven transitions (KRN-02-FR-002);
`revoked` is admin- or bulk-revoke-driven; `logged_out` is user-initiated.

**`agent_identity.status`:** `registered → active → deprecated → retired`.
Version upgrades (`agent_version` incrementing) do not change `status` —
an agent stays `active` across versions; only INT-04's kill switch or a
deliberate retirement moves it out of `active`. Historical attribution
survives every transition because it lives on the actor-ref snapshot of
each past action, not on this record's current state (§4.1).

**`device.trust_status`:** `registered → trusted → revoked`. `revoked` is
terminal for that device instance; a lost-and-recovered device re-registers.

**`login_attempt`** carries no state machine — it is an append-only log
entry, immutable once written (mirrors `P-08 Event`'s append-only rule,
though `login_attempt` is a KRN-02-owned entity, not itself a Event-primitive
record).

## 6. Standard functional requirements

- `KRN-02-FR-001` Authentication supports password, email OTP, phone OTP, SSO (SAML 2.0, OIDC) and Google Workspace. *(Vol 1, verbatim)*
- `KRN-02-FR-002` Sessions carry device binding, configurable idle and absolute timeouts, and can be revoked individually or in bulk. *(Vol 1, verbatim)*
- `KRN-02-FR-003` Impersonation by an administrator is possible, always audited, always visibly banner-marked, and never permitted for financial posting. *(Vol 1, verbatim)*
- `KRN-02-FR-004` Failed login handling includes progressive delay and lockout; credential material is never logged. *(Vol 1, verbatim)*
- `KRN-02-FR-005` External portal users (PR-22..27) authenticate through the same mechanism with a restricted scope; no separate identity system exists. *(Vol 1, verbatim)*
- `KRN-02-FR-006` Service accounts and registered devices are first-class, independently manageable identity-adjacent entities: service accounts carry an enforced credential rotation schedule, and a device can be individually revoked — ending only the session bound to it — without invalidating the underlying user's other active sessions or credentials. **Addition beyond Vol 1** — grounded in Vol 0 §7.3's description of PR-30 ("scoped, rotating credentials, rate limited") and the fact that Vol 1 lists `device` and `service_account` as owned entities with no dedicated requirement text of their own.

## 7. Differentiating requirements

- `KRN-02-DR-001` Agents hold real, versioned identities. Every action is attributable to a specific agent build, not to "the system". *(Vol 1, verbatim)*
- `KRN-02-DR-002` External personas (PR-22..27) and internal personas resolve through the identical `user`/`credential`/`session` substrate — a portal login is not a parallel system requiring separate patching, reconciliation or audit trail. **Addition beyond Vol 1** — this is `KRN-02-FR-005` restated as the "one brain" claim (Vol 0 §2.5) applied to identity itself, made explicit as a differentiator since Vol 1 states it only as a standard requirement.

## 8. Agents

None. KRN-02 provides the identity substrate every agent (PR-29) is
registered into via `agent_identity`, but registers no agent of its own.
Agent *behaviour* — registration workflow, tool binding, telemetry — is
owned by INT-03 (Agent Runtime & Registry); trust-ceiling governance is
owned by INT-04 (Trust Ladder & Governance). Both write to `agent_identity`
through a governed API rather than KRN-02 initiating agent behaviour
itself.

## 9. Screens and flows

All screens are KRN-13-generated from KRN-04 metadata (L6). Standard views:

- **Login** (unauthenticated, public) — method chooser (password/OTP/SSO),
  branded per tenant (STU-09).
- **MFA enrolment** (self-service) — every internal and external persona.
- **User management** (list + form) — PR-21: create/deactivate, assign
  `user_type`, force MFA reset, view a user's sessions and devices.
- **My active sessions** (self-service) — every persona: list own sessions
  across devices, revoke any but the current one.
- **Session administration** (list, bulk actions) — PR-21: revoke
  individually or in bulk (KRN-02-FR-002).
- **Device registry** — self-service revoke-own-device; PR-21 admin view
  across the tenant.
- **Service account management** — PR-21: create, rotate credential, view
  rate-limit configuration.
- **Agent identity roster** (read-mostly here; created via STU-07/INT-03) —
  PR-21, PR-01: view agent identity, current version, status, trust ceiling
  (read-only mirror of the INT-04-owned value).
- **Login attempts / lockout** — PR-21 and scoped auditor personas
  (PR-25/26): security review surface.
- **Impersonation launcher** — PR-21 only, guarded action, produces the
  persistent banner required by KRN-02-FR-003.

## 10. API surface

Base per Vol 1 §1.2 / Vol 0 §42: `/api/v1/identity/{entity}`.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/identity/auth/login` | `{login_id, method}` — starts password/OTP/SSO flow |
| POST | `/api/v1/identity/auth/otp/request` \| `/verify` | |
| POST | `/api/v1/identity/auth/sso/{provider}/callback` | SAML/OIDC/Google Workspace |
| POST | `/api/v1/identity/auth/logout` | Ends the current session |
| CRUD | `/api/v1/identity/users` | POST restricted to PR-21 or COM-04 provisioning |
| POST | `/api/v1/identity/users/{id}/deactivate` | Process-adjacent; emits `identity.user.deactivated` |
| POST | `/api/v1/identity/users/{id}/mfa/enrol` \| `/revoke` | |
| GET | `/api/v1/identity/sessions` | Own sessions by default; admin scope for all |
| POST | `/api/v1/identity/sessions/{id}/revoke` | Individual or, with a filter body, bulk |
| CRUD | `/api/v1/identity/service-accounts` | PR-21 only |
| POST | `/api/v1/identity/service-accounts/{id}/rotate-credential` | |
| GET, POST (restricted) | `/api/v1/identity/agent-identities` | Writes restricted to INT-03/STU-07 service accounts, never general users (see §17) |
| CRUD | `/api/v1/identity/devices` | Self-service for own devices; PR-21 for any |
| POST | `/api/v1/identity/devices/{id}/revoke` | |
| GET | `/api/v1/identity/login-attempts` | Filterable, admin/auditor scoped |
| POST | `/api/v1/identity/impersonation/start` \| `/end` | PR-21 only; every call to any other endpoint made under an active impersonation session carries `is_impersonation: true` and both actor IDs in its audit record |

All list endpoints: cursor pagination, declared filters, field selection.
All writes: idempotency key required (Vol 1 §1.2).

## 11. Permission matrix by persona

Actions: `create`, `read`, `update`, `deactivate`/`revoke`, `approve`
(N/A here — no approval matrix in KRN-02 itself).

| Persona | user.create/deactivate | mfa.reset (others) | session.read (own) | session.revoke (others) | device.revoke (others) | service_account.manage | agent_identity.read | login_attempt.read | impersonation.start |
|---|---|---|---|---|---|---|---|---|---|
| PR-21 System Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-01 Owner | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ (read) | ✓ (read, summary only) | ✗ |
| PR-16 CFO | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| PR-25 External CA/Auditor, PR-26 Regulator | ✗ | ✗ | ✓ (own) | ✗ | ✗ | ✗ | ✗ | ✓ (evidence scope only, per SEC-06) | ✗ |
| PR-28 Implementation Partner | ✓ (own tenant, provisioning window only) | ✓ (own tenant, provisioning window only) | ✓ (own) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| PR-29 Agent | ✗ | ✗ | n/a — agents authenticate via `credential_ref`/execution context, not a human `session` (§17) | ✗ | ✗ | ✗ | ✓ (own record only, via INT-03 tooling, not a direct user-facing call) | ✗ | ✗ |
| All other internal personas (PR-02..15, 17..20) | ✗ | ✗ | ✓ (own) | ✓ (own only, i.e. self-logout on another device) | ✓ (own device only) | ✗ | ✗ | ✗ | ✗ |
| PR-22..24, 27 External personas | ✗ | ✗ | ✓ (own) | ✓ (own only) | ✓ (own device only) | ✗ | ✗ | ✗ | ✗ |

**`device.revoke (others)` added post-draft:** the original permission
matrix had no column for device revocation at all, even though §9
describes "Device registry — self-service revoke-own-device; PR-21 admin
view across the tenant." Found the same way as D-32 (KRN-01's
`isolation_tier.promote` gap) — writing the permission tests and noticing
no `Krn02Action` corresponded to it. Own-device revoke is unconditional
for every persona (mirrors `session.revoke (own)`); revoking *another*
user's device is PR-21-only. Also found: `mfa.reset (others)` was already
correctly in this table, but the implementation had not wired the check
into `enrolMfa` — fixed alongside this, not a spec gap of its own.

**Negative cases:**
- PR-16 (CFO) attempting `session.revoke` on another user's session → 403,
  audited; CFO's role carries no session-administration grant regardless
  of seniority.
- Any non-PR-21 persona attempting `POST /api/v1/identity/impersonation/start`
  → 403, unconditionally — impersonation is never delegable via KRN-03
  (KRN-02-FR-003 treats it as structurally restricted, not merely
  role-gated).
- An `agent_identity` credential attempting to call
  `POST /api/v1/identity/users` → 403 — even though a `service` actor
  (COM-04 provisioning, per §10) may create users during tenant setup, an
  agent may never create a human identity, independent of any permission
  grant it otherwise holds (consistent with L9's spirit applied to
  identity creation, not just trust ceilings). **Corrected during
  implementation** — the original draft said "a `service_account` or
  `agent_identity` credential," which directly contradicted §10's "POST
  restricted to PR-21 or COM-04 provisioning" (COM-04 authenticates as a
  `service` actor). Found writing the permission tests, fixed per D-31's
  precedent (a concrete mismatch found by tests is fixed as ordinary
  implementation-time correction) rather than re-opened as a question —
  see `/spec/decisions-taken.md`.
- PR-28 (Implementation Partner) attempting any identity action after the
  tenant leaves its provisioning window → 403, mirroring KRN-01's
  equivalent negative case.
- An impersonation session (`is_impersonation: true`) attempting
  `POST /api/v1/fin/*/post` (or any `action: post` per KRN-03-FR-001) →
  403 regardless of the impersonated user's own permissions
  (KRN-02-FR-003).
- Any non-PR-21 persona attempting `POST /api/v1/identity/impersonation/end`
  → 403, unconditionally, same as `/start` — §10 states both endpoints are
  "PR-21 only," but the original implementation only wired the check into
  `startImpersonation`; `endImpersonation` had no permission check at all.
  Found in the same D-33 sweep, fixed alongside it (see
  `/spec/decisions-taken.md`).
- A non-`service` actor (a `user` or `agent` credential) attempting to call
  `upgradeAgentVersion` (agent version increment) → rejected, mirroring
  `registerAgentIdentity`'s existing `service`-actor-only guard. §10 already
  said agent-identity *writes* generally are "restricted to INT-03/STU-07
  service accounts," but only the registration path enforced it —
  the version-upgrade path did not. Found in the same D-33 sweep.

## 12. Events emitted / consumed

**Emitted** (Vol 1, verbatim, plus extensions):
- `identity.user.created`
- `identity.user.activated`
- `identity.user.deactivated`
- `identity.session.started`
- `identity.session.revoked`
- `identity.session.timed_out`
- `identity.login.failed`
- `identity.login.locked_out`
- `identity.agent.registered`
- `identity.agent.version_changed`
- `identity.device.registered`
- `identity.device.revoked`
- `identity.service_account.credential_rotated`
- `identity.impersonation.started`
- `identity.impersonation.ended`

**Consumed:**
- `core.tenant.suspended`, `core.tenant.closed` (KRN-01) — on receipt, all
  active `session` records for that tenant are revoked and no new session
  may be started until the tenant returns to `active` (a suspended tenant
  cannot be logged into, which is the concrete mechanism behind
  KRN-01-FR-004's lifecycle guarantee reaching every actor, not just data
  writes).
- A future offboarding event from PPL-04 (Onboarding & Offboarding) is
  expected to trigger `user.status → deactivated` automatically, per Vol 0
  §24's claim that "access genuinely closes" on exit — **not yet
  consumable**: PPL-04 is not built and its event contract does not exist
  yet. Flagged in §17 rather than inventing an event name (L15).

## 13. Reports and KPIs

- Active session count and concurrent-user count, by `user_type`.
- Failed-login and lockout rate (security posture, feeds SEC-01/SEC-06).
- MFA enrolment coverage by persona and `user_type`.
- Agent identity roster: version, status, current trust ceiling (read-only
  mirror; the ceiling's *history* and promotion trail is INT-04's report,
  not this module's).
- Device registry health: stale (`last_seen_at` beyond threshold) vs
  active devices.
- Impersonation log summary — surfaced to SEC-06 as evidence, not as a
  KRN-02-native dashboard beyond a simple count.

No statutory reports originate in KRN-02 itself.

## 14. Compliance touchpoints

- Every mutation KRN-02 makes feeds KRN-10 (Audit & Immutable Log); the
  `actor` field on every record and event in the entire platform (Vol 2
  §1.2) resolves to an identity minted here, making KRN-02 the anchor for
  "who did this" across every other module's compliance story.
- SEC-02 (Multi-Factor Authentication) owns per-role step-up policy; KRN-02
  owns the mechanism SEC-02 invokes (§3).
- SEC-07 (Data Privacy & DPDP) — hard deletion of a `user`'s personal data
  happens only through SEC-07's process (Vol 2 §1.3); KRN-02 never hard-
  deletes on its own.
- CMP-06 (Regulated Records) — impersonation attribution (KRN-02-FR-003)
  and agent version attribution (KRN-02-DR-001) are the identity anchor a
  "validated audit trail" and "electronic records with meaning" require;
  neither is achievable without a real, non-erasable actor identity per
  action.
- CMP-07 (Electronic Signature) — signature-audit binding uses the
  authenticated actor identity established here as the party whose intent
  is being captured.
- No GST, e-invoicing, e-way bill or TDS touchpoint (L7 not applicable —
  KRN-02 performs no tax computation of any kind).

## 15. Offline behaviour

**Profile: `read`.** KRN-02 is not itself listed among Vol 0 §9.2's
offline-`full` modules, and correctly so — logging in for the first time
requires connectivity. What must work offline is *continuation*: a device
that has already established a `session` and cached its device-pairing may
keep operating within the session's declared timeouts while offline,
because the offline-`full` modules that depend on this (SCM-02, MFG-04,
MFG-06, SLS-10, DLV-05, DLV-07, PPL-05, OPS-10) cannot re-authenticate
mid-shift on a factory floor with no signal.

**Conflict policy:** server-authoritative on reconnect. If a session was
revoked centrally (bulk revoke, tenant suspension, a lost-device report)
while the device was offline, the device's cached session is honoured for
local capture but every record captured during the now-invalid window is
synced as **queued-for-review** rather than silently accepted or silently
discarded (Vol 0 §9.2's "conflicts a machine should not resolve") — the
records exist and are not lost, but a human confirms whether they should
post given the actor's status at capture time.

## 16. Acceptance criteria (Given/When/Then)

**KRN-02-FR-001 — multi-method authentication**
> Given a tenant configured with SAML SSO for its Google Workspace domain and email OTP as fallback
> When a user with a `login_id` in that domain attempts to authenticate
> Then they may complete authentication via the SAML assertion or, if SSO is unavailable, via an emailed OTP, and the resulting `session.auth_method_used` records which path was taken.

**KRN-02-FR-002 — session device binding and timeouts**
> Given a user logs in from a new mobile device with an idle timeout of 30 minutes and an absolute timeout of 12 hours configured for their `user_type`
> When the device is idle for 31 minutes
> Then the session transitions to `idle_timed_out` and re-authentication is required; separately, when PR-21 bulk-revokes all sessions for that user, every session across every device for that user ends immediately regardless of its individual idle state.

**KRN-02-FR-003 — impersonation is audited, banner-marked, never for posting**
> Given PR-21 starts an impersonation session as a support user to diagnose a reported issue
> When the impersonated session attempts to post a financial transaction (`P-06`)
> Then the write is rejected regardless of the target user's own permissions, every action taken during impersonation is attributed to both the impersonating admin and the impersonated user in KRN-10, and the UI displays a persistent impersonation banner for the session's duration.

**KRN-02-FR-004 — lockout and credential hygiene**
> Given a `login_id` with 4 consecutive failed attempts within the configured window
> When a 5th failed attempt occurs
> Then the account is locked for the configured cooldown with progressive delay applied to each prior attempt, the failure is recorded in `login_attempt` with no submitted credential value appearing anywhere in that record or in any log, and `identity.login.locked_out` is emitted.

**KRN-02-FR-005 — external portal users, same mechanism**
> Given a dealer (PR-23) with an `external` `user_type` and no internal role assignment
> When they authenticate via WEB-09 (Partner & Dealer Portal)
> Then they resolve through the identical `/api/v1/identity/auth/login` flow and `session` entity as an internal user, distinguished only by `user_type: external` and by the portal-restricted scope KRN-03 applies — no separate identity store is involved.

**KRN-02-FR-006 — service accounts and devices (addition)**
> Given a service account provisioned for an ITG-01 connector with a 90-day credential rotation policy
> When the rotation window elapses without manual rotation
> Then the credential is automatically rotated and the previous one invalidated after a declared grace overlap, with `identity.service_account.credential_rotated` emitted; separately, given a registered mobile device is marked lost, when it is revoked, then only the session bound to that device ends — the user's other active sessions and their password remain valid.

**KRN-02-DR-001 — agent identity attribution across versions (full form of Vol 1's sample)**
> Given agent identity `MFG-AG-05` at `agent_version: 3` has posted 20 job-work ageing escalations
> When the agent is upgraded to `agent_version: 4`
> Then every one of the 20 prior actions' recorded `actor` reference continues to read `{type: agent, id: MFG-AG-05, version: 3}` unchanged, `agent_identity.agent_version` now reads `4`, INT-04's trust-ladder agreement tracking for version 4 starts from an empty baseline, and `identity.agent.version_changed` is emitted carrying both version numbers.

**KRN-02-DR-002 — one identity substrate for external and internal actors (addition)**
> Given a customer (PR-22) authenticating on WEB-08 and an employee (PR-15) authenticating on the internal web app in the same tenant
> When both are queried by PR-21 in the user management screen
> Then both appear as `user` records in the same list, filterable by `user_type`, with no separate external-identity table, connector or reconciliation job required to keep them consistent with KRN-03's permission model.

## 17. Open questions

Flagged per Vol 6 §4/L13 — gaps in Vol 1's field-level detail that this
draft filled by reasonable extrapolation. They should be confirmed or
corrected before this Vol 3 file is treated as binding:

1. **`credential`, `session`, `service_account`, `device` and
   `login_attempt` field tables** (§4.1) are Vol 1's entities-owned list
   with no accompanying "key fields" for any of them except `user` and
   `agent_identity`. The fields proposed are a reasonable minimum
   consistent with the stated FRs, not a verbatim source.
2. **`user.status` and `agent_identity.status` enum values** are proposed
   (§4.1/§5), not given in Vol 1. Please confirm or amend, especially
   whether `user.status` needs an intermediate state for "invited, not yet
   activated" beyond `pending`.
3. **Whether an agent holds a `session` at all**, or whether its execution
   context is tracked entirely by INT-03 with KRN-02 supplying only the
   `credential_ref` it authenticates with. This draft assumes the latter
   (§11's permission matrix marks agent `session.read` as n/a) but INT-03's
   Vol 3 file should confirm this boundary explicitly so the two specs do
   not disagree about where an agent's execution identity is tracked.
4. **The KRN-02/INT-04 write boundary on `agent_identity.trust_ceiling`**
   (§3, §4.1) — Vol 1 lists `trust_ceiling` as a KRN-02 "key field" with no
   mention of INT-04, while Vol 0 L9/§27.3 makes clear only a governed
   process may change it. This draft treats KRN-02 as the field's system
   of record and INT-04 as its only writer via a governed API — confirm
   this is the intended split before INT-04's Vol 3 file is drafted.
5. **The KRN-02/SEC-02 boundary** on MFA (§3) — SEC-02 (per-role step-up
   enforcement policy) ships in Phase 8 (Vol 0 §39) while KRN-02 (the
   mechanism SEC-02 will govern) ships in Phase 0. This draft assumes
   KRN-02 must therefore carry a minimal, always-on MFA capability (e.g. a
   simple per-role or per-`user_type` toggle) as a Phase 0 stopgap ahead
   of SEC-02's arrival — confirm this is acceptable, or whether a Phase 0
   MFA policy mechanism should instead live inside KRN-02 permanently
   rather than being provisional.
6. **PPL-04's offboarding event** (§12) is referenced narratively — Vol 0
   §24 states PPL-04 touches KRN-02 to close access on exit — but PPL-04
   is not yet specified and no event name exists. This is intentionally
   left unresolved here rather than inventing an event ID (L15); it should
   be closed when PPL-04's Vol 3 file is drafted, and this file's §12
   updated to consume the real event name at that time.
7. **`agent_identity` write-endpoint restriction** (§10) — this draft
   assumes `POST /api/v1/identity/agent-identities` is callable only by
   INT-03/STU-07 service accounts, never by a general user, since a
   general user directly editing an agent's identity record would be a
   backdoor around L9's "an agent may never... grant permissions [or have
   its ceiling modified by anything but the governed process]" even though
   the *user* editing it, not the agent itself, is the one acting. Confirm
   this enforcement boundary before INT-03/STU-07 are built.
