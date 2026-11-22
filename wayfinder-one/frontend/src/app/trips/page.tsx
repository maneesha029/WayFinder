'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Compass, Users } from 'lucide-react';
import type { TripSummary } from '@contracts/types';
import { AppShell } from '@/components/shell/AppShell';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { fmtDate, fmtMoney } from '@/lib/format';
import { HealthDot } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Chip } from '@/components/ui/Chip';

const statusLabel: Record<TripSummary['status'], string> = {
  DRAFT: 'Draft',
  PLANNED: 'Planned',
  BOOKED: 'Booked',
  ACTIVE: 'Active',
  COMPLETED: 'Completed'
};

/** `/trips` (B7 #16): trip cards with health dot. */
export default function TripsPage() {
  const trips = useQuery({ queryKey: qk.trips, queryFn: api.trips });

  return (
    <AppShell>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Your trips</h1>
          <p className="text-sm text-ink-2">The Guardian watches every booked trip — even while you sleep.</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink shadow-card transition-colors hover:bg-brand-strong"
        >
          <Compass className="h-4 w-4" aria-hidden />
          Plan a new trip
        </Link>
      </div>

      {trips.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-card" />
          ))}
        </div>
      ) : trips.isError ? (
        <div className="rounded-card border border-line bg-surface shadow-card">
          <ErrorState error={trips.error} onRetry={() => trips.refetch()} />
        </div>
      ) : !trips.data?.length ? (
        <div className="rounded-card border border-line bg-surface shadow-card">
          <EmptyState
            icon={<Compass className="h-5 w-5" aria-hidden />}
            title="No trips yet"
            body="Start with one line in the planner — destination, dates, budget. You'll get two proof-carrying plans back."
            action={
              <Link href="/" className="font-medium text-brand hover:underline">
                Open the planner →
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trips.data.map((t) => (
            <Link
              key={t.id}
              href={`/trips/${t.id}`}
              className="group flex flex-col rounded-card border border-line bg-surface p-4 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-pop"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-lg leading-tight">{t.title}</h2>
                <HealthDot health={t.health} className="mt-1.5" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip tone={t.status === 'ACTIVE' ? 'amber' : t.status === 'BOOKED' ? 'green' : 'neutral'}>
                  {statusLabel[t.status]}
                </Chip>
                {t.id === 'trip_g1' ? (
                  <Chip tone="brand" icon={<Users className="h-3 w-3" aria-hidden />}>
                    Group
                  </Chip>
                ) : null}
              </div>
              <p className="tnum mt-3 font-mono text-xs text-ink-3">
                {t.start_date ? `starts ${fmtDate(t.start_date)}` : 'dates to be decided'}
              </p>
              <p className="mt-auto flex items-center justify-between pt-3 text-sm">
                <span className="tnum font-semibold">{t.total_cost_inr !== null ? fmtMoney(t.total_cost_inr) : '—'}</span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
                  Open cockpit <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
