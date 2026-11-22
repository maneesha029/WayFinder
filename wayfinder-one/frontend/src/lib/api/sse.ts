'use client';

import { API_MODE, API_BASE } from './client';
import { getToken } from '@/lib/auth';
import { fixtureSse } from './fixtures';

/**
 * SSE envelope (B6.5): event: <type>, data: {"trip_id","ts","data"}.
 * Live mode: EventSource with a short-lived sse_token; fixtures mode: in-process bus.
 */
export type SseHandler = (payload: unknown) => void;

interface StreamHandle {
  close: () => void;
}

export function openTripStream(tripId: string, handlers: Record<string, SseHandler>, onStatus?: (ok: boolean) => void): StreamHandle {
  if (API_MODE === 'fixtures') return fixtureSse(tripId, handlers, onStatus);

  let es: EventSource | null = null;
  let tokenTimer: number | null = null;
  let reconnectTimer: number | null = null;
  let closed = false;
  let healthy = false;

  async function connect() {
    if (closed) return;
    try {
      const res = await fetch(`${API_BASE}/auth/sse-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() ?? ''}` }
      });
      if (!res.ok) throw new Error('sse token');
      const tok = (await res.json()) as { token: string };
      es = new EventSource(`${API_BASE}/trips/${tripId}/events?sse_token=${tok.token}`);
      es.onopen = () => {
        healthy = true;
        onStatus?.(true);
      };
      for (const name of Object.keys(handlers)) {
        es.addEventListener(name, (ev) => {
          const me = ev as MessageEvent;
          try {
            const envelope = JSON.parse(me.data);
            handlers[name](envelope.data);
          } catch {
            /* malformed frame: ignore, next heartbeat re-syncs */
          }
        });
      }
      es.onerror = () => {
        healthy = false;
        onStatus?.(false);
        es?.close();
        es = null;
        // A7: fall back to polling; retry the stream too.
        if (!closed && reconnectTimer === null) {
          reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, 5000);
        }
      };
      // refresh the 60s token before expiry while the stream is healthy
      tokenTimer = window.setTimeout(connect, 50_000);
    } catch {
      healthy = false;
      onStatus?.(false);
      if (!closed && reconnectTimer === null) {
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 5000);
      }
    }
  }

  connect();
  return {
    close: () => {
      closed = true;
      if (tokenTimer) window.clearTimeout(tokenTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      es?.close();
    }
  };
}
