import pg from 'pg';

export type Queryable = Pick<pg.Pool | pg.PoolClient, 'query'>;

export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl });
}

/**
 * Runs `fn` inside a single transaction, rolling back on any thrown error.
 *
 * Registration depends on this: an account, its family, and the owner membership
 * must all commit together or not at all (family-membership spec, "Family creation
 * is atomic with account creation").
 */
export async function withTransaction<T>(
  pool: pg.Pool,
  fn: (tx: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
