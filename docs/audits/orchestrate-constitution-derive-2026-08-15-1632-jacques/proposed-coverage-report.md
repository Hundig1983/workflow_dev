# Coverage Report — 2026-08-15

Constitution version: 1.1
Spec mode: openspec
Specs scanned: 1
Compliant: 1
Gaps: 0
Avg coverage: 100% (8/8 predicates satisfied)

## Per-spec status

### `add-auth-walking-skeleton` — ✓ compliant

Source: `openspec/changes/add-auth-walking-skeleton/proposal.md`
Declared scope tags: `auth, tenancy, infra, testing`
Applicable articles (by scope-tag intersection): **I.1, I.2, III.1, III.2**
Alignment checkboxes: 4/4 ticked

| Article | Predicate | Type | Result |
|---|---|---|---|
| I.1 — Server-side authorization & family isolation | `Article I` | citation | PASS |
| I.1 | `server-side\|backend.{0,20}(auth\|permission)\|family.{0,20}(isolat\|scope)` | text-presence | PASS |
| I.2 — Transport & credential security | `Article I` | citation | PASS |
| I.2 | `TLS\|HTTPS\|hash\|bcrypt\|argon2\|secure.{0,20}token` | text-presence | PASS |
| III.1 — Stack & runtime | `Article III` | citation | PASS |
| III.1 | `postgres\|docker\|expo\|react native` | text-presence | PASS |
| III.2 — Quality gates | `Article III` | citation | PASS |
| III.2 | `test\|lint` | text-presence | PASS |

Articles **II** (AI Assistant Data Boundary), **IV** (Location Update Discipline), and **V** (Product
Scope Boundary) do not intersect the declared scope tags and are correctly not required of this change.

## ⚠ What this number does and does not mean

**It means:** the change's `proposal.md` cites the articles that apply to its declared scope, and
contains the text each article's verification predicate looks for.

**It does not mean the code obeys the constitution.** Every predicate in this manifest is of type
`citation` or `text-presence`, evaluated against the proposal's prose. There are **no**
`code_must_contain` / `code_must_not_contain` predicates, so nothing here inspects the diff. A change
whose proposal said all the right words while the implementation did the opposite would score 100%.

For this particular change the code *was* independently verified — 51 tests against real PostgreSQL,
plus a mutation check confirming the family-isolation suite fails when scoping is removed (see
`docs/audits/job-audit_2_jacques_2026-08-15-1622.md`). That assurance comes from the job audit, **not
from this coverage number.**

Treat this report as advisory, as v1.0 intends. Raising it to real assurance requires adding code-level
predicates to the manifest so `issue-orchestrator`'s Phase 8 post-flight check has something to run.
