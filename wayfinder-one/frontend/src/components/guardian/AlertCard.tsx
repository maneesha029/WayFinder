'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { ChevronRight, Eye, Info, AlertTriangle, CircleAlert, Bell, X } from 'lucide-react';
import type { ActionRef, Alert } from '@contracts/types';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { fmtDateTime, timeAgo } from '@/lib/format';
import { LevelBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { SimBadge } from '@/components/ui/SimBadge';

const windowLabels: Record<string, string> = {
  POST_BOOKING: 'Post-booking',
  'T-72H': '72 h before',
  'T-24H': '24 h before',
  'T-3H': '3 h before',
  LIVE: 'Live'
};

const levelIcon = { INFO: Info, NUDGE: Bell, ACTION_NEEDED: AlertTriangle, CRITICAL: CircleAlert } as const;

/** Action button mapping — SWITCH_PLAN opens the switch card via a callback. */
function ActionButton({
  action,
  onOpenSwitch,
  onOpenTab
}: {
  action: ActionRef;
  onOpenSwitch: (recId?: string) => void;
  onOpenTab: (tab: string) => void;
}) {
  const primary = action.action === 'SWITCH_PLAN';
  return (
    <Button
      size="sm"
      variant={primary ? 'primary' : 'secondary'}
      data-testid={`alert-action-${action.action.toLowerCase()}`}
      onClick={() => {
        if (action.action === 'SWITCH_PLAN') onOpenSwitch(action.params?.recommendation_id as string | undefined);
        else if (action.action === 'VIEW') onOpenTab(String(action.params?.tab ?? 'itinerary'));
        else if (action.action === 'CHECK_IN') window.open(String(action.params?.url ?? ''), '_blank', 'noopener');
      }}
    >
      {action.label}
      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
    </Button>
  );
}

/**
 * AlertCard (A6.3): level icon+label+title+body, provenance line, one-tap action,
 * dismiss. Escalation ladder explained in a tooltip. New alerts slide in once.
 */
export function AlertCard({
  alert,
  onOpenSwitch,
  onOpenTab,
  highlight
}: {
  alert: Alert;
  onOpenSwitch: (recId?: string) => void;
  onOpenTab: (tab: string) => void;
  highlight?: boolean;
}) {
  const qc = useQueryClient();
  const [showWhy, setShowWhy] = useState(false);
  const ack = useMutation({
    mutationFn: (action: 'APPROVE' | 'DISMISS' | 'SEEN') => api.ackAlert(alert.id, { action }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.alerts(alert.trip_id) });
      qc.invalidateQueries({ queryKey: qk.trip(alert.trip_id) });
    }
  });
  const Icon = levelIcon[alert.level];

  return (
    <article
      data-testid={`alert-${alert.id}`}
      className={clsx(
        'anim-alert-in rounded-card border bg-surface shadow-card',
        highlight && 'ring-2 ring-brand/30',
        alert.level === 'CRITICAL' ? 'border-red/40' : alert.level === 'ACTION_NEEDED' ? 'border-amber/40' : 'border-line'
      )}
    >
      <div className="flex items-start gap-3 px-4 pt-3.5">
        <span
          aria-hidden
          className={clsx(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            alert.level === 'CRITICAL' ? 'bg-red-bg text-red' : alert.level === 'ACTION_NEEDED' ? 'bg-amber-bg text-amber' : alert.level === 'NUDGE' ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-ink-2'
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge level={alert.level} />
            <span className="font-mono text-xs text-ink-3">{windowLabels[alert.window] ?? alert.window}</span>
            <span className="font-mono text-xs text-ink-3">· {timeAgo(alert.created_at)}</span>
            {alert.state === 'DISMISSED' ? <span className="text-xs text-ink-3">dismissed</span> : null}
          </div>
          <h4 className="mt-1.5 font-semibold leading-snug">{alert.title}</h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{alert.body}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {alert.recommended_action && alert.state === 'NEW' ? (
              <ActionButton action={alert.recommended_action} onOpenSwitch={onOpenSwitch} onOpenTab={onOpenTab} />
            ) : null}
            <Tooltip content="Show the signals behind this alert — sources, freshness, and what they fed.">
              <button
                type="button"
                onClick={() => setShowWhy((v) => !v)}
                aria-expanded={showWhy}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-ink-2 hover:bg-surface-2"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                Why am I seeing this?
              </button>
            </Tooltip>
            {alert.state === 'NEW' ? (
              <button
                type="button"
                onClick={() => ack.mutate('DISMISS')}
                disabled={ack.isPending}
                className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-ink-3 hover:bg-surface-2"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Dismiss
              </button>
            ) : null}
          </div>

          {showWhy ? <WhyThisInline tripId={alert.trip_id} alertId={alert.id} /> : null}

          <p className="mt-2.5 flex flex-wrap items-center gap-1.5 font-mono text-xs text-ink-3">
            {alert.provenance.source} · checked {timeAgo(alert.provenance.checked_at)} · {fmtDateTime(alert.created_at)}
            {alert.provenance.is_simulated ? <SimBadge source={alert.provenance.source} /> : null}
          </p>
        </div>
      </div>
      <div className="h-1" aria-hidden>
        <div
          className={clsx(
            'h-full w-full',
            alert.level === 'CRITICAL' ? 'bg-red/70' : alert.level === 'ACTION_NEEDED' ? 'bg-amber/70' : alert.level === 'NUDGE' ? 'bg-brand/50' : 'bg-line'
          )}
        />
      </div>
    </article>
  );
}

/** WhyThis (B7 #33): signals + what they fed, fetched on demand. */
function WhyThisInline({ tripId, alertId }: { tripId: string; alertId: string }) {
  const signals = useSignalViews(tripId);
  if (signals.isLoading) return <p className="mt-3 rounded-inset bg-surface-2 px-3 py-2 text-xs text-ink-2">Loading signals…</p>;
  if (signals.isError) return <p className="mt-3 rounded-inset bg-red-bg px-3 py-2 text-xs text-red">Signals unavailable.</p>;
  const mine = signals.data?.filter((v) => v.used_in.includes(alertId)) ?? [];
  const list = mine.length ? mine : signals.data?.slice(0, 2) ?? [];
  return (
    <div className="mt-3 space-y-2 rounded-inset border border-dashed border-line bg-surface-2/50 px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Signals behind this alert</p>
      {list.map((v) => (
        <div key={v.signal.id} className="text-xs leading-relaxed">
          <p className="font-mono">
            <span className="font-semibold">{v.signal.kind}</span> · {v.signal.summary}
          </p>
          <p className="text-ink-3">
            source {v.signal.provenance.source} · confidence {Math.round(v.signal.provenance.confidence * 100)}% · fed into{' '}
            {v.used_in.length ? v.used_in.join(', ') : 'no alerts yet'}
          </p>
        </div>
      ))}
      {!list.length ? <p className="text-xs text-ink-3">No signals recorded yet for this trip.</p> : null}
    </div>
  );
}

function useSignalViews(tripId: string) {
  return useQuery({ queryKey: qk.signals(tripId), queryFn: () => api.signals(tripId), enabled: !!tripId, staleTime: 10_000 });
}
