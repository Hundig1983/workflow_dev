import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id — the salted, memory-hard function required by Article I.2. The salt is
 * generated per-hash by the library and embedded in the returned encoded string.
 */
const ARGON2ID = 2;

const OPTIONS = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const MIN_PASSWORD_LENGTH = 12;

export function passwordPolicyError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(encoded: string, password: string): Promise<boolean> {
  try {
    return await verify(encoded, password, OPTIONS);
  } catch {
    // A malformed stored hash must read as "does not match", never as a crash that
    // would let a caller distinguish it from a wrong password.
    return false;
  }
}
