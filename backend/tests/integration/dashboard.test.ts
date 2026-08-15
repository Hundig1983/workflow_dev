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

describe('GET /families/me/dashboard', () => {
  it("returns the caller's family with an explicit empty state", async () => {
    const { token, familyId } = await signupAndLogin(ctx.app, 'parent@example.com');

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/families/me/dashboard',
      headers: auth(token),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      family: { id: string; name: string };
      members: unknown[];
      sections: { key: string; items: unknown[] }[];
      isEmpty: boolean;
    };

    expect(body.family.id).toBe(familyId);
    expect(body.family.name).toBe("parent's family");
    expect(body.members).toHaveLength(1);
    expect(body.isEmpty).toBe(true);
    expect(body.sections.map((s) => s.key).sort()).toEqual([
      'calendar',
      'location',
      'shopping',
      'tasks',
    ]);
    for (const section of body.sections) expect(section.items).toEqual([]);
  });

  it('reports emptiness as a successful response, distinguishable from an error', async () => {
    const { token } = await signupAndLogin(ctx.app, 'parent@example.com');

    const ok = await ctx.app.inject({
      method: 'GET',
      url: '/families/me/dashboard',
      headers: auth(token),
    });
    const failure = await ctx.app.inject({ method: 'GET', url: '/families/me/dashboard' });

    // Empty: 2xx with a body describing the family. Failure: non-2xx with an error code.
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { isEmpty: boolean }).isEmpty).toBe(true);
    expect(ok.json()).not.toHaveProperty('error');

    expect(failure.statusCode).toBe(401);
    expect(failure.json()).toHaveProperty('error');
  });

  it("accepts the caller's own family id on the by-id route", async () => {
    const { token, familyId } = await signupAndLogin(ctx.app, 'parent@example.com');

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/families/${familyId}/dashboard`,
      headers: auth(token),
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { family: { id: string } }).family.id).toBe(familyId);
  });

  it('honours a custom family name given at signup', async () => {
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: 'parent@example.com',
        password: 'correct-horse-battery-staple',
        familyName: 'The Lopez Family',
      },
    });
    expect(created.statusCode).toBe(201);

    const { token } = (
      await ctx.app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'parent@example.com', password: 'correct-horse-battery-staple' },
      })
    ).json() as { token: string };

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/families/me/dashboard',
      headers: auth(token),
    });
    expect((response.json() as { family: { name: string } }).family.name).toBe('The Lopez Family');
  });
});
