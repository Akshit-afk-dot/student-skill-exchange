import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Resolves the API base URL.
 *
 * `localhost` on a phone means the phone itself, so a physical device or Android
 * emulator cannot reach a server running on the developer's machine that way. When the
 * configured URL points at localhost we substitute the host Expo is already serving the
 * bundle from, which is the machine running the API.
 */
function resolveBaseUrl(): string {
  const configured =
    (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
    process.env.EXPO_PUBLIC_API_URL ??
    'http://localhost:4000';

  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(configured);
  if (!isLocal || Platform.OS === 'web') return configured;

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (!host) return configured;

  const port = new URL(configured).port || '4000';
  return `http://${host}:${port}`;
}

export const BASE_URL = resolveBaseUrl();
export const API_URL = `${BASE_URL}/api/v1`;

const ACCESS_KEY = 'sse.access';
const REFRESH_KEY = 'sse.refresh';

/**
 * SecureStore is backed by the iOS keychain and Android keystore, but is unavailable on
 * web. Falling back to localStorage there keeps `expo start --web` usable for testing
 * while still using real secure storage on device.
 */
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

let accessToken: string | null = null;
let refreshToken: string | null = null;

export async function loadTokens(): Promise<{ access: string | null; refresh: string | null }> {
  accessToken = await storage.get(ACCESS_KEY);
  refreshToken = await storage.get(REFRESH_KEY);
  return { access: accessToken, refresh: refreshToken };
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  accessToken = access;
  refreshToken = refresh;
  await Promise.all([storage.set(ACCESS_KEY, access), storage.set(REFRESH_KEY, refresh)]);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await Promise.all([storage.remove(ACCESS_KEY), storage.remove(REFRESH_KEY)]);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string>;

  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True for the failures worth showing as "check your connection" rather than a message. */
  get isNetworkError(): boolean {
    return this.code === 'NETWORK';
  }
}

/** Called when the session cannot be recovered, so the app can return to sign-in. */
type SignOutHandler = () => void;
let onSignedOut: SignOutHandler = () => undefined;

export function setSignOutHandler(handler: SignOutHandler): void {
  onSignedOut = handler;
}

/** Shared so concurrent 401s trigger exactly one refresh. */
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshToken) return false;

  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        await clearTokens();
        return false;
      }
      const body = (await res.json()) as { data: { tokens: { accessToken: string; refreshToken: string } } };
      await saveTokens(body.data.tokens.accessToken, body.data.tokens.refreshToken);
      return true;
    } catch {
      // A network blip is not proof the session is invalid; keep the tokens.
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Multipart uploads set their own content type. */
  formData?: FormData;
  signal?: AbortSignal;
  retrying?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.formData ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection.');
  }

  if (res.status === 401 && !options.retrying && refreshToken) {
    if (await refreshSession()) {
      return request<T>(path, { ...options, retrying: true });
    }
    onSignedOut();
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(res.status, 'BAD_RESPONSE', 'The server returned an unexpected response.');
  }

  if (!res.ok) {
    const body = json as { error?: { code?: string; message?: string; details?: Record<string, string> } };
    throw new ApiError(
      res.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? `Request failed (${res.status})`,
      body.error?.details,
    );
  }

  return (json as { data: T }).data;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', formData }),
};

/** Builds a query string, omitting empty values so the URL stays readable. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}
