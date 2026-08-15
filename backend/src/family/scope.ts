import type { Queryable } from '../db/pool.js';

declare const familyScopeBrand: unique symbol;

/**
 * Proof that a caller belongs to a family, resolved server-side from their session.
 *
 * The brand is not exported, so a `FamilyScope` cannot be constructed anywhere except
 * `resolveFamilyScope` below. Every family-scoped query takes one as a required
 * argument, which makes "I forgot to scope this query" a compile error rather than a
 * silent data leak (Article I.1; design.md, "Family scope resolution lives in one place").
 */
export interface FamilyScope {
  readonly familyId: string;
  readonly userId: string;
  readonly role: FamilyRole;
  readonly [familyScopeBrand]: true;
}

export type FamilyRole = 'parent' | 'child';

/**
 * The single place a FamilyScope is minted. It derives the family from the
 * authenticated user's membership rows — never from anything the client sent.
 *
 * Takes the caller's oldest membership. Today every user has exactly one, because
 * registration creates exactly one family. The schema already permits several, so
 * when the PRD's open question "can one user belong to several families?" is answered
 * yes, this silently picking the first becomes wrong — the caller will need to say
 * which family they mean, and this signature will have to carry it.
 */
export async function resolveFamilyScope(
  db: Queryable,
  userId: string,
): Promise<FamilyScope | null> {
  const { rows } = await db.query<{ family_id: string; role: FamilyRole }>(
    `SELECT family_id, role
       FROM family_members
      WHERE user_id = $1
      ORDER BY created_at ASC
      LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return { familyId: row.family_id, userId, role: row.role } as FamilyScope;
}

/**
 * True only when the client-supplied family id names the caller's own family.
 *
 * Callers must reject on false rather than substituting the caller's family —
 * silently "correcting" a mismatched id would hide an authorization probe
 * (family-membership spec, "Client-supplied family identifier cannot widen scope").
 */
export function scopeCovers(scope: FamilyScope, requestedFamilyId: string): boolean {
  return scope.familyId === requestedFamilyId;
}
