## Context

See `proposal.md` — Why. The constraints that actually shape this design:

- **The repository has no code.** There is no existing pattern to match, so every choice here becomes the
  project's default by precedent. That argues for the smallest defensible option in each case, not the
  most capable one.
- **Constitution v1.0 is binding.** Article III.1 fixes PostgreSQL, reproducible migrations, React
  Native/Expo/TypeScript, and a locally reproducible Docker stack. Article I.1 requires server-side
  authorization with family isolation backed by dedicated tests. These are not design choices; they are
  inputs.
- **`ARCHITECTURE.md` left the backend framework explicitly undecided** and named one structural boundary
  that matters here: the auth subsystem must be isolated from family/business logic.
- **The PRD carries 30 unresolved open questions.** This design must avoid silently answering any of them
  beyond the three the walking skeleton genuinely cannot proceed without.

## Goals / Non-Goals

**Goals:**

- Establish one vertical seam through every layer — migration → data access → HTTP route → client screen —
  that later work can copy rather than re-invent.
- Make family isolation structurally hard to bypass, so that omitting it in future work is a visible
  deviation rather than an easy oversight.
- Keep the dependency surface small enough that the whole stack is comprehensible in one sitting.

**Non-Goals:**

- A general authorization framework. Two roles exist (`parent`, `child`); only the parent path is
  exercised here. The PRD is explicit that a sophisticated permission system is not wanted yet.
- Production deployment concerns — scaling, observability, secret management beyond "not hardcoded".
  Article III.1 scopes the stack to running locally.
- Answering PRD open questions that this slice does not touch (multi-family membership, child accounts,
  invitations, retention policy).

## Decisions

### Backend framework: Fastify

**Why:** TypeScript-first with per-route JSON Schema validation built in, so request validation is
declared at the route boundary rather than hand-rolled. Small enough to keep the PRD's "favor staying
small and coherent" constraint honest.

**Alternatives considered:** *NestJS* — its module system would enforce the auth/business-logic boundary
structurally rather than by convention, which is genuinely attractive here, but it brings a DI framework
and substantial scaffolding to a project deliberately scoped small. *Express* — the most familiar option,
but weaker TypeScript ergonomics and no built-in validation, so it would need the same schema layer added
by hand. *Hono* — smallest and most modern, but the thinnest ecosystem for session middleware, which is
the one area where this change would rather borrow than build.

**Consequence:** this resolves an `ARCHITECTURE.md` open question. It should be reflected back into
`ARCHITECTURE.md` when this change archives, so the seed doc stops claiming the framework is undecided.

### Sessions: opaque server-side token, not JWT

**Why:** every authenticated request must resolve the token against a `sessions` row, which means the
Article I.1 server-side check happens on the natural path rather than as an added discipline. Revocation
is immediate, there are no signing keys to manage, and there is no refresh-rotation protocol to get
subtly wrong. Only the token's hash is stored, so a database read does not yield usable credentials.

**Alternatives considered:** *JWT with refresh tokens* — the mainstream choice and stateless to verify,
but it invites trusting embedded claims instead of re-checking membership server-side, which is exactly
the failure mode Article I.1 exists to prevent; revocation would need a denylist that reintroduces the
database lookup anyway. *Short-lived JWT with no refresh* — simplest to build, but forces re-login on
expiry, which is poor on mobile.

**Trade-off accepted:** one database read per authenticated request. At this product's scale that is
irrelevant, and it can be cached later without changing the contract.

### Registration creates a family atomically

**Why:** the dashboard is meaningless without a family, and requiring a separate creation step would add a
second screen to a slice whose purpose is to be thin. Doing both in one transaction also exercises
transactional integrity in the very first code written.

**Alternatives considered:** *separate explicit family-creation step* — cleaner separation of auth from
family logic and closer to the eventual invitation flow, but it adds a screen and a flow for no additional
proof. *Invitation-token-gated signup* — most faithful to the eventual model, but requires building
invitations, which is well outside a walking skeleton.

**What this deliberately does not decide:** the `family_members` join table is a genuine many-to-many
relation even though only one family per user is created today. The PRD's open question "can one user
belong to several families?" therefore stays open and answerable without a schema rewrite.

### Family scope resolution lives in one place

The caller's family is resolved from the session in a single shared accessor, and family-scoped queries
take that resolved scope as a required argument rather than reading a client-supplied identifier. The
point is that writing a family-scoped query *without* a scope should not typecheck or should fail
loudly — isolation enforced by construction, not by reviewer vigilance.

### Auth module boundary

Per `ARCHITECTURE.md`, authentication (credentials, sessions, token verification) lives in its own module
that knows nothing about families, calendars, or tasks. Family membership consumes the authenticated
account identity; the auth module never imports family logic. Enforced by convention here, with the
module layout making violations visible in review.

## Risks / Trade-offs

- **Precedent risk — every choice here becomes the project's default.** → Each decision above records its
  alternatives and rationale, so a later change can revisit one without re-litigating the whole design.
- **Opaque sessions add a database read per request.** → Accepted deliberately; irrelevant at this scale
  and cacheable later behind the same contract.
- **The auth/business-logic boundary is convention-enforced, not compiler-enforced.** → Module layout
  makes crossings visible; if the boundary erodes, that is the signal to reconsider a framework with
  structural module boundaries.
- **Isolation tests could be written to pass trivially** (e.g. asserting a 403 without a second family
  actually existing). → The spec requires the scenario with two real families and their own members, and
  requires the tests to fail if scoping is removed from a read path.
- **The Fastify decision silently ages `ARCHITECTURE.md`.** → Reflecting it back into the seed doc is an
  explicit task, not left to memory.

## Migration Plan

There is nothing to migrate — this is the first schema. The relevant discipline is that the initial schema
ships as a numbered, reproducible migration rather than a hand-applied script, so the migration path
exists from the first commit. Rollback is dropping the database volume and re-running migrations; no data
is at risk because none exists.

## Open Questions

These are genuinely deferrable — none of them changes the specs, the approach, or the task breakdown:

- Session lifetime and whether idle timeout should differ from absolute expiry. A default is chosen now;
  tuning it later changes no contract.
- Whether the dashboard response should be a single aggregate document or a composition of per-section
  reads. Deferred until a second section actually exists to compose.
- Where exactly Expo-managed capabilities stop being sufficient (`ARCHITECTURE.md` open question). Nothing
  in this slice approaches that line.
