# Tasks — add-shared-shopping-lists

Sequenced for one implementer. Every task traces to a requirement scenario (specs/) or a design
decision (design.md). Constitution hooks are named inline the way the walking skeleton's tasks were.

## 1. Schema

- [ ] 1.1 Add migration `002_shopping_lists` to `backend/src/db/migrations.ts` — both tables, checks,
  indexes, and a `down` that drops them (reversible, Article III.2 discipline; design.md §Schema)
- [ ] 1.2 Extend the migrations integration test to cover up→down→up for `002` (pattern:
  `tests/integration/migrations.test.ts`)

## 2. Backend domain

- [ ] 2.1 `backend/src/shopping/repository.ts` — every query takes the branded `FamilyScope`; items are
  scoped by join through their list (design.md §Schema; spec: Family isolation)
- [ ] 2.2 `backend/src/shopping/service.ts` — list create/rename/delete; item add/edit; idempotent
  check/uncheck (`COALESCE` semantics, first checker stands); delete; clear (single idempotent UPDATE
  archiving checked-and-active only) (spec: Item lifecycle, Idempotent check-off, Clear)
- [ ] 2.3 Server-stamped `updated_at = now()` on every mutation; all list/item payloads expose
  `updated_at` (spec: Offline-ready contract)

## 3. HTTP

- [ ] 3.1 `backend/src/http/routes/shopping.ts` — the 11 endpoints from design.md §API, JSON-Schema
  validation per route (name 1–120 trimmed non-blank; quantity/note optional), auth guard + family
  scope resolved from the session exactly like `routes/families.ts` (Article I.1)
- [ ] 3.2 Cross-family and deleted targets refused without revealing existence — same refusal shape the
  family routes use (spec: Family isolation; Delete wins)
- [ ] 3.3 Register routes in `server.ts`; module boundary respected (`shopping/` imports no `auth/`
  internals — the existing eslint rule must fail a deliberate violation, then pass)

## 4. Tests (backend)

- [ ] 4.1 Isolation suite: two families; every new read and mutation path attempted cross-family; fails
  if scoping is removed (mutation-verify like the skeleton's 6.7) (Article I.1)
- [ ] 4.2 Conflict semantics: double-check is idempotent (one checked state, first checker stands);
  uncheck twice; concurrent-style edit-after-delete refused as not found; LWW — two sequential renames,
  later stands, `updated_at` moves (spec: Item lifecycle; Idempotent check-off)
- [ ] 4.3 Clear: archives only checked+active; unchecked untouched; second clear archives zero;
  archived items absent from the active view (spec: Clear archives only the checked items)
- [ ] 4.4 Replay safety: re-sending an already-succeeded check/delete/clear yields the same state, no
  error (spec: Mutations are safe to replay)

## 5. Dashboard delta

- [ ] 5.1 `dashboard/service.ts` — `sections[shopping].items` = `{listId, name, uncheckedCount}` per
  list (one grouped count query); type narrowed per key; `isEmpty` derivation untouched (delta spec:
  Shopping lists appear on the dashboard)
- [ ] 5.2 Dashboard integration test: family with a 2-unchecked-item list → summary present, count 2,
  `isEmpty` false; family with lists but zero unchecked → not empty (delta spec scenarios)

## 6. Client

- [ ] 6.1 `client/src/shopping/` — types + api module (all 11 calls; `updated_at` carried through;
  module boundary: no `auth/` import)
- [ ] 6.2 Lists screen: list names + unchecked counts from the dashboard/list endpoints; create; delete
  with confirm; empty and error states distinct (family-dashboard pattern)
- [ ] 6.3 List detail screen: add input; unchecked group; checked group visually apart; check/uncheck;
  edit; delete; **Clear checked** (spec: Checked items stay visible)
- [ ] 6.4 Optimistic updates with rollback on rejection for add/check/uncheck/delete/clear (design.md
  §Client — the client half of LWW)
- [ ] 6.5 Dashboard screen: shopping section renders the summaries and navigates to the lists

## 7. Close-out

- [ ] 7.1 Lint + typecheck + format + full test suite green on both packages; no secret introduced
  (Article III.2)
- [ ] 7.2 Verify the slice end-to-end against a running stack: create list → add items → check →
  another member sees it → clear → archived gone from view, unchecked kept (walk the spec's scenarios)
- [ ] 7.3 Tick the Constitutional Alignment checkboxes in `proposal.md` only against evidence in the
  merged diff, not intent (the 8.5 rule); update `README.md` only if a run instruction changed
