import { ApiError, type ApiClient } from '../api/client';
import type { Credentials, FieldError, Session, SignupInput } from './types';

/**
 * The one message shown for every login failure. The API already collapses
 * "no such account" and "wrong password" into a single response (user-auth spec);
 * the client must not re-introduce the distinction it was careful to remove.
 */
export const GENERIC_AUTH_FAILURE = 'Invalid email or password.';

export interface SignupResult {
  userId: string;
  familyId: string;
}

interface SignupResponse {
  user: { id: string; email: string };
  family: { id: string };
}

/** Thrown when signup is rejected for a specific input, so the screen can bind it (7.2). */
export class SignupValidationError extends Error {
  constructor(readonly errors: FieldError[]) {
    super(errors[0]?.message ?? 'Please check the details you entered.');
    this.name = 'SignupValidationError';
  }
}

export async function signup(api: ApiClient, input: SignupInput): Promise<SignupResult> {
  const body: Record<string, string> = { email: input.email, password: input.password };
  if (input.familyName !== undefined && input.familyName.trim() !== '') {
    body.familyName = input.familyName.trim();
  }

  try {
    const response = await api.request<SignupResponse>('/auth/signup', {
      method: 'POST',
      body,
      anonymous: true,
    });
    return { userId: response.user.id, familyId: response.family.id };
  } catch (error) {
    // Signup keeps the API's field attribution — unlike login, naming the bad input
    // here leaks nothing an attacker could not determine by trying valid input.
    if (error instanceof ApiError && error.field !== undefined) {
      throw new SignupValidationError([{ field: error.field, message: error.message }]);
    }
    throw error;
  }
}

export async function login(api: ApiClient, credentials: Credentials): Promise<Session> {
  return api.request<Session>('/auth/login', {
    method: 'POST',
    body: credentials,
    anonymous: true,
  });
}

export async function logout(api: ApiClient): Promise<void> {
  await api.request<void>('/auth/logout', { method: 'POST' });
}
