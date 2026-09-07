# Decisions taken during build — for human review

Format: date, decision ID (where applicable), decision, reasoning, who decided.

---

## D-11 — Book of record

**Decision:** Mirror mode first. Tally remains authoritative for a defined
period; the OS runs alongside with daily reconciliation reporting (Vol 0
§38). Cutover to OS-as-book-of-record happens once the owner is confident,
not on a fixed date.

**Reasoning:** Lower risk for the pilot and for early FIN development — the
migration acceptance tests (opening trial balance, stock valuation, ageing,
GST return reproduction — Vol 0 §38) get to prove out against a live parallel
run before anything depends on the OS being correct.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** Migration design (KRN + ITG-02 Tally Bridge), FIN-01..08 scope
when built in Phase 3, sales/onboarding narrative (COM-05).

---

## D-12 — Technology stack

**Decision:** Adopt Vol 1 §1.1's recommendation as-is, layered onto GCP:

- **Datastore:** PostgreSQL 16+ (GCP Cloud SQL, migrating to AlloyDB if scale
  demands) — JSONB for `tnt` extensions, native RLS for T11, `pgvector` for
  INT-01.
- **Language:** TypeScript, Node 22+, across API and workers.
- **Data access:** Query builder (Kysely or Drizzle), not a full ORM.
- **Queue/jobs:** Postgres-backed (pgmq or River) at Phase 0; revisit only if
  volume demands a dedicated broker.
- **Cache:** Redis (GCP Memorystore).
- **Object storage:** S3-compatible interface over GCS.
- **Search:** Postgres FTS + pgvector; no separate search cluster at Phase 0.
- **Web frontend:** React + a metadata-driven renderer (KRN-04/KRN-13 render
  screens from entity/layout metadata — L6; no hand-built forms).
- **Mobile (iOS + Android):** React Native, sharing TypeScript logic, API
  client and design tokens with the web renderer; offline store required
  (KRN-16).
- **Infra:** Cloud Run for API/web, Cloud Build/GitHub Actions for CI/CD,
  Cloud SQL, Memorystore, GCS, Cloud CDN.

**Reasoning:** Matches the stack independently recommended earlier in this
engagement before Vol 1-2 were supplied, and matches Vol 1 §1.1's own
reasoning: one datastore to operate rather than four, one language end to
end, capacity is the binding constraint (Vol 0 §40) not architecture novelty.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** All of Vol 1 (per Vol 0's own gating text); every
`[stack-bound]` section in Vol 1.

---

## D-13 — Deployment model

**Decision:** Pure SaaS only for now. On-prem/dedicated-instance support is
deferred until a regulated-vertical customer (BFSI/Pharma, Phase III per
Vol 0 §31) actually requires it.

**Reasoning:** KRN-01's isolation tiers (row / schema / dedicated instance)
already give strong per-tenant isolation on GCP-hosted infrastructure without
true on-prem deployment. Building on-prem/local-model support into INT-12 and
kernel packaging now would add real complexity for a Phase III need, against
Vol 0 §40's explicit depth-over-breadth guidance.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** Kernel packaging, INT-12 (Model Gateway) design.

---

## D-14 — Ordder.io and Karyaflo

**Decision:** Deferred. Not relevant to current build scope.

**Reasoning:** Neither product is described anywhere in Vol 0, 1 or 2, and
the human confirmed it does not need resolving now. Does not block Phase 0
kernel work (only blocks product boundary/roadmap/brand decisions per Vol 0
§43.2).

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion.

**Revisit:** Before any work that would touch Ordder.io/Karyaflo integration,
product boundary, or brand positioning relative to them.

---

## D-15 — Billing metric

**Decision:** Seats by user type — full / light / self-service / external,
per Vol 0 §33.4.

**Reasoning:** This pricing structure is already fully designed in Vol 0 and
maps directly onto the persona model (PR-01..30). Simplest to implement in
KRN-20 and avoids under-pricing floor/field roles (self-service is free above
a threshold; light/external priced differently from full seats), consistent
with Vol 0 §33.3's rule against billing on self-reported metrics.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Affects:** COM-03 (Pricing & Quote Engine), KRN-20 (Licensing &
Entitlement).

---

## D-16 — AI unit economics (§29.3 calculation)

**Decision:** Deferred. This is a calculation, not a decision, and requires
pricing targets (target gross margin, target Indian SMB price point) that
have not yet been supplied. Does not block Phase 0 kernel work — it only
gates the pricing model (§33) and the Intelligence tier boundary, both
downstream of Phase 2 (Intelligence) and later Commerce work.

**Reasoning:** Cannot be computed responsibly without target margin/price
inputs; guessing them would produce a number that looks authoritative but
isn't grounded, which is worse than not having one yet.

**Decided by:** Carried forward from Vol 0 §29.3 (not yet closed); flagged
2026-09-07.

**Revisit:** Before Phase 2 (Intelligence) pricing work or Commerce (COM-03)
work begins — request target gross margin and target price point from the
human at that point, then compute against Claude API / Vertex AI pricing.

---

## D-17 — Partner strategy timing

**Decision:** Deferred — decide later, when Phase 2 Commerce planning starts.

**Reasoning:** Only blocks COM-06 (Partner & Reseller Channel) and the
manifest certification model, both well downstream of Phase 0 kernel work
(Vol 0 §39 places COM-01..06 from Phase 2 onward; STU-08 itself is a Phase 1
add-on). No need to force this decision now.

**Decided by:** Human (project owner), 2026-09-07, via AskUserQuestion,
accepting the recommended default.

**Revisit:** At Phase 2 Commerce planning.

---

## Summary

All of D-11 through D-17 are now closed or explicitly, deliberately deferred
with a stated revisit trigger, per Q-002 in `/spec/questions.md`. Per Vol 0's
closing line and Vol 6 §11, Vol 1 (Kernel SRS) and the pilot slice gate are
therefore unblocked. Phase 0 (Kernel: KRN-01..14, CMP-01..04, ITG-01 per
Vol 0 §39) may begin, subject to the separate blocker raised in Q-003
(missing Vol 3 module SRS files with full acceptance criteria — required by
Vol 6 L13 before any code is written).
