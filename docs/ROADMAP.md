---
status: seed
provenance: reconcile
seeded: 2026-08-15
---

# Roadmap — FamilyHub (SEED)

> **Coarse product direction only — not a plan.** Candidate themes and rough direction. **No
> sequencing, no estimates, no dependencies, no issue numbers.** The candidate *structural backlog*
> lives in the PRD + the handoff; decomposition and ordering are `spec-creator` / `create-issue`'s job,
> not this skill's.

## Direction
<!-- evidence: partial -->
FamilyHub aims to become, in the source's own words, *"our family's shared memory and coordination
layer"* — one place where a household sees what's happening, what needs attention, what needs to be
bought, and where everyone is (when they choose to share). It starts from a small, coherent MVP across
four pillars on one shared family/member model, and grows carefully from there. The project is
deliberately kept small on purpose: it doubles as a benchmark for validating an agentic
software-development workflow, so scope discipline is itself a project goal, not just a constraint.
*(source: `project_idea/ideas.txt` §1, §45, §47)*

## Candidate themes
<!-- coarse groupings of intent — unordered -->
- **MVP core** — auth, family/member model, calendar (agenda view + basic reminders), shared shopping
  lists, tasks, explicit-opt-in location sharing showing only the latest known position.
- **Deepen offline & sync** — offline support beyond shopping lists, conflict-handling policy, and a
  realtime sync layer once "close to real-time" collaboration needs it.
- **Recurrence & scheduling depth** — fuller recurring-event edit semantics (single occurrence vs.
  this-and-future vs. whole series), recurring tasks, and recurrence patterns beyond daily/weekly/monthly.
- **Geofencing / places** — named places (Home, School, Work, …) and arrival/departure detection (*"Emma
  arrived at school"*). Explicitly a **future** theme, not MVP.
- **AI assistant** — a natural-language layer over calendar/tasks/shopping/location, strictly through
  controlled read-only tools, never a core-app dependency and never trained on family data.
- **Workflow-benchmark change requests** — five deliberate post-MVP change requests the source pre-planned
  specifically to exercise the development workflow after a stable MVP exists: (1) children can share
  location with parents but not siblings; (2) shopping lists work offline and sync on reconnect; (3) an
  event can have multiple reminders; (4) a parent can see who is responsible for each shopping-list item;
  (5) a weekly summary of upcoming events, unfinished tasks, and missing shopping items.
*(source: §24, §38, §40, §42)*

## Open Questions
- ~~Which MVP vertical slice should be built first — shopping lists or calendar?~~ **Resolved
  2026-08-23 (j.levrat): shared shopping lists first** — the strongest offline case, the simplest
  end-to-end slice, and the area where working prior art (patate) supplies vetted decisions. Calendar is
  the next candidate. (The walking skeleton — auth + empty dashboard — shipped 2026-08-23, issue #2.)
- Should the five pre-planned workflow-benchmark change requests (see above) run strictly after a stable
  MVP, or be interleaved with MVP development? Not stated either way.
