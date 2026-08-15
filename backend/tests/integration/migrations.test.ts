import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrateDown, migrateUp } from '../../src/db/migrator.js';
import { startTestDatabase, type TestDatabase } from '../helpers/postgres.js';

let db: TestDatabase;

beforeAll(async () => {
  db = await startTestDatabase();
});
afterAll(async () => {
  await db?.stop();
});

async function tableNames(): Promise<string[]> {
  const { rows } = await db.pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`,
  );
  return rows.map((r) => r.table_name);
}

describe('migrations', () => {
  it('applies cleanly against a fresh database', async () => {
    const ran = await migrateUp(db.pool);
    expect(ran).toEqual(['001_initial']);
    expect(await tableNames()).toEqual(
      expect.arrayContaining([
        'families',
        'family_members',
        'schema_migrations',
        'sessions',
        'users',
      ]),
    );
  });

  it('is idempotent — re-running applies nothing', async () => {
    expect(await migrateUp(db.pool)).toEqual([]);
  });

  it('reverts cleanly, satisfying the rollback requirement', async () => {
    expect(await migrateDown(db.pool)).toBe('001_initial');

    const remaining = await tableNames();
    for (const table of ['users', 'families', 'family_members', 'sessions']) {
      expect(remaining).not.toContain(table);
    }
    // The ledger itself survives, now empty.
    expect(remaining).toContain('schema_migrations');
    const { rows } = await db.pool.query('SELECT count(*)::int AS n FROM schema_migrations');
    expect(rows[0]).toEqual({ n: 0 });
  });

  it('reports nothing to revert once fully rolled back', async () => {
    expect(await migrateDown(db.pool)).toBeNull();
  });

  it('can be re-applied after a rollback', async () => {
    expect(await migrateUp(db.pool)).toEqual(['001_initial']);
  });
});

describe('schema invariants', () => {
  it('rejects a duplicate email', async () => {
    await db.pool.query("INSERT INTO users (email, password_hash) VALUES ('a@example.com', 'x')");
    await expect(
      db.pool.query("INSERT INTO users (email, password_hash) VALUES ('a@example.com', 'y')"),
    ).rejects.toThrow();
  });

  it('rejects a non-normalized email', async () => {
    await expect(
      db.pool.query("INSERT INTO users (email, password_hash) VALUES ('MIXED@example.com', 'x')"),
    ).rejects.toThrow();
  });

  it('rejects a membership pointing at a family that does not exist', async () => {
    const user = await db.pool.query<{ id: string }>(
      "INSERT INTO users (email, password_hash) VALUES ('orphan@example.com', 'x') RETURNING id",
    );
    await expect(
      db.pool.query('INSERT INTO family_members (family_id, user_id, role) VALUES ($1, $2, $3)', [
        '00000000-0000-0000-0000-000000000000',
        user.rows[0]?.id,
        'parent',
      ]),
    ).rejects.toThrow();
  });

  it('rejects the same user joining one family twice', async () => {
    const user = await db.pool.query<{ id: string }>(
      "INSERT INTO users (email, password_hash) VALUES ('dup@example.com', 'x') RETURNING id",
    );
    const family = await db.pool.query<{ id: string }>(
      "INSERT INTO families (name) VALUES ('F') RETURNING id",
    );
    const args = [family.rows[0]?.id, user.rows[0]?.id, 'parent'];
    await db.pool.query(
      'INSERT INTO family_members (family_id, user_id, role) VALUES ($1,$2,$3)',
      args,
    );
    await expect(
      db.pool.query(
        'INSERT INTO family_members (family_id, user_id, role) VALUES ($1,$2,$3)',
        args,
      ),
    ).rejects.toThrow();
  });
});
