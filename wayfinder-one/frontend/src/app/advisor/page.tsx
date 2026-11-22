'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/shell/AppShell';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { useAuth } from '@/lib/auth';
import { fmtDate } from '@/lib/format';
import { HealthDot } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Chip } from '@/components/ui/Chip';

/** `/advisor` (A6b): client trips sorted RED → AMBER → GREEN. */
export default function AdvisorPage() {
  const router = useRouter();
  const { user } = useAuth();
  const rows = useQuery({ queryKey: qk.advisorTrips, queryFn: api.advisorTrips, enabled: user?.role === 'ADVISOR' });

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 font-display text-2xl">
          <Sparkles className="h-5 w-5 text-brand" aria-hidden />
          Advisor console
        </h1>
        <p className="text-sm text-ink-2">Your client trips by health — worst first. Acting on a trip needs the traveller&apos;s recorded consent.</p>
      </div>

      {user?.role !== 'ADVISOR' ? (
        <div className="rounded-card border border-line bg-surface p-6 shadow-card">
          <EmptyState
            icon={<Sparkles className="h-5 w-5" aria-hidden />}
            title="Advisor account required"
            body="Sign in with an advisor account (advisor@demo.wf in the demo) to see the client console."
          />
        </div>
      ) : rows.isLoading ? (
        <Skeleton className="h-80 rounded-card" />
      ) : rows.isError ? (
        <div className="rounded-card border border-line bg-surface shadow-card">
          <ErrorState error={rows.error} onRetry={() => rows.refetch()} />
        </div>
      ) : !rows.data?.length ? (
        <div className="rounded-card border border-line bg-surface shadow-card">
          <EmptyState icon={<Sparkles className="h-5 w-5" aria-hidden />} title="No client trips yet" body="When travellers invite you with an advisor email, their trips appear here." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table data-testid="advisor-table" className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-3">
                  <th className="px-4 py-2.5 font-medium">
                    <span className="inline-flex items-center gap-1">
                      Health <ArrowUpDown className="h-3 w-3" aria-hidden />
                    </span>
                  </th>
                  <th className="px-4 py-2.5 font-medium">Traveller</th>
                  <th className="px-4 py-2.5 font-medium">Trip</th>
                  <th className="px-4 py-2.5 font-medium">Start</th>
                  <th className="px-4 py-2.5 font-medium">Next risk</th>
                  <th className="px-4 py-2.5 font-medium">Unread</th>
                  <th className="px-4 py-2.5 font-medium">Consent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {rows.data.map((r) => (
                  <tr
                    key={r.trip_id}
                    className="cursor-pointer transition-colors hover:bg-surface-2/60"
                    onClick={() => router.push(`/advisor/${r.trip_id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <HealthDot health={r.health} />
                        <span className="tnum font-mono text-xs">{r.score}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{r.traveller_name}</td>
                    <td className="px-4 py-3 text-ink-2">{r.title}</td>
                    <td className="tnum px-4 py-3 font-mono text-xs text-ink-3">{r.start_date ? fmtDate(r.start_date) : '—'}</td>
                    <td className="px-4 py-3 text-xs leading-snug text-ink-2">{r.next_risk}</td>
                    <td className="px-4 py-3">
                      {r.unread_alerts ? <span className="tnum rounded-full bg-amber-bg px-2 py-0.5 font-mono text-xs font-semibold text-amber">{r.unread_alerts}</span> : <span className="text-ink-3">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Chip tone={r.has_consent ? 'green' : 'neutral'}>{r.has_consent ? 'can act' : 'read-only'}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-ink-3">
        Open a row for the read-only cockpit, notes, and — with consent — actions labelled{' '}
        <Link href="/advisor" className="text-brand hover:underline">
          on behalf of your traveller
        </Link>
        .
      </p>
    </AppShell>
  );
}
