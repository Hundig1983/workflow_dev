import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  auth,
  createTestContext,
  login,
  signup,
  signupAndLogin,
  VALID_PASSWORD,
  type TestContext,
} from '../helpers/app.js';
import { truncateAll } from '../helpers/postgres.js';
import { hashSessionToken } from '../../src/auth/tokens.js';

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

describe('POST /auth/login', () => {
  it('issues a session token for valid credentials', async () => {
    await signup(ctx.app, 'parent@example.com');
    const response = await login(ctx.app, 'parent@example.com');

    expect(response.statusCode).toBe(200);
    const body = response.json() as { token: string; expiresAt: string };
    expect(body.token.length).toBeGreaterThanOrEqual(43);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('stores only the hash of the token, never the token itself', async () => {
    await signup(ctx.app, 'parent@example.com');
    const { token } = (await login(ctx.app, 'parent@example.com')).json() as { token: string };

    const stored = await ctx.db.pool.query<{ token_hash: string }>(
      'SELECT token_hash FROM sessions',
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]?.token_hash).toBe(hashSessionToken(token));
    expect(stored.rows[0]?.token_hash).not.toBe(token);
  });

  it('fails identically for an unknown email and a wrong password', async () => {
    await signup(ctx.app, 'parent@example.com');

    const unknown = await login(ctx.app, 'nobody@example.com', VALID_PASSWORD);
    const wrong = await login(ctx.app, 'parent@example.com', 'definitely-wrong-password');

    expect(unknown.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
    expect(unknown.body).toBe(wrong.body);
  });

  it('issues no session when credentials are invalid', async () => {
    await signup(ctx.app, 'parent@example.com');
    await login(ctx.app, 'parent@example.com', 'definitely-wrong-password');

    const sessions = await ctx.db.pool.query('SELECT count(*)::int AS n FROM sessions');
    expect(sessions.rows[0]).toEqual({ n: 0 });
  });
});

describe('authenticating a request', () => {
  it('accepts a live session', async () => {
    const { token } = await signupAndLogin(ctx.app, 'parent@example.com');
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/families/me/dashboard',
      headers: auth(token),
    });
    expect(response.statusCode).toBe(200);
  });

  it.each([
    ['no header', undefined],
    ['a malformed header', 'NotBearer abc'],
    ['an unknown token', 'Bearer aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
    ['an empty bearer value', 'Bearer '],
  ])('rejects a request with %s', async (_label, header) => {
    const response = await ctx.app.inject({
      method: 'GET',
      url: '/families/me/dashboard',
      ...(header ? { headers: { authorization: header } } : {}),
    });
    expect(response.statusCode).toBe(401);
    expect((response.json() as { error: { code: string } }).error.code).toBe('unauthenticated');
  });

  it('rejects an expired session', async () => {
    const { token } = await signupAndLogin(ctx.app, 'parent@example.com');
    await ctx.db.pool.query("UPDATE sessions SET expires_at = now() - interval '1 second'");

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/families/me/dashboard',
      headers: auth(token),
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the session so its token stops working immediately', async () => {
    const { token } = await signupAndLogin(ctx.app, 'parent@example.com');

    const loggedOut = await ctx.app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: auth(token),
    });
    expect(loggedOut.statusCode).toBe(204);

    const after = await ctx.app.inject({
      method: 'GET',
      url: '/families/me/dashboard',
      headers: auth(token),
    });
    expect(after.statusCode).toBe(401);
  });

  it('rejects a revoked token even while its expiry is still in the future', async () => {
    const { token } = await signupAndLogin(ctx.app, 'parent@example.com');
    await ctx.db.pool.query(
      "UPDATE sessions SET revoked_at = now(), expires_at = now() + interval '1 year'",
    );

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/families/me/dashboard',
      headers: auth(token),
    });
    expect(response.statusCode).toBe(401);
  });

  it('requires authentication to log out', async () => {
    const response = await ctx.app.inject({ method: 'POST', url: '/auth/logout' });
    expect(response.statusCode).toBe(401);
  });
});
