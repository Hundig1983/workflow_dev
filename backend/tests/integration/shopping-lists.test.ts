import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { auth, createTestContext, signupAndLogin, type TestContext } from '../helpers/app.js';
import { truncateAll } from '../helpers/postgres.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx?.stop();
});
afterEach(async () => {
  await truncateAll(ctx.db.pool);
});

interface List {
  id: string;
  name: string;
  updatedAt: string;
}
interface Item {
  id: string;
  listId: string;
  name: string;
  quantity: string | null;
  note: string | null;
  checkedAt: string | null;
  checkedBy: string | null;
  updatedAt: string;
}

async function createList(token: string, name = 'Groceries'): Promise<List> {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/families/me/shopping-lists',
    headers: auth(token),
    payload: { name },
  });
  expect(res.statusCode).toBe(201);
  return res.json() as List;
}

async function addItem(
  token: string,
  listId: string,
  payload: { name: string; quantity?: string; note?: string },
): Promise<Item> {
  const res = await ctx.app.inject({
    method: 'POST',
    url: `/families/me/shopping-lists/${listId}/items`,
    headers: auth(token),
    payload,
  });
  expect(res.statusCode).toBe(201);
  return res.json() as Item;
}

async function getDetail(token: string, listId: string) {
  const res = await ctx.app.inject({
    method: 'GET',
    url: `/families/me/shopping-lists/${listId}`,
    headers: auth(token),
  });
  expect(res.statusCode).toBe(200);
  return res.json() as { list: List; unchecked: Item[]; checked: Item[] };
}

