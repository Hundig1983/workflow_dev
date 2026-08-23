import type { ApiClient } from '../api/client';
import type { ListDetail, ShoppingItem, ShoppingList, ShoppingListWithCounts } from './types';

/**
 * Always under `/families/me/…`: the family is resolved server-side from the session
 * (Article I.1) — this module never sees, stores, or sends a family id.
 */
const base = '/families/me/shopping-lists';

export async function createList(api: ApiClient, name: string): Promise<ShoppingList> {
  return api.request<ShoppingList>(base, { method: 'POST', body: { name } });
}

export async function fetchLists(api: ApiClient): Promise<ShoppingListWithCounts[]> {
  const { lists } = await api.request<{ lists: ShoppingListWithCounts[] }>(base);
  return lists;
}

export async function fetchListDetail(api: ApiClient, listId: string): Promise<ListDetail> {
  return api.request<ListDetail>(`${base}/${listId}`);
}

export async function renameList(
  api: ApiClient,
  listId: string,
  name: string,
): Promise<ShoppingList> {
  return api.request<ShoppingList>(`${base}/${listId}`, { method: 'PATCH', body: { name } });
}

export async function deleteList(api: ApiClient, listId: string): Promise<void> {
  await api.request<void>(`${base}/${listId}`, { method: 'DELETE' });
}

export async function addItem(
  api: ApiClient,
  listId: string,
  input: { name: string; quantity?: string; note?: string },
): Promise<ShoppingItem> {
  return api.request<ShoppingItem>(`${base}/${listId}/items`, { method: 'POST', body: input });
}

export async function editItem(
  api: ApiClient,
  listId: string,
  itemId: string,
  patch: { name?: string; quantity?: string | null; note?: string | null },
): Promise<ShoppingItem> {
  return api.request<ShoppingItem>(`${base}/${listId}/items/${itemId}`, {
    method: 'PATCH',
    body: patch,
  });
}

export async function checkItem(
  api: ApiClient,
  listId: string,
  itemId: string,
): Promise<ShoppingItem> {
  return api.request<ShoppingItem>(`${base}/${listId}/items/${itemId}/check`, { method: 'POST' });
}

export async function uncheckItem(
  api: ApiClient,
  listId: string,
  itemId: string,
): Promise<ShoppingItem> {
  return api.request<ShoppingItem>(`${base}/${listId}/items/${itemId}/uncheck`, { method: 'POST' });
}

export async function deleteItem(api: ApiClient, listId: string, itemId: string): Promise<void> {
  await api.request<void>(`${base}/${listId}/items/${itemId}`, { method: 'DELETE' });
}

export async function clearList(
  api: ApiClient,
  listId: string,
): Promise<{ archivedCount: number }> {
  return api.request<{ archivedCount: number }>(`${base}/${listId}/clear`, { method: 'POST' });
}
