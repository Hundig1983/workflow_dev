import type { ApiClient } from '../api/client';
import type { Dashboard } from './types';

/**
 * Always the `me` route: the caller's family is resolved server-side from the session.
 * Passing a client-held family id would move an authorization decision onto the client,
 * which Article I.1 forbids.
 */
export async function fetchDashboard(api: ApiClient): Promise<Dashboard> {
  return api.request<Dashboard>('/families/me/dashboard');
}
