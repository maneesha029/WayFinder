'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, NotebookPen, ShieldAlert } from 'lucide-react';
import type { AdvisorNote } from '@contracts/types';
import { AppShell } from '@/components/shell/AppShell';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { useTripEvents } from '@/hooks/useTripEvents';
import { fmtDateTime, fmtMoney } from '@/lib/format';
import { ItineraryTimeline } from '@/components/itinerary/ItineraryTimeline';
import { ProofList } from '@/components/itinerary/ProofList';
import { HealthMeter } from '@/components/guardian/HealthMeter';
import { GuardianFeed } from '@/components/guardian/GuardianFeed';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Chip } from '@/components/ui/Chip';
import { pushToast } from '@/components/ui/Toast';

/** `/advisor/[id]` (A6b): read-only cockpit + notes; consent banner when absent. */
export default function AdvisorTripPage() {
  const params = useParams<{ id: string }>();
  const tripId = params.id;
  useTripEvents(tripId);
  const qc = useQueryClient();

  const data = useQuery({ queryKey: qk.advisorTrip(tripId), queryFn: () => api.advisorTrip(tripId) });

  const note = useMutation({
    mutationFn: (body: string) => api.advisorNote(tripId, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.advisorTrip(tripId) });
      pushToast({ level: 'success', title: 'Note saved' });
    }
  });

  if (data.isLoading) {
    return (
      <AppShell tripId={tripId}>
        <Skeleton className="h-96 rounded-card" />
      </AppShell>
    );
  }
  if (data.isError) {
    return (
      <AppShell tripId={tripId}>
        <Card>
          <ErrorState error={data.error} onRetry={() => data.refetch()} title="Client trip unavailable" />
        </Card>
      </AppShell>
    );
  }

  const { detail, notes } = data.data!;
  const consent = detail.trip.advisor_consent;
  const traveller = detail.trip.intent.travellers ?? 1;

  return (
    <AppShell tripId={tripId}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/advisor" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Client list
          </Link>
          <h1 className="mt-1.5 font-display text-2xl">{detail.trip.title}</h1>
          <p className="text-sm text-ink-2">
            {detail.trip.intent.destination} · {traveller} traveller{traveller > 1 ? 's' : ''}
            {detail.plan_a ? <span className="tnum font-mono"> · {fmtMoney(detail.plan_a.total_cost_inr)}</span> : null}
          </p>
        </div>
        <Chip tone={consent ? 'green' : 'amber'} className="uppercase text-[10px]">
          {consent ? 'consent to act: granted' : 'read-only'}
        </Chip>
      </div>

      {!consent ? (
        <p className="mb-4 flex items-start gap-2 rounded-card border border-amber/40 bg-amber-bg px-4 py-3 text-sm leading-relaxed text-amber" role="note">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Acting on this trip requires the traveller&apos;s recorded consent. You can read everything and leave notes;
          switches, bookings and approvals stay with the traveller.
        </p>
      ) : (
        <p className="mb-4 rounded-card border border-green/30 bg-green-bg px-4 py-3 text-sm text-green">
          Consent granted — actions on this trip are taken on behalf of the traveller and logged in the audit trail.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {detail.plan_a ? (
            <>
              <ItineraryTimeline plan={detail.plan_a} simNow={detail.trip.sim_now} />
              <ProofList validation={detail.plan_a.validation} />
            </>
          ) : (
            <Card>
              <EmptyState icon={<NotebookPen className="h-5 w-5" aria-hidden />} title="No plan yet" body="The traveller hasn't approved a plan for this trip." />
            </Card>
          )}
        </div>
        <aside className="space-y-4">
          {detail.slack ? <HealthMeter slack={detail.slack} /> : null}
          <Card>
            <CardHeader title="Guardian feed" sub="Same alerts the traveller sees." right={<Chip>{detail.unread_alerts} unread</Chip>} />
            <div className="max-h-96 overflow-y-auto px-3 py-3">
              <GuardianFeed tripId={tripId} onOpenSwitch={() => undefined} onOpenTab={() => undefined} />
            </div>
          </Card>
          <Card data-testid="advisor-notes">
            <CardHeader title="Notes" sub="Visible to you; the traveller sees them in the trip timeline." />
            <NoteForm onSave={(b) => note.mutate(b)} saving={note.isPending} />
            <ul className="divide-y divide-line border-t border-line">
              {notes.length ? (
                notes.map((n: AdvisorNote) => (
                  <li key={n.id} className="px-4 py-3">
                    <p className="text-sm leading-relaxed">{n.body}</p>
                    <p className="mt-1 font-mono text-xs text-ink-3">{fmtDateTime(n.created_at)}</p>
                  </li>
                ))
              ) : (
                <li className="px-4 py-3 text-sm text-ink-3">No notes yet.</li>
              )}
            </ul>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

function NoteForm({ onSave, saving }: { onSave: (body: string) => void; saving: boolean }) {
  const [body, setBody] = useState('');
  return (
    <div className="flex gap-2 px-4 py-3.5">
      <label className="sr-only" htmlFor="advisor-note">
        Add a note
      </label>
      <input
        id="advisor-note"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="e.g. Client asked for a quieter slot…"
        className="h-11 flex-1 rounded-inset border border-line bg-surface-2 px-3 text-sm"
      />
      <Button
        disabled={!body.trim()}
        loading={saving}
        onClick={() => {
          onSave(body.trim());
          setBody('');
        }}
      >
        Save
      </Button>
    </div>
  );
}
