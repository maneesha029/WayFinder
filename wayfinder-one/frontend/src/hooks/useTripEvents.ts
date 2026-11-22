'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Alert, Booking, SlackScore, SwitchRecommendation, LiveStatus } from '@contracts/types';
import { openTripStream } from '@/lib/api/sse';
import { qk } from '@/lib/queryKeys';
import { pushToast } from '@/components/ui/Toast';
import { setClock, setDrivePos } from '@/lib/demoStore';

/**
 * SSE wiring (A7): invalidates the right queries per event, toasts only
 * ACTION_NEEDED/CRITICAL alerts, falls back to polling with a "reconnecting" dot.
 */
export function useTripEvents(tripId: string): { live: boolean } {
  const qc = useQueryClient();
  const [live, setLive] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    const stream = openTripStream(
      tripId,
      {
        'alert.created': (payload) => {
          qc.invalidateQueries({ queryKey: qk.alerts(tripId) });
          qc.invalidateQueries({ queryKey: qk.trip(tripId) });
          const a = payload as Alert;
          if (a.level === 'ACTION_NEEDED' || a.level === 'CRITICAL') {
            pushToast({ level: a.level === 'CRITICAL' ? 'critical' : 'warning', title: a.title, body: a.body });
          }
        },
        'slack.updated': (payload) => {
          qc.setQueryData(qk.slack(tripId), payload as SlackScore);
        },
        'switch.proposed': (payload) => {
          qc.setQueryData(qk.switch(tripId), payload as SwitchRecommendation);
          const sw = payload as SwitchRecommendation;
          pushToast({
            level: 'warning',
            title: 'Switch recommended',
            body: `Plan A ${Math.round(sw.feasibility_a * 100)}% vs Plan B ${Math.round(sw.feasibility_b * 100)}%. Nothing changes until you approve.`
          });
        },
        'plan.switched': () => {
          qc.invalidateQueries({ queryKey: qk.trip(tripId) });
          qc.invalidateQueries({ queryKey: qk.bookings(tripId) });
          qc.invalidateQueries({ queryKey: qk.drafts(tripId) });
          qc.invalidateQueries({ queryKey: qk.evidence(tripId) });
          qc.invalidateQueries({ queryKey: qk.switch(tripId) });
          qc.invalidateQueries({ queryKey: qk.slack(tripId) });
          qc.invalidateQueries({ queryKey: qk.vouchers(tripId) });
        },
        'draft.created': () => {
          qc.invalidateQueries({ queryKey: qk.drafts(tripId) });
        },
        'booking.updated': (payload) => {
          const b = payload as Booking;
          qc.invalidateQueries({ queryKey: qk.bookings(tripId) });
          qc.invalidateQueries({ queryKey: qk.trip(tripId) });
          qc.invalidateQueries({ queryKey: qk.vouchers(tripId) });
          if (b.status === 'CONFIRMED' && b.supplier_ref?.startsWith('SIM-H')) {
            pushToast({ level: 'success', title: 'Hotel confirmed', body: `Reference ${b.supplier_ref} — vouchers are ready.` });
          }
        },
        'plan.updated': () => {
          qc.invalidateQueries({ queryKey: qk.trip(tripId) });
        },
        'sim.clock': (payload) => {
          const c = payload as { window: SimWindow_like; sim_now: string | null };
          setClock(c.window ?? null, c.sim_now ?? null);
        },
        'signal.created': () => {
          qc.invalidateQueries({ queryKey: qk.signals(tripId) });
        },
        'group.updated': () => {
          qc.invalidateQueries({ queryKey: qk.group(tripId) });
        },
        'vote.updated': (payload) => {
          qc.setQueryData(qk.votes(tripId), payload);
          qc.invalidateQueries({ queryKey: qk.split(tripId, 'EQUAL') });
        },
        'safe_checkin.due': (payload) => {
          const c = payload as { item_id: string };
          pushToast({ level: 'warning', title: 'Safe check-in due', body: `Confirm you are safe after ${c.item_id}. Reply in the Safety tab.` });
        },
        'notification.sent': (payload) => {
          qc.setQueryData<{ channel: string; to_masked: string; alert_id: string; state: string; at: string }[]>(
            ['receipts'],
            (prev) => [...(prev ?? []), { ...(payload as { channel: string; to_masked: string; alert_id: string; state: string }), at: new Date().toISOString() }]
          );
        },
        'live.updated': (payload) => {
          qc.setQueryData(qk.live(tripId), payload as LiveStatus);
        },
        'sim.reset': () => {
          setClock(null, null);
          setDrivePos(0, false);
          qc.invalidateQueries();
        }
      },
      (ok) => setLive(ok)
    );
    return () => stream.close();
  }, [tripId, qc]);

  return { live };
}

type SimWindow_like = 'POST_BOOKING' | 'T-72H' | 'T-24H' | 'T-3H' | 'LIVE';
