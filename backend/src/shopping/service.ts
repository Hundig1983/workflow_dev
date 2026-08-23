import type { Queryable } from '../db/pool.js';
import type { FamilyScope } from '../family/scope.js';
import {
  checkItemInScope,
  clearListInScope,
  deleteItemInScope,
  deleteListInScope,
  findListInScope,
  insertItem,
  insertList,
  listActiveItemsInScope,
  listListsWithCounts,
  renameListInScope,
  uncheckItemInScope,
  updateItemInScope,
  type ShoppingItem,
  type ShoppingList,
  type ShoppingListWithCounts,
} from './repository.js';

/**
 * Route-facing results. `list_not_found` covers both "no such list" and "not your
 * family's list" — deliberately indistinguishable (shopping-lists spec, Family
 * isolation: refusal must not reveal existence). `item_not_found` is only reachable
 * once the list gate passed, so it leaks nothing across families; it is also what a
 * late edit against a deleted item receives (delete wins).
 */
export type ListResult<T> = { kind: 'ok'; value: T } | { kind: 'list_not_found' };
export type ItemResult<T> =
  { kind: 'ok'; value: T } | { kind: 'list_not_found' } | { kind: 'item_not_found' };

export interface ListDetail {
  list: ShoppingList;
  /** Active items, split exactly the way the client renders them (spec: grouped apart). */
  unchecked: ShoppingItem[];
  checked: ShoppingItem[];
}

const trimmed = (name: string): string => name.trim();

export async function createList(
  db: Queryable,
  scope: FamilyScope,
  name: string,
): Promise<ShoppingList> {
  return insertList(db, scope, trimmed(name));
}

export async function getLists(
  db: Queryable,
  scope: FamilyScope,
): Promise<ShoppingListWithCounts[]> {
  return listListsWithCounts(db, scope);
}

export async function getListDetail(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
): Promise<ListResult<ListDetail>> {
  const list = await findListInScope(db, scope, listId);
  if (!list) return { kind: 'list_not_found' };
  const items = await listActiveItemsInScope(db, scope, listId);
  return {
    kind: 'ok',
    value: {
      list,
      unchecked: items.filter((i) => i.checkedAt === null),
      checked: items.filter((i) => i.checkedAt !== null),
    },
  };
}

export async function renameList(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
  name: string,
): Promise<ListResult<ShoppingList>> {
  const list = await renameListInScope(db, scope, listId, trimmed(name));
  return list ? { kind: 'ok', value: list } : { kind: 'list_not_found' };
}

export async function removeList(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
): Promise<ListResult<null>> {
  const removed = await deleteListInScope(db, scope, listId);
  // Repeating a delete is "refused as not found without error side effects"
  // (spec: Deleting a list removes its items) — the row is already gone.
  return removed ? { kind: 'ok', value: null } : { kind: 'list_not_found' };
}

export async function addItem(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
  input: { name: string; quantity?: string; note?: string },
): Promise<ListResult<ShoppingItem>> {
  const list = await findListInScope(db, scope, listId);
  if (!list) return { kind: 'list_not_found' };
  const item = await insertItem(db, scope, listId, { ...input, name: trimmed(input.name) });
  return { kind: 'ok', value: item };
}

async function itemOp(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
  op: () => Promise<ShoppingItem | null>,
): Promise<ItemResult<ShoppingItem>> {
  const list = await findListInScope(db, scope, listId);
  if (!list) return { kind: 'list_not_found' };
  const item = await op();
  return item ? { kind: 'ok', value: item } : { kind: 'item_not_found' };
}

export async function editItem(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
  itemId: string,
  patch: { name?: string; quantity?: string | null; note?: string | null },
): Promise<ItemResult<ShoppingItem>> {
  const clean = patch.name === undefined ? patch : { ...patch, name: trimmed(patch.name) };
  return itemOp(db, scope, listId, () => updateItemInScope(db, scope, listId, itemId, clean));
}

export async function checkItem(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
  itemId: string,
): Promise<ItemResult<ShoppingItem>> {
  return itemOp(db, scope, listId, () => checkItemInScope(db, scope, listId, itemId));
}

export async function uncheckItem(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
  itemId: string,
): Promise<ItemResult<ShoppingItem>> {
  return itemOp(db, scope, listId, () => uncheckItemInScope(db, scope, listId, itemId));
}

export async function removeItem(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
  itemId: string,
): Promise<ListResult<null>> {
  const list = await findListInScope(db, scope, listId);
  if (!list) return { kind: 'list_not_found' };
  // Replay-safe by design: whether a row was removed this call or a previous one, the
  // observable state is identical, so both answer success (spec: Mutations are safe
  // to replay). Cross-family targets never reach this line.
  await deleteItemInScope(db, scope, listId, itemId);
  return { kind: 'ok', value: null };
}

export async function clearList(
  db: Queryable,
  scope: FamilyScope,
  listId: string,
): Promise<ListResult<{ archivedCount: number }>> {
  const list = await findListInScope(db, scope, listId);
  if (!list) return { kind: 'list_not_found' };
  const archivedCount = await clearListInScope(db, scope, listId);
  return { kind: 'ok', value: { archivedCount } };
}
