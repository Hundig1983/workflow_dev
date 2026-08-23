# Job Audit — Issue #2 (Expo client slice)

| | |
|---|---|
| **Issue** | [#2](https://github.com/Hundig1983/workflow_dev/issues/2) — Walking skeleton: signup, login, and empty family dashboard |
| **Run** | `/issue-orchestrator #2`, 2026-08-15 22:03 |
| **Author** | jacques (Hundig1983) |
| **Branch** | `feat/issue-2-expo-client` |
| **Forge** | GitHub (`gh`) · openspec mode |
| **Commits** | `d6a2fbe`, `dd7a840` |
| **Scope** | Tasks 7.1–7.7, 8.3, 8.5. **8.1 deliberately excluded.** |

---

## 1. Complexity Report

**Score: 4/10 → MEDIUM.** Scored against the *remaining* slice, not the original issue — the DB, API and
multi-layer work merged in PR #4, leaving an additive single-layer UI subsystem.

| Trigger | Weight | Fired | Justification |
|---|---|---|---|
| DB schema/migration | +2 | No | `001_initial` shipped in PR #4; nothing here touches a migration |
| Auth/security touched | +2 | **Yes** | 7.4 secure-store session token; 7.5 attach token + 401 handling (Article I.2) |
| Multi-layer | +2 | No | UI + docs only; persistence and API layers already merged |
| >3 files expected | +1 | **Yes** | Expo app entry, 3 screens, api client, secure store, config, lint/format |
| Deployment / env changes | +1 | **Yes** | New app toolchain; `EXPO_PUBLIC_API_URL`; `DEV_DB_PORT` |
| Public endpoint impact | +1 | No | Consumes existing contracts unchanged; no endpoint added or modified |
| Risk of breaking existing flow | +1 | No | Purely additive; backend untouched and still 51/51 green |

## 2. Relevance Check

**`PARTIALLY_ADDRESSED`** — 33/43 tasks complete at run start. Backend merged (PR #4), client absent.
The issue was deliberately left open by the prior slice, and the remaining scope matched the issue body
exactly. No drift between issue and spec.

## 3. Conflict Check

**`CLEAR`.** `main` was the only branch locally and remotely; zero open PRs; working tree carried only the
four deliberately-untracked directories. No in-flight work could overlap.

## 4. Spec Binding Report

- **Spec mode:** `BOUND`
- **Spec source:** `openspec` — change `add-auth-walking-skeleton`
- **Validation:** `openspec validate --strict` → valid (before and after)
- **Files:** `proposal.md`, `design.md`, `tasks.md`, `specs/{user-auth,family-membership,family-dashboard}/spec.md`
- **Drift vs. issue:** none — title and AC aligned.

**Constitutional alignment:** `aligned`, applicable articles **I.1, I.2, III.1, III.2**.
At run start 4/4 were ticked. Task 8.5 re-verified each against the merged diff and **unticked III.1** —
its "whole stack runs locally via Docker Compose" clause has no supporting evidence, and task 8.1 exists
to supply it. Final state: **3/4 ticked, 1 unticked (III.1)**. Per-article `Evidence:` lines were added.
The `constitution-version` marker was corrected 1.0 → 1.1 (no article ID moved, so citations stayed valid).

**Post-flight predicate check: `no-code-predicates` — DID NOT RUN.**
0 of 2 applicable articles (I, III) carry code-level predicates, so nothing could be checked against this
diff. Compliance is **unverified against code**; the ticks above are an author assessment plus manual
evidence, not a machine check. This is a manifest-level gap, not a defect in this change — a manifest
produced by `/orchestrate-constitution` carries document-only predicates by design.

## 5. Selected Skill & Rationale

**`/forge -a -s`** — MEDIUM maps to structured FORGE. `-x` (adversarial examine) was not added: the change
is additive with no existing consumers to break. `-t` was not added: the tasks specify no client test
suite, and adding one would have been scope creep. Pre-MR self-review (Phase 8.5) covered review needs.

## 6. Plan Checklist

- [x] Scaffold Expo TS app, mirror backend lint/format/tsconfig (7.1)
- [x] Signup screen with field-level API errors (7.2)
- [x] Login screen with a single generic failure message (7.3)
- [x] Token in `expo-secure-store`; no secret in the bundle (7.4)
- [x] Token attached to requests; 401 routes to Login (7.5)
- [x] Dashboard with an explicit empty state (7.6)
- [x] Load failure visibly distinct from empty (7.7)
- [x] README rewritten for both packages (8.3)
- [x] Alignment re-verified against the diff (8.5)
- [ ] **8.1 — compose-up verification. Out of scope: no container runtime.**

## 7. Implementation Summary

35 files, +8654/-15, then one self-review fix.

| Area | What landed |
|---|---|
| `client/` | Expo SDK 57 + RN 0.86 + React 19, TypeScript strict (incl. `exactOptionalPropertyTypes`) |
| Navigation | Auth-state conditional rendering — **no router dependency** (design.md: smallest defensible option) |
| `src/api/client.ts` | Three-way error taxonomy: `ApiError` / `UnauthenticatedError` / `NetworkError` |
| `src/auth/` | SecureStore (native) / memory-only (web); generic login failure; field-attributed signup |
| `src/family/` | `/families/me/dashboard` only — never a client-supplied family id |
| `src/screens/` | Login, Signup, Dashboard (loading / empty / error states) |
| `scripts/devdb.mjs` | Real PostgreSQL 17 with no Docker via `embedded-postgres` binaries |
| `package.json` (root) | New — hosts `npm run db:dev` and delegating scripts |
| `README.md` | Placeholder replaced; compose path labelled **unverified** |

**Bug caught by verification.** `/auth/login` answers 401 for bad credentials; the first cut treated every
401 as a rejected session, so a mistyped password cleared the token and signed the user out
(`unauthenticatedCalls=3`). Gated on `!anonymous`; re-verified `calls=1`. This would have shipped had the
run stopped at "typecheck passes".

**Self-review finding (Phase 8.5).** Both arms of the JSON-parse catch threw an identical `NetworkError`,
so the `response.ok` test decided nothing. Simplified — `dd7a840`.

## 8. Security Impact Assessment

| Concern | Assessment |
|---|---|
| Auth files touched | **Yes — authorized.** Tasks 7.4/7.5 and Article I.2 explicitly require it. Not an unexpected touch. |
| Credential storage | `expo-secure-store` on native. On web there is no secure store; `localStorage` is the plain storage I.2 forbids, so the token is **memory-only** and lost on reload — strictly more conservative. Documented in README and proposal. |
| Account enumeration | Client preserves the API's single generic login failure; does **not** re-introduce the distinction the API closed. Verified: wrong password and unknown account both yield `invalid_credentials`. |
| Authorization on the client | None attempted. The client renders what the server returns and calls only `/families/me/dashboard`; no client-held family id is ever sent (Article I.1). |
| Secrets in the bundle | None. `EXPO_PUBLIC_API_URL` is a URL. `.env` is gitignored; only `.env.example` placeholders are committed. |
| Hardcoded credential | One: `dev-local-not-a-secret` in `scripts/devdb.mjs` — a loopback-bound throwaway dev cluster, named to be unmistakable, matching the existing test helper's `test-only-not-a-secret`. |
| Secret scan on staged diff | Clean — only type declarations and identifier names matched. |

## 9. Deployment Impact

- **New env vars:** `EXPO_PUBLIC_API_URL` (client, documented in `client/.env.example` + README);
  `DEV_DB_PORT` (optional, dev-only, defaults 55432).
- **New root `package.json`** — private, no dependencies, scripts only. Does not make this a workspace;
  `backend/` and `client/` remain independently installed.
- **No migration, no infra change, no CI change.** `docker-compose.yml` untouched.
- **`.gitignore`** extended: `.expo/`, `web-build/`, `.pgdata/`.

## 10. Risk Level & Mitigations

**Overall: LOW.** Purely additive; nothing existing imports the new code.

| Risk | Mitigation |
|---|---|
| Compose path still unproven | Explicitly labelled unverified in README; III.1 unticked; task 8.1 left open |
| Interactive UI flow unverified | DOM render + 10/10 integration verified; gap stated plainly rather than papered over |
| Native targets unexercised | No device/simulator available; SecureStore exercised only on the bypassed web path — stated in the PR body |
| Web token lost on reload | Deliberate, documented; web is a verification target, not a shipping one |

## 11. Rollback Plan

Revert `dd7a840` and `d6a2fbe`. Nothing else depends on them: no migration ran, no schema changed, no
existing module imports `client/`, and the backend is byte-identical. Deleting `client/`, `scripts/`, and
the root `package.json` restores the prior tree exactly; `.pgdata/` is gitignored local state removable
with `npm run db:dev:reset`.

## 12. PR Readiness Checklist

- [x] Branch created off `main`, never pushed to default
- [x] Commits scoped and messaged with rationale
- [x] `client` typecheck / lint / format clean
- [x] `backend` 51/51 tests still green (regression check)
- [x] `openspec validate --strict` passes
- [x] Metro bundles for web; app renders in headless Chrome
- [x] 10/10 client integration checks against the live API
- [x] Documented `db:dev → migrate → run` path verified from a **fresh** cluster
- [x] Secret scan clean
- [x] tasks.md 42/43; 8.1 deliberately open
- [x] Alignment re-verified; III.1 honestly unticked
- [x] **`Refs #2`, not `Closes #2`** — this is a slice, the issue must stay open
- [ ] Interactive click-through — **not verified**, stated in the PR body
- [ ] Native iOS/Android — **not verified**, no device available
