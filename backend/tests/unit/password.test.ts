import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  MIN_PASSWORD_LENGTH,
  passwordPolicyError,
  verifyPassword,
} from '../../src/auth/password.js';

describe('password hashing', () => {
  it('produces an argon2id hash that does not contain the password', async () => {
    const password = 'correct-horse-battery-staple';
    const encoded = await hashPassword(password);

    expect(encoded.startsWith('$argon2id$')).toBe(true);
    expect(encoded).not.toContain(password);
  });

  it('salts each hash, so the same password hashes differently every time', async () => {
    const a = await hashPassword('correct-horse-battery-staple');
    const b = await hashPassword('correct-horse-battery-staple');
    expect(a).not.toEqual(b);
  });

  it('verifies a correct password and rejects an incorrect one', async () => {
    const encoded = await hashPassword('correct-horse-battery-staple');
    await expect(verifyPassword(encoded, 'correct-horse-battery-staple')).resolves.toBe(true);
    await expect(verifyPassword(encoded, 'wrong-horse-battery-staple')).resolves.toBe(false);
  });

  it('treats a malformed stored hash as a non-match rather than throwing', async () => {
    await expect(verifyPassword('not-a-hash', 'anything')).resolves.toBe(false);
  });
});

describe('password policy', () => {
  it('rejects passwords below the minimum length', () => {
    expect(passwordPolicyError('a'.repeat(MIN_PASSWORD_LENGTH - 1))).not.toBeNull();
  });

  it('accepts passwords at or above the minimum length', () => {
    expect(passwordPolicyError('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });
});
