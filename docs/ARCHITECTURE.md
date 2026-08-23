---
status: seed
provenance: reconcile
seeded: 2026-08-15
---

# Architecture — FamilyHub (SEED)

> **Provisional.** Intended architecture, authored from intent before code exists. Key decisions are
> recorded **as assumptions**, not as established fact. Each section carries an `evidence:` marker.
> `orchestrate-documentation` grounds this against real code over time; `orchestrate-constitution`'s
> binding ADRs derive from the decisions captured here.

## Intended stack
<!-- evidence: partial -->
- **Mobile**: React Native + Expo + TypeScript. Cross-platform (iOS + Android) explicitly to avoid
  maintaining two separate native codebases. No web client required for MVP; a small admin/web interface
  is a possible later addition, not a v1 requirement.
- **Backend**: a REST API ("sufficient for the first version") on **Fastify + TypeScript** (Node.js).
  The framework was left open by the source and **decided in the walking-skeleton change**
  (`openspec/changes/add-auth-walking-skeleton/design.md`, issue #2) — chosen for its TypeScript-first
  API and per-route JSON Schema validation, over NestJS (heavier than a deliberately small project
  wants), Express (weaker TS story, no built-in validation), and Hono (thinner session ecosystem).
- **Database**: PostgreSQL, with reproducible migrations and FK/constraints enforcing invariants
  (multi-family, multi-member, shared resources, event participants, recurring activities, location
  sharing).
- **Infra**: Docker for backend + database; the whole setup runs and is reproducible locally.
- **Explicitly NOT using** (stated or implied by contrast): separate native iOS/Android codebases;
  GraphQL (REST is named directly); a NoSQL store (Postgres is named directly); a complex distributed
  synchronization framework "unless justified"; full WebSocket/realtime infrastructure in v1 (allowed
  later, not required now).
*(source: `project_idea/ideas.txt` §26, §28, §32–§34, §43)*

## High-level components & boundaries
<!-- evidence: intent-based -->
- **Mobile app** (React Native/Expo) — thin client; must never be trusted to enforce authorization; holds
  a local cache for offline use, shopping-first.
- **Backend REST API** — the system of record and sole enforcer of authorization; owns auth, family/
  member/invitation management, calendar/events, shopping lists/items, tasks, location shares,
  notifications.
- **Auth subsystem** — explicitly isolated from family/business logic, not entangled with it.
- **Database (PostgreSQL)** — multi-tenant; family-scoped isolation is enforced at the query/authorization
  layer, never assumed from application-level filtering alone.
- **Notification dispatcher** — cross-cutting; triggered by calendar reminders, task assignment/
  deadlines, shopping-list changes, and location events; must avoid over-notifying (batch, don't spam).
- *(Future, not MVP)* **Realtime layer** — WebSockets or an equivalent, added without rewriting the rest
  of the app.
- *(Future, not MVP)* **AI assistant layer** — natural-language access to calendar/tasks/shopping/
  location via a small set of controlled, pre-authorized **read-only tools**
  (`get_calendar_events`, `get_family_members`, `get_tasks`, `get_shopping_lists`,
  `get_member_location`) — **never** direct database access, and scoped strictly to what the
  authenticated user is already authorized to see.
*(source: §5, §13, §20–§21, §25, §28, §32, §40)*

## Key decisions (as assumptions / candidate ADRs)
<!-- evidence: partial -->
- **Decision:** Cross-platform mobile via React Native + Expo, not separate native apps. · **Rationale:**
  avoid maintaining two native codebases for one small team. · **Status:** assumed (candidate ADR).
- **Decision:** REST API, not GraphQL or another style. · **Rationale:** "sufficient for the first
  version"; keeps the surface simple. · **Status:** assumed (candidate ADR).
- **Decision:** PostgreSQL as the single system of record. · **Rationale:** relational integrity fits the
  multi-tenant family/shared-resource model; FK constraints enforce invariants the app must not violate
  silently. · **Status:** assumed (candidate ADR).
- **Decision:** All authorization is enforced **server-side**; the frontend is never trusted with it. ·
  **Rationale:** family-data isolation is a hard, repeatedly-stated security requirement — a frontend-only
  check would violate it. · **Status:** assumed (candidate ADR) — **strong candidate for a binding
  constitution article** given how forcefully and repeatedly the source states this.
- **Decision:** No realtime (WebSocket) infrastructure in MVP; the architecture must not preclude adding
  it later. · **Rationale:** avoid premature infrastructure complexity while shopping-list "close to
  real-time" collaboration is still deliverable via simpler means (e.g. polling/refresh). · **Status:**
  assumed (candidate ADR).
- **Decision:** Store only the *latest* known location per member, never a history, in MVP. ·
  **Rationale:** less sensitive data, less storage, simpler implementation, lower privacy risk, lower
  battery/network cost. · **Status:** assumed (candidate ADR) — the source itself frames this as an
  "initial instinct," not a firm decision; see Open Questions.
- **Decision:** Any future AI feature reads through a fixed set of pre-authorized, read-only tools only —
  never direct DB access — and neither location data nor family data is ever sent to or used to train an
  LLM. · **Rationale:** explicit, forcefully-stated privacy constraint, not a nice-to-have. · **Status:**
  assumed (candidate ADR) — worded closer to a firm constraint than the others; still routed through
  `orchestrate-constitution` for confirmation like the rest, given the AI feature itself is post-MVP.
- **Decision:** Offline support, if built for MVP at all, is scoped to shopping lists only, not the whole
  app. · **Rationale:** shopping is named as "the strongest offline use case" and keeps MVP bounded. ·
  **Status:** assumed (candidate ADR) — the source explicitly lists this as a 3-way undecided choice; see
  Open Questions.
- **Decision:** List mutations are designed **offline-ready without shipping offline**: every list
  resource carries `updated_at`; check-off is idempotent; conflict policy is last-write-wins on
  `updated_at` with delete-wins, over an optimistic UI. · **Rationale:** satisfies the "must not preclude
  offline/realtime" constraint at zero implementation cost now — the queue-and-replay client can be added
  later against unchanged API semantics. Imported from working prior art (patate,
  `github.com/Hundig1983/patate`, ARCHITECTURE §5.2–5.3), where exactly these semantics carried a
  SQLite offline queue. · **Status:** **decided (2026-08-23, j.levrat)**.

## Integration points
<!-- evidence: intent-based -->
- **Push notifications** — platform-level push, likely via Expo's notification APIs; provider/service
  unspecified.
- **Device location / GPS APIs** — the source explicitly wants the workflow to identify where
  Expo-managed location capabilities are sufficient vs. where bare/native configuration becomes
  necessary (background location in particular is a common Expo-managed limit).
- *(Future, not MVP)* **LLM/AI provider** — strictly behind the controlled read-only tool layer described
  above; provider unspecified, and out of scope until the AI assistant theme is picked up.
- **No third-party product integrations in MVP** — supermarket, bank, wearable, and smart-home
  integrations are explicitly out of scope (see `PRD.md` Non-goals).
*(source: §29, §34, §39, §40)*

## Assumptions
- ~~Backend runtime/framework is unconfirmed.~~ **Resolved** — Node.js + Fastify + TypeScript, decided
  and implemented in the walking-skeleton change (issue #2). Recorded here as a grounded fact rather
  than an assumption: the backend exists and runs on it.
- Expo-managed workflow is assumed sufficient for most of MVP; a "bare"/native-config escape hatch is
  assumed necessary later for background location and push — the source asks the workflow to pin down
  exactly where that line falls, which has not been done here.

## Open Questions
- Exact location update-frequency strategy (normal vs. battery-saving modes) — the source explicitly says
  this must not be hardcoded before understanding real platform capabilities.
- Where precisely Expo-managed capabilities are sufficient vs. where native configuration becomes
  required (background location, push).
- ~~Backend web framework choice.~~ **Answered**: Fastify (issue #2) — see Intended stack above.
- The eventual realtime mechanism (WebSockets vs. an alternative) once "close to real-time" collaboration
  needs it.
- Whether data should be encrypted at rest.
