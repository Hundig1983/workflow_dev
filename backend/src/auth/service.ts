import type pg from 'pg';
import type { Queryable } from '../db/pool.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  findCredentialsByEmail,
  findLiveSessionByTokenHash,
  insertSession,
  insertUser,
  revokeSession,
} from './repository.js';
import { expiryFromNow, generateSessionToken, hashSessionToken } from './tokens.js';
import {
  normalizeEmail,
  type Account,
  type AuthenticatedSession,
  type IssuedSession,
} from './types.js';

/**
 * Constant-ish work factor for the "unknown email" branch of login. Verifying a
 * throwaway hash keeps the timing of "no such account" close to "wrong password",
 * so the two are not trivially distinguishable (user-auth spec, "Invalid credentials
 * are rejected indistinguishably").
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZS1zdGF0aWMtc2FsdA$Zm9yIHRpbWluZyBwdXJwb3NlcyBvbmx5ISE';

export async function createAccount(
  db: Queryable,
  email: string,
  password: string,
): Promise<Account> {
  return insertUser(db, normalizeEmail(email), await hashPassword(password));
}

/** Returns the account id when credentials are valid, else null. Never says which half failed. */
export async function verifyCredentials(
  db: Queryable,
  email: string,
  password: string,
): Promise<string | null> {
  const found = await findCredentialsByEmail(db, normalizeEmail(email));
  if (!found) {
    await verifyPassword(DUMMY_HASH, password);
    return null;
  }
  return (await verifyPassword(found.passwordHash, password)) ? found.id : null;
}

export async function issueSession(
  db: Queryable,
  userId: string,
  ttlHours: number,
): Promise<IssuedSession> {
  const token = generateSessionToken();
  const expiresAt = expiryFromNow(ttlHours);
  await insertSession(db, userId, hashSessionToken(token), expiresAt);
  // The raw token is returned exactly once, here. Only its hash is persisted.
  return { token, expiresAt };
}

export async function authenticate(
  pool: pg.Pool,
  presentedToken: string,
): Promise<AuthenticatedSession | null> {
  if (presentedToken.trim() === '') return null;
  return findLiveSessionByTokenHash(pool, hashSessionToken(presentedToken));
}

export async function endSession(pool: pg.Pool, sessionId: string): Promise<void> {
  await revokeSession(pool, sessionId);
}
