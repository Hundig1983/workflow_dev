import type pg from 'pg';
import { withTransaction } from '../db/pool.js';
import { createAccount } from '../auth/service.js';
import { isUniqueViolation } from '../auth/repository.js';
import type { Account } from '../auth/types.js';
import { insertFamily, insertMembership } from '../family/repository.js';

/**
 * Registration spans both modules, so it lives in neither: the auth module must not
 * import family logic (ARCHITECTURE.md boundary), and family logic should not own
 * credential handling. This module composes the two.
 */

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export interface RegistrationResult {
  account: Account;
  familyId: string;
}

export function defaultFamilyName(email: string): string {
  const localPart = email.split('@')[0] ?? 'New';
  return `${localPart}'s family`;
}

/**
 * Creates the account, its family, and the owner membership in ONE transaction.
 * Any failure rolls all three back, leaving the email free for a later attempt
 * (family-membership spec, "Family creation is atomic with account creation").
 */
export async function register(
  pool: pg.Pool,
  email: string,
  password: string,
  familyName?: string,
): Promise<RegistrationResult> {
  try {
    return await withTransaction(pool, async (tx) => {
      const account = await createAccount(tx, email, password);
      const family = await insertFamily(tx, familyName?.trim() || defaultFamilyName(account.email));
      await insertMembership(tx, family.id, account.id, 'parent');
      return { account, familyId: family.id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new EmailAlreadyRegisteredError();
    throw error;
  }
}
