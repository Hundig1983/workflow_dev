<!-- Version: 1.0 | Date: 2026-08-15 | Author: orchestrate-constitution -->
<!-- Changes: v1.0 — initial derive from docs/PRD/PRD.md and docs/ARCHITECTURE.md (both status: seed) -->

# Project Constitution — FamilyHub

> **What this is**: Binding rules consulted before drafting specs, opening
> issues, or shipping code. Derived from PRD constraints, ADRs, AI_DECISIONS,
> and explicitly-promoted memory entries.
>
> **Machine interface**: All consumers MUST read `constitution.manifest.json`,
> not parse this markdown. Stable HTML anchors are provided for human
> URL deep-linking only.
>
> **Append-only**: Articles are never deleted. Status transitions are
> `binding → superseded by <ID>` or `binding → withdrawn (with reason)`.
>
> **Hard cap**: ≤12 binding articles. New rules coalesce into existing
> articles as new sections before exceeding the cap.
>
> **Source status note**: every article below derives from `docs/PRD/PRD.md`
> and `docs/ARCHITECTURE.md`, both still carrying `status: seed` (authored by
> `/project-seed` before any code exists). These are the sources'
> best-available intent, not code-grounded fact — `orchestrate-documentation`
> grounds them against real code as it lands.

## Stewardship

- **Steward**: jacques
- **Adoption review**: 2026-11-13 (+90 days from initial derive)
- **Promotion ledger**: see `promotions.log.md`
- **Coverage report**: see `coverage-report.md`

---

## Index

