import type { FastifyReply } from 'fastify';

export type ErrorCode =
  | 'validation_failed'
  | 'registration_rejected'
  | 'invalid_credentials'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'internal_error';

export interface ErrorBody {
  error: { code: ErrorCode; message: string; field?: string };
}

/**
 * The only way this service emits an error. Keeping one shape here is what stops a
 * driver error, a stack trace, or an ORM message from reaching a client.
 */
export function fail(
  reply: FastifyReply,
  status: number,
  code: ErrorCode,
  message: string,
  field?: string,
): FastifyReply {
  const body: ErrorBody = { error: field ? { code, message, field } : { code, message } };
  return reply.status(status).send(body);
}

/**
 * Login and signup-lookup failures deliberately share one message so a caller cannot
 * learn whether an address is registered (user-auth spec).
 */
export const GENERIC_AUTH_FAILURE = 'Invalid email or password.';
