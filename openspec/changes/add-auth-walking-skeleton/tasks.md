## 1. Local stack & tooling

- [x] 1.1 Initialise the TypeScript backend project with strict compiler settings and a documented `dev`, `build`, `test`, and `lint` script set
- [x] 1.2 Add Docker Compose with `api` and `postgres` services, so `docker compose up` yields a working stack from a clean checkout (Article III.1)
- [x] 1.3 Configure ESLint and a formatter, wired into the `lint` script and passing on the empty project (Article III.2)
- [x] 1.4 Configure the test runner with a disposable test database, so integration tests run without touching the dev database
- [x] 1.5 Add `.env.example` documenting every required variable, and confirm no secret is committed to source (Article III.2)

## 2. Schema & migrations

- [x] 2.1 Add a migration tool and wire `migrate` / `rollback` scripts; verify a migration applies and reverts cleanly against a fresh database
- [x] 2.2 Write the initial migration creating `users` (unique email, password hash, timestamps)
- [x] 2.3 Extend the initial migration with `families` and `family_members` (account ↔ family, role `parent`/`child`, unique per pair), modelled as a true many-to-many so multi-family membership stays answerable later
- [x] 2.4 Extend the initial migration with `sessions` (token hash, owning account, expiry, revoked-at), indexed on the token hash
- [x] 2.5 Verify foreign keys and uniqueness constraints reject the invariant violations they exist to prevent (orphan membership, duplicate email, duplicate membership)

## 3. Auth module

- [x] 3.1 Create the auth module with no imports from family or business logic, per the boundary in `design.md`
- [x] 3.2 Implement password hashing and verification with a salted, memory-hard function; assert the plaintext appears in no record, log, or response (spec: user-auth → Account registration)
- [x] 3.3 Implement session issuance: generate an unguessable token, persist only its hash with an expiry, return the token once (spec: user-auth → Credential verification and session issuance)
- [x] 3.4 Implement session resolution: look up the presented token's hash, reject missing, expired, and revoked sessions (spec: user-auth → Authentication of subsequent requests)
- [x] 3.5 Implement session revocation so a revoked token stops authenticating immediately, regardless of expiry (spec: user-auth → Session revocation)

## 4. Family scope enforcement

- [x] 4.1 Implement the single shared accessor that resolves the caller's family from their session server-side (spec: family-membership → Server-side family scope resolution)
- [x] 4.2 Make family-scoped data access take the resolved scope as a required argument, so a family-scoped query written without a scope fails loudly rather than returning everything (Article I.1)
- [x] 4.3 Ensure a client-supplied family identifier can never widen scope — mismatches are rejected, not silently replaced with the caller's own family (spec: family-membership → Server-side family scope resolution)

## 5. HTTP API

- [x] 5.1 Set up the HTTP server with schema-validated routes and a consistent error shape that never leaks internals
- [x] 5.2 Implement `POST /auth/signup`: validate input, create account, family, and owner membership in one transaction, roll back entirely on any failure (spec: family-membership → Family creation on registration)
- [x] 5.3 Implement `POST /auth/login`: verify credentials, issue a session, and return the same generic failure for unknown email and wrong password alike (spec: user-auth → Credential verification and session issuance)
- [x] 5.4 Implement `POST /auth/logout`: revoke the caller's current session (spec: user-auth → Session revocation)
- [x] 5.5 Add the authentication guard applied to every non-public route, rejecting unauthenticated requests before any side effect
- [x] 5.6 Implement `GET /families/me/dashboard`: family-scoped read returning the caller's family and an explicit empty content state (spec: family-dashboard → Authenticated dashboard retrieval, Explicit empty state)

## 6. Tests

- [x] 6.1 Unit-test password hashing and session token handling, including that stored values cannot yield a usable credential
- [x] 6.2 Integration-test the signup → login → dashboard path end to end against a real database
- [x] 6.3 Integration-test authentication failures: missing, malformed, expired, and revoked tokens each rejected (spec: user-auth)
- [x] 6.4 Integration-test registration failures: duplicate email, malformed email, weak password — each creating no account (spec: user-auth)
- [x] 6.5 Test that a failed signup leaves no account, family, or membership behind and frees the email address (spec: family-membership → Family creation on registration)
- [x] 6.6 **Write the dedicated family-isolation tests** required by Article I.1: two real families with their own members, asserting the first cannot read the second's dashboard, including a request crafted to bypass client-side filtering (spec: family-membership → Cross-family data isolation)
- [x] 6.7 Verify the isolation tests actually fail when family scoping is removed from a read path — a test that cannot fail proves nothing

## 7. Expo client

- [x] 7.1 Initialise the React Native + Expo TypeScript app with lint and format wired to the same standard as the backend (Article III.1)
- [x] 7.2 Build the Signup screen: collect email and password, surface field-level validation errors from the API
- [x] 7.3 Build the Login screen with its generic authentication-failure message
- [x] 7.4 Store the session token in the platform secure store, never in plain async storage, and confirm no secret is embedded in the bundle (Article I.2)
- [x] 7.5 Attach the session token to authenticated requests and route the user to Login when a request is rejected as unauthenticated
- [x] 7.6 Build the Dashboard screen rendering the family with an explicit, recognisable empty state (spec: family-dashboard → Explicit empty state)
- [x] 7.7 Present load failures distinctly from the empty state, so a member can tell "nothing here yet" from "could not load" (spec: family-dashboard → Explicit empty state)

## 8. Close-out

- [x] 8.1 Verify the whole stack runs from a clean checkout following only the README: compose up, migrate, run the app, sign up, log in, see the empty dashboard (Article III.1)
- [x] 8.2 Confirm `lint` and the full test suite pass, and that no secret is hardcoded anywhere in source (Article III.2)
- [x] 8.3 Replace the placeholder `README.md` with real setup, run, migrate, and test instructions — it currently predates the project having an identity
- [x] 8.4 Update `ARCHITECTURE.md` to record Fastify as the chosen backend framework, resolving its open question rather than leaving the seed doc claiming the choice is deferred
- [x] 8.5 Tick the Constitutional Alignment checkboxes in `proposal.md` only against evidence in the merged diff, not intent
