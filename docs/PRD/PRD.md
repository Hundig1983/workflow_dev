---
status: seed
provenance: reconcile
seeded: 2026-08-15
---

# Product Requirements — FamilyHub (SEED)

> **Provisional.** Authored from intent before code exists. Each section carries an `evidence:` marker;
> claims not grounded in a source are listed under Assumptions or Open Questions. Graduated by
> `orchestrate-documentation` as code lands. Do not treat as verified.

## Problem
<!-- evidence: partial -->
Families lack one shared, simple place to coordinate everyday life. Coordination overhead shows up as
repeated messages — *"Who's picking up Emma?"*, *"Did anyone buy milk?"*, *"Where are you?"*, *"What
time is football?"*, *"Who was supposed to book the dentist?"* — that a shared calendar, shopping list,
task list, and location view could answer without another message. The guiding principle: **less
coordination overhead, more awareness of what is happening in the family.** *(source: `project_idea/ideas.txt` §1, §47)*

## Users
<!-- evidence: partial -->
- **Primary context**: a family household. The product is multi-tenant from day one — many independent
  families, each fully isolated from the others (not "one family's private app," a real product boundary).
- **Member types**: `parent` and `child`. The distinction matters mainly for permissions (e.g. only
  parents configure family settings) — deliberately *not* a sophisticated role/permission system at
  first, but permissions must be modeled explicitly rather than hardcoded throughout the app.
- **MVP target**: a small household — two parents, potentially children. A family has at least one
  administrator; one administrator is expected to be sufficient for MVP.
*(source: §2, §4, §29, §30, §33)*

## Goals & scope
<!-- evidence: partial -->
Four core areas, unified by one shared family/member model (notifications support all four, not a
fifth pillar):
- **Family calendar** — create/edit/delete events (title, date, start/optional end time, location,
  description, participants, creator, reminder settings); an event may involve one member, several, or
  the whole family; agenda/list view (calendar/month view is nice-to-have, not required for MVP);
  reminders (10 min / 30 min / 1 h / 1 day before, user-configurable default); a small number of
  recurrence patterns (daily/weekly/monthly) — not full RFC-style recurrence.
- **Shared shopping lists** — multiple lists per family; items with name/quantity/note/category/
  checked state/creator/dates; shared and close-to-real-time (full WebSocket infra not required for the
  first prototype, but the architecture must not preclude adding it); a "shopping mode" UX emphasizing
  unchecked items and quick check/add, with purchased items staying visible until explicitly cleared.
- **Family tasks** — title/description/assignee/due date/priority/status/creator/optional recurrence;
  states todo/in-progress/completed; assignable to any member (children included); appears in both
  personal and family task views. No full Kanban system.
- **Location sharing** — explicit per-member opt-in/opt-out; shows current/last-known position + update
  timestamp; clearly distinguishes "location unavailable" from "location sharing disabled"; must not
  drain battery (no continuous polling; normal/battery-saving modes).
*(source: §3, §7–§9, §11, §12, §16–§18, §20, §21, §23, §38)*

## Non-goals
<!-- evidence: partial -->
**Permanently out of scope** (explicitly listed, not deferred): chat, messaging, video calls, social
features, public profiles, advanced parental controls, image recognition, shopping recommendations,
supermarket integration, bank integration, wearable integration, smart-home integration, complex
subscription/billing, multi-language support, sophisticated analytics. The product is explicitly *not*
a social network, project-management tool, or sophisticated parental-control system.

**Deferred, not permanent** (explicitly named as *future* candidates, not excluded forever — see
`ROADMAP.md`): geofencing / places, an AI assistant, location history, full offline synchronization for
every feature, advanced recurring-event editing.
*(source: §1, §24, §39, §40)*

## Constraints
<!-- evidence: partial -->
- **Security & privacy is first-class**, not an afterthought: HTTPS/TLS; secure authentication; passwords
  via a secure hashing algorithm; authorization checked **server-side only** (frontend never trusted); no
  secrets in the mobile app; secure on-device token storage; minimal location-data retention; **family
  data isolation enforced at the backend** with dedicated automated tests (never rely on frontend
  filtering); proper account/data deletion mechanisms.
- **AI guardrail (explicit, strong)**: location data must never be sent to an LLM; family data must never
  be used to train AI models. This applies to any future AI feature (§ Roadmap), not just MVP.
- **Technical**: runs locally; Docker for backend/DB infrastructure; PostgreSQL; TypeScript; React
  Native/Expo for mobile; reproducible setup; automated tests; linting/formatting; database migrations;
  no hardcoded secrets; clear documentation.
- **Battery**: location sharing must not drain the phone battery — no GPS polling every few seconds;
  update frequency must not be hardcoded before understanding platform capabilities.
