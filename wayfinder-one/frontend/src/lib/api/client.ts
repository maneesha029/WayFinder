import type { ErrorBody } from '@contracts/types';

export const API_BASE: string =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1';

export type ApiMode = 'live' | 'fixtures';
export const API_MODE: ApiMode =
  (process.env.NEXT_PUBLIC_API_MODE as ApiMode | undefined) || 'live';

export const DEMO_MODE = (process.env.NEXT_PUBLIC_DEMO_MODE || '0') === '1';

/** Error envelope (B6.4): message is shown as-is, code drives behaviour. */
export class ApiError extends Error {
  readonly code: ErrorBody['code'];
  readonly details: Record<string, unknown> | null;
  readonly requestId: string;
  readonly status: number;

  constructor(status: number, body: ErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details ?? null;
    this.requestId = body.request_id;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Consequential actions carry this; retries must reuse the same key (A7). */
  idempotencyKey?: string;
  /** Plain text / blob / HTML responses return raw. */
  raw?: boolean;
  signal?: AbortSignal;
}

import { getToken, clearSession } from '@/lib/auth';

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal
    });
  } catch {
    throw new ApiError(0, {
      code: 'INTERNAL',
      message: 'Network unreachable. Check your connection and try again.',
      details: null,
      request_id: 'client-offline'
    });
  }

  if (res.status === 401 && token) {
    clearSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login');
    }
  }

  if (opts.raw) {
    if (!res.ok) await throwFromEnvelope(res);
    return (await res.text()) as unknown as T;
  }

  if (!res.ok) await throwFromEnvelope(res);
  return (await res.json()) as T;
}

async function throwFromEnvelope(res: Response): Promise<never> {
  let body: { error?: ErrorBody } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (body?.error) throw new ApiError(res.status, body.error);
  throw new ApiError(res.status, {
    code: res.status === 404 ? 'NOT_FOUND' : res.status === 403 ? 'FORBIDDEN' : 'INTERNAL',
    message: `Request failed (${res.status})`,
    details: null,
    request_id: 'unknown'
  });
}
