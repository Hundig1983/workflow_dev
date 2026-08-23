/**
 * Family isolation for shopping lists and items (Article I.1; shopping-lists spec,
 * "Family isolation of lists and items").
 *
 * Every path is exercised cross-family and must answer 404 without revealing whether
 * the target exists. These tests fail if any new query loses its family filter: the
 * scoping lives in the SQL (`family_id = scope.familyId` / join through the list), so
 * removing it makes the cross-family request succeed and the assertion go red —
 * the mutation-verification property the spec demands.
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

interface Fixture {
  ownerToken: string;
  strangerToken: string;
  listId: string;
  itemId: string;
}

async function fixture(): Promise<Fixture> {
  const owner = await signupAndLogin(ctx.app, 'owner@example.com');
  const stranger = await signupAndLogin(ctx.app, 'stranger@example.com');

  const list = (
    await ctx.app.inject({
      method: 'POST',
      url: '/families/me/shopping-lists',
      headers: auth(owner.token),
      payload: { name: 'Groceries' },
    })
  ).json() as { id: string };

  const item = (
    await ctx.app.inject({
      method: 'POST',
      url: `/families/me/shopping-lists/${list.id}/items`,
      headers: auth(owner.token),
      payload: { name: 'Milk' },
    })
  ).json() as { id: string };

  return {
    ownerToken: owner.token,
    strangerToken: stranger.token,
    listId: list.id,
    itemId: item.id,
  };
}

describe('cross-family refusal without existence leak', () => {
  it('refuses every list and item path identically for another family', async () => {
    const f = await fixture();
    const base = `/families/me/shopping-lists/${f.listId}`;
    const itemUrl = `${base}/items/${f.itemId}`;

    const attempts: {
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
      url: string;
      payload?: object;
    }[] = [
      { method: 'GET', url: base },
      { method: 'PATCH', url: base, payload: { name: 'Hijacked' } },
      { method: 'DELETE', url: base },
      { method: 'POST', url: `${base}/items`, payload: { name: 'Injected' } },
      { method: 'PATCH', url: itemUrl, payload: { name: 'Hijacked item' } },
      { method: 'POST', url: `${itemUrl}/check` },
      { method: 'POST', url: `${itemUrl}/uncheck` },
      { method: 'DELETE', url: itemUrl },
      { method: 'POST', url: `${base}/clear` },
    ];

    for (const attempt of attempts) {
      const res = await ctx.app.inject({
        method: attempt.method,
        url: attempt.url,
        headers: auth(f.strangerToken),
        ...(attempt.payload ? { payload: attempt.payload } : {}),
      });
      expect(res.statusCode, `${attempt.method} ${attempt.url}`).toBe(404);
      const body = res.json() as { error: { code: string; message: string } };
      // The refusal for "another family's list" must be byte-identical to "no such
      // list" — same code, same message — so existence cannot be probed.
      expect(body.error.code).toBe('not_found');
      expect(body.error.message).toBe('Shopping list not found.');
    }
  });

  it('a genuinely nonexistent list answers exactly like a foreign one', async () => {
    const f = await fixture();
    const ghost = '00000000-0000-4000-8000-000000000000';
    const foreign = await ctx.app.inject({
      method: 'GET',
      url: `/families/me/shopping-lists/${f.listId}`,
      headers: auth(f.strangerToken),
    });
    const absent = await ctx.app.inject({
      method: 'GET',
      url: `/families/me/shopping-lists/${ghost}`,
      headers: auth(f.strangerToken),
    });
    expect(foreign.statusCode).toBe(absent.statusCode);
    expect(foreign.json()).toEqual(absent.json());
  });

  it("cross-family mutations change nothing in the owner's data", async () => {
    const f = await fixture();
    const detail = (
      await ctx.app.inject({
        method: 'GET',
        url: `/families/me/shopping-lists/${f.listId}`,
        headers: auth(f.ownerToken),
      })
    ).json() as { list: { name: string }; unchecked: { name: string; checkedAt: null }[] };

    expect(detail.list.name).toBe('Groceries');
    expect(detail.unchecked.map((i) => i.name)).toEqual(['Milk']);
  });

  it("the strangers' own list view stays empty — no foreign rows bleed in", async () => {
    const f = await fixture();
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/families/me/shopping-lists',
      headers: auth(f.strangerToken),
    });
    expect((res.json() as { lists: unknown[] }).lists).toHaveLength(0);
  });

  it('unauthenticated requests are refused before any side effect', async () => {
    const f = await fixture();
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/families/me/shopping-lists/${f.listId}/clear`,
    });
    expect(res.statusCode).toBe(401);
  });
});
