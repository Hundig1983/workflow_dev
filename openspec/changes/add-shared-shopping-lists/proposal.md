# Proposal: add-shared-shopping-lists

<!-- request-type: feature · intake: COMPLEX 6/10 (DB schema +2, multi-layer +2, >3 files +1, shared dashboard contract +1) -->

## Why

The walking skeleton (archived change `add-auth-walking-skeleton`) proved the structural seam — auth,
families, an explicitly empty dashboard — and deliberately shipped zero features. This change delivers
the **first real feature slice**: shared shopping lists, the vertical the ROADMAP resolved as first on
2026-08-23 (strongest offline case, simplest end-to-end slice, and the area where the author's working
prior art — patate, `github.com/Hundig1983/patate` — supplies vetted decisions, imported into the
canonical docs in PR #9). After this, the dashboard's `shopping` section stops being empty by
construction and `isEmpty` means something.

## What Changes

- **New tables** `shopping_lists` and `shopping_items` (one reversible migration): family-scoped lists
  with named items carrying quantity and note; `updated_at` on both tables; checked and archived state
  as timestamps (`checked_at`, `archived_at`), never booleans, so semantics stay auditable.
- **New authenticated, family-scoped REST endpoints** under `/families/me/shopping-lists` — create /
  rename / delete lists; add / edit / check / uncheck / delete items; an explicit **clear** that
  archives all checked items. Family scope resolved server-side from the session (Article I.1 pattern —
  no client-supplied family id).
- **Decided conflict semantics** (canonical docs, PR #9): **last-write-wins on `updated_at`**, check-off
  and uncheck **idempotent**, **delete-wins** over concurrent edits, optimistic UI client-side. Every
  list resource response exposes `updated_at`, and all mutations are idempotent-or-LWW, so offline sync
  can be added later against unchanged API semantics (ARCHITECTURE ADR "offline-ready without shipping
  offline").
- **Checked items stay visible**, grouped apart from unchecked ones, until an explicit clear **archives**
  them (they leave the active view but are not destroyed — retention decision, PRD).
- **Client**: a Lists screen and a List detail screen (add input, unchecked group, checked group, clear
  action), optimistic updates with rollback on rejection, empty and error states presented distinctly
  (family-dashboard "explicit empty state" pattern reused).
- **Dashboard delta**: `sections[shopping].items` becomes real — per-list summaries (id, name, unchecked
  count); `isEmpty` turns `false` once any list exists. The dashboard contract changes shape for the
  shopping section only — additive for clients that ignore section item shapes, but flagged: it is the
  one shared contract this slice touches.

**Out of scope** (explicitly, per the request): stores, suggestions, prices, purchase history, offline
mode, notifications, realtime push. None of these is a permanent non-goal (Article V.1 checked below) —
they are deferred, not forbidden.

## Capabilities

### New Capabilities

- `shopping-lists` — list management, item lifecycle (add/edit/check/uncheck/delete), checked-visibility
  + explicit clear-to-archive, conflict semantics (LWW / idempotent / delete-wins), family isolation,
  offline-ready contract (`updated_at` everywhere).

### Modified Capabilities

- `family-dashboard` — the `shopping` section now carries per-list summaries and participates in
  `isEmpty`; the "explicit empty state" requirement gains the distinction "no lists yet" vs "lists exist
  but everything is done".

## Impact

- **Backend**: new `backend/src/shopping/` module (repository + service, family-scope-branded like
  `family/`); new routes file; migration `002_shopping_lists` in `backend/src/db/migrations.ts`;
  dashboard service reads real counts. No auth-surface change (existing guard reused untouched).
- **Client**: new `client/src/shopping/` (api + types) and two screens; Dashboard screen renders the
  shopping section as navigation into lists.
- **Tests**: isolation suite extended to the new resources (mutation-verified like task 6.7 of the
  skeleton); dedicated conflict-semantics tests (idempotent double-check, delete-wins, LWW ordering);
  clear-archives-only-checked.
- **No** new env vars, no infra change, no dependency addition expected backend-side.

## Constitutional Alignment

<!-- constitution-version: 1.1 -->
<!-- scope-tags: tenancy, db, testing, business-logic -->
<!-- applicable-articles: I.1, I.3, III.2, V.1 -->

This change is governed by 4 constitutional articles per its declared scope tags. The author confirms
alignment with each by ticking the box and ensuring the change text satisfies the verification hint.
Boxes are ticked at authoring time against the *spec's* text; the implementer re-verifies against the
*merged diff* (close-out task), per the evidence-not-intent rule.

- [x] **[Article I.1](../../../docs/architecture/constitution.md#article-i-1) — Server-side authorization & family isolation**
  Verify: citation `Article I`; spec shows server-side family scoping.
  → Every list/item read and mutation is resolved through the session's family scope server-side
  (`/families/me/…`, no client-supplied family id); cross-family access is refused without revealing
  existence; dedicated isolation scenarios + mutation-verified tests are in scope (specs
  `shopping-lists` → Family isolation).
- [x] **[Article I.3](../../../docs/architecture/constitution.md#article-i-3) — Data retention & deletion**
  Verify: citation `Article I`; retention/deletion semantics explicit.
  → Deletion is real deletion (list delete cascades its items; item delete removes the row — delete-wins
  is the decided conflict rule). Clearing **archives** checked items (`archived_at`, out of active view,
  retained) — the PRD-decided visibility/retention behavior, stated in the spec rather than implied.
- [x] **[Article III.2](../../../docs/architecture/constitution.md#article-iii-2) — Quality gates**
  Verify: citation `Article III`; tests + lint in scope.
  → Dedicated integration tests for isolation and for each conflict rule (idempotent check, delete-wins,
  LWW), lint/typecheck/format on both packages, no secret introduced; reversible migration keeps the
  RISKY-tier rollback discipline established by `001_initial`.
- [x] **[Article V.1](../../../docs/architecture/constitution.md#article-v-1) — Permanent non-goals**
  Verify: citation `Article V`; out-of-scope list checked against the permanent non-goals.
  → The slice's out-of-scope list (stores, suggestions, prices, history, offline, notifications,
  realtime) contains **deferred** items only; nothing on Article V's permanent list (no shopping
  *recommendations*, no supermarket integration, no chat/social) enters scope. "Suggestions" here means
  patate-style history autocomplete — deferred anyway; the Article V item "shopping recommendations"
  (algorithmic purchase advice) stays untouched.

*Sections applicable by tag but with no surface in this change (their applies-when is unmet — noted for
the reviewer, no checkbox owed):* **I.2** Transport & credential security (no credential, token, or
transport change; the auth guard is reused untouched) · **III.1** Stack & runtime (no stack decision —
existing Fastify/Postgres/Expo reused; the Compose stack is unchanged) · **IV.1** Location discipline
(no location surface in this change).
