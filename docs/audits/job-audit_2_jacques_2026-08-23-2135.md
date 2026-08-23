# Job Audit — Issue #2 (close-out: task 8.1, Compose verification)

| | |
|---|---|
| **Issue** | [#2](https://github.com/Hundig1983/workflow_dev/issues/2) — Walking skeleton: signup, login, and empty family dashboard |
| **Run** | `/issue-orchestrator #2`, 2026-08-23 21:35 (entered via `/intake` no-argument derive mode → `route=resume`) |
| **Author** | jacques (Hundig1983) |
| **Branch** | `feat/issue-2-close-out` |
| **Forge** | GitHub (`gh`) · openspec mode (`openspec` 1.4.1) |
| **Scope** | Task **8.1** — the last of 43. Slices 1 (#4, backend) and 2 (#6, client) already merged. |
| **Outcome** | 43/43 tasks · 4/4 articles ticked · `openspec list` → **✓ Complete** · **this PR closes #2** |

---

## 1. Complexity Report

Scored on the **remaining** scope (the whole change scored 9/10 RISKY on 2026-08-15; that rigor was spent on slices 1–2).

| Trigger | Weight | Fires? | Justification |
|---|---|---|---|
| DB schema / migration | +2 | no | migration runs; not changed |
| Auth / security touched | +2 | no (pre) | not in scope at dispatch — **post-hoc: a CORS allow-list was required** (see §8) |
| Multi-layer change | +2 | no | verification crosses every layer; code changes are infra + one HTTP-server option |
| >3 files expected | +1 | yes | tasks.md, proposal.md, compose, env example, README (+ whatever the walk broke) |
| Deployment / env changes | +1 | yes | compose + env wiring is the task |
| Public endpoint impact | +1 | no | no new route |
| Risk of breaking existing flow | +1 | no | `npm run db:dev` path untouched |

**Score 2/10 → SIMPLE → `/oneshot`** (`--mode auto`). Retrospectively the auth/security trigger would have
fired (+2 → 4, MEDIUM); the difference is `forge -a -s` vs `oneshot`. Not re-dispatched: the change is a
20-line, deny-by-default, tested addition and was reviewed in 8.5 with that lens.

## 2. Relevance Check

**PARTIALLY_ADDRESSED.** Merged PRs #3 (spec), #4 (backend slice), #6 (client slice) cover 42 of 43
tasks; issue comments record both slices and name 8.1 as the remainder. The user explicitly chose
"Resume #2" in `/intake` derive mode two minutes before this run — taken as *Proceed anyway* on exactly
the remaining scope; not re-asked.

## 3. Conflict Check

**CLEAR.** Zero open PRs, zero in-flight `feat|fix|chore/issue-*` branches, #2 the only open issue.
Early claim (4.5): issue already assigned to `Hundig1983` = current user → `already_mine`, no claim
made, nothing to release.

## 4. Spec Binding Report

| | |
|---|---|
| `{spec_mode}` / `{spec_source}` | **BOUND** / `openspec` via `.sdd/handoff/add-auth-walking-skeleton.json` fast-path (issue 2 ↔ slug) |
| Validation | `openspec validate add-auth-walking-skeleton --strict --json` → valid, 0 issues (freshness guard in openspec mode) |
| Tasks at bind | 42/43 — only 8.1 open |
| `{alignment_mode}` | `aligned` — `<!-- applicable-articles: I.1, I.2, III.1, III.2 -->`, constitution v1.1 |
| Alignment at bind | 3/4 ticked; **III.1 unticked** (its "whole stack runs locally via Docker Compose" clause had no evidence — task 8.1 exists to supply it) |
| Alignment at end | **4/4** — III.1 ticked with an Evidence line naming what ran |
| Source-of-truth conflicts | none; comments record slices, never override the spec |

## 5. Selected Skill & Rationale

`/oneshot` (SIMPLE, auto). Payload carried: issue + slug + spec paths, the one task's text, measured
environment facts (Docker OK; host ports 3000/5432 busy, 3001/5433 free; compose hardcodes 5432), a
"clean checkout means it" protocol (fresh `git clone`, README only, fixes mirrored back to the working
tree), the evidence-not-intent rule for ticking 8.1/III.1, teardown and no-commit/no-PR rules.

## 6. Plan Checklist

- [x] Fresh clone of the branch into scratch; follow README compose section verbatim
- [x] Record every step that fails or that the README omits
- [x] Fix minimally in the working tree; mirror; re-run
- [x] Walk signup → login → dashboard against the compose stack (API) **and in the real web client**
- [x] Tick 8.1 + III.1 only on evidence
- [x] Rewrite README "Not yet verified" paragraph to the truth
- [x] Validate: backend tests, lint, typecheck, prettier, `openspec validate --strict`
- [x] Tear down (`down -v`), stop Metro, no `.env` tracked

## 7. Implementation Summary

Running the README from a clean checkout surfaced **three defects**, all fixed:

1. **Postgres host port hardcoded** (`'5432:5432'`) → `Bind for 0.0.0.0:5432 failed: port is already
   allocated` on any host with a local Postgres. Now `${POSTGRES_PORT:-5432}:5432`; documented.
2. **No migration step in the compose section.** The api container does not migrate on start; a README
   follower's first signup answered `HTTP 500` (`relation "users" does not exist`). The runtime image has
   no `tsx`, so the documented command is `docker compose exec api node dist/src/db/cli.js up` (verified
   `Applied: 001_initial`, idempotent `Already up to date.`).
3. **The API sent no CORS headers** → the web client (port 8081) could not call it from any browser
   (`blocked by CORS policy`). Slice 2 had driven the client's modules from Node, where CORS does not
   exist, so this was invisible. Fix: env-driven allow-list `CORS_ORIGINS` (comma-separated; **empty =
   no CORS headers at all**), `@fastify/cors@^11` registered only when non-empty, `GET/POST`,
   `content-type`/`authorization`, `credentials: false` (Bearer tokens, not cookies). Native apps send no
   `Origin` and are unaffected. `.env.example` presets the two Expo-web dev origins; compose passes it
   through. Three tests pin the behavior (allowed preflight, unlisted origin, empty list).

Files: `docker-compose.yml`, `backend/.env.example`, `backend/src/config.ts`, `backend/src/http/server.ts`,
`backend/src/index.ts`, `backend/package.json` + lock (+45 lines: `@fastify/cors`, `fastify-plugin`),
`backend/tests/integration/cors.test.ts` (new), `README.md`, `openspec/.../tasks.md` (8.1),
`openspec/.../proposal.md` (III.1).

**Evidence of the walk (clean clone, `PORT=3001`, `POSTGRES_PORT=5433`):**
- `docker compose up --build -d` → api image built, `postgres:17-alpine` **healthy**, api listening
- `exec api node dist/src/db/cli.js up` → `Applied: 001_initial`
- curl: `POST /auth/signup` **201** → `POST /auth/login` **200** (opaque token, 30-day expiry) →
  `GET /families/me/dashboard` **200** `isEmpty:true` with 4 empty sections → unauth **401** → wrong
  password **401** `invalid_credentials`
- preflight `OPTIONS /auth/signup` from `127.0.0.1:8081` → **204**, `allow-origin` echoed,
  `allow-headers: content-type, authorization`, no `allow-credentials`
- **Headless Chromium (Playwright) driving the real Expo web UI** against the compose API: Login renders →
  Signup → "The Walkers" dashboard with **"Nothing here yet"** → Sign out → wrong password shows the
  generic failure and stays on Login → Sign in → dashboard again → Sign out. API calls observed:
  `201, 200, 200, 204, 401, 200, 200, 204`. Screenshot captured. **This is the interactive click-through
  slice 2 listed as not verified — now done.**

Validation: backend **54/54** (51 + 3), `eslint` clean, `tsc --noEmit` clean, prettier clean,
`openspec validate --strict` valid, `openspec list` → ✓ Complete (43/43).

## 8. Security Impact Assessment

| Concern | Assessment |
|---|---|
| **Guardrail: `cors` pattern fired** | **Yes — unexpected at dispatch, required by the journey. Surfaced at the Phase 10 gate as an explicit acknowledge item, not auto-cleared.** `backend/tests/integration/cors.test.ts` matches by path; `server.ts` adds a CORS policy. Neither the spec nor the issue pre-authorized CORS work; both require "run the app, sign up, log in" which is impossible from a browser without it. |
| Policy shape | Allow-list only, exact origins, **deny by default when `CORS_ORIGINS` is unset/empty**; `GET/POST`; headers `content-type`, `authorization`; `credentials:false`. No wildcard anywhere. |
| Authorization / isolation (I.1) | Unchanged. No read path, query, or scope resolution touched. Unlisted origins cannot read responses; Bearer tokens are not ambient, so cross-origin requests cannot carry a victim's session. |
| Credential handling (I.2) | Unchanged: argon2id, token hash only, memory-only on web. TLS clause still unexercised (nothing deployed). |
| New dependency | `@fastify/cors@11.3.0` (peer fastify 5) + `fastify-plugin`. Lock delta 45 lines, nothing else moved. |
| Secrets | The clone's throwaway Postgres password never entered the repo; `.env` files are gitignored (`git status` shows none); `.env.example` holds placeholders only; README examples use an obviously fake password. |
| Post-flight constitution verify (Phase 8 §5) | **`no-code-predicates` — DID NOT RUN.** Manifest v1.1 carries only `citation`/`text-presence` predicates and no `code_verification` block for I or III; nothing was machine-checked against the diff. |
| Semantic intent check (Phase 8.5 §1a) | `ran:I.1,I.2,III.1,III.2` — no violation found (details above). |

## 9. Deployment Impact

- **New env vars:** `POSTGRES_PORT` (compose host port, default 5432), `CORS_ORIGINS` (API; default
  empty = no browser origin allowed). Both in `backend/.env.example`, compose, README.
- **Compose:** postgres host port now overridable; api receives `CORS_ORIGINS`. Image rebuild required
  (new dependency) — `--build` is in the README command.
- **No migration change, no schema change, no CI change.**
- Anyone running the **npm path** (`npm run backend:dev` + `npm run client:web`) gets CORS from the same
  `.env.example` copy — that path had the identical browser defect and is fixed by the same change.

## 10. Risk Level & Mitigations

**Overall: LOW.** Additive, deny-by-default, covered by tests, exercised end-to-end.

| Risk | Mitigation |
|---|---|
| A deployment sets `CORS_ORIGINS` too broadly | The variable is a literal origin list; README says leave empty to refuse browsers; no wildcard support is exposed |
| Complexity under-scored (auth trigger missed at dispatch) | Recorded in §1; reviewed in 8.5 with the security lens; gate acknowledge-line in Phase 10 |
| Native iOS/Android unexercised | No device; unchanged from slice 2; stated in the PR |
| `npm start` script points at a non-existent path (`dist/index.js` vs `dist/src/index.js`) | Pre-existing, out of scope, undocumented in README, compose uses the correct Dockerfile CMD — noted in the PR as a follow-up |

## 11. Rollback Plan

Revert the close-out commit(s). No migration ran, no schema moved. Reverting removes the CORS plugin,
the two env vars, the port override, the test file, and the README/spec ticks; the stack returns to
its previous (unverified-compose, browser-blocked) state. `docker compose down -v` drops any local
volume created while verifying.

## 12. PR Readiness Checklist

- [x] Branch `feat/issue-2-close-out` cut from up-to-date `main`; never pushed to default
- [x] Compose stack built, migrated and walked **from a fresh clone, README only**
- [x] **Interactive browser click-through** of signup / sign out / wrong password / login / dashboard
- [x] backend 54/54 · lint · typecheck · prettier · `openspec validate --strict`
- [x] tasks.md **43/43**; proposal.md **4/4** ticked against evidence; `openspec list` ✓ Complete
- [x] README compose section rewritten to the verified truth (date, host, ports, three defects)
- [x] Secret scan clean; no `.env` tracked; stack torn down; Metro stopped
- [x] **`Closes #2`** — scope fully resolved (Phase 11 step 1.5)
- [x] Post-merge step prepared: `openspec archive add-auth-walking-skeleton`
- [ ] Gate acknowledge pending: **CORS policy added to the HTTP server without prior spec authorization**
- [ ] Native iOS/Android — not verified (no device)
- [ ] TLS — not verified (nothing deployed)
