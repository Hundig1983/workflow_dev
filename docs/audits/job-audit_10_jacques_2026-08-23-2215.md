# Job Audit — Issue #10 (shared shopping lists, first feature slice)

| | |
|---|---|
| **Issue** | [#10](https://github.com/Hundig1983/workflow_dev/issues/10) — Shared shopping lists: named lists, items, idempotent check-off, clear-to-archive |
| **Run** | `/issue-orchestrator #10`, 2026-08-23 22:15 (entered via `/intake` → `/spec-creator` → `/create-issue` the same evening) |
| **Author** | jacques (Hundig1983) |
| **Branch** | `feat/issue-10-add-shared-shopping-lists` |
| **Forge** | GitHub (`gh`) · openspec mode (`openspec` 1.4.1) |
| **Implementer** | `/forge -a -x -s` (COMPLEX → full FORGE with adversarial examine) |
| **Outcome** | 22/22 tasks · 80/80 backend tests · browser-verified end to end · **closes #10** |

---

## 1. Complexity Report

| Trigger | Weight | Fires? | Justification |
|---|---|---|---|
| DB schema / migration | +2 | **Yes** | Migration `002_shopping_lists`: two new tables, checks, partial index |
| Auth / security touched | +2 | No | Existing guard chain reused unchanged; no auth file in the diff |
| Multi-layer | +2 | **Yes** | Persistence + service/API + client screens in one change |
| >3 files expected | +1 | **Yes** | 19 files touched |
| Deployment / env changes | +1 | No | No new env var, no infra change; migration runs through the existing path |
| Public endpoint impact | +1 | No | 11 new endpoints, all authenticated; no public contract |
| Risk of breaking existing flow | +1 | **Yes** | Shared surfaces: dashboard contract, `api/client.ts` verb union, eslint boundary rule |

**Score 6/10 → COMPLEX → `/forge -a -x -s`.** Matches the `/intake` pre-triage exactly (6/10, gate 5 → spec route), so routing was consistent across entry point and orchestrator.

## 2. Relevance Check

**CURRENT.** Issue opened 20:27Z the same evening from the spec merged in PR #11; no merged PR addresses it; no drift between issue body and change.

## 3. Conflict Check

**CLEAR.** Zero open PRs, zero in-flight `feat|fix|chore/issue-*` branches at claim time, #10 the only open issue.

## 4. Spec Binding Report

| | |
|---|---|
| `{spec_mode}` / `{spec_source}` | **BOUND** / `openspec` via `.sdd/handoff/add-shared-shopping-lists.json` fast-path (issue 10 ↔ slug) |
| Validation | `openspec validate add-shared-shopping-lists --strict` → valid (before and after implementation) |
| Tasks at bind → at end | 0/22 → **22/22** |
| `{alignment_mode}` | `aligned` — `<!-- applicable-articles: I.1, I.3, III.2, V.1 -->`, constitution v1.1, scope tags `tenancy, db, testing, business-logic` |
| Alignment boxes | 4/4 ticked at authoring; re-verified against the diff in §8 below |
| Source-of-truth conflicts | none |

## 5. Selected Skill & Rationale

`/forge -a -x -s` per the dispatch table (COMPLEX). Payload carried the change's specs as acceptance
criteria, `design.md` as closed decisions, `tasks.md` as the work plan, the repo's pattern files
(branded `FamilyScope`, `fail()` envelope, TS-embedded migrations, no-router client), the measured
environment, and the four applicable articles.

## 6. Plan Checklist

- [x] Migration 002 (reversible, tested up→down→up)
- [x] Scoped repository + service + 11 routes
- [x] Dashboard delta (summaries, `isEmpty`)
- [x] Client: types/api, two screens, dashboard section, navigation
- [x] Tests: behavior, isolation, edge cases
- [x] Adversarial examine on own diff (`-x`)
- [x] Live end-to-end verification

## 7. Implementation Summary

**Backend** — `db/migrations.ts` (002: `shopping_lists`, `shopping_items`; state as timestamps
`checked_at`/`archived_at`, CHECK making "archived but never checked" unrepresentable, partial index on
active rows) · `shopping/repository.ts` (13 family-scoped queries) · `shopping/service.ts` (list-in-scope
gate + discriminated results) · `http/routes/shopping.ts` (11 endpoints, JSON-Schema per route) ·
`server.ts` registration · `dashboard/service.ts` (real summaries, per-key section typing) ·
`eslint.config.js` (boundary group extended — see §8).

**Client** — `shopping/{types,api}.ts` · `ListsScreen` (create, delete-with-confirm, three states) ·
`ListDetailScreen` (add, unchecked/checked groups, check/uncheck, edit, delete, Clear checked; optimistic
with rollback) · `DashboardScreen` (shopping section renders summaries + CTA) · `App.tsx` (view state
`dashboard | lists | list`) · `api/client.ts` (verb union extended to PATCH/DELETE).

**Design decision worth recording.** Check/uncheck are a **conditional UPDATE plus fetch-on-noop**, not a
`COALESCE` update. A `COALESCE`-only statement would move `updated_at` on every replay, letting a
replayed check beat a concurrent uncheck under LWW — a silent conflict-semantics violation. The test
asserts `updated_at` is byte-identical across a replay.

**Tests** — `shopping-lists` (13), `shopping-isolation` (5), `shopping-edge-cases` (6, from the `-x`
pass), plus `migrations` and `dashboard` extended. Suite: **54 → 80**.

## 8. Security Impact Assessment

| Concern | Assessment |
|---|---|
| Auth files touched | **None.** The guard chain (`makeRequireSession` → `makeRequireFamilyScope`) is reused verbatim. |
| **Article I.1 — semantic check (Phase 8.5 §1a)** | **PASS, verified not merely named.** All **13/13** new SQL statements constrain by `family_id` — directly on `shopping_lists`, or through a join/`USING` on the owning list for every item operation. The canonical failure ("names the key, never filters by it") does not occur. No route reads a family id from the request. |
| Isolation coverage | 9 cross-family paths (GET/PATCH/DELETE list, POST item, PATCH/check/uncheck/DELETE item, clear) all answer **404 with a byte-identical body** to a nonexistent list — existence cannot be probed. A stranger's own list view stays empty. |
| **Article I.3 — semantic check** | **PASS.** Two real `DELETE`s (list cascade, item) and one archive (`archived_at`); the test asserts archived rows are still present in the table. Both retention semantics are explicit, neither is a euphemism for the other. |
| **Article V.1 — semantic check** | **PASS.** Diff scanned for the permanent non-goals (recommendations, supermarket/bank/wearable/smart-home integrations, chat, social, subscriptions) — zero hits. |
| Module boundary | **FINDING, fixed in this diff.** `backend/eslint.config.js` enumerates business modules by name; `shopping/` was missing, so `auth/` could have imported it with no complaint. Added to the restricted group and **proven to fire** on a deliberate `auth → shopping` import, then clean. This is a boundary *tightening*. |
| Shared client change | `api/client.ts` method union widened to include PATCH/DELETE. Type-level only; each route still authorizes server-side. No existing call changes. |
| Secrets | None introduced; secret scan over the diff clean. |
| **Post-flight constitution verify (Phase 8 §5)** | **`no-code-predicates` — DID NOT RUN.** Manifest v1.1 carries only `citation`/`text-presence` predicates and no `code_verification` block, so nothing was machine-checked against the diff. The semantic pass above is what covered these articles. |
| **Semantic intent check (Phase 8.5 §1a)** | `ran:I.1,I.3,III.2,V.1` — no violation found. |

## 9. Deployment Impact

- **Migration required on deploy**: `002_shopping_lists` (reversible; `down` drops both tables).
- **No new env vars, no infra change, no dependency added** (backend and client both).
- Dashboard response shape changes for the `shopping` section only — the client change ships in the same slice, so no consumer is left behind.

## 10. Risk Level & Mitigations

**Overall: LOW-MEDIUM** — new schema and a shared contract, but additive, covered, and exercised.

| Risk | Mitigation |
|---|---|
| Dashboard contract shape change | Delta spec pins it; client updated in the same PR; dashboard tests assert both the populated and the all-done cases |
| LWW absorbs conflicts silently (by design) | `created_by`/`checked_by` + timestamps leave room for an activity trail later with no schema change |
| Multi-device concurrency unproven | Semantics are tested at the API level (idempotence, delete-wins, replay); a true two-device run is not covered — stated below |
| Migration on a populated DB | `down` tested; tables are new, so no backfill and no lock on existing data |

## 11. Rollback Plan

Revert the branch's commits and run `npm run rollback` (or `node dist/src/db/cli.js down`) once to drop
`002_shopping_lists`. Nothing pre-existing depends on the new module: the dashboard falls back to an
empty shopping section, the client screens disappear with the revert, and `001_initial` is untouched.

## 12. PR Readiness Checklist

- [x] Branch cut from up-to-date `main`; never pushed to default
- [x] 22/22 tasks ticked against evidence; `openspec validate --strict` valid
- [x] backend **80/80**; lint · typecheck · prettier clean on both packages
- [x] Isolation suite covers every new path; eslint boundary rule proven to fire
- [x] **Live browser walk** against the Compose stack: create list → 3 items → check 2 → grouped apart → Clear → basket empty, unchecked kept → dashboard "Groceries · 1 to buy"
- [x] Stack torn down; no `.env` tracked; no secret in the diff
- [x] **`Closes #10`** — scope fully resolved (Phase 11 step 1.5)
- [ ] Gate acknowledge: post-flight constitution check **did not run** (manifest has no code predicates) — compliance rests on the semantic pass, not a machine check
- [ ] Native iOS/Android — not verified (no device)
- [ ] Two-device concurrent editing — not verified (single-browser walk)
