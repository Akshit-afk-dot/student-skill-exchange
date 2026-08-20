/**
 * Thin API client for the admin dashboard.
 *
 * Handles the one piece of real complexity in talking to this API: access tokens expire
 * after 15 minutes, so a 401 triggers a single refresh-and-retry. Concurrent 401s share
 * one refresh promise rather than each starting their own and invalidating each other
 * through the server's token-reuse detection.
 */

const BASE = import.meta.env.VITE_API_URL ?? '';
const API = `${BASE}/api/v1`;

const ACCESS_KEY = 'sse.admin.access';
const REFRESH_KEY = 'sse.admin.refresh';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, string> };
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
}

export const tokens = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Shared across concurrent 401s so only one refresh is ever in flight. */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return false;

  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) {
        tokens.clear();
        return false;
      }
      const body = (await res.json()) as { data: { tokens: { accessToken: string; refreshToken: string } } };
      tokens.set(body.data.tokens.accessToken, body.data.tokens.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Internal: prevents an infinite refresh loop. */
  retrying?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const access = tokens.access;
  if (access) headers.Authorization = `Bearer ${access}`;

  const res = await fetch(`${API}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (res.status === 401 && !options.retrying && tokens.refresh) {
    if (await refreshTokens()) {
      return apiFetch<T>(path, { ...options, retrying: true });
    }
    // Refresh failed: the session is genuinely over.
    window.dispatchEvent(new CustomEvent('sse:signed-out'));
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json: unknown = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const body = json as ApiErrorBody;
    throw new ApiError(
      res.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? `Request failed with ${res.status}`,
      body.error?.details,
    );
  }

  return (json as { data: T }).data;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}
