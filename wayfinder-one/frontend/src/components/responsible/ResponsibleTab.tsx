'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Leaf, Check } from 'lucide-react';
import type { Plan, ResponsibleInsight, ResponsibleReport, SwapPreview } from '@contracts/types';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { fmtMoney } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Chip } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { pushToast } from '@/components/ui/Toast';
import { idemKey } from '@/lib/format';

const kindTone = {
  CO2: 'green',
  CROWD_RELIEF: 'brand',
  LOCAL_ECONOMY: 'amber',
  ECO_HERITAGE: 'neutral'
} as const;

const kindLabel: Record<ResponsibleInsight['kind'], string> = {
  CO2: 'Carbon',
  CROWD_RELIEF: 'Crowd relief',
  LOCAL_ECONOMY: 'Local economy',
  ECO_HERITAGE: 'Eco heritage'
};

/**
 * Responsible tab (A6b): CO₂ total + by-mode SVG bars (patterns + colour),
 * insight cards, AlternativeCard → preview → explicit approve via swap-item.
 */
export function ResponsibleTab({ tripId, plan }: { tripId: string; plan: Plan | null }) {
  const report = useQuery({ queryKey: qk.responsible(tripId), queryFn: () => api.responsible(tripId), staleTime: 60_000 });
  const [preview, setPreview] = useState<SwapPreview | null>(null);
  const [pending, setPending] = useState<ResponsibleInsight | null>(null);
  const qc = useQueryClient();

  const swap = useMutation({
    mutationFn: ({ apply, itemId, offerId }: { apply: boolean; itemId: string; offerId: string }) => {
      const key = apply ? idemKey('swap', tripId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)) : undefined;
      return api.swapItem(tripId, { item_id: itemId, offer_id: offerId, apply, approve: apply }, key);
    },
    onSuccess: (r, vars) => {
      if (!vars.apply) {
        setPreview(r);
        return;
      }
      pushToast({ level: 'success', title: 'Alternative applied', body: r.summary });
      qc.invalidateQueries({ queryKey: qk.trip(tripId) });
      qc.invalidateQueries({ queryKey: qk.responsible(tripId) });
      setPreview(null);
      setPending(null);
    }
  });

  if (report.isLoading) return <Skeleton className="h-80 rounded-card" />;
  if (report.isError) {
    return (
      <Card>
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      </Card>
    );
  }
  const data = report.data!;
  const modes = Object.entries(data.by_mode);
  const total = data.total_co2_kg;

  return (
    <div className="space-y-4" data-testid="responsible-tab">
      <Card>
        <CardHeader
          title="Carbon & community impact"
          sub={data.method}
          right={
            <Chip tone="green" icon={<Leaf className="h-3 w-3" aria-hidden />} className="tnum">
              {total.toFixed(0)} kg CO₂ total
            </Chip>
          }
        />
        <div className="px-4 py-4">
          {/* SVG bars, labelled, with patterns so colour is never the only cue (A5 a11y) */}
          <svg viewBox="0 0 420 120" className="w-full" role="img" aria-label={`CO₂ by mode: ${modes.map(([k, v]) => `${k} ${v.toFixed(1)} kg`).join(', ')}`}>
            {modes.map(([mode, kg], i) => {
              const barW = 120;
              const x = 24 + i * 132;
              const h = Math.max(6, (kg / Math.max(...modes.map(([, v]) => v))) * 72);
              const y = 96 - h;
              return (
                <g key={mode}>
                  <defs>
                    <pattern id={`pat-${i}`} width="6" height="6" patternUnits="userSpaceOnUse">
                      <rect width="6" height="6" fill="var(--brand-soft)" />
                      <path d="M0 6 L6 0" stroke="var(--brand)" strokeWidth="1.4" />
                    </pattern>
                  </defs>
                  <rect x={x} y={y} width={barW} height={h} rx="4" fill={`url(#pat-${i})`} stroke="var(--brand)" strokeWidth="1" />
                  <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)" fontFamily="var(--font-sans)">
                    {kg.toFixed(1)} kg
                  </text>
                  <text x={x + barW / 2} y={112} textAnchor="middle" fontSize="10" fill="var(--ink-2)" fontFamily="var(--font-mono)">
                    {mode.toLowerCase()}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {data.insights.map((ins) => (
          <Card key={`${ins.item_id}-${ins.kind}`}>
            <CardHeader
              title={ins.title}
              sub={kindLabel[ins.kind]}
              right={<Chip tone={kindTone[ins.kind]}>{kindLabel[ins.kind]}</Chip>}
            />
            <div className="px-4 py-3">
              <p className="text-sm leading-relaxed text-ink-2">{ins.detail}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink-3">
                {ins.co2_saving_kg ? <span>−{ins.co2_saving_kg.toFixed(0)} kg CO₂</span> : null}
                {ins.delta_cost_inr !== null && ins.delta_cost_inr !== 0 ? (
                  <span>{ins.delta_cost_inr > 0 ? '+' : '−'}{fmtMoney(Math.abs(ins.delta_cost_inr))}</span>
                ) : null}
              </div>
              {ins.alternative_offer_id ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  loading={swap.isPending && pending?.title === ins.title}
                  onClick={() => {
                    setPending(ins);
                    swap.mutate({ apply: false, itemId: ins.item_id!, offerId: ins.alternative_offer_id! });
                  }}
                >
                  Preview this alternative
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      {preview ? (
        <Dialog
          open
          onClose={() => {
            setPreview(null);
            setPending(null);
          }}
          title="Alternative — solver-checked preview"
          testid="swap-preview"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setPreview(null);
                  setPending(null);
                }}
              >
                Close
              </Button>
              <Button
                icon={<Check className="h-4 w-4" />}
                loading={swap.isPending}
                onClick={() => pending && swap.mutate({ apply: true, itemId: pending.item_id!, offerId: pending.alternative_offer_id! })}
              >
                Approve swap
              </Button>
            </div>
          }
        >
          <div className="space-y-2.5 text-sm">
            <p className="leading-relaxed">{preview.summary}</p>
            <p className="tnum font-mono text-xs text-ink-3">
              delta cost {preview.delta_cost_inr >= 0 ? '+' : '−'}{fmtMoney(Math.abs(preview.delta_cost_inr))}
              {preview.delta_co2_kg !== null ? ` · CO₂ ${preview.delta_co2_kg >= 0 ? '+' : '−'}${Math.abs(preview.delta_co2_kg).toFixed(1)} kg` : ''} ·{' '}
              {preview.applied ? 'applied' : 'preview only'}
            </p>
            <p className="text-xs leading-relaxed text-ink-2">
              Applying re-runs the solver; if the alternative makes the plan infeasible you will see SOLVER_INFEASIBLE and
              nothing changes. Creates Plan A v+1.
            </p>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
