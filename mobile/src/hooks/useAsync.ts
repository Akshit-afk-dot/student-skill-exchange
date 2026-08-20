import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  reload(): void;
  /** Refetch without showing the full-screen spinner (pull-to-refresh). */
  refresh(): void;
  setData(next: T | null): void;
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}

/**
 * Runs an async function on mount and whenever `deps` change.
 *
 * A request counter drops responses from superseded calls, so rapid filter changes
 * cannot leave older results on screen.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  const requestId = useRef(0);
  const mounted = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (isRefresh: boolean) => {
    const id = ++requestId.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await fnRef.current();
      if (id !== requestId.current || !mounted.current) return;
      setData(result);
    } catch (err) {
      if (id !== requestId.current || !mounted.current) return;
      setError(messageFor(err));
    } finally {
      if (id === requestId.current && mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  return {
    data,
    error,
    loading,
    refreshing,
    reload: useCallback(() => setNonce((n) => n + 1), []),
    refresh: useCallback(() => void run(true), [run]),
    setData,
  };
}

/** Wraps a one-shot action with pending/error state for buttons and forms. */
export function useAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): {
  run(...args: TArgs): Promise<TResult | null>;
  pending: boolean;
  error: string | null;
  fieldErrors: Record<string, string> | null;
  reset(): void;
} {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args: TArgs) => {
    setPending(true);
    setError(null);
    setFieldErrors(null);
    try {
      return await fnRef.current(...args);
    } catch (err) {
      setError(messageFor(err));
      // 422 responses carry per-field messages the forms attach to their inputs.
      if (err instanceof ApiError && err.details) setFieldErrors(err.details);
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setFieldErrors(null);
  }, []);

  return { run, pending, error, fieldErrors, reset };
}
