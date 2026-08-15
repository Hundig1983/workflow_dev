import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import pg from 'pg';

/**
 * Runs a real PostgreSQL for integration tests, using the server binaries shipped by
 * `embedded-postgres`.
 *
 * We drive initdb/pg_ctl directly rather than using that package's JS wrapper: the
 * wrapper insists on a Unix socket in the data directory, and PostgreSQL caps socket
 * paths at 107 bytes — which a temp path can exceed. Connecting over TCP on loopback
 * sidesteps that entirely.
 *
 * Real Postgres matters here rather than an emulator: the properties under test are
 * transactional rollback and FK/unique constraint enforcement, which are exactly the
 * behaviors an in-memory substitute approximates least well.
 */

const require = createRequire(import.meta.url);

function binDir(): string {
  // The package's `exports` map hides ./package.json, so resolve its entry point and
  // walk up out of dist/ instead.
  const entry = require.resolve(`@embedded-postgres/${process.platform}-${process.arch}`);
  return join(entry, '..', '..', 'native', 'bin');
}

export interface TestDatabase {
  pool: pg.Pool;
  connectionString: string;
  stop: () => Promise<void>;
}

let nextPort = 55500 + Math.floor(Math.random() * 400);

export async function startTestDatabase(): Promise<TestDatabase> {
  const bin = binDir();
  const root = mkdtempSync(join(tmpdir(), 'fhpg-'));
  const dataDir = join(root, 'data');
  const pwFile = join(root, 'pw');
  const port = nextPort++;
  const password = 'test-only-not-a-secret';

  writeFileSync(pwFile, password, 'utf8');

  const init = spawnSync(
    join(bin, 'initdb'),
    ['-D', dataDir, '-U', 'postgres', `--pwfile=${pwFile}`, '-A', 'password', '--encoding=UTF8'],
    { encoding: 'utf8' },
  );
  if (init.status !== 0) {
    throw new Error(`initdb failed (${init.status}): ${init.stderr || init.stdout}`);
  }

  // fsync off is safe and much faster for a throwaway database.
  const start = spawnSync(
    join(bin, 'pg_ctl'),
    [
      '-D',
      dataDir,
      '-o',
      `-p ${port} -h 127.0.0.1 -k ${root} -c fsync=off -c full_page_writes=off`,
      '-l',
      join(root, 'server.log'),
      '-w',
      'start',
    ],
    { encoding: 'utf8' },
  );
  if (start.status !== 0) {
    throw new Error(`pg_ctl start failed (${start.status}): ${start.stderr || start.stdout}`);
  }

  const connectionString = `postgres://postgres:${password}@127.0.0.1:${port}/postgres`;
  const pool = new pg.Pool({ connectionString, max: 8 });

  const stop = async (): Promise<void> => {
    await pool.end().catch(() => undefined);
    spawnSync(join(bin, 'pg_ctl'), ['-D', dataDir, '-m', 'immediate', '-w', 'stop'], {
      encoding: 'utf8',
    });
    // A leftover temp dir must never fail a test run.
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // Best effort — the OS reclaims the temp dir either way.
    }
  };

  return { pool, connectionString, stop };
}

/** Wipes all data between tests without re-running migrations. */
export async function truncateAll(pool: pg.Pool): Promise<void> {
  await pool.query('TRUNCATE sessions, family_members, families, users RESTART IDENTITY CASCADE');
}
