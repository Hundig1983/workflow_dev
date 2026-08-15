import type { FastifyInstance } from 'fastify';
import { migrateUp } from '../../src/db/migrator.js';
import { buildServer } from '../../src/http/server.js';
import { startTestDatabase, type TestDatabase } from './postgres.js';

export interface TestContext {
  app: FastifyInstance;
  db: TestDatabase;
  stop: () => Promise<void>;
}

export const VALID_PASSWORD = 'correct-horse-battery-staple';

export async function createTestContext(sessionTtlHours = 24): Promise<TestContext> {
  const db = await startTestDatabase();
  await migrateUp(db.pool);
  const app = buildServer(db.pool, { sessionTtlHours });
  await app.ready();
  return {
    app,
    db,
    stop: async () => {
      await app.close();
      await db.stop();
    },
  };
}

export async function signup(
  app: FastifyInstance,
  email: string,
  password: string = VALID_PASSWORD,
  familyName?: string,
) {
  return app.inject({
    method: 'POST',
    url: '/auth/signup',
    payload: familyName ? { email, password, familyName } : { email, password },
  });
}

export async function login(
  app: FastifyInstance,
  email: string,
  password: string = VALID_PASSWORD,
) {
  return app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });
}

/** Signs up then logs in, returning the bearer token and the created family id. */
export async function signupAndLogin(
  app: FastifyInstance,
  email: string,
  password: string = VALID_PASSWORD,
): Promise<{ token: string; familyId: string; userId: string }> {
  const created = await signup(app, email, password);
  if (created.statusCode !== 201) {
    throw new Error(`signup failed: ${created.statusCode} ${created.body}`);
  }
  const createdBody = created.json() as { user: { id: string }; family: { id: string } };

  const session = await login(app, email, password);
  if (session.statusCode !== 200) {
    throw new Error(`login failed: ${session.statusCode} ${session.body}`);
  }
  const { token } = session.json() as { token: string };

  return { token, familyId: createdBody.family.id, userId: createdBody.user.id };
}

export function auth(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}