- **Project-purpose constraint**: this project is deliberately scoped small — it doubles as a benchmark
  for validating an agentic software-development workflow (requirements analysis → domain modelling →
  architecture → implementation → testing → change requests). Scope decisions should favor staying small
  and coherent over feature breadth.
*(source: §23, §29, §40, §43, §45)*

## Candidate structural backlog
<!-- coarse themes only — NO sequencing, estimates, dependencies, or issue numbers -->
- **foundation:** email/password auth (isolated from family/business logic) incl. session persistence
  and eventual password reset; family + family-member + invitation model; family-data-isolation &
  server-side authorization backbone (with dedicated tests); base REST API skeleton; Docker + Postgres +
  migrations setup.
- **governance:** security/privacy-first rules and the family-isolation boundary as candidate binding
  constitution articles; the AI guardrail (no location-to-LLM, no training on family data) as a candidate
  binding article; unit/integration/E2E testing strategy.
- **first-vertical-slice:** candidates — **shared shopping lists** (the source itself calls this the
  strongest offline use case and a simple end-to-end slice: list → item → check → shared sync) *or*
  **family calendar** (called "one of the central features," presented first). The source does not state
  which to build first — see Open Questions.
- **core-features (post-first-slice):** the remaining three pillars — calendar, tasks, location sharing —
  plus baseline notifications (calendar reminder, task assignment).
*(source: §38, §12–§13)*

## Assumptions
<!-- every forward claim not grounded in a source -->
- **Product name** assumed as "FamilyHub" from the source document's own title (`project_idea/ideas.txt`
  header) — not independently confirmed by a dedicated naming statement. Confirm or rename at the G-seed
  gate.
- One administrator per family is assumed sufficient for MVP (source hedges with "may be sufficient").
- Shopping-list write conflicts default to **last-write-wins** for MVP (source: "might be acceptable,"
  explicitly flagged as needing to stay an *explicit* decision, not an accidental one).
- Purchased shopping items **stay visible** until explicitly cleared, rather than auto-hiding (stated
  preference, §16, to avoid confusing two family members) — the source *also* lists this as an open
  question (§37.18) needing explicit confirmation, so treat this as the MVP default, not a closed decision.
- MVP recurrence limited to daily/weekly/monthly patterns only (no full RFC recurrence).
- Backend web framework is unspecified — the source explicitly defers this to the architecture phase
  (only "TypeScript" and "REST API" are fixed).

## Open Questions
<!-- contradictions surfaced but not resolved; gaps not yet filled — carried forward -->
The source document itself enumerates 35 questions it explicitly does **not** want resolved silently
(`project_idea/ideas.txt` §37); they are reproduced here in full, grouped by domain, plus a few more
surfaced while reconciling the narrative sections. None have been answered — every one is carried forward
verbatim per the skill's invariant.

**Family & accounts**
- Can one user belong to several families?
- Can a child have an account? Can a child profile exist *without* an account?
- Who can invite family members? Who can remove a member?
- What happens when an event participant leaves the family? What happens to tasks assigned to a removed
  member? What should happen to a family when its administrator leaves?

**Calendar**
- Can children create calendar events? Can children see all family events?
- How should recurring calendar events be represented — instances generated dynamically, or ahead of
  time?
- Editing a recurring event: this occurrence only, this-and-future, or the entire series — which (if any)
  should MVP support? *(narrative §10 — deliberately flagged as "an area where I am deliberately unsure")*
- Should calendar events support attachments?
- Should the app support multiple time zones? How should daylight-saving-time changes be handled?

**Shopping**
- Beyond the tentative last-write-wins default (see Assumptions), is there a better simultaneous-edit
  resolution the team should commit to?
- Should shopping-list changes generate notifications — and if so, batched how (adding 5 items shouldn't
  mean 5 pushes)?

**Location**
- Exact authorization model: who can see whose location (parent↔child, child↔child)? Can a parent
  disable location sharing for a child? How is a child's consent represented?
- Should location sharing expire automatically?
- How often should location update, and should updates happen in the background?
- Should the server retain even the *latest* known location, or is that already too much? *(distinct from
  the "no history" assumption above — this is about retaining the current value at all)*
- Should family members be notified when someone starts/stops sharing their location?

**Cross-cutting / platform**
- Offline support: implement it broadly, explicitly defer it, or design for it but implement only for
  shopping lists (the three options the source names)?
- How should conflicting offline changes be merged?
- What is the minimum viable notification system across all four feature areas?
- Should there be a web client at all, beyond a possible later small admin interface?
- Should data be encrypted at rest?
- How long should location data be retained, if any is retained at all?
- How can a user export their data? How can a user delete their account and all family data?
