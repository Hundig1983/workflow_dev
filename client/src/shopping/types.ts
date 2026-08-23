export interface ShoppingList {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
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
  checkedAt: string | null;
  checkedBy: string | null;
  createdAt: string;
  /** LWW anchor — carried on every payload so a future offline client can queue/replay. */
  updatedAt: string;
}

export interface ListDetail {
  list: ShoppingList;
  unchecked: ShoppingItem[];
  checked: ShoppingItem[];
}

/** Shape of the dashboard's shopping section items (family-dashboard delta spec). */
export interface ShoppingSummary {
  listId: string;
  name: string;
  uncheckedCount: number;
}

export function isShoppingSummaryArray(items: unknown[]): items is ShoppingSummary[] {
  return items.every(
    (i) =>
      typeof i === 'object' &&
      i !== null &&
      typeof (i as ShoppingSummary).listId === 'string' &&
      typeof (i as ShoppingSummary).name === 'string' &&
      typeof (i as ShoppingSummary).uncheckedCount === 'number',
  );
}
