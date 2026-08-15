import type { Queryable } from '../db/pool.js';
import { findFamilyInScope, listMembersInScope } from '../family/repository.js';
import type { FamilyScope } from '../family/scope.js';

export interface DashboardSection {
  key: 'calendar' | 'tasks' | 'shopping' | 'location';
  items: readonly never[];
}

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
  // No feature area exists yet, so every section is empty by construction. When
  // calendar/tasks/shopping/location land they populate these same keys.
  const sections = SECTION_KEYS.map((key) => ({ key, items: [] as readonly never[] }));

  return {
    family: { id: family.id, name: family.name },
    members,
    sections,
    isEmpty: sections.every((section) => section.items.length === 0),
  };
}