describe('list management', () => {
  it('creates a named list and exposes updated_at', async () => {
    const { token } = await signupAndLogin(ctx.app, 'a@example.com');
    const list = await createList(token, 'Groceries');
    expect(list.name).toBe('Groceries');
    expect(list.updatedAt).toBeTruthy();
  });

  it('rejects a blank name without creating a list', async () => {
    const { token } = await signupAndLogin(ctx.app, 'a@example.com');
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/families/me/shopping-lists',
      headers: auth(token),
      payload: { name: '   ' },
    });
    expect(res.statusCode).toBe(400);
    const lists = await ctx.app.inject({
      method: 'GET',
      url: '/families/me/shopping-lists',
      headers: auth(token),
    });
    expect((lists.json() as { lists: unknown[] }).lists).toHaveLength(0);
  });

  it('rename is last-write-wins: the later write stands and updated_at moves', async () => {
    const { token } = await signupAndLogin(ctx.app, 'a@example.com');
    const list = await createList(token);
    const first = await ctx.app.inject({
      method: 'PATCH',
      url: `/families/me/shopping-lists/${list.id}`,
      headers: auth(token),
      payload: { name: 'Weekly shop' },
    });
    const second = await ctx.app.inject({
      method: 'PATCH',
      url: `/families/me/shopping-lists/${list.id}`,
      headers: auth(token),
      payload: { name: 'Saturday market' },
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const detail = await getDetail(token, list.id);
    expect(detail.list.name).toBe('Saturday market');
    expect(new Date(detail.list.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(list.updatedAt).getTime(),
    );
  });

  it('deleting a list removes its items; deleting again is refused as not found', async () => {
    const { token } = await signupAndLogin(ctx.app, 'a@example.com');
    const list = await createList(token);
    await addItem(token, list.id, { name: 'Milk' });

    const del = await ctx.app.inject({
      method: 'DELETE',
      url: `/families/me/shopping-lists/${list.id}`,
      headers: auth(token),
    });
    expect(del.statusCode).toBe(204);

    const again = await ctx.app.inject({
      method: 'DELETE',
      url: `/families/me/shopping-lists/${list.id}`,
      headers: auth(token),
    });
    expect(again.statusCode).toBe(404);

    const { rows } = await ctx.db.pool.query('SELECT count(*)::int AS n FROM shopping_items');
    expect((rows[0] as { n: number }).n).toBe(0);
  });
});

describe('item lifecycle', () => {
  it('adds an item with quantity and note into the unchecked group', async () => {
    const { token } = await signupAndLogin(ctx.app, 'a@example.com');
    const list = await createList(token);
    const item = await addItem(token, list.id, {
      name: 'Milk',
      quantity: '2L',
      note: 'lactose-free',
    });
    expect(item.quantity).toBe('2L');
    const detail = await getDetail(token, list.id);
    expect(detail.unchecked.map((i) => i.name)).toEqual(['Milk']);
    expect(detail.checked).toHaveLength(0);
  });

  it('edits resolve last-write-wins and can null a field explicitly', async () => {
    const { token } = await signupAndLogin(ctx.app, 'a@example.com');
    const list = await createList(token);
    const item = await addItem(token, list.id, { name: 'Milk', note: 'old note' });

    const a = await ctx.app.inject({
      method: 'PATCH',
      url: `/families/me/shopping-lists/${list.id}/items/${item.id}`,
      headers: auth(token),
      payload: { note: 'first write' },
    });
    const b = await ctx.app.inject({
      method: 'PATCH',
      url: `/families/me/shopping-lists/${list.id}/items/${item.id}`,
      headers: auth(token),
      payload: { note: null },
    });
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    const detail = await getDetail(token, list.id);
    expect(detail.unchecked[0]?.note).toBeNull();
  });

  it('delete wins over a late edit: the edit is refused as not found', async () => {
    const { token } = await signupAndLogin(ctx.app, 'a@example.com');
    const list = await createList(token);
    const item = await addItem(token, list.id, { name: 'Milk' });

    const del = await ctx.app.inject({
      method: 'DELETE',
      url: `/families/me/shopping-lists/${list.id}/items/${item.id}`,
      headers: auth(token),
    });
    expect(del.statusCode).toBe(204);

    const lateEdit = await ctx.app.inject({
      method: 'PATCH',
      url: `/families/me/shopping-lists/${list.id}/items/${item.id}`,
      headers: auth(token),
      payload: { name: 'Oat milk' },
    });
    expect(lateEdit.statusCode).toBe(404);
    const detail = await getDetail(token, list.id);
    expect(detail.unchecked).toHaveLength(0);
  });
});

describe('idempotent check-off and uncheck', () => {
  it('double-check yields one checked state, the first checker stands, updated_at does not move on replay', async () => {
    const { token, userId } = await signupAndLogin(ctx.app, 'a@example.com');
    const list = await createList(token);
    const item = await addItem(token, list.id, { name: 'Milk' });

    const url = `/families/me/shopping-lists/${list.id}/items/${item.id}/check`;
    const first = await ctx.app.inject({ method: 'POST', url, headers: auth(token) });
    expect(first.statusCode).toBe(200);
    const afterFirst = first.json() as Item;
    expect(afterFirst.checkedAt).not.toBeNull();
    expect(afterFirst.checkedBy).toBe(userId);

    const replay = await ctx.app.inject({ method: 'POST', url, headers: auth(token) });
    expect(replay.statusCode).toBe(200);
    const afterReplay = replay.json() as Item;
    expect(afterReplay.checkedAt).toBe(afterFirst.checkedAt);
    expect(afterReplay.checkedBy).toBe(afterFirst.checkedBy);
    // Replay is a true no-op: updated_at unchanged, so a replayed check can never
    // beat a concurrent uncheck under LWW (design.md, conflict semantics).
    expect(afterReplay.updatedAt).toBe(afterFirst.updatedAt);
  });

  it('two members checking the same item is safe and keeps the first checker', async () => {
    const first = await signupAndLogin(ctx.app, 'a@example.com');
    const list = await createList(first.token);
    const item = await addItem(first.token, list.id, { name: 'Milk' });

    // Second member joins the same family directly (no invitation flow in this slice).
    const second = await signupAndLogin(ctx.app, 'b@example.com');
    await ctx.db.pool.query('DELETE FROM family_members WHERE user_id = $1', [second.userId]);
    await ctx.db.pool.query(
      "INSERT INTO family_members (family_id, user_id, role) VALUES ($1, $2, 'parent')",
      [first.familyId, second.userId],
    );

    const url = `/families/me/shopping-lists/${list.id}/items/${item.id}/check`;
    const r1 = await ctx.app.inject({ method: 'POST', url, headers: auth(first.token) });
    const r2 = await ctx.app.inject({ method: 'POST', url, headers: auth(second.token) });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect((r2.json() as Item).checkedBy).toBe(first.userId);

    const detail = await getDetail(first.token, list.id);
    expect(detail.checked).toHaveLength(1);
  });

  it('uncheck restores the item and is idempotent too', async () => {
    const { token } = await signupAndLogin(ctx.app, 'a@example.com');
    const list = await createList(token);
    const item = await addItem(token, list.id, { name: 'Milk' });
    const base = `/families/me/shopping-lists/${list.id}/items/${item.id}`;

    await ctx.app.inject({ method: 'POST', url: `${base}/check`, headers: auth(token) });
    const un1 = await ctx.app.inject({
      method: 'POST',
      url: `${base}/uncheck`,
      headers: auth(token),
    });
    const un2 = await ctx.app.inject({
      method: 'POST',
      url: `${base}/uncheck`,
      headers: auth(token),
    });
    expect(un1.statusCode).toBe(200);
    expect(un2.statusCode).toBe(200);
    expect((un2.json() as Item).checkedAt).toBeNull();

    const detail = await getDetail(token, list.id);
    expect(detail.unchecked).toHaveLength(1);
    expect(detail.checked).toHaveLength(0);
  });
});

describe('checked visibility and explicit clear', () => {
  it('clear archives only checked items, keeps unchecked ones, and is idempotent', async () => {
    const { token } = await signupAndLogin(ctx.app, 'a@example.com');
    const list = await createList(token);
    const milk = await addItem(token, list.id, { name: 'Milk' });
    const eggs = await addItem(token, list.id, { name: 'Eggs' });
    await addItem(token, list.id, { name: 'Bread' });

    for (const id of [milk.id, eggs.id]) {
      await ctx.app.inject({
        method: 'POST',
        url: `/families/me/shopping-lists/${list.id}/items/${id}/check`,
        headers: auth(token),
      });
    }

    // Checked items are still visible, grouped apart, before the clear.
    const before = await getDetail(token, list.id);
    expect(before.checked.map((i) => i.name).sort()).toEqual(['Eggs', 'Milk']);
    expect(before.unchecked.map((i) => i.name)).toEqual(['Bread']);

    const clear = await ctx.app.inject({
      method: 'POST',
      url: `/families/me/shopping-lists/${list.id}/clear`,
      headers: auth(token),
    });
    expect(clear.statusCode).toBe(200);
    expect((clear.json() as { archivedCount: number }).archivedCount).toBe(2);

    const after = await getDetail(token, list.id);
    expect(after.checked).toHaveLength(0);
    expect(after.unchecked.map((i) => i.name)).toEqual(['Bread']);

    // Archived rows are retained, not destroyed (Article I.3).
    const { rows } = await ctx.db.pool.query(
      'SELECT count(*)::int AS n FROM shopping_items WHERE archived_at IS NOT NULL',
    );
    expect((rows[0] as { n: number }).n).toBe(2);

    const replay = await ctx.app.inject({
      method: 'POST',
      url: `/families/me/shopping-lists/${list.id}/clear`,
      headers: auth(token),
    });
    expect((replay.json() as { archivedCount: number }).archivedCount).toBe(0);
  });
});

describe('replay safety (offline-ready contract)', () => {
  it('replaying an already-succeeded delete and clear yields the same state with no error', async () => {
    const { token } = await signupAndLogin(ctx.app, 'a@example.com');
    const list = await createList(token);
    const item = await addItem(token, list.id, { name: 'Milk' });
    const itemUrl = `/families/me/shopping-lists/${list.id}/items/${item.id}`;

    const d1 = await ctx.app.inject({ method: 'DELETE', url: itemUrl, headers: auth(token) });
    const d2 = await ctx.app.inject({ method: 'DELETE', url: itemUrl, headers: auth(token) });
    expect(d1.statusCode).toBe(204);
    expect(d2.statusCode).toBe(204);

    const c1 = await ctx.app.inject({
      method: 'POST',
      url: `/families/me/shopping-lists/${list.id}/clear`,
      headers: auth(token),
    });
    const c2 = await ctx.app.inject({
      method: 'POST',
      url: `/families/me/shopping-lists/${list.id}/clear`,
      headers: auth(token),
    });
    expect(c1.statusCode).toBe(200);
    expect(c2.statusCode).toBe(200);
  });

  it('every list and item payload exposes updated_at', async () => {
    const { token } = await signupAndLogin(ctx.app, 'a@example.com');
    const list = await createList(token);
    const item = await addItem(token, list.id, { name: 'Milk' });
    expect(list.updatedAt).toBeTruthy();
    expect(item.updatedAt).toBeTruthy();

    const lists = await ctx.app.inject({
      method: 'GET',
      url: '/families/me/shopping-lists',
      headers: auth(token),
    });
    for (const l of (lists.json() as { lists: List[] }).lists) expect(l.updatedAt).toBeTruthy();

    const detail = await getDetail(token, list.id);
    for (const i of [...detail.unchecked, ...detail.checked]) expect(i.updatedAt).toBeTruthy();
  });
});
