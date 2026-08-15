import type { Queryable } from '../db/pool.js';
import type { Account, AuthenticatedSession } from './types.js';

const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: string }).code === UNIQUE_VIOLATION
    : false;
}

interface UserRow {
  id: string;
  email: string;
  created_at: Date;
}

export async function insertUser(
  db: Queryable,
  email: string,
  passwordHash: string,
): Promise<Account> {
  const { rows } = await db.query<UserRow>(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [email, passwordHash],
  );
  const row = rows[0];
  if (!row) throw new Error('INSERT ... RETURNING produced no row');
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

export async function findCredentialsByEmail(
  db: Queryable,
  email: string,
): Promise<{ id: string; passwordHash: string } | null> {
  const { rows } = await db.query<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE email = $1',
    [email],
  );
  const row = rows[0];
  return row ? { id: row.id, passwordHash: row.password_hash } : null;
}

export async function insertSession(
  db: Queryable,
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, tokenHash, expiresAt],
  );
  const row = rows[0];
  if (!row) throw new Error('INSERT ... RETURNING produced no row');
  return row.id;
}

/**
 * Resolves a presented token hash to a live session. Expiry and revocation are
 * filtered in SQL so an expired or revoked session can never be returned to a caller
 * that forgot to check (user-auth spec, "Authentication of subsequent requests").
 */
export async function findLiveSessionByTokenHash(
  db: Queryable,
  tokenHash: string,
  now: Date = new Date(),
): Promise<AuthenticatedSession | null> {
  const { rows } = await db.query<{ id: string; user_id: string; expires_at: Date }>(
    `SELECT id, user_id, expires_at
       FROM sessions
      WHERE token_hash = $1
        AND revoked_at IS NULL
        AND expires_at > $2`,
    [tokenHash, now],
  );
  const row = rows[0];
  return row ? { sessionId: row.id, userId: row.user_id, expiresAt: row.expires_at } : null;
}

export async function revokeSession(db: Queryable, sessionId: string): Promise<void> {
  await db.query('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [
    sessionId,
  ]);
}
