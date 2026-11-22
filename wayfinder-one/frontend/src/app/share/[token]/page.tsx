'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Compass, MapPin, Clock3 } from 'lucide-react';
import type { SharedTripView } from '@contracts/types';
import { api } from '@/lib/api/endpoints';
import { fmtDateTime, fmtTime } from '@/lib/format';
import { HealthBadge } from '@/components/ui/Badge';
import { LogoMark } from '@/components/shell/AppShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Card } from '@/components/ui/Card';

/**
 * `/share/[token]` (A6b): public, no auth, `SharedTripView` ONLY — health,
 * next stop, ETA, last place, as-of. No PII, no booking refs. Expired → friendly 404.
 */
export default function SharePage() {
  const params = useParams<{ token: string }>();
  const view = useQuery({
    queryKey: ['share', params.token],
    queryFn: () => api.shareView(params.token),
    retry: false,
    refetchInterval: 30_000
  });

  if (view.isLoading || !view.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-wash px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <LogoMark size={40} />
            <p className="font-mono text-xs uppercase tracking-wider text-ink-3">Live trip status — shared with you</p>
          </div>
          {view.isError ? (
            <Card className="p-2">
              <EmptyState
                icon={<Compass className="h-5 w-5" aria-hidden />}
                title="This link has expired or was revoked"
                body="Share links are time-limited and can be revoked any time by the traveller. Ask them for a fresh link."
              />
            </Card>
          ) : (
            <Skeleton className="h-72 rounded-card" />
          )}
        </div>
      </div>
    );
  }

  const data = view.data;
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-wash px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <LogoMark size={40} />
          <p className="font-mono text-xs uppercase tracking-wider text-ink-3">Live trip status — shared with you</p>
        </div>

        <Card data-testid="shared-trip-view" className="overflow-hidden">
          <div className="border-b border-line bg-paper-wash px-5 py-4">
            <h1 className="font-display text-xl">{data.title}</h1>
            <div className="mt-1.5">
              <HealthBadge health={data.health} />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 px-5 py-4">
            <div className="rounded-inset bg-surface-2 px-3 py-2.5">
              <dt className="flex items-center gap-1 text-xs text-ink-3">
                <MapPin className="h-3 w-3" aria-hidden /> Next stop
              </dt>
              <dd className="mt-0.5 text-sm font-medium">{data.next_stop ?? '—'}</dd>
            </div>
            <div className="rounded-inset bg-surface-2 px-3 py-2.5">
              <dt className="flex items-center gap-1 text-xs text-ink-3">
                <Clock3 className="h-3 w-3" aria-hidden /> ETA
              </dt>
              <dd className="tnum mt-0.5 font-mono text-sm font-medium">{data.eta ? fmtTime(data.eta) : '—'}</dd>
            </div>
            <div className="col-span-2 rounded-inset bg-surface-2 px-3 py-2.5">
              <dt className="text-xs text-ink-3">Last known place</dt>
              <dd className="mt-0.5 text-sm font-medium">{data.last_location_name ?? '—'}</dd>
            </div>
          </dl>
          <p className="border-t border-line px-5 py-3 font-mono text-xs text-ink-3">
            as of {fmtDateTime(data.as_of)} · this page shows the latest status only — no personal details, no
            bookings, no location history.
          </p>
        </Card>
      </div>
    </div>
  );
}
