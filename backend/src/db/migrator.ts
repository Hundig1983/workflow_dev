import type pg from 'pg';
import { migrations, type Migration } from './migrations.js';

const LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id         text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );
`;

async function appliedIds(pool: pg.Pool): Promise<Set<string>> {
  await pool.query(LEDGER);
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM schema_migrations');
  return new Set(rows.map((r) => r.id));
}

export async function migrateUp(pool: pg.Pool): Promise<string[]> {
  const applied = await appliedIds(pool);
  const ran: string[] = [];
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    await runInTransaction(pool, migration.up, async (tx) => {
      await tx.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
    });
    ran.push(migration.id);
  }
  return ran;
}

/** Reverts the most recently applied migration. Returns its id, or null if none. */
export async function migrateDown(pool: pg.Pool): Promise<string | null> {
  const applied = await appliedIds(pool);
  const target: Migration | undefined = [...migrations].reverse().find((m) => applied.has(m.id));
  if (!target) return null;
  await runInTransaction(pool, target.down, async (tx) => {
    await tx.query('DELETE FROM schema_migrations WHERE id = $1', [target.id]);
  });
  return target.id;
}

async function runInTransaction(
  pool: pg.Pool,
  sql: string,
  ledger: (tx: pg.PoolClient) => Promise<void>,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await ledger(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
