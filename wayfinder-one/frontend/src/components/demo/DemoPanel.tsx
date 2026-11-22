'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Clock3, FlaskConical, Play, RotateCcw, Square, Zap } from 'lucide-react';
import type { Window as SimWindow } from '@contracts/types';
import { api } from '@/lib/api/endpoints';
import { setDrivePos } from '@/lib/demoStore';
import { pushToast } from '@/components/ui/Toast';
import { useDemoRoute } from '@/hooks/useDemoRoute';
import clsx from 'clsx';

/** Demo control panel (A6.9): a deliberately dev-tool-looking dark strip. */
export function DemoPanel({
  open,
  onClose,
  tripId
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
}) {
  const qc = useQueryClient();
  const state = useQuery({ queryKey: ['demoState'], queryFn: api.demoState, enabled: open, refetchInterval: 2000 });

  const clock = useMutation({
    mutationFn: (w: SimWindow) => api.demoClock(tripId, { window: w }),
    onSuccess: (r) => {
      pushToast({ level: 'info', title: `Clock → ${r.window}`, body: `sim_now ${r.sim_now}` });
      qc.invalidateQueries();
    }
  });
  const inject = useMutation({
    mutationFn: (b: { kind: 'FLIGHT_DELAY' | 'RAIN' | 'BANDH' | 'TRAFFIC_JAM'; params: Record<string, unknown> }) =>
      api.demoInject(tripId, b),
    onSuccess: () => qc.invalidateQueries()
  });
  const reset = useMutation({
    mutationFn: api.demoReset,
    onSuccess: () => {
      pushToast({ level: 'info', title: 'Demo reset', body: 'Seed restored. The trip is unbooked again.' });
      qc.invalidateQueries();
    }
  });

  // drive-play: advance along the demo route, posting pings every 500ms (A6.6)
  const route = useDemoRoute();
  const points = route.data ?? [];
  useEffect(() => {
    if (!open) return;
    let timer: number | null = null;
    let pos = 0;
    const start = () => {
      if (timer || !points.length) return;
      pos = 0;
      setDrivePos(0, true);
      timer = window.setInterval(() => {
        pos += 0.02;
        if (pos >= 1) {
          setDrivePos(1, false);
          stop();
          return;
        }
        setDrivePos(pos, true);
        const p = points[Math.floor(pos * (points.length - 1))];
        api
          .location(tripId, { lat: p.lat, lng: p.lng, speed_kmh: 28, ts: new Date().toISOString() })
          .then((l) => qc.setQueryData(['live', tripId], l))
          .catch(() => stop());
      }, 500);
    };
    const stop = () => {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
        setDrivePos(0, false);
      }
    };
    (window as unknown as { __wfDrive?: { start: () => void; stop: () => void } }).__wfDrive = { start, stop };
    return () => {
      stop();
      delete (window as unknown as { __wfDrive?: unknown }).__wfDrive;
    };
  }, [open, tripId, qc, points]);

  if (!open) return null;

  const windows: Array<[SimWindow, string]> = [
    ['POST_BOOKING', 't0'],
    ['T-72H', 't72'],
    ['T-24H', 't24'],
    ['T-3H', 't3'],
    ['LIVE', 'live']
  ];

  return (
    <div
      data-testid="demo-panel"
      role="complementary"
      aria-label="Demo control panel"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10"
      style={{ background: 'var(--grad-demo)', color: '#E8EAED' }}
    >
      <div className="mx-auto flex max-w-content flex-wrap items-center gap-2 px-4 py-3 font-mono text-xs sm:px-6">
        <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-white/70">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden /> demo control
        </span>
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-white/80">
          window: {state.data?.window ?? '—'}
        </span>
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-white/80">
          sim_now: {state.data?.sim_now ? state.data.sim_now.replace('T', ' ').slice(0, 16) : '—'}
        </span>

        <div className="mx-1 h-4 w-px bg-white/15" aria-hidden />

        <div className="flex flex-wrap items-center gap-1.5">
          {windows.map(([w, id]) => (
            <button
              key={w}
              type="button"
              data-testid={`clock-${id}`}
              disabled={clock.isPending}
              onClick={() => clock.mutate(w)}
              className={clsx(
                'rounded-full border px-2.5 py-1 transition-colors',
                w === 'POST_BOOKING' ? 'border-white/20 text-white/85' : 'border-white/20 text-white/85 hover:bg-white/10'
              )}
            >
              <Clock3 className="mr-1 inline h-3 w-3" aria-hidden />
              {w === 'POST_BOOKING' ? 'post-booking' : w.toLowerCase()}
            </button>
          ))}
        </div>

        <div className="mx-1 h-4 w-px bg-white/15" aria-hidden />

        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" data-testid="inject-delay-55" onClick={() => inject.mutate({ kind: 'FLIGHT_DELAY', params: { minutes: 55 } })} className="rounded-full border border-amber/50 bg-amber/15 px-2.5 py-1 text-amber-200 hover:bg-amber/25">
            <Zap className="mr-1 inline h-3 w-3" aria-hidden /> delay 55
          </button>
          <button type="button" data-testid="inject-delay-120" onClick={() => inject.mutate({ kind: 'FLIGHT_DELAY', params: { minutes: 120 } })} className="rounded-full border border-red/50 bg-red/15 px-2.5 py-1 text-red-200 hover:bg-red/25">
            <Zap className="mr-1 inline h-3 w-3" aria-hidden /> delay 120
          </button>
          <button type="button" data-testid="inject-rain" onClick={() => inject.mutate({ kind: 'RAIN', params: { day: 3, intensity: 'HEAVY' } })} className="rounded-full border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 text-sky-200 hover:bg-sky-400/20">
            <Zap className="mr-1 inline h-3 w-3" aria-hidden /> rain
          </button>
          <button type="button" data-testid="inject-bandh" onClick={() => inject.mutate({ kind: 'BANDH', params: { day: 2 } })} className="rounded-full border border-white/20 px-2.5 py-1 text-white/85 hover:bg-white/10">
            <Zap className="mr-1 inline h-3 w-3" aria-hidden /> bandh
          </button>
          <button type="button" data-testid="inject-traffic-25" onClick={() => inject.mutate({ kind: 'TRAFFIC_JAM', params: { minutes: 25 } })} className="rounded-full border border-amber/50 bg-amber/15 px-2.5 py-1 text-amber-200 hover:bg-amber/25">
            <Zap className="mr-1 inline h-3 w-3" aria-hidden /> traffic 25
          </button>
          <DriveButton />
          <button type="button" data-testid="demo-reset" onClick={() => reset.mutate()} className="rounded-full border border-white/20 px-2.5 py-1 text-white/85 hover:bg-white/10">
            <RotateCcw className="mr-1 inline h-3 w-3" aria-hidden /> reset
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-full border border-white/20 px-2.5 py-1 text-white/60 hover:bg-white/10"
          aria-label="Close demo panel"
        >
          esc · D
        </button>
      </div>
    </div>
  );
}

function DriveButton() {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (playing) {
      (window as unknown as { __wfDrive?: { start: () => void } }).__wfDrive?.start();
      return () => {
        (window as unknown as { __wfDrive?: { stop: () => void } }).__wfDrive?.stop();
      };
    }
  }, [playing]);

  return (
    <button
      type="button"
      data-testid="drive-play"
      onClick={() => setPlaying((v) => !v)}
      className={clsx(
        'rounded-full border px-2.5 py-1',
        playing ? 'border-green/60 bg-green/20 text-green-200' : 'border-white/20 text-white/85 hover:bg-white/10'
      )}
    >
      {playing ? <Square className="mr-1 inline h-3 w-3" aria-hidden /> : <Play className="mr-1 inline h-3 w-3" aria-hidden />}
      {playing ? 'stop drive' : 'drive'}
    </button>
  );
}

export function DemoHotkeyHint({ onClick, window }: { onClick: () => void; window: SimWindow | null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-xs text-ink-2 hover:border-brand hover:text-brand sm:inline-flex"
      aria-label="Open demo control panel (hotkey D)"
    >
      <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans font-semibold">D</kbd>
      {window ?? 'demo'}
    </button>
  );
}
