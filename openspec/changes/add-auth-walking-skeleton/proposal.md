## Why

FamilyHub has canonical docs, a binding constitution (v1.0), and **zero code**. Nothing in
`openspec/specs/` describes real behavior yet, so every subsequent change would be a delta against
nothing — the spec-driven workflow has no substrate to operate on.

This change is the deliberate **walking skeleton**: the thinnest slice that carries one real user from
sign-up, through login, to an (empty) family dashboard, crossing every architectural layer exactly once
(PostgreSQL → REST API → Expo client → Docker). It is scoped by what it must *prove*, not by what it
must *deliver*: after it lands, `openspec/specs/` holds real capabilities, deltas become meaningful, and
every later change is an ordinary brownfield delta.

It also makes Article I.1 concrete rather than aspirational. Family-data isolation and server-side
authorization are the constitution's most forcefully-stated rules; this slice is where they first acquire
executable meaning and dedicated tests, before any feature depends on them.

## What Changes

- **Database schema + first migration** — `users`, `families`, `family_members`, `sessions`. Foreign keys
  and constraints enforce the multi-tenant invariants rather than leaving them to application code.
- **Backend REST API (Fastify + TypeScript)** — resolves the `ARCHITECTURE.md` open question "backend web
  framework choice — explicitly deferred to the architecture phase". The **auth subsystem is a separate
  module** from family/business logic, per `ARCHITECTURE.md`'s stated boundary.
- **`POST /auth/signup`** — creates a user, a family, and an owner `family_members` row in one
  transaction. Password stored via **argon2id**. Public, unauthenticated endpoint.
- **`POST /auth/login`** — verifies credentials and issues an **opaque session token**; only its hash is
  persisted. Public, unauthenticated endpoint.
- **`POST /auth/logout`** — revokes the current session server-side.
- **`GET /families/me/dashboard`** — authenticated, family-scoped read returning the caller's family and
  an explicitly empty set of feature sections. Every query is filtered by the caller's verified family
  membership, resolved **server-side** from the session — never from a client-supplied family id.
- **Expo / React Native client (TypeScript)** — Signup, Login, and Dashboard screens; session token held
  in `expo-secure-store`, never in plain `AsyncStorage`; no secret embedded in the bundle.
- **Docker Compose stack** — `api` + `postgres`, reproducible from a clean checkout with documented
  migration and seed commands.
- **Test suite** — unit, integration, and **dedicated family-isolation tests** proving that a member of
  family A cannot read family B's dashboard, plus linting and formatting configuration.

No **BREAKING** changes: this is the project's first executable code.

## Capabilities

### New Capabilities

- `user-auth`: account registration, credential verification, session issuance, session revocation, and
  the authentication of subsequent requests.
- `family-membership`: the family record, the member-to-family relation with roles, and the server-side
  resolution of a caller's family scope that all family-scoped reads depend on.
- `family-dashboard`: the authenticated, family-scoped dashboard read — the surface later feature work
  (calendar, tasks, shopping, location) attaches to.

### Modified Capabilities

*(none — no existing capabilities. `openspec/specs/` is empty.)*

## Impact

- **New code**: backend API, database schema and migrations, Expo client, Docker composition, test suite,
  lint/format configuration. There is no existing code to affect.
- **New dependencies**: Fastify, a PostgreSQL driver, a migration tool, an argon2 implementation, a test
  runner, ESLint + Prettier, `expo-secure-store`.
- **Decisions this change records** (each resolving an explicit open question, not inventing one):
  - Backend framework = **Fastify** — `ARCHITECTURE.md` deferred this to the architecture phase.
  - Session mechanism = **opaque server-side token**, not JWT — the docs were silent; chosen because
    resolving every request against a `sessions` row structurally forces the Article I.1 server-side
    check and makes revocation immediate.
  - Sign-up **auto-creates a family** with the registrant as its first parent/admin — the thinnest path
    to a meaningful dashboard. The `family_members` join table deliberately leaves the PRD's open
    question "can one user belong to several families?" answerable later without a schema rewrite.
- **Deliberately deferred** (named here so they are not mistaken for oversights): password reset, member
  invitations, child accounts, account deletion, refresh-token rotation, and all four feature pillars.

## Constitutional Alignment

<!-- constitution-version: 1.1 -->
<!-- scope-tags: auth, tenancy, infra, testing -->
<!-- applicable-articles: I.1, I.2, III.1, III.2 -->
<!-- alignment-verified-against-diff: 2026-08-15, task 8.5 -->

