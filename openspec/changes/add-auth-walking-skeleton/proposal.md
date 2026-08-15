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

<!-- constitution-version: 1.0 -->
<!-- scope-tags: auth, tenancy, infra, testing -->
<!-- applicable-articles: I.1, I.2, III.1, III.2 -->

This change is governed by 4 constitutional articles per its declared scope tags. The author confirms
alignment with each by ticking the box and ensuring the proposal text satisfies the verification hint.

- [x] **[Article I.1](../../../docs/architecture/constitution.md#article-i-1) — Server-side authorization & family isolation**
  Verify: text references one of `server-side`, `backend auth/permission`, `family isolat/scope`.
  → All authorization is enforced **server-side**; family scope is resolved from the session on the
  backend and never from client input. Dedicated automated **family isolation** tests are a required
  deliverable of this change, not a follow-up.
- [x] **[Article I.2](../../../docs/architecture/constitution.md#article-i-2) — Transport & credential security**
  Verify: text references one of `TLS`, `HTTPS`, `hash`, `bcrypt`, `argon2`, `secure token`.
  → Passwords hashed with **argon2id**; only a **hash** of each session token is persisted; the token is
  held on-device in `expo-secure-store` (a **secure token** store); **HTTPS/TLS** is required for any
  non-local deployment and no secret is embedded in the mobile bundle.
- [x] **[Article III.1](../../../docs/architecture/constitution.md#article-iii-1) — Stack & runtime**
  Verify: text references one of `postgres`, `docker`, `expo`, `react native`.
  → **PostgreSQL** as system of record with reproducible migrations, **React Native**/**Expo** +
  TypeScript client, whole stack runs locally via **Docker** Compose.
- [x] **[Article III.2](../../../docs/architecture/constitution.md#article-iii-2) — Quality gates**
  Verify: text references one of `test`, `lint`.
  → Automated **tests** (unit, integration, isolation) plus **lint** and format configuration ship with
  this change; no secret is hardcoded in source.

*Articles II (AI Assistant Data Boundary), IV (Location Update Discipline), and V (Product Scope
Boundary) do not intersect the declared scope tags and are not cited here. This change introduces no AI
surface, no location handling, and nothing on the permanent non-goals list.*
