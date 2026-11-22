'use client';

import { useState } from 'react';
import clsx from 'clsx';
import type { ChatResponse, DestinationOption, Plan } from '@contracts/types';
import type { WorkspacePhase } from '@/components/chat/ChatPanel';
import { fmtMoney } from '@/lib/format';
import { ItineraryTimeline } from './ItineraryTimeline';
import { PlanCompare } from './PlanCompare';
import { ProofList } from './ProofList';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton, TimelineSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { MapPin, ShieldCheck, BedDouble, Utensils, Landmark } from 'lucide-react';

export type WorkspaceView = 'chat' | 'plans' | 'error';

const STEPS = ['Understanding', 'Searching', 'Solving', 'Verifying'] as const;

/**
 * Right pane of the plan workspace (A6.1): timeline, plan toggle, proofs, book CTA.
 */
export function ItineraryPanel({
  planA,
  planB,
  simNow,
  phase,
  progressStep,
  response,
  error,
  onRetry,
  onBook,
  booking
}: {
  planA: Plan | null;
  planB: Plan | null;
  simNow?: string | null;
  phase: WorkspacePhase;
  progressStep?: number;
  response: ChatResponse | null;
  error?: unknown;
  onRetry?: () => void;
  onBook: (plan: Plan) => void;
  booking?: boolean;
}) {
  const [mode, setMode] = useState<'A' | 'B' | 'COMPARE'>('A');
  const activePlan = mode === 'B' && planB ? planB : planA;

  return (
    <section
      data-testid="itinerary-panel"
      aria-label="Plan and itinerary"
      className="flex min-h-0 flex-col rounded-card border border-line bg-surface shadow-card"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-display text-lg">The plan, with proof</h2>
        {planA ? (
          <Segmented
            ariaLabel="Plan view"
            testid="plan-view-toggle"
            options={[
              { value: 'A', label: 'Plan A' },
              { value: 'B', label: 'Plan B' },
              { value: 'COMPARE', label: 'Compare' }
            ]}
            value={mode}
            onChange={setMode}
            size="sm"
          />
        ) : null}
      </header>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {error ? (
          <ErrorState error={error} onRetry={onRetry} title="The planner hit a snag" />
        ) : phase === 'planning' ? (
          <Planning progressStep={progressStep ?? 0} />
        ) : phase === 'recommending' && response?.destination_options?.length ? (
          <DestinationCards options={response.destination_options} />
        ) : activePlan ? (
          <div className="space-y-4">
            {mode === 'COMPARE' && planB ? (
              <PlanCompare planA={planA!} planB={planB} mode="COMPARE" onMode={setMode} simNow={simNow} />
            ) : null}
            <ItineraryTimeline plan={activePlan} simNow={simNow} />
            <ProofList validation={activePlan.validation} />
          </div>
        ) : phase === 'clarifying' && response ? (
          <div className="rounded-card border border-dashed border-line bg-surface-2/50 px-5 py-8 text-center">
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-ink-2">{response.assistant_message}</p>
          </div>
        ) : (
          <EmptyItinerary />
        )}
      </div>

      {planA && !error ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3">
          <div className="text-sm">
            <span className="tnum font-display text-xl">{fmtMoney(activePlan?.total_cost_inr)}</span>
            <span className="ml-2 text-xs text-ink-3">
              headroom {fmtMoney(activePlan?.validation.budget_headroom_inr)} · meals excluded
            </span>
          </div>
          <Button data-testid="book-cta" onClick={() => planA && onBook(planA)} loading={booking} icon={<ShieldCheck className="h-4 w-4" aria-hidden />}>
            Review &amp; book
          </Button>
        </footer>
      ) : null}
    </section>
  );
}

function EmptyItinerary() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-paper-wash text-brand shadow-card">
        <MapPin className="h-6 w-6" aria-hidden />
      </span>
      <div>
        <h3 className="font-display text-xl">Your itinerary appears here</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-ink-2">
          Two solver-verified plans (A and B) with slack between every leg, source-checked prices and the solver&apos;s
          proof list. Nothing is invented — and nothing books without you.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        <Chip icon={<BedDouble className="h-3 w-3" aria-hidden />}>Stays verified</Chip>
        <Chip icon={<Utensils className="h-3 w-3" aria-hidden />}>Meals excluded, stated</Chip>
        <Chip icon={<Landmark className="h-3 w-3" aria-hidden />}>Timed entries checked</Chip>
      </div>
    </div>
  );
}

function Planning({ progressStep }: { progressStep: number }) {
  return (
    <div className="space-y-4 py-2">
      <ol className="flex items-center gap-1.5" aria-label="Planning progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-1.5">
            <span
              aria-current={i === progressStep ? 'step' : undefined}
              className={clsx(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                i < progressStep ? 'bg-green-bg text-green' : i === progressStep ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-ink-3'
              )}
            >
              {i < progressStep ? '✓' : i + 1}
            </span>
            <span className={clsx('hidden text-xs sm:block', i === progressStep ? 'font-semibold text-ink' : 'text-ink-3')}>{s}</span>
            {i < STEPS.length - 1 ? <span className="h-px flex-1 bg-line" aria-hidden /> : null}
          </li>
        ))}
      </ol>
      <TimelineSkeleton />
    </div>
  );
}

function DestinationCards({ options }: { options: DestinationOption[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">Available now — pick one and I&apos;ll build Plan A and a rain-safe Plan B.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <div
            key={o.name}
            role="group"
            aria-disabled={!o.available}
            className={clsx(
              'rounded-card border p-4',
              o.available
                ? 'border-line bg-surface shadow-card transition-shadow hover:shadow-pop'
                : 'cursor-not-allowed border-dashed border-line bg-surface-2/60 opacity-70'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-lg leading-tight">{o.name}</h3>
              <Chip tone={o.available ? 'brand' : 'neutral'} className="tnum shrink-0">
                ~{fmtMoney(o.est_budget_inr)}
              </Chip>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{o.why}</p>
            {!o.available ? <p className="mt-2 font-mono text-xs text-ink-3">Not in prototype inventory</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
