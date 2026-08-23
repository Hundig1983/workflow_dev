import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createApiClient, type ApiClient } from '../api/client';
import { login as loginRequest, logout as logoutRequest, signup as signupRequest } from './api';
import { clearToken, loadToken, saveToken } from './storage';
import type { Credentials, SignupInput } from './types';

type AuthStatus = 'restoring' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  api: ApiClient;
  signIn: (credentials: Credentials) => Promise<void>;
  register: (input: SignupInput) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('restoring');

  // The api client is built once and must not be rebuilt when the token changes,
  // so the token is read through a ref rather than captured in a closure.
  const tokenRef = useRef<string | null>(null);

  const setToken = useCallback((token: string | null) => {
    tokenRef.current = token;
    setStatus(token === null ? 'anonymous' : 'authenticated');
  }, []);

  const handleUnauthenticated = useCallback(() => {
    // The server rejected the session: drop it and fall back to the signed-out
    // surface. This is what routes the user to Login on a 401 (task 7.5).
    tokenRef.current = null;
    setStatus('anonymous');
    void clearToken();
  }, []);

  const api = useMemo(
    () =>
      createApiClient({
        getToken: () => tokenRef.current,
        onUnauthenticated: handleUnauthenticated,
      }),
    [handleUnauthenticated],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadToken();
      if (cancelled) return;
      setToken(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, [setToken]);

  const signIn = useCallback(
    async (credentials: Credentials) => {
      const session = await loginRequest(api, credentials);
      await saveToken(session.token);
      setToken(session.token);
    },
    [api, setToken],
  );

  const register = useCallback(
    async (input: SignupInput) => {
      // Signup deliberately does not issue a session (backend keeps session issuance
      // in one place), so completing registration means signing in straight after.
      await signupRequest(api, input);
      await signIn({ email: input.email, password: input.password });
    },
    [api, signIn],
  );

  const signOut = useCallback(async () => {
    try {
      await logoutRequest(api);
    } catch {
      // A failed logout must still sign the user out locally — the token is being
      // discarded either way, and stranding them signed-in would be worse.
    }
    await clearToken();
    setToken(null);
  }, [api, setToken]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, api, signIn, register, signOut }),
    [status, api, signIn, register, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error('useAuth must be used inside an AuthProvider');
  return value;
}
