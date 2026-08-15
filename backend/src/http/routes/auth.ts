import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { endSession, issueSession, verifyCredentials } from '../../auth/service.js';
import { passwordPolicyError } from '../../auth/password.js';
import { isValidEmail, normalizeEmail } from '../../auth/types.js';
import { EmailAlreadyRegisteredError, register } from '../../registration/service.js';
import { fail, GENERIC_AUTH_FAILURE } from '../errors.js';
import { makeRequireSession } from '../auth-guard.js';

const credentialsSchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', minLength: 3, maxLength: 320 },
    password: { type: 'string', minLength: 1, maxLength: 1024 },
    familyName: { type: 'string', maxLength: 120 },
  },
} as const;

interface CredentialsBody {
  email: string;
  password: string;
  familyName?: string;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  sessionTtlHours: number,
): void {
  const requireSession = makeRequireSession(pool);

  app.post<{ Body: CredentialsBody }>(
    '/auth/signup',
    { schema: { body: credentialsSchema } },
    async (request, reply) => {
      const { email, password, familyName } = request.body;

      if (!isValidEmail(normalizeEmail(email))) {
        return fail(reply, 400, 'validation_failed', 'Enter a valid email address.', 'email');
      }
      const policyError = passwordPolicyError(password);
      if (policyError) {
        return fail(reply, 400, 'validation_failed', policyError, 'password');
      }

      try {
        const { account, familyId } = await register(pool, email, password, familyName);
        // No token here: signing up does not log you in. The client calls /auth/login,
        // which keeps session issuance in exactly one place.
        return reply
          .status(201)
          .send({ user: { id: account.id, email: account.email }, family: { id: familyId } });
      } catch (error) {
        if (error instanceof EmailAlreadyRegisteredError) {
          // Deliberately neutral: the spec requires the response not to confirm
          // whether the address is already registered. Note this only narrows the
          // leak — the 409 status still distinguishes this case. Closing it fully
          // needs an email-verification flow (always answer 202, confirm out of band),
          // which is out of scope for the walking skeleton. Tracked in the PR body.
          return fail(
            reply,
            409,
            'registration_rejected',
            'That email address cannot be registered.',
            'email',
          );
        }
        throw error;
      }
    },
  );

  app.post<{ Body: CredentialsBody }>(
    '/auth/login',
    { schema: { body: credentialsSchema } },
    async (request, reply) => {
      const { email, password } = request.body;
      const userId = await verifyCredentials(pool, email, password);
      if (!userId) {
        // Unknown address and wrong password are indistinguishable from out here.
        return fail(reply, 401, 'invalid_credentials', GENERIC_AUTH_FAILURE);
      }
      const session = await issueSession(pool, userId, sessionTtlHours);
      return reply
        .status(200)
        .send({ token: session.token, expiresAt: session.expiresAt.toISOString() });
    },
  );

  app.post('/auth/logout', { preHandler: requireSession }, async (request, reply) => {
    const session = request.session;
    if (!session) return fail(reply, 401, 'unauthenticated', 'Authentication required.');
    await endSession(pool, session.sessionId);
    return reply.status(204).send();
  });
}
