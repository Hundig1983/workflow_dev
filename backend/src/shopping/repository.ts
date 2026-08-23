import type { Queryable } from '../db/pool.js';
import type { FamilyScope } from '../family/scope.js';

export interface ShoppingList {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShoppingListWithCounts extends ShoppingList {
  uncheckedCount: number;
  checkedCount: number;
}

export interface ShoppingItem {
  id: string;
  listId: string;
  name: string;
  quantity: string | null;
  note: string | null;
  checkedAt: Date | null;
  checkedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Dashboard projection (family-dashboard delta spec). */
export interface ShoppingListSummary {
  listId: string;
  name: string;
  uncheckedCount: number;
}

interface ListRow {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

interface ItemRow {
  id: string;
  list_id: string;
  name: string;
  quantity: string | null;
  note: string | null;
  checked_at: Date | null;
  checked_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const toList = (r: ListRow): ShoppingList => ({
  id: r.id,
  name: r.name,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toItem = (r: ItemRow): ShoppingItem => ({
  id: r.id,
  listId: r.list_id,
  name: r.name,
  quantity: r.quantity,
  note: r.note,
  checkedAt: r.checked_at,
  checkedBy: r.checked_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const LIST_COLS = 'id, name, created_at, updated_at';
const ITEM_COLS =
  'id, list_id, name, quantity, note, checked_at, checked_by, created_at, updated_at';

export async function insertList(
  db: Queryable,
  scope: FamilyScope,
  name: string,
): Promise<ShoppingList> {
  const { rows } = await db.query<ListRow>(
    `INSERT INTO shopping_lists (family_id, name, created_by)
     VALUES ($1, $2, $3)
     RETURNING ${LIST_COLS}`,
    [scope.familyId, name, scope.userId],
  );
  const row = rows[0];
  if (!row) throw new Error('INSERT ... RETURNING produced no row');
  return toList(row);
}

export async function listListsWithCounts(
  db: Queryable,
  scope: FamilyScope,
): Promise<ShoppingListWithCounts[]> {
  const { rows } = await db.query<ListRow & { unchecked_count: string; checked_count: string }>(
    `SELECT l.id, l.name, l.created_at, l.updated_at,
            COUNT(i.id) FILTER (WHERE i.checked_at IS NULL)     AS unchecked_count,
            COUNT(i.id) FILTER (WHERE i.checked_at IS NOT NULL) AS checked_count
       FROM shopping_lists l
       LEFT JOIN shopping_items i ON i.list_id = l.id AND i.archived_at IS NULL
      WHERE l.family_id = $1
      GROUP BY l.id
      ORDER BY l.created_at ASC`,
    [scope.familyId],
  );
  return rows.map((r) => ({
    ...toList(r),
    uncheckedCount: Number(r.unchecked_count),
    checkedCount: Number(r.checked_count),
  }));
}

/**
 * The in-scope gate every item operation goes through: a list outside the caller's
 * family resolves to null exactly like a list that does not exist, so the refusal
 * never reveals existence (shopping-lists spec, "Family isolation").
 */
export async function findListInScope(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
): Promise<ShoppingList | null> {
  const { rows } = await db.query<ListRow>(
    `SELECT ${LIST_COLS} FROM shopping_lists WHERE id = $1 AND family_id = $2`,
    [listId, scope.familyId],
  );
  const row = rows[0];
  return row ? toList(row) : null;
}

/** LWW: the later successful write stands; updated_at is stamped server-side. */
export async function renameListInScope(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
  name: string,
): Promise<ShoppingList | null> {
  const { rows } = await db.query<ListRow>(
    `UPDATE shopping_lists
        SET name = $3, updated_at = now()
      WHERE id = $1 AND family_id = $2
      RETURNING ${LIST_COLS}`,
    [listId, scope.familyId, name],
  );
  const row = rows[0];
  return row ? toList(row) : null;
}

export async function deleteListInScope(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    'DELETE FROM shopping_lists WHERE id = $1 AND family_id = $2',
    [listId, scope.familyId],
  );
  return (rowCount ?? 0) > 0;
}

export async function insertItem(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
  input: { name: string; quantity?: string; note?: string },
): Promise<ShoppingItem> {
  // The caller (service) has already gated on findListInScope; the WHERE-subquery keeps
  // the write itself scoped too, so a bypassed gate still cannot write cross-family.
  const { rows } = await db.query<ItemRow>(
    `INSERT INTO shopping_items (list_id, name, quantity, note, created_by)
     SELECT l.id, $3, $4, $5, $6
       FROM shopping_lists l
      WHERE l.id = $1 AND l.family_id = $2
     RETURNING ${ITEM_COLS}`,
    [listId, scope.familyId, input.name, input.quantity ?? null, input.note ?? null, scope.userId],
  );
  const row = rows[0];
  if (!row) throw new Error('shopping list disappeared between scope gate and insert');
  return toItem(row);
}

export async function listActiveItemsInScope(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
): Promise<ShoppingItem[]> {
  const { rows } = await db.query<ItemRow>(
    `SELECT ${ITEM_COLS.replace(/(^|, )/g, '$1i.')}
       FROM shopping_items i
       JOIN shopping_lists l ON l.id = i.list_id
      WHERE i.list_id = $1 AND l.family_id = $2 AND i.archived_at IS NULL
      ORDER BY i.created_at ASC`,
    [listId, scope.familyId],
  );
  return rows.map(toItem);
}

async function findActiveItemInScope(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
  itemId: string,
): Promise<ShoppingItem | null> {
  const { rows } = await db.query<ItemRow>(
    `SELECT ${ITEM_COLS.replace(/(^|, )/g, '$1i.')}
       FROM shopping_items i
       JOIN shopping_lists l ON l.id = i.list_id
      WHERE i.id = $1 AND i.list_id = $2 AND l.family_id = $3 AND i.archived_at IS NULL`,
    [itemId, listId, scope.familyId],
  );
  const row = rows[0];
  return row ? toItem(row) : null;
}

/** LWW edit of an active item; a deleted or archived item is not found (delete wins). */
export async function updateItemInScope(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
  itemId: string,
  patch: { name?: string; quantity?: string | null; note?: string | null },
): Promise<ShoppingItem | null> {
  const { rows } = await db.query<ItemRow>(
    `UPDATE shopping_items i
        SET name       = COALESCE($4::text, i.name),
            quantity   = CASE WHEN $6::boolean THEN $5::text ELSE i.quantity END,
            note       = CASE WHEN $8::boolean THEN $7::text ELSE i.note END,
            updated_at = now()
       FROM shopping_lists l
      WHERE i.id = $1 AND i.list_id = $2 AND l.id = i.list_id AND l.family_id = $3
        AND i.archived_at IS NULL
      RETURNING ${ITEM_COLS.replace(/(^|, )/g, '$1i.')}`,
    [
      itemId,
      listId,
      scope.familyId,
      patch.name ?? null,
      patch.quantity ?? null,
      patch.quantity !== undefined,
      patch.note ?? null,
      patch.note !== undefined,
    ],
  );
  const row = rows[0];
  return row ? toItem(row) : null;
}

/**
 * Idempotent check-off: the mutation fires only while unchecked (the first checker
 * stands and `updated_at` does NOT move on replay — a replayed no-op must not beat a
 * concurrent uncheck under LWW). A no-op falls back to returning the current row.
 */
export async function checkItemInScope(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
  itemId: string,
): Promise<ShoppingItem | null> {
  const { rows } = await db.query<ItemRow>(
    `UPDATE shopping_items i
        SET checked_at = now(), checked_by = $4, updated_at = now()
       FROM shopping_lists l
      WHERE i.id = $1 AND i.list_id = $2 AND l.id = i.list_id AND l.family_id = $3
        AND i.archived_at IS NULL AND i.checked_at IS NULL
      RETURNING ${ITEM_COLS.replace(/(^|, )/g, '$1i.')}`,
    [itemId, listId, scope.familyId, scope.userId],
  );
  const row = rows[0];
  if (row) return toItem(row);
  return findActiveItemInScope(db, scope, listId, itemId);
}

/** Idempotent uncheck: mirror of checkItemInScope. */
export async function uncheckItemInScope(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
  itemId: string,
): Promise<ShoppingItem | null> {
  const { rows } = await db.query<ItemRow>(
    `UPDATE shopping_items i
        SET checked_at = NULL, checked_by = NULL, updated_at = now()
       FROM shopping_lists l
      WHERE i.id = $1 AND i.list_id = $2 AND l.id = i.list_id AND l.family_id = $3
        AND i.archived_at IS NULL AND i.checked_at IS NOT NULL
      RETURNING ${ITEM_COLS.replace(/(^|, )/g, '$1i.')}`,
    [itemId, listId, scope.familyId],
  );
  const row = rows[0];
  if (row) return toItem(row);
  return findActiveItemInScope(db, scope, listId, itemId);
}

/** Hard delete (delete-wins). Returns whether a row was removed this call. */
export async function deleteItemInScope(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
  itemId: string,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM shopping_items i
      USING shopping_lists l
      WHERE i.id = $1 AND i.list_id = $2 AND l.id = i.list_id AND l.family_id = $3`,
    [itemId, listId, scope.familyId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * One idempotent statement: archives exactly the checked-and-active items of the list
 * (shopping-lists spec, "Clear archives only the checked items"). Archived rows are
 * retained, not destroyed (Article I.3).
 */
export async function clearListInScope(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE shopping_items i
        SET archived_at = now(), updated_at = now()
       FROM shopping_lists l
      WHERE i.list_id = $1 AND l.id = i.list_id AND l.family_id = $2
        AND i.checked_at IS NOT NULL AND i.archived_at IS NULL`,
    [listId, scope.familyId],
  );
  return rowCount ?? 0;
}

/** Dashboard projection: one summary per list with its live unchecked count. */
export async function listShoppingSummaries(
  db: Queryable,
  scope: FamilyScope,
): Promise<ShoppingListSummary[]> {
  const { rows } = await db.query<{ id: string; name: string; unchecked_count: string }>(
    `SELECT l.id, l.name,
            COUNT(i.id) FILTER (WHERE i.checked_at IS NULL AND i.archived_at IS NULL) AS unchecked_count
       FROM shopping_lists l
       LEFT JOIN shopping_items i ON i.list_id = l.id
      WHERE l.family_id = $1
      GROUP BY l.id
      ORDER BY l.created_at ASC`,
    [scope.familyId],
  );
  return rows.map((r) => ({
    listId: r.id,
    name: r.name,
    uncheckedCount: Number(r.unchecked_count),
  }));
}
