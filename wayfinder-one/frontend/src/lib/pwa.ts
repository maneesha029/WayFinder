'use client';

/**
 * PWA runtime (A6b): service-worker registration, offline pack download into
 * Cache Storage, and the queued-SOS replay on reconnect.
 */
import type { OfflineManifest } from '@contracts/types';

export const PACK_CACHE = 'wf-offline-pack-v1';
export const SHELL_CACHE = 'wf-shell-v1';

export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    /* SW is a progressive enhancement; the app works without it */
  });
}

export interface PackResult {
  bytes: number;
  syncedAt: string;
  version: number;
}

/** Download the offline pack + manifest resources into Cache Storage (AC-35). */
export async function downloadOfflinePack(tripId: string, apiFetch: <T>(p: string) => Promise<T>): Promise<PackResult> {
  const manifest = await apiFetch<OfflineManifest>(`/trips/${tripId}/offline-manifest`);
  let bytes = 0;
  const cache = await caches.open(PACK_CACHE);
  for (const r of manifest.resources) {
    const url = new URL(r.url, window.location.origin).toString();
    try {
      const res = await fetch(url);
      if (res.ok) {
        await cache.put(url, res.clone());
        bytes += r.bytes;
      }
    } catch {
      /* a single failed resource must not abort the pack */
    }
  }
  const meta: PackResult = { bytes, syncedAt: new Date().toISOString(), version: manifest.version };
  await cache.put(`meta:${tripId}`, new Response(JSON.stringify(meta)));
  return meta;
}

export async function readPackMeta(tripId: string): Promise<PackResult | null> {
  try {
    const cache = await caches.open(PACK_CACHE);
    const res = await cache.match(`meta:${tripId}`);
    return res ? ((await res.json()) as PackResult) : null;
  } catch {
    return null;
  }
}

/** Replay queued consequential actions (SOS, check-in confirm) on reconnect (A6b). */
const QUEUE_KEY = 'wf.actionQueue.v1';

export interface QueuedAction {
  id: string;
  path: string;
  method: 'POST';
  body: unknown;
  idempotencyKey: string;
  queuedAt: string;
}

export function readQueue(): QueuedAction[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) || '[]') as QueuedAction[];
  } catch {
    return [];
  }
}

export function enqueueAction(a: Omit<QueuedAction, 'queuedAt'>): void {
  if (typeof window === 'undefined') return;
  const q = readQueue();
  q.push({ ...a, queuedAt: new Date().toISOString() });
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function replayQueue(
  send: (a: QueuedAction) => Promise<void>
): Promise<number> {
  const queue = readQueue();
  const remaining: QueuedAction[] = [];
  let sent = 0;
  for (const a of queue) {
    try {
      await send(a);
      sent += 1;
    } catch {
      remaining.push(a);
    }
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  }
  return sent;
}
