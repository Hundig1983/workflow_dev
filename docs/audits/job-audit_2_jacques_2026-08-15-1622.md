# Job Audit: Issue #2 — Walking skeleton: signup, login, and empty family dashboard

| Field | Value |
|---|---|
| Issue | [#2](https://github.com/Hundig1983/workflow_dev/issues/2) |
| Forge | github (`gh`) — `Hundig1983/workflow_dev` |
| Branch | `feat/issue-2-add-auth-walking-skeleton` (from `main` @ `e5cf710`) |
| Mode | `auto` |
| Spec mode | `BOUND` — `{spec_source}` = `openspec` |
| Feature slug | `add-auth-walking-skeleton` |
| Author | jacques |
| Run | 2026-08-15 16:22 UTC+2 |

## 1. Complexity Report

**Score 9/10 → RISKY.** Identical to the score `/intake` computed pre-spec; re-derived here from the bound spec.

| Trigger | Weight | Triggered | Justification |
|---|---|---|---|
| DB schema/migration | +2 | Yes | `001_initial` creates `users`, `families`, `family_members`, `sessions` |
| Auth/security touched | +2 | Yes | The change *is* signup/login/sessions |
| Multi-layer | +2 | Yes | persistence + service + HTTP (UI deferred, see §7) |
| >3 files expected | +1 | Yes | 42 files changed |
| Deployment / env changes | +1 | Yes | Docker Compose, 7 new env vars, first migration |
| Public endpoint impact | +1 | Yes | `/auth/signup`, `/auth/login` are unauthenticated |
| Risk of breaking existing flow | +1 | **No** | Empty repo — no existing flow exists to break |

## 2. Relevance Check

`CURRENT`. Issue opened 2026-08-15T14:00Z, ~2h before this run; no comments; no competing PR. Nothing in the repo addressed any part of it — the tree had zero application code at dispatch.

## 3. Conflict Check

`CLEAR`. No open PRs at dispatch, no other branches touching `backend/`, issue unassigned before this run's Phase 4.5 claim. The only adjacent work was PR #3 (this run's own spec landing), merged before the implementation branch was cut.

## 4. Spec Binding Report

Bound via `.sdd/handoff/add-auth-walking-skeleton.json` fast-path (issue `2` recorded, fingerprint guard `openspec-validate`). `openspec validate add-auth-walking-skeleton --strict` → passed, 0 issues.

- `{alignment_mode}` = `aligned`
- `{declared_scope_tags}` = `auth, tenancy, infra, testing`
- `{applicable_articles}` = **I.1, I.2, III.1, III.2** (I.3 excluded — needs `privacy`, not declared)
- `{alignment_unticked_count}` = 0

⚠ **The 0 unticked count overstates assurance.** Those boxes were ticked at spec-authoring time against `text-presence` predicates that inspect the *spec's own wording*, not the code. See §8.

## 5. Selected Skill & Rationale

`/forge -a -x -s -t` per the RISKY row of the dispatch table. No `project-dispatch.md` override exists.

## 6. Plan Checklist

Scope was deliberately narrowed to a **partial slice** at the pre-dispatch gate (user decision): task groups 1–6 plus 8.2 and 8.4. Groups 7 (Expo client), 8.1, 8.3 explicitly deferred. 33 of 43 task boxes ticked.

## 7. Implementation Summary

42 files. Fastify + TypeScript API; one reversible migration; argon2id passwords; opaque session tokens stored only as SHA-256 hashes; registration creating account + family + owner membership in one transaction; Docker Compose stack.

**Family isolation is enforced by construction.** `FamilyScope` is a branded type whose brand symbol is not exported, so it can only be minted by `resolveFamilyScope` from a session. Family-scoped queries take one as a required argument — an unscoped read does not typecheck.

### Verification actually performed

| Gate | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `prettier --check` | pass |
| `npm test` | **51/51 pass** against real PostgreSQL 17.4 |
| Mutation check (task 6.7) | **pass** — see below |

**Environment constraint:** no Docker and no system PostgreSQL in this WSL distro. Tests run real PostgreSQL 17.4 in userspace via `embedded-postgres`'s bundled binaries (driven directly through `initdb`/`pg_ctl` over TCP — the package's own wrapper needs a Unix socket path that exceeds Postgres's 107-byte cap). **Docker Compose itself is therefore written but never executed** — task 8.1 stays open for that reason.

