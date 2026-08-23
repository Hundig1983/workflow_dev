import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/http/server.js';
import { migrateUp } from '../../src/db/migrator.js';
import { startTestDatabase, type TestDatabase } from '../helpers/postgres.js';

const WEB_ORIGIN = 'http://127.0.0.1:8081';

describe('CORS allow-list', () => {
  let db: TestDatabase;
  beforeAll(async () => {
    db = await startTestDatabase();
    await migrateUp(db.pool);
  });
  afterAll(async () => {
    await db.stop();
  });

  it('answers a browser preflight for an allowed origin', async () => {
    const app = buildServer(db.pool, { sessionTtlHours: 1, corsOrigins: [WEB_ORIGIN] });
    await app.ready();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/auth/signup',
      headers: {
        origin: WEB_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(String(res.headers['access-control-allow-headers'])).toMatch(/authorization/i);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    await app.close();
  });

  it('sends no CORS headers for an origin that is not listed', async () => {
    const app = buildServer(db.pool, { sessionTtlHours: 1, corsOrigins: [WEB_ORIGIN] });
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });

  it('sends no CORS headers at all when the allow-list is empty (the default)', async () => {
    const app = buildServer(db.pool, { sessionTtlHours: 1 });
    await app.ready();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: WEB_ORIGIN },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });
});
