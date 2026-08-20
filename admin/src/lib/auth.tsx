import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api, tokens } from './api';
import type { SessionUser } from './types';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

interface AuthResponse {
  user: SessionUser;
  tokens: { accessToken: string; refreshToken: string };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  // Restore the session on load: a stored token is only trustworthy if /auth/me agrees.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!tokens.access) {
        setLoading(false);
        return;
      }
      try {
        const data = await api.get<{ user: SessionUser }>('/auth/me');
        if (!cancelled) setUser(data.user);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // The api client fires this when a refresh fails, so an expired session drops the
  // dashboard back to the login screen instead of leaving it stuck on errors.
  useEffect(() => {
    const onSignedOut = () => clearSession();
    window.addEventListener('sse:signed-out', onSignedOut);
    return () => window.removeEventListener('sse:signed-out', onSignedOut);
  }, [clearSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await api.post<AuthResponse>('/auth/login', { email, password });

    // The API is shared with the student app; this dashboard is admin-only.
    if (data.user.role !== 'ADMIN') {
      throw new ApiError(403, 'NOT_ADMIN', 'This dashboard is for administrator accounts only.');
    }

    tokens.set(data.tokens.accessToken, data.tokens.refreshToken);
    setUser(data.user);
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = tokens.refresh;
    if (refreshToken) {
      // Best effort: the local session is cleared either way.
      await api.post('/auth/logout', { refreshToken }).catch(() => undefined);
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
