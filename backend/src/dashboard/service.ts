import type { Queryable } from '../db/pool.js';
import { findFamilyInScope, listMembersInScope } from '../family/repository.js';
import type { FamilyScope } from '../family/scope.js';
import { listShoppingSummaries, type ShoppingListSummary } from '../shopping/repository.js';

/** Feature sections fill in as their areas land; only shopping is real so far. */
export type DashboardSection =
  | { key: 'calendar' | 'tasks' | 'location'; items: readonly never[] }
  | { key: 'shopping'; items: readonly ShoppingListSummary[] };

export interface Dashboard {
  family: { id: string; name: string };
  members: { userId: string; email: string; role: string }[];
  sections: DashboardSection[];
  /**
   * Explicit, successful "nothing here yet" — distinct from an error, so the client
   * can render a deliberate empty state rather than guessing from an absent field
   * (family-dashboard spec, "Explicit empty state").
   */
  isEmpty: boolean;
}

const SECTION_KEYS = ['calendar', 'tasks', 'shopping', 'location'] as const;

export async function buildDashboard(db: Queryable, scope: FamilyScope): Promise<Dashboard | null> {
  const family = await findFamilyInScope(db, scope);
  if (!family) return null;

  const members = await listMembersInScope(db, scope);
  const shopping = await listShoppingSummaries(db, scope);
  // A list with zero unchecked items still counts as content: "lists exist and
  // everything is done" is not the same state as "no lists yet" (family-dashboard
  // delta spec) — so summaries appear regardless of their counts.
  const sections: DashboardSection[] = SECTION_KEYS.map((key) =>
    key === 'shopping' ? { key, items: shopping } : { key, items: [] as readonly never[] },
  );

  return {
    family: { id: family.id, name: family.name },
    members,
    sections,
    isEmpty: sections.every((section) => section.items.length === 0),
  };
}
