import { describe, expect, it } from 'vitest';
import {
  expiryFromNow,
  generateSessionToken,
  hashSessionToken,
  tokensMatch,
} from '../../src/auth/tokens.js';

describe('session tokens', () => {
  it('generates unguessable, unique tokens', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateSessionToken()));
    expect(tokens.size).toBe(500);
    // 32 random bytes, base64url-encoded.
    for (const token of tokens) expect(token.length).toBeGreaterThanOrEqual(43);
  });

  it('hashes deterministically and irreversibly', () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toContain(token);
    expect(hashSessionToken(token)).toHaveLength(64);
  });

  it('produces different hashes for different tokens', () => {
    expect(hashSessionToken(generateSessionToken())).not.toBe(
      hashSessionToken(generateSessionToken()),
    );
  });

  it('compares tokens without leaking length-independent timing', () => {
    const token = generateSessionToken();
    expect(tokensMatch(token, token)).toBe(true);
    expect(tokensMatch(token, generateSessionToken())).toBe(false);
    expect(tokensMatch(token, token.slice(0, -1))).toBe(false);
  });

  it('computes an expiry the given number of hours ahead', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(expiryFromNow(24, now).toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });
});
