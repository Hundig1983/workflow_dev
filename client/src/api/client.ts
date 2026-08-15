import { API_URL } from '../config';

/** The single error envelope the API emits (backend/src/http/errors.ts). */
interface ErrorEnvelope {
  error: { code: string; message: string; field?: string };
}

/**
 * The API answered, and said no. `field` names the offending input when the
 * failure is a per-field validation error.
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The session is absent, expired, or rejected. Distinct so callers can re-authenticate. */
export class UnauthenticatedError extends ApiError {
  constructor(message: string) {
    super('unauthenticated', message, 401);
    this.name = 'UnauthenticatedError';
  }
}

/**
 * The API could not be reached, or answered with something that is not the agreed
 * envelope. Kept separate from ApiError because the dashboard must tell "no content"
 * apart from "could not load" (family-dashboard spec).
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export interface ApiClientOptions {
  /** Returns the current session token, or null when signed out. */
  getToken: () => string | null;
  /** Invoked whenever the API rejects the session, before the error is thrown. */
  onUnauthenticated: () => void;
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Send without the Authorization header even if a token exists (login/signup). */
  anonymous?: boolean;
}

export interface ApiClient {
  request: <T>(path: string, options?: RequestOptions) => Promise<T>;
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = (value as { error?: unknown }).error;
  if (typeof candidate !== 'object' || candidate === null) return false;
  const { code, message } = candidate as { code?: unknown; message?: unknown };
  return typeof code === 'string' && typeof message === 'string';
}

/**
 * Token access is injected rather than imported so this module stays free of any
 * dependency on the auth module — the client mirror of the backend's module boundary.
 */
export function createApiClient({ getToken, onUnauthenticated }: ApiClientOptions): ApiClient {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, anonymous = false } = options;
    const headers: Record<string, string> = { Accept: 'application/json' };

    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const token = anonymous ? null : getToken();
    if (token !== null) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new NetworkError('Could not reach the server.');
    }

    if (response.status === 204) return undefined as T;

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      // An unreadable body is a transport-level problem whether or not the status was
      // ok — there is nothing to interpret either way.
      throw new NetworkError('The server returned an unreadable response.');
    }

    if (response.ok) return payload as T;

    if (!isErrorEnvelope(payload)) {
      throw new NetworkError('The server returned an unexpected response.');
    }

    const { code, message, field } = payload.error;

    // Only an *authenticated* request can have its session rejected. Login and signup
    // also answer 401 for bad credentials, and treating that as an expired session
    // would sign out a user who merely mistyped their password.
    if (response.status === 401 && !anonymous) {
      onUnauthenticated();
      throw new UnauthenticatedError(message);
    }

    throw new ApiError(code, message, response.status, field);
  }

  return { request };
}
