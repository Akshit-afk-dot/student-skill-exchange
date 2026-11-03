import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import {
  clearTokens,
  getRefreshToken,
  loadTokens,
  saveTokens,
  setSignOutHandler,
} from '../api/client';
import { auth as authApi } from '../api/endpoints';
import { connectSocket, disconnectSocket } from '../api/socket';
import type { SelfUser } from '../types';

interface AuthState {
  user: SelfUser | null;
  /** True until the stored session has been checked, so no screen flashes first. */
  initialising: boolean;
  signIn(email: string, password: string): Promise<void>;
  signInWithGoogle(idToken: string): Promise<void>;
  register(input: {
    name: string;
    email: string;
    password: string;
    college?: string;
    department?: string;
    year?: number;
    acceptTerms?: boolean;
  }): Promise<void>;
  signOut(): Promise<void>;
  refreshUser(): Promise<void>;
  setUser(user: SelfUser): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SelfUser | null>(null);
  const [initialising, setInitialising] = useState(true);

  const endSession = useCallback(async () => {
    disconnectSocket();
    await clearTokens();
    setUser(null);
  }, []);

  // The api client calls this when a refresh fails, so an unrecoverable session drops
  // straight back to the sign-in screen.
  useEffect(() => {
    setSignOutHandler(() => {
      void endSession();
    });
  }, [endSession]);

  // Restore a stored session on cold start.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { access } = await loadTokens();
        if (!access) return;

        const { user: me } = await authApi.me();
        if (cancelled) return;

        setUser(me);
        connectSocket();
      } catch {
        // Either the token is dead or the device is offline. Clearing is the safe
        // reading: a signed-out user can sign in again, a stuck one cannot.
        if (!cancelled) await clearTokens();
      } finally {
        if (!cancelled) setInitialising(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Callers must await this: it persists the tokens before reporting success, so the
  // caller's try/catch sees a failed keystore write rather than letting it escape as an
  // unhandled rejection with the form showing no error.
  const applyAuth = useCallback(
    async (payload: { user: SelfUser; tokens: { accessToken: string; refreshToken: string } }) => {
      await saveTokens(payload.tokens.accessToken, payload.tokens.refreshToken);
      setUser(payload.user);
      connectSocket();
    },
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      await applyAuth(await authApi.login(email, password));
    },
    [applyAuth],
  );

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      await applyAuth(await authApi.google(idToken));
    },
    [applyAuth],
  );

  const register = useCallback(
    async (input: Parameters<AuthState['register']>[0]) => {
      await applyAuth(await authApi.register(input));
    },
    [applyAuth],
  );

  const signOut = useCallback(async () => {
    const refresh = getRefreshToken();
    if (refresh) {
      // Best effort — the local session is cleared whether or not the server hears us.
      await authApi.logout(refresh).catch(() => undefined);
    }
    await endSession();
  }, [endSession]);

  const refreshUser = useCallback(async () => {
    try {
      const { user: me } = await authApi.me();
      setUser(me);
    } catch {
      // Leave the cached user in place; a transient failure should not blank the UI.
    }
  }, []);

  // Coming back to the app is usually when a student has just tapped the link in their
  // verification email, so pick up the new state rather than keep a stale banner.
  const signedIn = user !== null;
  useEffect(() => {
    if (!signedIn) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshUser();
    });
    return () => subscription.remove();
  }, [signedIn, refreshUser]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      initialising,
      signIn,
      signInWithGoogle,
      register,
      signOut,
      refreshUser,
      setUser,
    }),
    [user, initialising, signIn, signInWithGoogle, register, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
