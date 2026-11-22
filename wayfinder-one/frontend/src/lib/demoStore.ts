'use client';

import { useSyncExternalStore } from 'react';
import type { Window as SimWindow } from '@contracts/types';

/**
 * Sim-clock state (sim.clock SSE → store → header + demo panel + live tab).
 * Also drives the simulated-drive slider position (0..1 along the demo route).
 */
export interface DemoState {
  window: SimWindow | null;
  simNow: string | null;
  drivePos: number;
  driving: boolean;
}

let state: DemoState = { window: null, simNow: null, drivePos: 0, driving: false };
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function setClock(window: SimWindow | null, simNow: string | null) {
  state = { ...state, window, simNow };
  emit();
}

export function setDrivePos(pos: number, driving?: boolean) {
  state = { ...state, drivePos: Math.min(1, Math.max(0, pos)), driving: driving ?? state.driving };
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state
  );
}
