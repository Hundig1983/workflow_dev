import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { auth, createTestContext, signupAndLogin, type TestContext } from '../helpers/app.js';
import { truncateAll } from '../helpers/postgres.js';
import { findFamilyInScope, listMembersInScope } from '../../src/family/repository.js';
import { resolveFamilyScope } from '../../src/family/scope.js';

/**
 * Article I.1 — the constitution's most forcefully stated rule. These are the
 * "dedicated automated tests" it requires; they are the reason this change exists in
 * the shape it does, so they are deliberately explicit rather than parameterised.
 */

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

async function twoFamilies() {
  const alice = await signupAndLogin(ctx.app, 'alice@example.com');
  const bob = await signupAndLogin(ctx.app, 'bob@example.com');
  expect(alice.familyId).not.toBe(bob.familyId);
  return { alice, bob };
}

describe('cross-family isolation', () => {
  it('denies a member of one family access to another family by id', async () => {
    const { alice, bob } = await twoFamilies();

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/families/${bob.familyId}/dashboard`,
      headers: auth(alice.token),
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).not.toContain('bob@example.com');
  });

  it('rejects a mismatched family id rather than silently serving the caller their own', async () => {
    const { alice, bob } = await twoFamilies();

    const response = await ctx.app.inject({
      method: 'GET',
      url: `/families/${bob.familyId}/dashboard`,
      headers: auth(alice.token),
    });

    // A quiet fallback to Alice's own family would look like success and hide the probe.
    expect(response.statusCode).not.toBe(200);
    expect(response.body).not.toContain(alice.familyId);
  });

  it("serves only the caller's own family on the /me route, with two families present", async () => {
    const { alice, bob } = await twoFamilies();

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/families/me/dashboard',
      headers: auth(alice.token),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      family: { id: string };
      members: { email: string }[];
    };
    expect(body.family.id).toBe(alice.familyId);
    expect(body.family.id).not.toBe(bob.familyId);
    expect(body.members.map((m) => m.email)).toEqual(['alice@example.com']);
    expect(response.body).not.toContain('bob@example.com');
  });

  it('holds when the request is crafted to bypass any client-side filtering', async () => {
    const { alice, bob } = await twoFamilies();

    // Straight at the API with another family's id, plus a spoofed body/query — no
    // client code involved at all.
    const crafted = await ctx.app.inject({
      method: 'GET',
      url: `/families/${bob.familyId}/dashboard?familyId=${bob.familyId}`,
      headers: { ...auth(alice.token), 'x-family-id': bob.familyId },
    });

    expect(crafted.statusCode).toBe(403);
    expect(crafted.body).not.toContain('bob@example.com');
  });

  it('scopes repository reads to the resolved family, never the whole table', async () => {
    const { alice, bob } = await twoFamilies();

    const aliceScope = await resolveFamilyScope(ctx.db.pool, alice.userId);
    expect(aliceScope).not.toBeNull();

    const family = await findFamilyInScope(ctx.db.pool, aliceScope!);
    const members = await listMembersInScope(ctx.db.pool, aliceScope!);

    expect(family?.id).toBe(alice.familyId);
    expect(members.map((m) => m.email)).toEqual(['alice@example.com']);
    expect(members.some((m) => m.email === 'bob@example.com')).toBe(false);
    expect(bob.familyId).toBeDefined();
  });
});

describe('isolation-test integrity', () => {
  /**
   * Task 6.7 — a test that cannot fail proves nothing. The isolation assertions above
   * would pass trivially against an empty or single-family database, so this asserts
   * the leak is genuinely available to be caught: unscoped reads DO see both families,
   * and only the scope filter prevents it.
   */
  it('confirms the data needed to leak actually exists, so the assertions are not vacuous', async () => {
    const { alice, bob } = await twoFamilies();

    const unscopedFamilies = await ctx.db.pool.query<{ id: string }>('SELECT id FROM families');
    const unscopedUsers = await ctx.db.pool.query<{ email: string }>('SELECT email FROM users');

    // Without a scope filter, both families and both members are plainly reachable.
    expect(unscopedFamilies.rows).toHaveLength(2);
    expect(unscopedUsers.rows.map((r) => r.email).sort()).toEqual([
      'alice@example.com',
      'bob@example.com',
    ]);

    // With the scope filter, exactly one is reachable — the difference is the control.
    const aliceScope = await resolveFamilyScope(ctx.db.pool, alice.userId);
    const scopedMembers = await listMembersInScope(ctx.db.pool, aliceScope!);
    expect(scopedMembers).toHaveLength(1);

    expect(unscopedFamilies.rows.map((r) => r.id).sort()).toEqual(
      [alice.familyId, bob.familyId].sort(),
    );
  });
});
