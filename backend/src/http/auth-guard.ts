import type { FastifyReply, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { authenticate } from '../auth/service.js';
import type { AuthenticatedSession } from '../auth/types.js';
import { resolveFamilyScope, type FamilyScope } from '../family/scope.js';
import { fail } from './errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    session?: AuthenticatedSession;
    familyScope?: FamilyScope;
  }
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token === '' ? null : token;
}

/**
 * Applied to every non-public route. Rejects before the handler runs, so an
 * unauthenticated request can never reach code that performs a side effect
 * (user-auth spec, "Authentication of subsequent requests").
 */
export function makeRequireSession(pool: pg.Pool) {
  return async function requireSession(request: FastifyRequest, reply: FastifyReply) {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      return fail(reply, 401, 'unauthenticated', 'Authentication required.');
    }
    const session = await authenticate(pool, token);
    if (!session) {
      // Missing, malformed, unknown, expired, and revoked all land here identically.
      return fail(reply, 401, 'unauthenticated', 'Authentication required.');
    }
    request.session = session;
  };
}

/**
 * Resolves the caller's family from their session. Runs after requireSession and
 * never reads a family id from the request (Article I.1).
 */
export function makeRequireFamilyScope(pool: pg.Pool) {
  return async function requireFamilyScope(request: FastifyRequest, reply: FastifyReply) {
    const session = request.session;
    if (!session) {
      return fail(reply, 401, 'unauthenticated', 'Authentication required.');
    }
    const scope = await resolveFamilyScope(pool, session.userId);
    if (!scope) {
      return fail(reply, 403, 'forbidden', 'No family membership for this account.');
    }
    request.familyScope = scope;
  };
}