| Article | Title | Status | Scope tags |
|---|---|---|---|
| [I](#article-i) | Data & Access Security | binding | `auth`, `tenancy`, `privacy` |
| [II](#article-ii) | AI Assistant Data Boundary | binding | `ai-safety`, `privacy` |
| [III](#article-iii) | Technical Baseline | binding | `infra`, `docs`, `testing` |
| [IV](#article-iv) | Location Update Discipline | binding | `business-logic` |
| [V](#article-v) | Product Scope Boundary | binding | `business-logic` |

---

## Article I — Data & Access Security {#article-i}

**Scope tags**: `auth`, `tenancy`, `privacy`
**Status**: binding
**Promoted**: 2026-08-15 from `prd-constraint-security-privacy`, `arch-key-decisions-auth`

### Section I.1 — Server-side authorization & family isolation {#article-i-1}

**Rule**: All authorization MUST be enforced server-side; the frontend is never trusted to enforce permissions. Every family-scoped resource MUST be checked against the authenticated user's family membership, backed by dedicated automated tests.

**Sources**:
- prd-constraint: `docs/PRD/PRD.md` §Constraints (sha256: `eeb65e37…`)
- arch-binding-block: `docs/ARCHITECTURE.md` §Key decisions (sha256: `f7902afe…`)

**Verification**:
- Applies when: spec carries any scope tag in `[auth, tenancy, rbac]`
- Must satisfy:
  - citation: `Article I`
  - text-presence: `server-side|backend.{0,20}(auth|permission)|family.{0,20}(isolat|scope)`

**Violation example**: checking permissions only in the mobile app's UI layer, or a database query that doesn't filter by family membership.

**Provenance**: promoted 2026-08-15 by jacques. Corroborated independently at both PRD-constraint and ARCHITECTURE-decision level — the source document repeatedly and forcefully states this as non-negotiable.

---

### Section I.2 — Transport & credential security {#article-i-2}

**Rule**: All data in transit MUST use HTTPS/TLS. Passwords MUST be stored using a secure password-hashing algorithm. No secret MAY be embedded in the mobile application. Session/auth tokens MUST be stored securely on-device.

**Sources**:
- prd-constraint: `docs/PRD/PRD.md` §Constraints (sha256: `eeb65e37…`)

**Verification**:
- Applies when: spec carries any scope tag in `[auth, privacy, infra]`
- Must satisfy:
  - citation: `Article I`
  - text-presence: `TLS|HTTPS|hash|bcrypt|argon2|secure.{0,20}token`

**Violation example**: storing a plaintext password, or embedding an API key directly in the mobile bundle.

**Provenance**: promoted 2026-08-15 by jacques. HALT 2 — BINDING.

---

### Section I.3 — Data retention & deletion {#article-i-3}

**Rule**: Location and family-data retention MUST be minimized. Users MUST have a functioning account and family-data deletion mechanism.

**Sources**:
- prd-constraint: `docs/PRD/PRD.md` §Constraints (sha256: `eeb65e37…`)

**Verification**:
- Applies when: spec carries any scope tag in `[privacy]`
- Must satisfy:
  - citation: `Article I`
  - text-presence: `delet|retention|minimal`

**Violation example**: no account-deletion endpoint, or persisting full location history with no stated retention limit.

**Provenance**: promoted 2026-08-15 by jacques. HALT 2 — BINDING. Note: the *specific* retention policy (latest-location-only, no history) is still an open question — see Article-adjacent candidate appendix entry and `docs/PRD/PRD.md` Open Questions.

---

## Article II — AI Assistant Data Boundary {#article-ii}

**Scope tags**: `ai-safety`, `privacy`
**Status**: binding
**Promoted**: 2026-08-15 from `prd-constraint-ai-guardrail`, `arch-key-decisions-ai`

### Section II.1 — Read-only, tool-mediated access only {#article-ii-1}

**Rule**: Any AI assistant feature MUST access application data only through a fixed set of pre-authorized, read-only tools, scoped to what the authenticated user is already authorized to see. Direct database access by an AI component is forbidden.

**Sources**:
- arch-binding-block: `docs/ARCHITECTURE.md` §Key decisions (sha256: `f7902afe…`)

**Verification**:
- Applies when: spec carries scope tag `ai-safety`
- Must satisfy:
  - citation: `Article II`
  - text-presence: `read-only|pre-authorized tool|no direct.{0,20}(db|database)`

**Violation example**: an AI feature querying the database directly instead of going through a defined, scoped tool.

**Provenance**: promoted 2026-08-15 by jacques. HALT 3 (ARCH) — YES.

---

### Section II.2 — No location-to-LLM, no training on family data {#article-ii-2}

**Rule**: Location data MUST NOT be sent to an LLM. Family data MUST NOT be used to train AI models.

**Sources**:
- prd-constraint: `docs/PRD/PRD.md` §Constraints (sha256: `eeb65e37…`)
- arch-binding-block: `docs/ARCHITECTURE.md` §Key decisions (sha256: `f7902afe…`)

**Verification**:
- Applies when: spec carries scope tag `ai-safety`
- Must satisfy:
  - citation: `Article II`
  - text-presence: `not.{0,20}(train|training)|no location.{0,20}(llm|model)`

**Violation example**: sending raw GPS coordinates as part of a prompt to an LLM provider, or including family records in a fine-tuning dataset.

**Provenance**: promoted 2026-08-15 by jacques. Corroborated at both PRD and ARCHITECTURE level — stated more forcefully than any other candidate this run.

---

## Article III — Technical Baseline {#article-iii}

**Scope tags**: `infra`, `docs`, `testing`
**Status**: binding
**Promoted**: 2026-08-15 from `prd-constraint-technical-baseline`

### Section III.1 — Stack & runtime {#article-iii-1}

**Rule**: The backend runs as a REST API with PostgreSQL as the system of record, using reproducible database migrations. The mobile client is React Native, Expo, and TypeScript. The whole stack MUST run locally via Docker with a reproducible setup.

**Sources**:
- prd-constraint: `docs/PRD/PRD.md` §Constraints (sha256: `eeb65e37…`)

**Verification**:
- Applies when: spec carries scope tag `infra`
- Must satisfy:
  - citation: `Article III`
  - text-presence: `postgres|docker|expo|react native`

**Violation example**: introducing a second datastore, or a native-only (non-Expo) mobile codebase, without a superseding article.

**Provenance**: promoted 2026-08-15 by jacques. HALT 2 — BINDING.

---

### Section III.2 — Quality gates {#article-iii-2}

**Rule**: Automated tests, linting, and formatting are required on every change. No secret MAY be hardcoded in source.

**Sources**:
- prd-constraint: `docs/PRD/PRD.md` §Constraints (sha256: `eeb65e37…`)

**Verification**:
- Applies when: spec carries any scope tag in `[testing, docs]`
- Must satisfy:
  - citation: `Article III`
  - text-presence: `test|lint`

**Violation example**: merging a new endpoint with zero test coverage.

**Provenance**: promoted 2026-08-15 by jacques. HALT 2 — BINDING.

---

## Article IV — Location Update Discipline {#article-iv}

**Scope tags**: `business-logic`
**Status**: binding
**Promoted**: 2026-08-15 from `prd-constraint-battery`

### Section IV.1 — No continuous GPS polling {#article-iv-1}

**Rule**: Location sharing MUST NOT poll GPS continuously (e.g. every few seconds). Update frequency MUST use a configurable strategy (e.g. normal / battery-saving) rather than a single hardcoded interval.

**Sources**:
- prd-constraint: `docs/PRD/PRD.md` §Constraints (sha256: `eeb65e37…`)

**Verification**:
- Applies when: spec carries scope tag `business-logic` AND concerns location
- Must satisfy:
  - citation: `Article IV`
  - text-presence: `battery|interval|frequency|configurable`

**Violation example**: polling GPS every few seconds regardless of battery mode, or a hardcoded fixed interval with no battery-saving path.

**Provenance**: promoted 2026-08-15 by jacques. HALT 2 — BINDING. Note: the *exact* update-frequency values are an open question (see `docs/ARCHITECTURE.md` Open Questions) — this article binds the discipline, not the specific numbers.

---

## Article V — Product Scope Boundary {#article-v}

**Scope tags**: `business-logic`
**Status**: binding
**Promoted**: 2026-08-15 from `prd-oos-permanent`

### Section V.1 — Permanent non-goals {#article-v-1}

**Rule**: The following are out of scope for this product and MUST NOT be built without a constitution amendment: chat, messaging, video calls, social features, public profiles, advanced parental controls, image recognition, shopping recommendations, third-party supermarket/bank/wearable/smart-home integrations, complex subscription/billing, multi-language support, sophisticated analytics.

**Sources**:
- prd-out-of-scope: `docs/PRD/PRD.md` §Non-goals (sha256: `eeb65e37…`)

**Verification**:
- Applies when: spec carries scope tag `business-logic`
- Must satisfy:
  - citation: `Article V`
  - text-presence: `out of scope|non-goal`

**Violation example**: shipping a chat or social-feed feature without first amending this article at HALT 1/2.

**Provenance**: promoted 2026-08-15 by jacques. HALT 2 — BINDING. Distinct from the *deferred* non-goals (geofencing, AI assistant, location history, full offline sync, advanced recurrence) — those stayed in the candidate appendix as future, not permanent, exclusions.

---

## Candidate appendix (not yet binding)

These five did not promote this run — kept for a future derive, not discarded. See `constitution.manifest.json` `candidates[]` for the machine record.

- **Scope discipline** (`prd-constraint-scope-discipline`) — "stay small, this project is a workflow benchmark." Project philosophy, not a verifiable code rule.
- **Deferred non-goals** (`prd-oos-deferred`) — geofencing, AI assistant, location history, full offline sync, advanced recurrence. Roadmap timing, not a hard rule; may promote once a target version is decided.
- **PostgreSQL invariants** (`arch-key-decisions-postgres`) — FK constraints must enforce invariants. Borderline; kept aspirational pending real schema work.
- **No realtime infra in MVP** (`arch-key-decisions-realtime`) — architectural guidance, not an easily code-verifiable invariant yet.
- **Location: latest-only, never history** (`arch-key-decisions-location`) — the source itself calls this an "initial instinct," and it's also an open PRD question. Should not bind until confirmed.