This change is governed by 4 constitutional articles per its declared scope tags. The author confirms
alignment with each by ticking the box and ensuring the proposal text satisfies the verification hint.

> **Verified against the merged diff (task 8.5), not against intent.** Each article below carries a
> `Evidence:` line recording what the code actually shows. Ticks were originally made at authoring time;
> this pass re-checked every one. The constitution moved v1.0 → v1.1 during this change; no article ID
> moved, so the citations above remain valid.

- [x] **[Article I.1](../../../docs/architecture/constitution.md#article-i-1) — Server-side authorization & family isolation**
  Verify: text references one of `server-side`, `backend auth/permission`, `family isolat/scope`.
  → All authorization is enforced **server-side**; family scope is resolved from the session on the
  backend and never from client input. Dedicated automated **family isolation** tests are a required
  deliverable of this change, not a follow-up.
  **Evidence:** `backend/src/http/auth-guard.ts` + `backend/src/family/scope.ts` resolve scope from the
  session; `backend/src/http/routes/families.ts:39` rejects a mismatched family id with 403 rather than
  silently serving the caller's own. `tests/integration/family-isolation.test.ts` (6 tests) plus task 6.7
  confirm the tests fail when scoping is removed. Client-side, `client/src/family/api.ts` calls only
  `/families/me/dashboard` and never sends a client-held family id.
- [x] **[Article I.2](../../../docs/architecture/constitution.md#article-i-2) — Transport & credential security**
  Verify: text references one of `TLS`, `HTTPS`, `hash`, `bcrypt`, `argon2`, `secure token`.
  → Passwords hashed with **argon2id**; only a **hash** of each session token is persisted; the token is
  held on-device in `expo-secure-store` (a **secure token** store); **HTTPS/TLS** is required for any
  non-local deployment and no secret is embedded in the mobile bundle.
  **Evidence:** `backend/src/auth/password.ts` (argon2id via `@node-rs/argon2`);
  `backend/src/auth/tokens.ts` persists only a SHA-256 hash; `client/src/auth/storage.ts` uses
  `expo-secure-store` on native. `client/src/config.ts` carries only a URL — no credential.
  **Partial:** on **web** there is no platform secure store, so the token is held in memory only (lost on
  reload) rather than in `localStorage`, which would be the "plain storage" this article forbids —
  strictly more conservative, and documented in the README. **The TLS clause is unexercised**: nothing is
  deployed, so no transport configuration exists in the diff to verify.
- [ ] **[Article III.1](../../../docs/architecture/constitution.md#article-iii-1) — Stack & runtime**
  Verify: text references one of `postgres`, `docker`, `expo`, `react native`.
  → **PostgreSQL** as system of record with reproducible migrations, **React Native**/**Expo** +
  TypeScript client, whole stack runs locally via **Docker** Compose.
  **Evidence — partial, so deliberately left unticked.** Verified: PostgreSQL 17 as system of record
  with a reproducible numbered migration (`backend/src/db/migrations.ts`, `001_initial`), and a
  React Native + Expo + TypeScript client (`client/`, Expo SDK 57), running end-to-end against the API.
  **Not verified: "the whole stack runs locally via Docker Compose."** No container runtime was available
  in this environment, so `docker-compose.yml` has still never been executed. A verified alternative
  local path exists (`npm run db:dev`, backed by `embedded-postgres`) and is what the README recommends,
  but it is not the Compose claim this article's text makes. **Task 8.1 is exactly this verification and
  remains open — this box should be ticked by whoever completes it, not before.**
- [x] **[Article III.2](../../../docs/architecture/constitution.md#article-iii-2) — Quality gates**
  Verify: text references one of `test`, `lint`.
  → Automated **tests** (unit, integration, isolation) plus **lint** and format configuration ship with
  this change; no secret is hardcoded in source.
  **Evidence:** `backend` — 51 tests passing across 7 files (unit, integration, family isolation),
  `npm run lint` and `npm run typecheck` clean. `client` — `npm run lint` and `npm run typecheck` clean,
  with `client/eslint.config.mjs` mirroring the backend's module-boundary rule (verified to actually fire
  on a deliberate violation, not merely configured). No credential appears in either package's source;
  the only committed values are the placeholders in `*.env.example`.

*Articles II (AI Assistant Data Boundary), IV (Location Update Discipline), and V (Product Scope
Boundary) do not intersect the declared scope tags and are not cited here. This change introduces no AI
surface, no location handling, and nothing on the permanent non-goals list.*
