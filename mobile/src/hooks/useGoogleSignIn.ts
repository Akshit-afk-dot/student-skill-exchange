import Constants from 'expo-constants';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { useAuth } from '../store/auth';

// Closes the browser popup and hands the result back to the app once Google redirects.
// Must run at module scope, before any auth request is made.
WebBrowser.maybeCompleteAuthSession();

interface GoogleClientIds {
  expo?: string;
  ios?: string;
  android?: string;
  web?: string;
}

/**
 * Client IDs come from app.json's `extra.google`, or the matching EXPO_PUBLIC_ vars.
 * Each platform needs its own ID from the Google Cloud console — see docs/INTEGRATIONS.md.
 */
function clientIds(): GoogleClientIds {
  const extra = (Constants.expoConfig?.extra?.google ?? {}) as GoogleClientIds;

  // app.json ships the keys as empty strings so the shape is visible and easy to fill
  // in. `??` would treat "" as configured, so blanks are normalised away first.
  const pick = (...candidates: Array<string | undefined>): string | undefined =>
    candidates.find((c) => typeof c === 'string' && c.trim().length > 0);

  return {
    expo: pick(extra.expo, process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID),
    ios: pick(extra.ios, process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
    android: pick(extra.android, process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
    web: pick(extra.web, process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  };
}

export interface GoogleSignIn {
  /** False when no client IDs are configured, so the button can be hidden entirely. */
  available: boolean;
  signIn(): void;
  pending: boolean;
  error: string | null;
}

/**
 * "Continue with Google".
 *
 * Requests an **ID token** rather than an access token: the server verifies the ID token
 * against our own client IDs, which is what stops a token minted for a different app
 * being replayed against this one. An access token would prove nothing about audience.
 */
export function useGoogleSignIn(): GoogleSignIn {
  const { signInWithGoogle } = useAuth();
  const ids = clientIds();
  const available = Boolean(ids.expo || ids.ios || ids.android || ids.web);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The hook must be called unconditionally, so it is always set up; `available`
  // decides whether the UI offers it.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: ids.web || ids.expo || '',
    iosClientId: ids.ios,
    androidClientId: ids.android,
  });

  useEffect(() => {
    if (!response) return;

    if (response.type === 'dismiss' || response.type === 'cancel') {
      setPending(false);
      return;
    }

    if (response.type === 'error') {
      setPending(false);
      setError(response.error?.message ?? 'Google sign-in failed');
      return;
    }

    if (response.type !== 'success') {
      setPending(false);
      return;
    }

    const idToken = response.params?.id_token;
    if (!idToken) {
      setPending(false);
      setError('Google did not return an ID token');
      return;
    }

    void signInWithGoogle(idToken)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Google sign-in failed');
      })
      .finally(() => setPending(false));
  }, [response, signInWithGoogle]);

  return {
    available,
    pending,
    error,
    signIn: () => {
      if (!request) {
        setError('Google sign-in is still loading. Try again in a moment.');
        return;
      }
      setError(null);
      setPending(true);
      void promptAsync();
    },
  };
}
