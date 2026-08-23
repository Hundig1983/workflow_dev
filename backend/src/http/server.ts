import cors from '@fastify/cors';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type pg from 'pg';
import { fail } from './errors.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerFamilyRoutes } from './routes/families.js';
import { registerShoppingRoutes } from './routes/shopping.js';

export interface ServerOptions {
  sessionTtlHours: number;
  logLevel?: string;
  /** Browser origins allowed to call the API. Empty (the default) sends no CORS headers at all. */
  corsOrigins?: string[];
}

export function buildServer(pool: pg.Pool, options: ServerOptions): FastifyInstance {
  const app = Fastify({
    logger: options.logLevel ? { level: options.logLevel } : false,
  });

  if (options.corsOrigins && options.corsOrigins.length > 0) {
    // Bearer tokens, not cookies: no credentialed CORS. Native clients send no Origin and are unaffected.
    void app.register(cors, {
      origin: options.corsOrigins,
      methods: ['GET', 'POST'],
      allowedHeaders: ['content-type', 'authorization'],
      credentials: false,
    });
  }

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      const field = error.validation[0]?.instancePath?.replace(/^\//, '');
      return fail(
        reply,
        400,
        'validation_failed',
        'Request failed validation.',
        field || undefined,
      );
    }
    // Log the real cause; return an opaque body so internals never reach the client.
    request.log.error({ err: error }, 'unhandled error');
    return fail(reply, 500, 'internal_error', 'Something went wrong.');
  });

  app.setNotFoundHandler((_request, reply) =>
    fail(reply, 404, 'not_found', 'That endpoint does not exist.'),
  );

  app.get('/health', async () => ({ status: 'ok' }));

  registerAuthRoutes(app, pool, options.sessionTtlHours);
  registerFamilyRoutes(app, pool);
  registerShoppingRoutes(app, pool);

  return app;
}
