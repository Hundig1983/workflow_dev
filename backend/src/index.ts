import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { buildServer } from './http/server.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
const app = buildServer(pool, {
  sessionTtlHours: config.sessionTtlHours,
  logLevel: config.logLevel,
});

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error({ err: error }, 'failed to start');
  await pool.end();
  process.exit(1);
}
