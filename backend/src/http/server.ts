import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type pg from 'pg';
import { fail } from './errors.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerFamilyRoutes } from './routes/families.js';

export interface ServerOptions {
  sessionTtlHours: number;
  logLevel?: string;
}

export function buildServer(pool: pg.Pool, options: ServerOptions): FastifyInstance {
  const app = Fastify({
    logger: options.logLevel ? { level: options.logLevel } : false,
  });

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

  return app;
}
