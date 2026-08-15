import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { buildDashboard } from '../../dashboard/service.js';
import { scopeCovers } from '../../family/scope.js';
import { makeRequireFamilyScope, makeRequireSession } from '../auth-guard.js';
import { fail } from '../errors.js';

const familyIdParams = {
  type: 'object',
  required: ['familyId'],
  additionalProperties: false,
  properties: { familyId: { type: 'string', format: 'uuid' } },
} as const;

export function registerFamilyRoutes(app: FastifyInstance, pool: pg.Pool): void {
  const preHandler = [makeRequireSession(pool), makeRequireFamilyScope(pool)];

  app.get('/families/me/dashboard', { preHandler }, async (request, reply) => {
    const scope = request.familyScope;
    if (!scope) return fail(reply, 401, 'unauthenticated', 'Authentication required.');

    const dashboard = await buildDashboard(pool, scope);
    if (!dashboard) return fail(reply, 404, 'not_found', 'Family not found.');
    return reply.status(200).send(dashboard);
  });

  /**
   * Addressing a family by id is allowed only for your own family. A mismatch is
   * rejected outright rather than silently served as the caller's own family — a
   * quiet fallback would mask an authorization probe (family-membership spec).
   */
  app.get<{ Params: { familyId: string } }>(
    '/families/:familyId/dashboard',
    { schema: { params: familyIdParams }, preHandler },
    async (request, reply) => {
      const scope = request.familyScope;
      if (!scope) return fail(reply, 401, 'unauthenticated', 'Authentication required.');

      if (!scopeCovers(scope, request.params.familyId)) {
        return fail(reply, 403, 'forbidden', 'You do not have access to that family.');
      }

      const dashboard = await buildDashboard(pool, scope);
      if (!dashboard) return fail(reply, 404, 'not_found', 'Family not found.');
      return reply.status(200).send(dashboard);
    },
  );
}
