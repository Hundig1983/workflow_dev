# orchestrate-constitution — run log

| Field | Value |
|---|---|
| Mode | `derive` (auto-selected) |
| Apply | **false — preview only, nothing written outside this folder** |
| Auto-mode reason | source drift — 1 source changed since last derive |
| Forge | github |
| Spec mode | openspec |
| Steward | jacques |
| Branch at run | `main` |
| Date | 2026-08-15 16:32 |

## Pre-flight

| Check | Result |
|---|---|
| Working tree | dirty — 4 untracked dirs, all unrelated to this skill's outputs |
| Branch | `main` (not a prior `docs/orchestrate-*` branch) |
| Tooling | `gh` 2.87.0 ✓ · `jq` 1.8.2 ✓ (`~/bin/jq`, on PATH) · `sha256sum` ✓ · `glab` absent (not needed) |
| `CONSTITUTION_EXISTS` | true |
| `MANIFEST_EXISTS` | true |
| Promotions ledger | present |
| Source tracking (§10) | **all sources tracked** — 0 untracked |
| Override file | `.claude/skills/orchestrate-documentation/project-docs.md` — 3 scope-tag extensions (`privacy`, `ai-safety`, `tenancy`) |

⚠ The override file lives under the **untracked** `.claude/` directory. It is read successfully today, but a
clone of this repo would derive with the canonical 14 tags only, silently losing `privacy` / `ai-safety` /
`tenancy` — and the existing articles cite those tags. Not blocking (pre-flight §10 covers canonical
*sources*, not the override), but worth committing.

## Phase 1 — Gather

| Class | Found | Disposition |
|---|---|---|
| A — ADRs | 0 | — |
| B — PRD constraints | 5 bullets (§`Constraints`) | unchanged since last derive |
| B — PRD out-of-scope | 0 bullets (§`Non-goals`, prose body — read body, not count) | unchanged |
| C — ARCHITECTURE binding blocks | 3 sections with binding language | 1 changed |
| D — AI_DECISIONS | 0 | — |
| E — Auto-memory | 0 (directory empty) | nothing to promote |
| F — Migration docstrings | `backend/src/db/migrations.ts` (4 `CREATE TABLE`) | **new** — evidence only |
| G — `.specs/*/notes.md` | 0 (openspec mode) | — |

`scripts/extract_prd_sections.sh` exited 0 and matched the `Constraints` / `Non-goals` dialect — the
project-seed dialect, resolved via the alias set rather than a hardcoded header.

**Drift:** 1 changed (`docs/ARCHITECTURE.md`), 0 new, 0 removed. `docs/PRD/PRD.md` byte-identical.

```
docs/ARCHITECTURE.md   stored f7902afe…  →  current a1524bf5…
docs/PRD/PRD.md        unchanged
```

Drift content: the Fastify decision recorded in §Intended stack, one Assumption marked resolved, one Open
Question marked answered. **No article's cited source span was touched** — the only span any article cites
from this file is `arch-key-decisions-auth` (§Key decisions, backing Article I.1), which is byte-identical.

## Phase 2 — Extract

One new candidate:

- **`c-101`** — *"The backend framework is Fastify (Node.js + TypeScript)."*
  Class C (arch-binding-block, §Intended stack) · suggested scope tags `[infra]` · class C never
  auto-promotes.

## Phase 3 — Cluster + Clarify

- **Clusters:** 1 — `c-101` intersects the existing Article III cluster (`infra, docs, testing`).
- **HALT 1 — contradictions: 0.** Pair-wise scan found no opposing imperative; gate not triggered.
- **HALT 2 — drift disposition:** user chose **(a) wording only — refresh, keep article IDs**.
  Rationale: no cited span moved; the diff adds a newly-decided fact rather than altering a rule.
  Rule 15 (drift ≠ rule-change) upheld.
