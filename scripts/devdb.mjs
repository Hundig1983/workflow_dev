#!/usr/bin/env node
/**
 * Local PostgreSQL for development, without Docker.
 *
 * The backend already depends on `embedded-postgres`, which ships real PostgreSQL 17
 * server binaries for the host platform. This drives `initdb`/`pg_ctl` directly, the
 * same way backend/tests/helpers/postgres.ts does for the test suite — so a developer
 * (or CI) with no container runtime can still run the whole stack.
 *
 * Usage: node scripts/devdb.mjs start|stop|status|reset
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const BACKEND = join(REPO, 'backend');
const DATA_ROOT = join(REPO, '.pgdata');
const DATA = join(DATA_ROOT, 'data');

/**
 * PostgreSQL rejects a Unix socket path longer than 107 bytes, and a repo checked out
 * under a deep path blows that limit before the socket name is even appended. The data
 * directory may live anywhere; the socket must not.
 */
const SOCKET_DIR = '/tmp/fhdev';

const PORT = Number(process.env.DEV_DB_PORT ?? 55432);
const DB = 'familyhub';
const USER = 'postgres';
// Local development only, never deployed. The database listens on loopback exclusively.
const PASSWORD = 'dev-local-not-a-secret';

export const DATABASE_URL = `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}`;

const require = createRequire(join(BACKEND, 'noop.js'));

function binDir() {
  // The package's `exports` map hides ./package.json, so resolve its entry point and
  // walk up out of dist/ instead. Same approach as the test helper.
  const entry = require.resolve(`@embedded-postgres/${process.platform}-${process.arch}`);
  return join(entry, '..', '..', 'native', 'bin');
}

function pg_(cmd, args) {
  return spawnSync(join(binDir(), cmd), args, { encoding: 'utf8' });
}

function isRunning() {
  return pg_('pg_ctl', ['-D', DATA, 'status']).status === 0;
}

function start() {
  mkdirSync(DATA_ROOT, { recursive: true });
  mkdirSync(SOCKET_DIR, { recursive: true });

  if (!existsSync(DATA)) {
    const pwFile = join(DATA_ROOT, 'pw');
    writeFileSync(pwFile, PASSWORD, 'utf8');
    const init = pg_('initdb', [
      '-D', DATA, '-U', USER, `--pwfile=${pwFile}`, '-A', 'password', '--encoding=UTF8',
    ]);
    if (init.status !== 0) {
      console.error('initdb failed:\n' + (init.stderr || init.stdout));
      process.exit(1);
    }
    console.log('initialised a new cluster in .pgdata/');
  }

  if (isRunning()) {
    console.log('already running');
  } else {
    const started = pg_('pg_ctl', [
      '-D', DATA,
      '-o', `-p ${PORT} -h 127.0.0.1 -k ${SOCKET_DIR}`,
      '-l', join(DATA_ROOT, 'server.log'),
      '-w', 'start',
    ]);
    if (started.status !== 0) {
      console.error('pg_ctl start failed:\n' + (started.stderr || started.stdout));
      console.error(`see ${join(DATA_ROOT, 'server.log')}`);
      process.exit(1);
    }
    console.log(`started on 127.0.0.1:${PORT}`);
  }
  return ensureDatabase();
}

async function ensureDatabase() {
  const pg = require('pg');
  const admin = new pg.Client({
    connectionString: `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/postgres`,
  });
  await admin.connect();
  const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [DB]);
  if (rows.length === 0) {
    await admin.query(`CREATE DATABASE ${DB}`);
    console.log(`created database ${DB}`);
  }
  await admin.end();
  console.log(`\nDATABASE_URL=${DATABASE_URL}`);
  console.log('\nNext: cd backend && npm run migrate && npm run dev');
}

const command = process.argv[2] ?? 'start';

switch (command) {
  case 'start':
    await start();
    break;
  case 'stop': {
    const stopped = pg_('pg_ctl', ['-D', DATA, '-m', 'fast', '-w', 'stop']);
    console.log(stopped.status === 0 ? 'stopped' : 'not running');
    break;
  }
  case 'status': {
    const status = pg_('pg_ctl', ['-D', DATA, 'status']);
    console.log((status.stdout || status.stderr).trim());
    process.exitCode = status.status ?? 1;
    break;
  }
  case 'reset':
    pg_('pg_ctl', ['-D', DATA, '-m', 'immediate', '-w', 'stop']);
    rmSync(DATA_ROOT, { recursive: true, force: true });
    console.log('removed .pgdata/ — the next start will re-initialise and you must re-run migrations');
    break;
  default:
    console.error(`unknown command: ${command}\nusage: node scripts/devdb.mjs start|stop|status|reset`);
    process.exitCode = 1;
}
