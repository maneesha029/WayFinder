'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import type { Plan, PlanItem } from '@contracts/types';
import { fmtDate, fmtMoney, fmtTime } from '@/lib/format';
import { TypeIcon } from './ItemCard';
import { Chip } from '@/components/ui/Chip';

type DiffKind = 'changed' | 'removed' | 'added' | 'same';

interface DiffRow {
  day: number;
  a?: PlanItem;
  b?: PlanItem;
  kind: DiffKind;
}

function diffPlans(a: Plan, b: Plan): DiffRow[] {
  const rows: DiffRow[] = [];
  const bPool = [...b.items];
  for (const item of a.items) {
    // same id = same item; otherwise match on day+type (a rebook keeps the slot)
    const matchIdx = bPool.findIndex((x) => x.id === item.id || (x.day === item.day && x.type === item.type));
    const match = matchIdx >= 0 ? bPool[matchIdx] : undefined;
    if (match) bPool.splice(matchIdx, 1);
    const changed =
      match &&
      (match.title !== item.title ||
        match.start !== item.start ||
        Math.abs(match.price_inr - item.price_inr) > 0);
    rows.push({ day: item.day, a: item, b: match, kind: !match ? 'removed' : changed ? 'changed' : 'same' });
  }
  for (const extra of bPool) rows.push({ day: extra.day, b: extra, kind: 'added' });
  return rows.sort((x, y) => x.day - y.day);
}

/** PlanCompare (A6.1): toggle A | B | Compare; compare highlights diffs + headline numbers. */
export function PlanCompare({
  planA,
  planB,
  mode,
  onMode,
  simNow
}: {
  planA: Plan;
  planB: Plan | null;
  mode: 'A' | 'B' | 'COMPARE';
  onMode: (m: 'A' | 'B' | 'COMPARE') => void;
  simNow?: string | null;
}) {
  const diff = useMemo(() => (planB ? diffPlans(planA, planB) : []), [planA, planB]);
  const active = mode === 'B' && planB ? planB : planA;
  const counts = {
    changed: diff.filter((r) => r.kind === 'changed').length,
    removed: diff.filter((r) => r.kind === 'removed').length,
    added: diff.filter((r) => r.kind === 'added').length
  };

  return (
    <div data-testid="plan-compare">
      <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="Plan view">
        {(
          [
            ['A', `Plan A · ${fmtMoney(planA.total_cost_inr)}`],
            ['B', planB ? `Plan B · ${fmtMoney(planB.total_cost_inr)}` : 'Plan B'],
            ['COMPARE', 'Compare']
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => onMode(m)}
            className={clsx(
              'rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all duration-150',
              mode === m ? 'bg-brand text-brand-ink shadow-card' : 'border border-line bg-surface text-ink-2 hover:border-brand hover:text-brand'
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-3">{active.summary}</span>
      </div>

      {mode === 'COMPARE' && planB ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricCard label="Plan A feasibility" value={`${Math.round(planA.validation.feasibility * 100)}%`} sub={`min slack ${planA.validation.min_slack_min} min`} health={planA.validation.feasibility >= 0.85 ? 'GREEN' : planA.validation.feasibility >= 0.5 ? 'AMBER' : 'RED'} />
            <MetricCard label="Plan B feasibility" value={`${Math.round(planB.validation.feasibility * 100)}%`} sub={`min slack ${planB.validation.min_slack_min} min`} health={planB.validation.feasibility >= 0.85 ? 'GREEN' : planB.validation.feasibility >= 0.5 ? 'AMBER' : 'RED'} />
            <MetricCard
              label="Cost difference"
              value={fmtMoney(planB.total_cost_inr - planA.total_cost_inr)}
              sub={`B ${fmtMoney(planB.total_cost_inr)} vs A ${fmtMoney(planA.total_cost_inr)}`}
            />
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {counts.changed ? <Chip tone="brand">{counts.changed} changed</Chip> : null}
            {counts.added ? <Chip tone="green">{counts.added} new in B</Chip> : null}
            {counts.removed ? <Chip tone="red">{counts.removed} dropped in B</Chip> : null}
            {!counts.changed && !counts.added && !counts.removed ? <Chip tone="neutral">Plans are identical</Chip> : null}
          </div>
          <div className="overflow-hidden rounded-card border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-3">
                  <th className="px-3 py-2 font-medium">Day</th>
                  <th className="px-3 py-2 font-medium">Plan A</th>
                  <th className="px-3 py-2 font-medium">Plan B</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {diff.map((r, i) => (
                  <tr key={`${r.a?.id ?? 'x'}-${r.b?.id ?? 'y'}-${i}`} className={clsx(r.kind !== 'same' && 'bg-brand-soft/40')}>
                    <td className="tnum px-3 py-2 align-top font-mono text-xs text-ink-3">{r.day}</td>
                    <td className="px-3 py-2 align-top">
                      {r.a ? (
                        <span className={clsx('inline-flex items-start gap-1.5', r.kind === 'removed' && 'text-red line-through decoration-1')}>
                          <TypeIcon type={r.a.type} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" />
                          <span>
                            {r.a.title}
                            <span className="block font-mono text-xs text-ink-3">
                              {fmtDate(r.a.start).slice(0, 6)} · {fmtTime(r.a.start)} · {fmtMoney(r.a.price_inr)}
                            </span>
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-ink-3">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {r.b ? (
                        <span className={clsx('inline-flex items-start gap-1.5', r.kind === 'added' && 'text-green')}>
                          <TypeIcon type={r.b.type} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" />
                          <span>
                            {r.b.title}
                            <span className="block font-mono text-xs text-ink-3">
                              {fmtDate(r.b.start).slice(0, 6)} · {fmtTime(r.b.start)} · {fmtMoney(r.b.price_inr)}
                            </span>
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-ink-3">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-relaxed text-ink-2">
            Plan B is stored and kept warm: prices and availability re-verified on a schedule. Switching always needs your approval —
            kept bookings stay untouched.
          </p>
        </div>
      ) : (
        <p className="rounded-card border border-line bg-surface-2/60 px-4 py-3 text-sm leading-relaxed text-ink-2">
          <span className="font-semibold text-ink">{mode === 'B' ? 'Plan B' : 'Plan A'} — {active.summary}</span>
          <span className="mt-1 block font-mono text-xs text-ink-3">
            feasibility {Math.round(active.validation.feasibility * 100)}% · min slack {active.validation.min_slack_min} min · total {fmtMoney(active.total_cost_inr)}
          </span>
        </p>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, health }: { label: string; value: string; sub: string; health?: 'GREEN' | 'AMBER' | 'RED' }) {
  return (
    <div className="rounded-card border border-line bg-surface px-3.5 py-3 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</p>
      <p
        className={clsx(
          'tnum mt-1 font-display text-2xl',
          health === 'GREEN' && 'text-green',
          health === 'AMBER' && 'text-amber',
          health === 'RED' && 'text-red'
        )}
      >
        {value}
      </p>
      <p className="font-mono text-xs text-ink-3">{sub}</p>
    </div>
  );
}
