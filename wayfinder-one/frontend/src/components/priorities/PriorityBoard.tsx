'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, Hourglass } from 'lucide-react';
import type { LostItem, Plan, Priority, RebalancePreview } from '@contracts/types';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { fmtDuration, idemKey, fmtMoney } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Chip, PriorityChip } from '@/components/ui/Chip';
import { ErrorState } from '@/components/ui/States';
import { pushToast } from '@/components/ui/Toast';

const COLUMNS: Array<{ priority: Priority; title: string; hint: string }> = [
  { priority: 'MUST', title: 'Must-do', hint: 'Protected during any rebalance — solver keeps these.' },
  { priority: 'NICE', title: 'Nice-to-have', hint: 'First to bend when time is lost.' },
  { priority: 'SKIP_IF_NEEDED', title: 'Skip if needed', hint: 'First to drop when the day compresses.' }
];

/**
 * PriorityBoard (A6b): Must/Nice/Skip columns with keyboard-accessible moves
 * (buttons, not drag-only) + the "lose 90 minutes" rebalance preview.
 */
export function PriorityBoard({ tripId, plan }: { tripId: string; plan: Plan }) {
  const qc = useQueryClient();
  const [localPriority, setLocalPriority] = useState<Record<string, Priority>>({});
  const [rebalance, setRebalance] = useState<{ lostMin: number; fromItem: string } | null>(null);
  const [preview, setPreview] = useState<RebalancePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (priorities: Array<{ item_id: string; priority: Priority }>) => api.putPriorities(tripId, { priorities }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.trip(tripId) });
      pushToast({ level: 'success', title: 'Priorities saved', body: 'The solver re-validated the plan.' });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Saving failed.')
  });

  const rebalanceCall = useMutation({
    mutationFn: ({ apply }: { apply: boolean }) => {
      const key = apply ? idemKey('reb', tripId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)) : null;
      return api.rebalance(
        tripId,
        {
          lost_min: rebalance!.lostMin,
          from_item_id: rebalance!.fromItem,
          apply,
          approve: apply,
          idempotency_key: key
        },
        key ?? undefined
      );
    },
    onSuccess: (r, vars) => {
      if (!vars.apply) {
        setPreview(r);
        return;
      }
      pushToast({ level: 'success', title: 'Rebalance applied', body: r.summary });
      qc.invalidateQueries({ queryKey: qk.trip(tripId) });
      setRebalance(null);
      setPreview(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Rebalance failed.')
  });

  // opening the scenario dialog immediately fetches the solver preview (apply=false)
  const rebalanceOpen = rebalance !== null;
  useEffect(() => {
    if (rebalanceOpen) {
      setPreview(null);
      rebalanceCall.mutate({ apply: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebalanceOpen]);

  const priorityOf = (itemId: string, fallback: Priority): Priority => localPriority[itemId] ?? fallback;
  function move(itemId: string, dir: 1 | -1) {
    const order: Priority[] = ['SKIP_IF_NEEDED', 'NICE', 'MUST'];
    const item = plan.items.find((i) => i.id === itemId)!;
    const current = order.indexOf(priorityOf(itemId, item.priority));
    const next = order[Math.min(2, Math.max(0, current + dir))];
    setLocalPriority((prev) => ({ ...prev, [itemId]: next }));
    save.mutate([{ item_id: itemId, priority: next }]);
  }

  return (
    <div className="space-y-4" data-testid="priority-board">
      <div className="grid gap-3 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = plan.items.filter((i) => priorityOf(i.id, i.priority) === col.priority);
          return (
            <Card key={col.priority}>
              <CardHeader title={col.title} sub={col.hint} right={<Chip className="tnum">{items.length}</Chip>} />
              {!items.length ? (
                <p className="px-4 py-4 text-sm text-ink-3">Empty — nothing ranks here right now.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{i.title}</p>
                        <p className="font-mono text-xs text-ink-3">
                          day {i.day} · {i.fixed ? 'fixed time' : 'flexible'}
                        </p>
                      </div>
                      <div className="flex gap-1" role="group" aria-label={`Change priority of ${i.title}`}>
                        <Button size="sm" variant="ghost" aria-label={`Demote ${i.title}`} onClick={() => move(i.id, -1)} icon={<ArrowDown className="h-3.5 w-3.5" />} />
                        <Button size="sm" variant="ghost" aria-label={`Promote ${i.title}`} onClick={() => move(i.id, 1)} icon={<ArrowUp className="h-3.5 w-3.5" />} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {error ? <p role="alert" className="rounded-inset bg-red-bg px-3.5 py-2.5 text-sm text-red">{error}</p> : null}

      <Card>
        <CardHeader
          title="Time banking"
          sub="When a delay eats your day, decide what gives — before it happens."
          right={
            <Button size="sm" variant="secondary" icon={<Hourglass className="h-3.5 w-3.5" />} onClick={() => setRebalance({ lostMin: 90, fromItem: 'it_a_e1' })}>
              What if I lose 90 minutes?
            </Button>
          }
        />
        <div className="px-4 py-3 text-sm leading-relaxed text-ink-2">
          Pick a lost-time scenario; the solver proposes what to drop or shorten — MUST items are protected, lowest-ranked
          value goes first. Applying always needs your approval and creates Plan A v+1.
        </div>
      </Card>

      {rebalance ? (
        <Dialog
          open
          onClose={() => {
            setRebalance(null);
            setPreview(null);
          }}
          title={`Lose ${fmtDuration(rebalance.lostMin)} — what gives?`}
          testid="rebalance-preview"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setRebalance(null);
                  setPreview(null);
                }}
              >
                Close
              </Button>
              <Button
                disabled={!preview?.dropped.length}
                loading={rebalanceCall.isPending}
                icon={<Check className="h-4 w-4" />}
                onClick={() => rebalanceCall.mutate({ apply: true })}
              >
                {preview ? 'Apply rebalance' : 'Preview'}
              </Button>
            </div>
          }
        >
          {preview ? (
            <div className="space-y-3 text-sm">
              <p className="leading-relaxed">{preview.summary}</p>
              {preview.dropped.length ? (
                <div className="rounded-inset border border-red/30 bg-red-bg/50 px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red">Dropped</p>
                  {preview.dropped.map((d: LostItem) => (
                    <p key={d.item_id} className="mt-1 flex items-center gap-2">
                      {d.title} <PriorityChip priority={d.priority} />
                    </p>
                  ))}
                </div>
              ) : null}
              <p className="tnum font-mono text-xs text-ink-3">
                preview total {fmtMoney(preview.plan_preview.total_cost_inr)} · {preview.applied ? 'applied' : 'not applied yet'}
              </p>
            </div>
          ) : rebalanceCall.isPending ? (
            <p className="text-sm text-ink-2">Solving what to drop…</p>
          ) : rebalanceCall.isError ? (
            <ErrorState error={rebalanceCall.error} onRetry={() => rebalanceCall.mutate({ apply: false })} />
          ) : null}
        </Dialog>
      ) : null}
    </div>
  );
}
