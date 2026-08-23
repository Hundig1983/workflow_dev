# Design — add-shared-shopping-lists

Decisions and tradeoffs for the implementer. The smallest defensible option in each case, matching the
patterns the walking skeleton established. Conflict semantics were **decided before this spec** in the
canonical docs (PR #9, imported from prior art patate) — this file applies them, it does not reopen them.

## Schema (one reversible migration, `002_shopping_lists`)

```sql
CREATE TABLE shopping_lists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shopping_lists_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT shopping_lists_name_max CHECK (length(name) <= 120)
);
CREATE INDEX ON shopping_lists (family_id);

CREATE TABLE shopping_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id     uuid NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name        text NOT NULL,
  quantity    text,
  note        text,
  checked_at  timestamptz,
  checked_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  archived_at timestamptz,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shopping_items_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT shopping_items_archived_implies_checked CHECK (archived_at IS NULL OR checked_at IS NOT NULL)
);
CREATE INDEX ON shopping_items (list_id) WHERE archived_at IS NULL;
```

- **State as timestamps, not booleans.** `checked_at`/`archived_at` carry when; `checked_by` carries who.
  "Checked" ≡ `checked_at IS NOT NULL`; "active" ≡ `archived_at IS NULL`. The CHECK constraint makes
  "archived but never checked" unrepresentable.
- **`quantity` is free text** ("2L", "3", "a handful") — the PRD asks for name/quantity/note, not
  arithmetic. A numeric+unit model (patate's) buys nothing until prices/history exist. Down: no summing.
- **Family scoping is by join** (`items → lists → family_id`); items carry no `family_id` of their own —
  one source of scope truth, no denormalized drift. Every repository query takes the branded
  `FamilyScope` exactly like `family/repository.ts`.

## Conflict semantics (applying the decided rules)

- **LWW**: the server stamps `updated_at = now()` on every successful mutation; concurrent PATCHes both
  succeed and the later arrival stands. **Deliberately no `If-Match`/version precondition** — LWW was
  chosen over optimistic concurrency control; a precondition would surface conflicts the product decided
  to absorb.
- **Idempotent check/uncheck**: `check` sets `checked_at = COALESCE(checked_at, now())`,
  `checked_by = COALESCE(checked_by, <caller>)` — re-checking changes nothing (first checker stands);
  `uncheck` nulls both. Both return the resulting item either way.
- **Delete-wins**: deletes are unconditional; a late edit against a deleted row gets the same
  refused-as-not-found the isolation path uses. Nothing recreates rows.
- **Clear**: `UPDATE … SET archived_at = now() WHERE list_id = $1 AND checked_at IS NOT NULL AND
  archived_at IS NULL` — one statement, inherently idempotent, unchecked rows untouched.

## API (all authenticated; scope from session; every response carries `updated_at`)

```
POST   /families/me/shopping-lists                     {name}                    → 201 list
GET    /families/me/shopping-lists                                              → lists + unchecked/checked counts
GET    /families/me/shopping-lists/:listId                                      → list + active items (grouped)
PATCH  /families/me/shopping-lists/:listId             {name}                    → 200 list (LWW)
DELETE /families/me/shopping-lists/:listId                                      → 204 (cascade)
POST   /families/me/shopping-lists/:listId/items       {name, quantity?, note?}  → 201 item
PATCH  /families/me/shopping-lists/:listId/items/:id   {name?, quantity?, note?} → 200 item (LWW)
POST   /families/me/shopping-lists/:listId/items/:id/check                      → 200 item (idempotent)
POST   /families/me/shopping-lists/:listId/items/:id/uncheck                    → 200 item (idempotent)
DELETE /families/me/shopping-lists/:listId/items/:id                            → 204 (idempotent outcome)
POST   /families/me/shopping-lists/:listId/clear                                → 200 {archivedCount} (idempotent)
```

- `check`/`uncheck`/`clear` are POST verbs on sub-resources, not PATCH state flags: they name the
  *operation* whose idempotence the spec guarantees, which keeps the future offline replay queue a list
  of named operations rather than diffed states.
- Cross-family targets get the same refusal the existing family paths use (scope makes the row
  invisible; the spec pins the behavior — "refused without revealing existence" — not the status code).
- Archived items are absent from `GET :listId` (active view). No history endpoint in this slice.

## Dashboard delta

`buildDashboard` fills `sections[shopping].items` with `{listId, name, uncheckedCount}` per list (one
grouped count query). `isEmpty` keeps its existing derivation (`every section empty`) and therefore
flips false when a list exists — no special-casing. `DashboardSection.items` loses `readonly never[]`
for the shopping key; the type becomes a per-key union so calendar/tasks/location stay `never[]`.

## Client

- **Lists screen** (from the dashboard's shopping section): list names + unchecked counts, create by
  name, delete with confirm.
- **List detail screen**: add input at top; unchecked group; checked group visually apart; per-item
  check/uncheck tap, edit, delete; **Clear checked** action. Load / empty / error states presented
  distinctly, exactly like the dashboard screen's three states.
- **Optimistic UI with rollback**: mutations apply locally first, reconcile with the server response,
  roll back on rejection — the client-side half of the decided LWW posture. No client-side conflict
  detection (server semantics absorb conflicts).
- Same module boundary as the skeleton: `shopping/` talks to `api/`, never to `auth/` (eslint-enforced).

## Alternatives rejected

- **Optimistic concurrency (`If-Match` on `updated_at`)** — contradicts the decided LWW posture; would
  reintroduce user-visible conflict errors the product chose to absorb.
- **Soft-delete for items** — delete-wins makes hard delete the honest semantic; archive already covers
  "keep it visible/retained" for the checked flow. Two retention mechanisms would blur I.3.
- **Store-anchored lists (patate's model)** — richer (history/suggestions/prices hang off stores) but a
  bigger first slice; FamilyHub's PRD asks for generic named lists. Stores can arrive later without
  schema damage (a nullable `store_id` on lists, or a `stores` table referencing lists).
- **Realtime push in-slice** — the ARCHITECTURE ADR defers realtime; "close-to-real-time" is met by
  refetch-on-focus + optimistic UI for now.

## Risks

- **Dashboard contract change** is the one shared surface touched; the delta spec pins the new shape and
  the client change rides in the same slice, so no consumer is left behind.
- **LWW absorbs conflicts silently** by design; if family-scale reality later demands visibility
  ("who renamed this?"), `checked_by`/`created_by` columns and timestamps leave room for an activity
  trail without schema change.
