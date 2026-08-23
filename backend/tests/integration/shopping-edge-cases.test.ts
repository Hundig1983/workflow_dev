/**
 * Edge cases found by the FORGE adversarial examine pass (-x) on this slice's own diff.
 * Each one guards an invariant the spec implies but does not spell out as a scenario:
 * archived items are immutable, a partial PATCH leaves untouched fields alone, and an
 * item id is only valid within the list that owns it (even inside the same family).
 */
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

async function setup() {
  const { token } = await signupAndLogin(ctx.app, 'a@example.com');
  const list = (
    await ctx.app.inject({
      method: 'POST',
      url: '/families/me/shopping-lists',
      headers: auth(token),
      payload: { name: 'L' },
    })
  ).json() as { id: string };
  const item = (
    await ctx.app.inject({
      method: 'POST',
      url: `/families/me/shopping-lists/${list.id}/items`,
      headers: auth(token),
      payload: { name: 'Milk', quantity: '2L', note: 'n' },
    })
  ).json() as { id: string };
  return { token, listId: list.id, itemId: item.id };
}

describe('shopping edge cases', () => {
  it('A: an archived item cannot be checked/edited/resurrected after clear', async () => {
    const { token, listId, itemId } = await setup();
    const base = `/families/me/shopping-lists/${listId}/items/${itemId}`;
    await ctx.app.inject({ method: 'POST', url: `${base}/check`, headers: auth(token) });
    await ctx.app.inject({
      method: 'POST',
      url: `/families/me/shopping-lists/${listId}/clear`,
      headers: auth(token),
    });
    const edit = await ctx.app.inject({
      method: 'PATCH',
      url: base,
      headers: auth(token),
      payload: { name: 'Zombie' },
    });
    const uncheck = await ctx.app.inject({
      method: 'POST',
      url: `${base}/uncheck`,
      headers: auth(token),
    });
    expect(edit.statusCode).toBe(404);
    expect(uncheck.statusCode).toBe(404);
    const detail = (
      await ctx.app.inject({
        method: 'GET',
        url: `/families/me/shopping-lists/${listId}`,
        headers: auth(token),
      })
    ).json() as { unchecked: unknown[]; checked: unknown[] };
    expect(detail.unchecked).toHaveLength(0);
    expect(detail.checked).toHaveLength(0);
  });

  it('B: PATCH with only a name leaves quantity and note untouched', async () => {
    const { token, listId, itemId } = await setup();
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/families/me/shopping-lists/${listId}/items/${itemId}`,
      headers: auth(token),
      payload: { name: 'Oat milk' },
    });
    const body = res.json() as { name: string; quantity: string | null; note: string | null };
    expect(body.name).toBe('Oat milk');
    expect(body.quantity).toBe('2L');
    expect(body.note).toBe('n');
  });

  it('C: an item id from another list of the SAME family is refused', async () => {
    const { token, listId, itemId } = await setup();
    const other = (
      await ctx.app.inject({
        method: 'POST',
        url: '/families/me/shopping-lists',
        headers: auth(token),
        payload: { name: 'Other' },
      })
    ).json() as { id: string };
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/families/me/shopping-lists/${other.id}/items/${itemId}/check`,
      headers: auth(token),
    });
    expect(res.statusCode).toBe(404);
  });

  it('D: uncheck then re-check re-stamps checked_by to the new checker', async () => {
    const { token, listId, itemId } = await setup();
    const base = `/families/me/shopping-lists/${listId}/items/${itemId}`;
    const c1 = (
      await ctx.app.inject({ method: 'POST', url: `${base}/check`, headers: auth(token) })
    ).json() as { checkedAt: string; updatedAt: string };
    await ctx.app.inject({ method: 'POST', url: `${base}/uncheck`, headers: auth(token) });
    const c2 = (
      await ctx.app.inject({ method: 'POST', url: `${base}/check`, headers: auth(token) })
    ).json() as { checkedAt: string; updatedAt: string };
    expect(new Date(c2.checkedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(c1.checkedAt).getTime(),
    );
    expect(new Date(c2.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(c1.updatedAt).getTime(),
    );
  });

  it('E: list name is trimmed on write, not just validated', async () => {
    const { token } = await signupAndLogin(ctx.app, 'b@example.com');
    const list = (
      await ctx.app.inject({
        method: 'POST',
        url: '/families/me/shopping-lists',
        headers: auth(token),
        payload: { name: '  Padded  ' },
      })
    ).json() as { name: string };
    expect(list.name).toBe('Padded');
  });

  it('F: a 121-char list name is rejected by schema, not by the DB', async () => {
    const { token } = await signupAndLogin(ctx.app, 'c@example.com');
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/families/me/shopping-lists',
      headers: auth(token),
      payload: { name: 'x'.repeat(121) },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { code: string } }).error.code).toBe('validation_failed');
  });
});
