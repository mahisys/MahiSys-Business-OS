# KRN-09 · Notification & Communication Hub

**Family:** Kernel · **Layer:** L0 · **SKU tier:** `included` · **Depends on:** KRN-02 (Identity & Authentication — actor resolution for inbound channels), KRN-03 (Access Control — permission enforcement on channel-executed actions), KRN-04 (Entity & Metadata Engine — template variable binding), KRN-05 (Process Engine — approvals granted in-thread), KRN-06 (Event Bus)

**Status:** DRAFT — expanded by the AI implementer from Vol 1 Part 2 (KRN-09)
per Vol 6 §4/L13, for human review and approval. Not binding until approved
(see §17).

---

## 1. Purpose and buyer

One routing layer for email, WhatsApp, SMS, push and in-app notification
(Vol 0 T9, §9.3). WhatsApp is a **bidirectional client** here, not a
marketing channel: session, identity and permission all resolve to the same
kernel objects as web (Vol 0 §9.3), so an approval sent as a notification can
be granted in the same thread and lands as an authenticated, audited action
(`KRN-09-DR-001`) — this is wow-catalogue item #4 (Vol 0 §28): "WhatsApp as
a full client — order, approve, dispatch, collect, in-thread."

Not bought directly — `included` platform-fee substrate (Vol 0 §11). Every
module that needs to reach a human (an approval request, a stockout alert, a
payment reminder, a delivery confirmation) is a buyer in the architectural
sense; nearly every registered agent (`FIN-AG-01`, `MFG-AG-05`, `SLS-AG-01`,
`OPS-AG-02`, `DLV-AG-02`, and more, Vol 0 §27.4) reaches its human escalation
path through KRN-09. The direct "user" of its admin surface is PR-21 for
channel configuration and provider credentials; PR-01/09/19/22/23 (Vol 0
§9.1's WhatsApp client personas) are the everyday conversational users.

## 2. Personas and their jobs

| Persona | Job |
|---|---|
| PR-21 System Administrator | Configures channel providers (WhatsApp BSP, SMS gateway, email domain), templates, throttle limits |
| PR-01 Owner / Director | Approves requests and receives the daily brief entirely inside WhatsApp (Vol 0 §9.3) |
| PR-09 Field Sales / Beat Rep | Captures orders from WhatsApp text/photo, receives dispatch/payment confirmations |
| PR-19 Employee | Marks attendance, requests leave, receives payslip notification — all over WhatsApp/app (PPL-14) |
| PR-22 Customer | Order status, payment reminder with UPI link, ticket raise/status, receives invoice |
| PR-23 Dealer / Distributor | Scheme notification, claim status, order confirmation over WhatsApp/portal |
| PR-24 Vendor | PO notification, ASN request, payment status |
| PR-11 Marketing Executive | Authors and schedules campaign sends (via MKT-02/03, which route through KRN-09) |
| PR-14 Support Agent | Receives inbound ticket messages routed to OPS-01 via KRN-09 ingestion |
| PR-16 Finance Controller / CFO | Sets tone/frequency ceilings for automated collections messaging (governs `FIN-AG-01`) |
| PR-04/05/07/13/20 floor and field personas | Receive voice-and-vernacular briefings and task notifications (INT-07 + KRN-09) |
| PR-29 Agent | Sends notifications and, at trust levels ≥ L2, drafts or sends channel-based approval requests within its declared scope |

## 3. Scope in / scope out

**In scope:** channel-agnostic notification routing (email, WhatsApp, SMS,
push, in-app); templates bound to entity data; per-user channel preference,
quiet hours, batching/digest; consent and opt-out ledger; inbound message
ingestion and conversational session management; resolving an inbound
message to an authenticated actor and executing the action it requests;
delivery tracking with retry and channel fallback; throttling.

**Out of scope:** campaign audience building, A/B testing, drip sequencing
and marketing-specific analytics (`MKT-01`, `MKT-02`, `MKT-03`, `MKT-09`,
`MKT-10` — these are Layer-2 applications that *consume* KRN-09 as their
send/delivery mechanism, they do not duplicate it); the underlying business
action a channel-triggered approval executes (owned by whichever module's
`P-07 Process` the approval belongs to — KRN-09 only resolves identity and
routes the instruction, `KRN-05` executes the transition); call recording
and IVR (`ITG-06` Telephony & CTI); the DPDP-wide consent/subject-request
workflow across all consent-bearing entities in the tenant, not only channel
consent (`SEC-07` — see §17.2 for the drawn boundary).

## 4. Entities owned; entities consumed

**Owned:** `notification_template`, `notification`, `channel_config`,
`delivery_record`, `preference`, `consent_record`, `inbound_message`,
`conversation_session`.

**Consumed (by ID):**
- `P-01 Party` — recipient/sender identity; `ContactChannel` (Vol 2 §1.4)
  supplies the phone/email/WhatsApp address resolved against.
- `user`, `agent_identity` (KRN-02) — the authenticated actor an inbound
  message resolves to (`KRN-09-DR-001`).
- `approval_request` (KRN-05) — the pending action a channel reply can
  grant or reject.
- `role`, `permission_grant` (KRN-03) — the resolved actor's action is
  checked against these before execution; KRN-09 never bypasses this (L11).
- `event` (KRN-06/P-08) — most notifications are triggered by a subscribed
  event (e.g. `fin.invoice.overdue` triggers a payment reminder).

## 5. State machines

**`notification.status`:** `queued → sent → delivered → read`, with
`sent/delivered → failed` on provider error and `failed → queued` as a
bounded automatic retry (`KRN-09-FR-005`); exhausting retries on the
preferred channel triggers the declared fallback chain (e.g. WhatsApp
delivery failure falls back to SMS) before the notification reaches a
terminal `failed` state.

**`conversation_session.status`:** `active → expired` (idle-timeout per
policy, `KRN-09-FR-003`) or `active → closed` (explicit end, e.g. an
approval was granted and the thread's purpose is fulfilled). `expired`/
`closed` are terminal; a new inbound message from the same channel identity
after expiry opens a new session rather than reviving the old one, so
context does not silently leak across unrelated conversations.

**`inbound_message.processed_status`:** `pending → resolved →
action_executed`, or `pending → rejected` (identity could not be resolved
with sufficient confidence, the resolved actor lacks permission for the
requested action, or the message is ambiguous). A `rejected` message never
executes an action — it prompts a clarifying reply or routes to a human,
consistent with KRN-09-DR-001's "authenticated action" requirement never
being satisfied by a guess.

**`print_template`-style `notification_template.status`:** `draft → active →
deprecated`, mirroring `KRN-08-FR-...` pattern for consistency across kernel
template-bearing entities (L12 — deprecation needs a sunset and successor).

## 6. Standard functional requirements

- `KRN-09-FR-001` Templates are channel-specific, localised, and variable-bound to entity data. *(Vol 1, verbatim)*
- `KRN-09-FR-002` Per-user channel preference, quiet hours, batching and digest are respected; statutory and safety notifications override quiet hours. *(Vol 1, verbatim)*
- `KRN-09-FR-003` Conversation sessions maintain context across turns and expire on policy. *(Vol 1, verbatim)*
- `KRN-09-FR-004` Consent and opt-out are recorded per channel per purpose and enforced before send (SEC-07). *(Vol 1, verbatim)*
- `KRN-09-FR-005` Delivery status is tracked per message with retry and fallback chains. *(Vol 1, verbatim)*
- `KRN-09-FR-006` *(addition)* Outbound WhatsApp template messages are pre-registered and provider-approved before use; an unapproved or session-expired template cannot be sent outside the WhatsApp Business 24-hour customer-service window — Vol 1's FR list does not mention WhatsApp Business API's own approval/session constraints, which are a hard external requirement for `KRN-09-DR-001` and for MKT-03 to function at all.
- `KRN-09-FR-007` *(addition)* In-app notifications persist with read/unread state in a per-user notification centre, independent of external channel delivery — Vol 0's standard-capability list for KRN-09 (§11) names "in-app" as one of the five channels but Vol 1's FR list only describes external-channel delivery tracking; this item covers the channel Vol 1's FRs otherwise leave undefined.
- `KRN-09-FR-008` *(addition)* Sending is throttled per channel and per tenant to respect provider rate limits and prevent a single bulk operation from starving transactional sends; a throttle breach degrades to queued delivery, never a dropped message — Vol 0 §11's standard-capability list for KRN-09 names "throttling" explicitly but Vol 1's FR list omits it.

## 7. Differentiating requirements

- `KRN-09-DR-001` Inbound WhatsApp messages resolve to an authenticated actor and can execute actions — an approval sent as a notification is granted in the same thread and lands as an authenticated, audited action. *(Vol 1, verbatim)*

## 8. Agents

None registered to KRN-09 itself. KRN-09 is the delivery and identity-
resolution substrate nearly every other agent uses to reach a human —
`FIN-AG-01` Collections Chaser, `MFG-AG-05` Job Work Ageing Watchdog,
`SLS-AG-01` Lead Response Watchdog, `OPS-AG-02` SLA Watchdog, `DLV-AG-02`
SLA Breach Watchdog, and others (Vol 0 §27.4) — but ownership of those
agents remains with their respective modules; KRN-09 exposes the send API
and the resolved-actor context they act within, and never itself decides
what to say or when.

## 9. Screens and flows

All screens are KRN-13-generated from KRN-04 metadata (L6). Standard views:

- **Channel Configuration** (WhatsApp BSP, SMS gateway, email domain,
  push credentials — via SEC-03 vault) — PR-21 only.
- **Notification Template Library** (per channel, per locale, variable
  bindings, WhatsApp Meta approval status) — PR-21; module owners propose
  templates for their own transactional notifications.
- **My Notification Preferences** (channel opt-in per category, quiet
  hours, digest frequency) — every internal and external persona,
  self-service.
- **Notification Centre** (in-app, read/unread) — every persona with an
  active session.
- **Consent Ledger** (per party, per channel, per purpose, opt-in/withdrawn
  history) — PR-21, PR-16/PR-17 (SEC-07 touchpoints).
- **Conversation Monitor** (active WhatsApp sessions, resolved actor,
  pending action, escalation to human) — PR-21, PR-14 (Support Agent, for
  OPS-01-routed threads).
- **Delivery Status Dashboard** (sent/delivered/failed by channel, fallback
  triggers) — PR-21.

## 10. API surface

Base per Vol 0 §42: `/api/v1/comms/{entity}`.

| Method | Path | Notes |
|---|---|---|
| CRUD | `/api/v1/comms/templates` | `notification_template`; write restricted to owning module + PR-21 |
| POST | `/api/v1/comms/send` | `{template_id, recipient_party_id\|user_id, channel?, variables}` — `channel` optional, resolves via `preference` if omitted |
| POST | `/api/v1/comms/inbound` | Webhook ingress per channel provider (ITG-01 pattern); not end-user-callable |
| GET | `/api/v1/comms/preferences` / `PATCH .../preferences/{user_id}` | Self-service, and PR-21 on behalf of a user |
| GET | `/api/v1/comms/delivery-status` | Filterable by `notification_id`, channel, date range, status |
| CRUD | `/api/v1/comms/consent` | `consent_record`; write requires SEC-07-aligned purpose declaration |
| GET | `/api/v1/comms/sessions/{id}` | `conversation_session` detail, for the Conversation Monitor |
| POST | `/api/v1/comms/sessions/{id}/hand-off` | Escalates an unresolved/ambiguous session to a human agent (PR-14 or the relevant approver) |

All list endpoints: cursor pagination, declared filters, field selection
(Vol 1 §1.2). All writes: idempotency key required.

## 11. Permission matrix by persona

Actions: `create`, `read`, `update`, `approve` (channel-executed action),
`export`.

| Persona | template.create/update | send.request | preference.update (own) | preference.update (others) | consent.read/manage | channel_config.manage | session.read/hand-off |
|---|---|---|---|---|---|---|---|
| PR-21 System Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PR-11 Marketing Executive | ✓ (marketing category only, via MKT-02/03) | ✓ (campaign sends, subject to consent gate) | ✓ | ✗ | ✓ (read only) | ✗ | ✗ |
| PR-16 CFO | ✗ | ✓ (collections tone/ceiling config, governs `FIN-AG-01`) | ✓ | ✗ | ✓ (read only) | ✗ | ✗ |
| PR-17 HR Manager | ✗ | ✓ (PPL notifications) | ✓ | ✓ (own team, DPDP-scoped) | ✓ (employee consent, read only) | ✗ | ✗ |
| PR-14 Support Agent | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ (own-queue sessions) |
| Any internal persona sending via their own module (e.g. PR-06 PO notification, PR-08 quote share) | ✗ (uses existing template) | ✓ (own module's transactional category only) | ✓ | ✗ | ✗ | ✗ | ✗ |
| PR-01/09/19/22/23/24 conversational personas | ✗ | ✗ (recipients/actors, not senders) | ✓ | ✗ | ✗ | ✗ | ✗ |
| PR-29 Agent | ✗ (uses pre-approved templates within trust scope) | ✓ (within its declared trust ceiling, INT-04) | ✗ | ✗ | ✗ | ✗ | ✗ |

**Negative cases:**
- PR-11 (Marketing) attempting to send a marketing message to a party with
  `consent_record.consent_given: false` for that channel/purpose → 403,
  rejected before send, logged (KRN-09-FR-004/SEC-07).
- An inbound WhatsApp reply resolving to a Party with no linked `user` or
  insufficient permission for the requested approval action (e.g. a dealer
  attempting to approve an internal discount override reserved for PR-08) →
  the action is rejected at the KRN-03 permission check (L11 — KRN-09 never
  substitutes its own judgement for the permission layer), the session is
  marked for human hand-off, and the rejection is audited in KRN-10.
- PR-14 (Support Agent) attempting `channel_config.manage` (provider
  credentials) → 403; only PR-21 manages channel infrastructure.
- Any agent (PR-29) attempting to send outside its registered trust ceiling
  or template scope → 403 at INT-04, per Vol 0 §27.3/L9 — KRN-09 enforces
  this at the send API boundary, not merely trusting the caller.

## 12. Events emitted / consumed

**Emitted** (Vol 1, verbatim, plus extensions):
- `comms.notification.sent`
- `comms.notification.delivered`
- `comms.notification.failed`
- `comms.inbound.received`
- `comms.action.executed_via_channel`
- `comms.template.activated` *(addition)*
- `comms.template.deprecated` *(addition)*
- `comms.consent.granted` *(addition)*
- `comms.consent.withdrawn` *(addition)*
- `comms.session.started` *(addition)*
- `comms.session.expired` *(addition)*
- `comms.session.handed_off` *(addition — feeds the Conversation Monitor and PR-14's queue)*

**Consumed:** every business event that a `notification_template` is bound
to trigger on (e.g. `fin.invoice.overdue` → `FIN-AG-01`'s reminder,
`mfg.job_work.aged_near_180d` → `MFG-AG-05`'s escalation,
`process.approval.requested` → the approval-notification that
`KRN-09-DR-001` allows to be answered in-thread); `access.role.revoked`
(KRN-03 — invalidates any in-flight `conversation_session` whose resolved
actor just lost the permission the pending action requires).

## 13. Reports and KPIs

- Delivery rate, read rate and fallback-trigger rate per channel
  (operational health, PR-21).
- Inbound resolution rate: percentage of inbound messages resolved to an
  authenticated actor vs. rejected/handed-off (directly measures
  `KRN-09-DR-001`'s reliability, surfaced to PR-21 and referenced by INT-04
  trust-ladder evidence for any agent whose escalation path runs through
  WhatsApp).
- Consent/opt-out counts per channel per purpose (SEC-07 evidence).
- Quiet-hours override count by category (statutory/safety vs. accidental
  override — an anomaly signal for INT-09).

## 14. Compliance touchpoints

- `KRN-09-FR-004` is the enforcement point for `SEC-07` (Data Privacy &
  DPDP) at send time: no message leaves without a recorded, unwithdrawn
  consent for that channel and purpose. KRN-09 owns `consent_record` and
  enforces it directly (see §17.2 for why this does not conflict with
  SEC-07's later, broader DPDP workflow).
- WhatsApp Business Policy (Meta) governs `KRN-09-FR-006` — template
  approval and the 24-hour session window are external platform rules
  KRN-09 must enforce technically, not merely document.
- Statutory and safety notifications overriding quiet hours
  (`KRN-09-FR-002`) covers, at minimum: OTP/security alerts (KRN-02), a
  recall communication (J-13), a statutory filing deadline reminder
  (CMP-05/PPL-09), and a payment-failure/mandate-lapse alert (FIN-05) — the
  category list itself is tenant/manifest-configurable but the override
  mechanism is a kernel guarantee.

## 15. Offline behaviour

**Profile: `online` for send/receive, with queue-on-reconnect for
originating events.** KRN-09 itself requires connectivity to dispatch or
ingest a message — there is no offline WhatsApp/SMS/email/push transport.
However, notifications triggered by an event captured offline (e.g. `MFG-04`
production logged offline on the shop floor, `SCM-02` stock movement
captured on a handheld scanner) are queued alongside that event's own sync
per the originating module's offline profile (Vol 0 §9.2) and dispatched
once the device reconnects — the notification never fires early on stale
data and never fires twice for the same synced event (idempotency key from
`KRN-06-FR-004`). The **Notification Centre** (in-app) is cached read-only
offline; new items appear on next sync.

## 16. Acceptance criteria (Given/When/Then)

**KRN-09-FR-001 — channel-specific, localised, variable-bound templates**
> Given a `notification_template` "payment_reminder" with an email variant and a WhatsApp variant, both bound to `{customer_name, amount_due, due_date}`
> When a reminder is sent to a customer with `preferred_language: hi`
> Then each channel renders its own layout with the customer's own values, in Hindi, and the two renders are not required to be structurally identical (email includes a full statement link; WhatsApp includes a UPI link) while carrying the same facts.

**KRN-09-FR-002 — preference, quiet hours, statutory override**
> Given user U-1 with quiet hours 21:00–08:00 IST and a marketing message queued at 22:00, and separately a statutory PF-challan-deadline reminder queued at 22:00
> When both are evaluated for send
> Then the marketing message is held until 08:00, and the statutory reminder sends immediately, both decisions logged with the reason.

**KRN-09-FR-003 — conversation session context and expiry**
> Given a WhatsApp session opened when PR-09 photographs a handwritten order, with follow-up questions asked by the system across three turns
> When PR-09 replies "yes" to the third turn's confirmation
> Then the reply is interpreted in the context of that specific session (not a generic keyword match), and if PR-09 replies "yes" again 6 hours later after the session's policy-defined idle timeout has passed, a new session opens rather than re-executing the stale confirmation.

**KRN-09-FR-004 — consent enforced before send**
> Given Party PA-2 with `consent_record{channel: whatsapp, purpose: marketing, consent_given: false}`
> When MKT-03 attempts to include PA-2 in a promotional broadcast
> Then the send is blocked for PA-2 specifically (other consenting recipients in the same broadcast are unaffected), and the block is logged with the consent basis.

**KRN-09-FR-005 — delivery tracking, retry, fallback**
> Given a WhatsApp send that fails delivery after 3 retries within its retry window
> When the fallback chain is configured as `whatsapp → sms`
> Then an SMS is automatically attempted with equivalent content, `delivery_record` shows both attempts with their outcomes, and the notification reaches `delivered` (via SMS) rather than terminal `failed`.

**KRN-09-FR-006 — WhatsApp template approval and session window**
> Given a marketing template not yet approved by the WhatsApp BSP, and a separate transactional template that is approved
> When MKT-03 attempts to send the unapproved template outside any active customer-service session
> Then the send is rejected before reaching the provider, while the approved transactional template sends normally regardless of session window state.

**KRN-09-FR-007 — persistent in-app notification centre**
> Given user U-2 offline for 3 days during which 12 in-app notifications were generated
> When U-2 opens the app
> Then all 12 appear with correct read/unread state, independent of whether any external channel (email/push) also fired for the same events, and marking one read does not affect the others.

**KRN-09-FR-008 — throttling degrades to queued, never dropped**
> Given a bulk campaign of 50,000 WhatsApp sends queued at once, exceeding the tenant's configured per-minute channel throttle
> When the campaign executes
> Then sends are queued and paced within the throttle limit, no message is silently dropped, and a concurrent transactional send (e.g. an OTP) from a different module is not delayed behind the bulk queue (transactional priority is preserved).

**KRN-09-DR-001 — inbound WhatsApp resolves to an authenticated actor and executes an action**
> Given an approval request for a 12% discount routed to Sales Head PR-08's WhatsApp as a notification carrying a pending `approval_request` reference
> When PR-08 replies "approve" in the same thread from their registered WhatsApp number
> Then the inbound message resolves to PR-08's `user` identity via their verified `ContactChannel`, KRN-03 confirms PR-08 holds discount-approval permission at that threshold, KRN-05's approval transition executes with PR-08 as the actor, `comms.action.executed_via_channel` and the underlying `process.approval.granted` events both emit, and the KRN-10 audit entry attributes the approval to PR-08 with `source: whatsapp` and a link to the originating conversation session — indistinguishable in audit weight from an approval granted on web.
>
> Given the same scenario but the reply comes from a phone number not linked to any registered actor
> When the message is processed
> Then no action executes, the `inbound_message.processed_status` is `rejected`, and the session is flagged for human hand-off with the unresolved sender's number visible for manual triage — the system never guesses an identity to honour an approval.
>
> Given a resolved, authenticated actor whose WhatsApp reply requests an action above their permission scope (e.g. a 25% discount when their ceiling is 15%)
> When the message is processed
> Then KRN-03 rejects the action despite successful identity resolution, the rejection is audited with both the resolved identity and the attempted scope, and the original approval request remains pending for a correctly-scoped approver — identity resolution and permission enforcement are never conflated (L11).

## 17. Open questions

Flagged per Vol 6 §4/L13 — gaps in Vol 1's field-level detail this draft
filled by reasonable extrapolation. Confirm or correct before this file is
binding:

1. **Field-level detail for all eight owned entities** (§4) is not given in
   Vol 1 beyond entity names and purpose. In particular the mechanism by
   which `inbound_message`/`conversation_session` track a *resolved actor*
   (`resolved_party_id`, `resolved_user_id`, `resolution_confidence` fields
   proposed in this draft) is inferred entirely from `KRN-09-DR-001`'s prose
   — no such fields are named in Vol 1 or Vol 2. Confirm whether a
   dedicated `channel_identity_link` entity (mapping a verified
   `ContactChannel` to a `user`/`agent_identity` once, rather than
   re-resolving per message) should exist instead, which would also make
   the resolution auditable as its own lifecycle rather than a per-message
   field.
2. **Scope boundary with `SEC-07` (Data Privacy & DPDP).** Vol 1's own
   `KRN-09-FR-004` text names SEC-07 for consent enforcement, yet SEC-07
   (Layer 2, Security family) is not in the Phase 0 kernel build (Vol 0
   §39) while KRN-09 is. Since `consent_record` is explicitly a
   KRN-09-owned entity per Vol 1, this draft assumes KRN-09 owns and
   enforces channel/purpose consent directly and independently of when
   SEC-07 is built, with SEC-07 (once built) providing the tenant-wide
   DPDP subject-request/anonymisation workflow *across* `consent_record`
   and every other consent-bearing entity in the platform, not owning
   channel consent itself. Confirm this reading resolves the apparent
   phase-order conflict rather than indicating KRN-09-FR-004 should be
   deferred until SEC-07 exists.
3. **WhatsApp Business Policy specifics** (`KRN-09-FR-006`, an addition) —
   this draft states the mechanism (approval + session window enforcement)
   but not implementation specifics (which BSP/provider, category
   taxonomy such as Meta's utility/marketing/authentication template
   classes). Needs confirmation once `ITG-01`/a WhatsApp BSP connector is
   selected, likely a Vol 5 (Cross-Cutting) integration detail rather than
   a KRN-09 field, flagged here so it is not silently assumed away.
4. **Statutory/safety override category list** (§14) — this draft names
   examples (OTP, recall, filing deadline, mandate lapse) but Vol 0/1 do
   not provide an exhaustive, authoritative list of which notification
   categories are permitted to override quiet hours. Recommend this become
   a platform-maintained (`sys`) reference list, similar to
   `KRN-12-DR-001`'s HSN/SAC pattern, confirmed before CMP-05/PPL-09 are
   drafted so both agree with KRN-09 on the category taxonomy.