- **HALT 3 (memory): not triggered** — auto-memory directory empty, 0 candidates.
- **HALT 3 (ARCH) — promote `c-101`?** user chose **(2) NO — keep in candidate appendix**.
  Rationale: Article III.1 already binds what the PRD actually constrained (REST, PostgreSQL,
  reproducible migrations, TypeScript, Expo, Docker). The framework is the one thing the source
  *explicitly declined to bind*. Promoting it would push the constitution past its sources, make a
  framework swap require a constitutional amendment, and add a predicate every `infra` spec must satisfy
  for no safety gain. It stays recorded in `ARCHITECTURE.md` and the change's `design.md`.
- **Cap check:** PASS — 5 binding, unchanged (cap 12).

```
Final article roster:      5  (unchanged, IDs I–V)
Final candidate appendix:  5 → 6  (+c-101)
Withdrawn this run:        0
```

## Phase 4a — Derive (preview)

**Target version: 1.0 → 1.1** — patch bump. Only a text refresh: every section's `rule_hash` is
unchanged; only a source `sha256` moved. No new articles, no supersedes, no withdrawals.

### Proposed changes (NOT applied — `--apply` was not passed)

1. `constitution.manifest.json`
   - `constitution_version`: `1.0` → `1.1`
   - `sources[].sha256` for `docs/ARCHITECTURE.md`: `f7902afe…` → `a1524bf5…` (all 5 duplicate entries)
   - `candidates[]`: append `c-101` (topic: backend framework = Fastify; `promotion_status: pending`;
     `halt_history`: HALT 3 → appendix)
   - `generated_at`: refreshed
2. `constitution.md`
   - Version header `1.0` → `1.1`; changelog line added
   - **No article body changes** — all five articles' rule text is untouched
3. `coverage-report.md` — fully replaced; see `proposed-coverage-report.md` in this folder
4. `promotions.log.md` — **no new entry** (0 memory promotions, 0 ARCH promotions this run)

## Coverage verification (openspec mode)

Scanned active changes via `openspec list` → 1 change: `add-auth-walking-skeleton`.

Target file: `openspec/changes/add-auth-walking-skeleton/proposal.md` (openspec mode reads `proposal.md`
where kiro mode reads `spec.md`).

| Article | Predicate | Result |
|---|---|---|
| I.1 | citation `Article I` | PASS |
| I.1 | text-presence `server-side\|backend.{0,20}(auth\|permission)\|family.{0,20}(isolat\|scope)` | PASS |
| I.2 | citation `Article I` | PASS |
| I.2 | text-presence `TLS\|HTTPS\|hash\|bcrypt\|argon2\|secure.{0,20}token` | PASS |
| III.1 | citation `Article III` | PASS |
| III.1 | text-presence `postgres\|docker\|expo\|react native` | PASS |
| III.2 | citation `Article III` | PASS |
| III.2 | text-presence `test\|lint` | PASS |

**8/8 predicates pass. 1 scanned, 1 compliant, 0 gaps, 100%.**

## ⚠ Findings for the workflow (this project's actual subject)

1. **The predicates verify the spec's prose, never the code.** All 8 checks above are `citation` /
   `text-presence` against `proposal.md`. They pass because the proposal *says* "server-side",
   "argon2", "postgres", "test". A proposal could satisfy every one of them while the merged diff did
   the opposite. The manifest carries **zero** `code_must_contain` / `code_must_not_contain` predicates,
   so `issue-orchestrator`'s Phase 8 post-flight check — the half that would close this loop — has
   nothing to run. **Coverage of 100% here means "the spec used the right words", not "the code obeys
   the constitution."** Reported honestly rather than as assurance.
2. **Real architectural decisions made in a change's `design.md` never reach the constitution.** The
   walking skeleton decided the session mechanism (opaque server-side tokens over JWT) and the
   atomic-registration rule. Neither is in any canonical source, so neither was visible to this derive.
   Only the Fastify decision surfaced — and only because a task explicitly wrote it back into
   `ARCHITECTURE.md`. Nothing in the workflow makes that write-back systematic; it happened because it
   was hand-authored as task 8.4. Every project will silently lose decisions this way.
3. **The scope-tag override lives in untracked `.claude/`.** See pre-flight note above.

## Next

This was a preview. To apply:

```
/orchestrate-constitution --mode derive --apply
```

That would branch off `main`, write the four files above, and open a draft MR at HALT 4.
