'use client';

import { useSyncExternalStore } from 'react';
import type { TokenResponse, User } from '@contracts/types';

/**
 * A1 security rule: access token lives in memory, rehydrated from sessionStorage.
 * Never localStorage. Sessions die with the tab.
 */
const SS_KEY = 'wf.session.v1';

interface Session {
  token: string;
  user: User;
  expiresAt: number;
}

let session: Session | null = readSession();
const listeners = new Set<() => void>();

function readSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.token || s.expiresAt < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

function emit() {
  for (const fn of listeners) fn();
}

export function setSessionFromToken(res: TokenResponse) {
  session = {
    token: res.access_token,
    user: res.user,
    expiresAt: Date.now() + res.expires_in * 1000
  };
  try {
    window.sessionStorage.setItem(SS_KEY, JSON.stringify(session));
  } catch {
    /* private mode: memory-only session */
  }
  emit();
}

export function setUser(user: User) {
  if (!session) return;
  session = { ...session, user };
  try {
    window.sessionStorage.setItem(SS_KEY, JSON.stringify(session));
  } catch {
    /* keep memory-only */
  }
  emit();
}

export function clearSession() {
  session = null;
  try {
    window.sessionStorage.removeItem(SS_KEY);
  } catch {
    /* noop */
  }
  emit();
}

export function getToken(): string | null {
  return session?.token ?? null;
}

export function getAuthUser(): User | null {
  return session?.user ?? null;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Fires the callback when the session store changes (login/logout). */
export function subscribeAuth(fn: () => void): () => void {
  return subscribe(fn);
}

export function useAuth(): { user: User | null; token: string | null } {
  const s = useSyncExternalStore(
    subscribe,
    () => session,
    () => null
  );
  return { user: s?.user ?? null, token: s?.token ?? null };
}

export function authHeader(): Record<string, string> {
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}