**Mutation check (task 6.7 — "verify the isolation tests fail when scoping is removed"):** defeating `scopeCovers` (forcing `return true`) turned 3 of 6 isolation tests red with genuine authorization failures — `expected 200 to be 403`, not crashes. A first attempt also stripped the SQL `WHERE`, but that produced 500s (a crash, not a leak), so it was re-run narrowly to get a clean signal. The isolation suite is non-vacuous.

## 8. Security Impact Assessment

Auth/security files were touched extensively — **explicitly authorized**, since the issue's entire subject is authentication. Not a blocker.

- Passwords: argon2id, salted per-hash, plaintext asserted absent from records/logs/responses.
- Session tokens: 32 random bytes, only SHA-256 hash persisted, revocation immediate, expiry enforced in SQL.
- Login failures indistinguishable between unknown email and wrong password (verified byte-identical response bodies; a dummy-hash verify keeps timing comparable at 16ms vs 10ms).
- No hardcoded secrets; `.env` gitignored, `.env.example` carries placeholders only.

### ⚠ Finding: post-flight constitution verification could not run

Phase 8 step 5 checks the manifest's `code_must_contain` / `code_must_not_contain` regexes against the diff. This project's manifest is **Forge-native shape** and carries **only** `citation` (9) and `text-presence` (9) predicates — **zero** code-level ones. The check is therefore a structural no-op here, and constitutional compliance is never mechanically verified against code. The only record is the checkbox set, ticked at spec time from the spec's own wording. **This is a workflow gap, not a defect in this change** — it affects every project whose constitution came from `/orchestrate-constitution` in Forge-native shape.

### ⚠ Known residual: signup email enumeration

The user-auth spec requires the duplicate-email response not to reveal whether an address is registered. The error code was made neutral (`registration_rejected`), but the **409 status still distinguishes the case**. Closing it fully requires an email-verification flow (always answer 202, confirm out of band), which is outside this slice. Flagged rather than silently deviated from.

## 9. Deployment Impact

7 new environment variables, all documented in `backend/.env.example` and consumed by `docker-compose.yml`: `DATABASE_URL`, `PORT`, `HOST`, `SESSION_TTL_HOURS`, `LOG_LEVEL`, plus `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` for the database container. `POSTGRES_PASSWORD` is deliberately required with no default (`:?` in compose) so the stack refuses to start on an unset credential.

First migration must run on deploy (`npm run migrate`).

## 10. Risk Level & Mitigations

**RISKY.**

| Risk | Mitigation |
|---|---|
| Docker Compose never executed | Task 8.1 left open and explicitly listed as remaining scope |
| Isolation could regress silently later | Mutation-verified suite; `FamilyScope` makes unscoped reads a type error |
| `resolveFamilyScope` takes the oldest membership | Documented in-code; becomes wrong only when multi-family membership is answered yes |
| `embedded-postgres` is a beta release | devDependency only; never ships in the runtime image (`npm ci --omit=dev`) |
| ARCHITECTURE.md edit changes a constitution source | Expected drift — see §12 |

## 11. Rollback Plan

- **Schema:** `npm run rollback` reverts `001_initial`. Verified in `migrations.test.ts`: up → down → re-up, plus "nothing to revert" and idempotency cases.
- **Code:** revert the two commits (`f447f8d`, `ebc4c74`); nothing else depends on them.
- **Data:** none at risk — no environment has run this schema.

## 12. PR Readiness Checklist

- [x] Typecheck, lint, format, and 51 tests green
- [x] Dedicated family-isolation tests present and mutation-verified (Article I.1)
- [x] Migration reversible and tested
- [x] No secrets in source; `.env` ignored
- [x] New env vars documented
- [x] Deferred scope named explicitly → PR uses `Refs #2`, **not** `Closes #2`
- [ ] Docker Compose executed end-to-end — **cannot** in this environment
- [ ] Expo client (group 7) — deliberately out of scope

**⚠ Expected constitution drift:** `docs/ARCHITECTURE.md` is a fingerprinted constitution source. Task 8.4 edited it to record the Fastify decision, so its `sha256` no longer matches the manifest. Re-run `/orchestrate-constitution` after merge. This is the drift signal working as designed, not a regression.
