import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;

/**
 * Session tokens are opaque and random — they carry no claims, so nothing about a
 * request's authority can be read out of the token itself. Authority is always
 * resolved server-side by looking the hash up (design.md, "Sessions").
 */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * Only this digest is ever persisted (user-auth spec, "Session token is stored only
 * as a hash"). A plain SHA-256 is right here where a slow KDF is not: the input is
 * 256 bits of entropy we generated, so it is not brute-forceable the way a password is.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function expiryFromNow(ttlHours: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
}
