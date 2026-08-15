import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, signup, VALID_PASSWORD, type TestContext } from '../helpers/app.js';
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

describe('POST /auth/signup', () => {
  it('creates an account, a family, and a parent membership', async () => {
    const response = await signup(ctx.app, 'parent@example.com');

    expect(response.statusCode).toBe(201);
    const body = response.json() as { user: { id: string; email: string }; family: { id: string } };
    expect(body.user.email).toBe('parent@example.com');

    const members = await ctx.db.pool.query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [body.family.id, body.user.id],
    );
    expect(members.rows).toEqual([{ role: 'parent' }]);
  });

  it('never returns or stores the plaintext password', async () => {
    const response = await signup(ctx.app, 'parent@example.com');
    expect(response.body).not.toContain(VALID_PASSWORD);

    const stored = await ctx.db.pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1',
      ['parent@example.com'],
    );
    expect(stored.rows[0]?.password_hash).not.toContain(VALID_PASSWORD);
    expect(stored.rows[0]?.password_hash.startsWith('$argon2id$')).toBe(true);
  });

  it('normalizes the email so case variants collide', async () => {
    await signup(ctx.app, 'Parent@Example.com');
    const stored = await ctx.db.pool.query('SELECT email FROM users');
    expect(stored.rows).toEqual([{ email: 'parent@example.com' }]);

    const duplicate = await signup(ctx.app, 'PARENT@EXAMPLE.COM');
    expect(duplicate.statusCode).toBe(409);
  });

  it('rejects a duplicate email and creates nothing', async () => {
    await signup(ctx.app, 'parent@example.com');
    const duplicate = await signup(ctx.app, 'parent@example.com');

    expect(duplicate.statusCode).toBe(409);
    const users = await ctx.db.pool.query('SELECT count(*)::int AS n FROM users');
    const families = await ctx.db.pool.query('SELECT count(*)::int AS n FROM families');
    expect(users.rows[0]).toEqual({ n: 1 });
    expect(families.rows[0]).toEqual({ n: 1 });
  });

  it.each([
    ['not-an-email', 'email'],
    ['also@bad', 'email'],
  ])('rejects malformed email %s', async (email) => {
    const response = await signup(ctx.app, email);
    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: { code: string } }).error.code).toBe('validation_failed');

    const users = await ctx.db.pool.query('SELECT count(*)::int AS n FROM users');
    expect(users.rows[0]).toEqual({ n: 0 });
  });

  it('rejects a password below the strength policy and creates nothing', async () => {
    const response = await signup(ctx.app, 'parent@example.com', 'short');

    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: { field?: string } }).error.field).toBe('password');
    const users = await ctx.db.pool.query('SELECT count(*)::int AS n FROM users');
    expect(users.rows[0]).toEqual({ n: 0 });
  });

  it('rolls back the account and family together when membership insertion fails', async () => {
    // Force the third statement of the registration transaction to fail. If the
    // transaction is not atomic, the user and family rows survive this.
    await ctx.db.pool.query('ALTER TABLE family_members ADD CONSTRAINT tmp_block CHECK (false)');

    const response = await signup(ctx.app, 'parent@example.com');
    expect(response.statusCode).toBe(500);

    const users = await ctx.db.pool.query('SELECT count(*)::int AS n FROM users');
    const families = await ctx.db.pool.query('SELECT count(*)::int AS n FROM families');
    expect(users.rows[0]).toEqual({ n: 0 });
    expect(families.rows[0]).toEqual({ n: 0 });

    await ctx.db.pool.query('ALTER TABLE family_members DROP CONSTRAINT tmp_block');

    // And the email is free again afterwards.
    const retry = await signup(ctx.app, 'parent@example.com');
    expect(retry.statusCode).toBe(201);
  });
});
