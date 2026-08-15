import type { Queryable } from '../db/pool.js';
import type { FamilyRole, FamilyScope } from './scope.js';

export interface Family {
  id: string;
  name: string;
  createdAt: Date;
}

export interface FamilyMemberSummary {
  userId: string;
  email: string;
  role: FamilyRole;
}

export async function insertFamily(db: Queryable, name: string): Promise<Family> {
  const { rows } = await db.query<{ id: string; name: string; created_at: Date }>(
    'INSERT INTO families (name) VALUES ($1) RETURNING id, name, created_at',
    [name],
  );
  const row = rows[0];
  if (!row) throw new Error('INSERT ... RETURNING produced no row');
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export async function insertMembership(
  db: Queryable,
  familyId: string,
  userId: string,
  role: FamilyRole,
): Promise<void> {
  await db.query('INSERT INTO family_members (family_id, user_id, role) VALUES ($1, $2, $3)', [
    familyId,
    userId,
    role,
  ]);
}

/**
 * Family-scoped read. Taking `FamilyScope` (not a bare id) is what makes the
 * authorization check unskippable — see scope.ts.
 */
export async function findFamilyInScope(db: Queryable, scope: FamilyScope): Promise<Family | null> {
  const { rows } = await db.query<{ id: string; name: string; created_at: Date }>(
    'SELECT id, name, created_at FROM families WHERE id = $1',
    [scope.familyId],
  );
  const row = rows[0];
  return row ? { id: row.id, name: row.name, createdAt: row.created_at } : null;
}

export async function listMembersInScope(
  db: Queryable,
  scope: FamilyScope,
): Promise<FamilyMemberSummary[]> {
  const { rows } = await db.query<{ user_id: string; email: string; role: FamilyRole }>(
    `SELECT fm.user_id, u.email, fm.role
       FROM family_members fm
       JOIN users u ON u.id = fm.user_id
      WHERE fm.family_id = $1
      ORDER BY fm.created_at ASC`,
    [scope.familyId],
  );
  return rows.map((r) => ({ userId: r.user_id, email: r.email, role: r.role }));
}
