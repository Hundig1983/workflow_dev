import { loadConfig } from '../config.js';
import { createPool } from './pool.js';
import { migrateDown, migrateUp } from './migrator.js';

const direction = process.argv[2];

if (direction !== 'up' && direction !== 'down') {
  console.error('Usage: tsx src/db/cli.ts <up|down>');
  process.exit(1);
}

const pool = createPool(loadConfig().databaseUrl);

try {
  if (direction === 'up') {
    const ran = await migrateUp(pool);
    console.log(ran.length === 0 ? 'Already up to date.' : `Applied: ${ran.join(', ')}`);
  } else {
    const reverted = await migrateDown(pool);
    console.log(reverted === null ? 'Nothing to revert.' : `Reverted: ${reverted}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
