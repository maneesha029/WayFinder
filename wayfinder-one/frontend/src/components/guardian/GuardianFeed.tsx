'use client';

import { useQuery } from '@tanstack/react-query';
import { BellOff, Clock3 } from 'lucide-react';
import type { Alert } from '@contracts/types';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { AlertCard } from './AlertCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Tooltip } from '@/components/ui/Tooltip';

const WINDOW_ORDER = ['LIVE', 'T-3H', 'T-24H', 'T-72H', 'POST_BOOKING'] as const;
const windowTitles: Record<string, string> = {
  LIVE: 'Live now',
  'T-3H': '3 hours before',
  'T-24H': '24 hours before',
  'T-72H': '72 hours before',
  POST_BOOKING: 'Right after booking'
};

/**
 * GuardianFeed (A6.3): alerts grouped by window (Live first), only
 * ACTION_NEEDED/CRITICAL toast (handled in useTripEvents).
 */
export function GuardianFeed({
  tripId,
  onOpenSwitch,
  onOpenTab
}: {
  tripId: string;
  onOpenSwitch: (recId?: string) => void;
  onOpenTab: (tab: string) => void;
}) {
  const alerts = useQuery({ queryKey: qk.alerts(tripId), queryFn: () => api.alerts(tripId) });

  if (alerts.isLoading) {
    return (
      <div className="space-y-3" aria-hidden>
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
      </div>
    );
  }
  if (alerts.isError) {
    return (
      <div className="rounded-card border border-line bg-surface shadow-card">
        <ErrorState error={alerts.error} onRetry={() => alerts.refetch()} title="Guardian feed unavailable" />
      </div>
    );
  }

  const list: Alert[] = alerts.data ?? [];
  if (!list.length) {
    return (
      <div className="rounded-card border border-line bg-surface shadow-card">
        <EmptyState
          icon={<BellOff className="h-5 w-5" aria-hidden />}
          title="Guardian is watching. Nothing needs you yet."
          body="The Journey Pulse checks weather, events, traffic and flight status on a schedule. Alerts appear here the moment something touches your plan."
          action={
            <p className="flex items-center gap-1.5 font-mono text-xs text-ink-3">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              next check within 30 s (demo) / 30 min (live)
            </p>
          }
        />
      </div>
    );
  }

  const groups = WINDOW_ORDER.map((w) => ({ window: w, items: list.filter((a) => a.window === w) })).filter((g) => g.items.length);

  return (
    <div className="space-y-5" data-testid="guardian-feed">
      {groups.map((g) => (
        <section key={g.window} aria-labelledby={`gf-${g.window}`}>
          <h3 id={`gf-${g.window}`} className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-ink-2">
            {windowTitles[g.window]}
            <span className="tnum rounded-full bg-surface-2 px-2 py-0.5 font-mono text-xs text-ink-3">{g.items.length}</span>
            {g.window === 'LIVE' ? (
              <Tooltip content="Escalation ladder: Info → Nudge → Action needed → Critical. Only Action needed and Critical interrupt you.">
                <span className="cursor-help text-xs font-normal text-ink-3 underline decoration-dotted">how alerts escalate</span>
              </Tooltip>
            ) : null}
          </h3>
          <div className="space-y-3">
            {g.items.map((a) => (
              <AlertCard key={a.id} alert={a} onOpenSwitch={onOpenSwitch} onOpenTab={onOpenTab} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
