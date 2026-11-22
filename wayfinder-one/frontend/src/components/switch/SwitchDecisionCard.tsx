'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Check, ShieldCheck, X } from 'lucide-react';
import type { CourtesyDraft, SwitchRecommendation } from '@contracts/types';
import { ApiError } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { fmtMoney, idemKey, pct } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, PriorityChip } from '@/components/ui/Chip';
import { pushToast } from '@/components/ui/Toast';

const modeExplanations: Record<string, string> = {
  FULL: 'The whole day moves to Plan B.',
  MIXED: 'Afternoon from Plan B, the rest from Plan A.'
};

/**
 * SwitchDecisionCard (A6.4): A vs B with lost/kept/changing, drafts checklist,
 * explicit approve — never auto-closed, nothing half-applied on failure.
 */
export function SwitchDecisionCard({
  rec,
  tripId,
  onOpenDrafts,
  onSwitched,
  banner = false
}: {
  rec: SwitchRecommendation;
  tripId: string;
  onOpenDrafts: () => void;
  onSwitched?: (result: { message: string }) => void;
  banner?: boolean;
}) {
  const qc = useQueryClient();
  const [draftState, setDraftState] = useState<Record<string, boolean>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const keyRef = useRef(idemKey('sw', rec.id));

  useEffect(() => {
    keyRef.current = idemKey('sw', rec.id);
    setFailure(null);
  }, [rec]);

  const drafts = useDrafts(tripId);
  const draftList: CourtesyDraft[] = drafts.data ?? [];
  const pending = draftList.filter((d) => d.state === 'DRAFT');
  const [preselected, setPreselected] = useState<Record<string, boolean> | null>(null);
  const selected = preselected ?? Object.fromEntries(pending.map((d) => [d.id, true]));

  const decide = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REJECT') =>
      api.switchDecision(
        rec.id,
        {
          decision,
          approve_draft_ids: decision === 'APPROVE' ? pending.filter((d) => selected[d.id]).map((d) => d.id) : [],
          idempotency_key: keyRef.current
        },
        keyRef.current
      ),
    onSuccess: (_r, decision) => {
      qc.invalidateQueries({ queryKey: qk.trip(tripId) });
      qc.invalidateQueries({ queryKey: qk.bookings(tripId) });
      qc.invalidateQueries({ queryKey: qk.drafts(tripId) });
      qc.invalidateQueries({ queryKey: qk.evidence(tripId) });
      qc.invalidateQueries({ queryKey: qk.switch(tripId) });
      qc.invalidateQueries({ queryKey: qk.slack(tripId) });
      qc.invalidateQueries({ queryKey: qk.vouchers(tripId) });
      if (decision === 'APPROVE') {
        pushToast({
          level: 'success',
          title: 'Plan switched.',
          body: `${pending.filter((d) => selected[d.id]).length} messages sent (simulated). Kept bookings untouched.`
        });
        onSwitched?.({ message: 'Plan switched.' });
      } else {
        pushToast({ level: 'info', title: 'Keeping Plan A', body: 'Nothing was changed. Plan B stays warm.' });
      }
    },
    onError: (e) => {
      setFailure(e instanceof ApiError ? e.message : 'Something failed. Nothing was changed. Plan A is still active.');
    }
  });

  return (
    <Card data-testid="switch-card" className={banner ? 'border-brand/40 bg-gradient-to-br from-brand-soft/70 to-surface' : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="flex items-center gap-2 font-display text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-bg text-amber">
            <ArrowRightLeft className="h-4 w-4" aria-hidden />
          </span>
          Switch to recover the day
        </h3>
        <Chip tone="brand" className="uppercase tracking-wide text-[10px]">
          {rec.mode} · {modeExplanations[rec.mode]}
        </Chip>
      </div>

      <div className="px-4 py-3.5">
        <p className="font-display text-xl leading-snug">
          Plan A: <span className={rec.feasibility_a >= 0.85 ? 'text-green' : rec.feasibility_a >= 0.5 ? 'text-amber' : 'text-red'}>{pct(rec.feasibility_a)}</span>{' '}
          likely to work. Plan B: <span className={rec.feasibility_b >= 0.85 ? 'text-green' : 'text-amber'}>{pct(rec.feasibility_b)}</span>.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{rec.reason}</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <MiniStats title="Plan A" feasibility={rec.feasibility_a} slack={rec.slack_a_min} delta={0} />
          <MiniStats title="Plan B (proposed)" feasibility={rec.feasibility_b} slack={rec.slack_b_min} delta={rec.delta_cost_inr} highlight />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-inset border border-red/30 bg-red-bg/60 px-3 py-2.5" data-testid="switch-lost">
            <p className="text-xs font-semibold uppercase tracking-wide text-red">Lost</p>
            {rec.lost_items.length ? (
              rec.lost_items.map((l) => (
                <p key={l.item_id} className="mt-1.5 flex items-center gap-1.5 text-sm">
                  <X className="h-3.5 w-3.5 shrink-0 text-red" aria-hidden /> {l.title} <PriorityChip priority={l.priority} />
                </p>
              ))
            ) : (
              <p className="mt-1.5 text-sm text-ink-2">Nothing lost.</p>
            )}
          </div>
          <div className="rounded-inset border border-green/30 bg-green-bg/60 px-3 py-2.5" data-testid="switch-kept">
            <p className="text-xs font-semibold uppercase tracking-wide text-green">Kept (untouched)</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm">
              <Check className="h-3.5 w-3.5 shrink-0 text-green" aria-hidden />
              {rec.kept_booking_item_ids.length} bookings stay exactly as they are
            </p>
          </div>
          <div className="rounded-inset border border-line bg-surface-2/60 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">Changing</p>
            <p className="mt-1.5 text-sm text-ink-2">{rec.changed_booking_item_ids.length} bookings cancelled &amp; rebooked</p>
            <p className="tnum mt-1 font-mono text-sm font-semibold">delta {fmtMoney(rec.delta_cost_inr)}</p>
          </div>
        </div>

        {pending.length ? (
          <div className="mt-3 rounded-inset border border-line px-3 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Courtesy messages ({pending.length} drafts)</p>
              <button type="button" onClick={onOpenDrafts} className="text-sm font-medium text-brand hover:underline">
                Preview drafts →
              </button>
            </div>
            <ul className="mt-2 space-y-1.5">
              {pending.map((d) => (
                <li key={d.id} className="flex items-center gap-2.5 text-sm">
                  <input
                    id={`sw-draft-${d.id}`}
                    type="checkbox"
                    checked={selected[d.id] ?? false}
                    onChange={(e) => setPreselected({ ...selected, [d.id]: e.target.checked })}
                    className="h-4 w-4 rounded border-line accent-[var(--brand)]"
                  />
                  <label htmlFor={`sw-draft-${d.id}`} className="min-w-0 flex-1 truncate">
                    To <span className="font-medium">{d.recipient_name}</span> ({d.channel.toLowerCase()}) —{' '}
                    <span className="text-ink-2">{d.body.slice(0, 64)}…</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {failure ? (
          <p role="alert" className="mt-3 rounded-inset bg-red-bg px-3.5 py-2.5 text-sm text-red">
            {failure} Nothing was changed. Plan A is still active.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            data-testid="switch-approve"
            onClick={() => decide.mutate('APPROVE')}
            loading={decide.isPending}
            disabled={decide.isPending}
            icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
          >
            Approve switch
          </Button>
          <Button
            data-testid="switch-keep"
            variant="secondary"
            onClick={() => decide.mutate('REJECT')}
            disabled={decide.isPending}
          >
            Keep Plan A
          </Button>
          <p className="text-xs text-ink-3">Never switches without approval — kept bookings keep their ids.</p>
        </div>
      </div>
    </Card>
  );
}

function MiniStats({
  title,
  feasibility,
  slack,
  delta,
  highlight
}: {
  title: string;
  feasibility: number;
  slack: number;
  delta: number;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? 'rounded-card border border-brand/40 bg-surface px-3.5 py-3' : 'rounded-card border border-line bg-surface px-3.5 py-3'}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{title}</p>
      <p className="tnum mt-1 flex items-baseline gap-3 font-display text-xl">
        <span className={feasibility >= 0.85 ? 'text-green' : feasibility >= 0.5 ? 'text-amber' : 'text-red'}>{pct(feasibility)}</span>
        <span className="font-mono text-xs text-ink-3">min slack {slack} min</span>
      </p>
      <p className="tnum font-mono text-xs text-ink-2">{delta > 0 ? `costs ${fmtMoney(delta)} more` : 'no extra cost'}</p>
    </div>
  );
}

function useDrafts(tripId: string) {
  return useQuery({ queryKey: qk.drafts(tripId), queryFn: () => api.drafts(tripId), enabled: !!tripId });
}
