'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ChatResponse, Plan } from '@contracts/types';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/shell/AppShell';
import { ChatPanel, type WorkspacePhase } from '@/components/chat/ChatPanel';
import { ItineraryPanel } from '@/components/itinerary/ItineraryPanel';
import { BookDialog } from '@/components/bookings/BookDialog';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { useTripEvents } from '@/hooks/useTripEvents';

/**
 * `/` — Plan workspace (A6.1): chat 38% / itinerary 62% on desktop; single
 * column on tablet/mobile. State machine: empty → clarifying/recommending →
 * planning (≥600ms) → planned → book dialog.
 */
export default function PlanWorkspacePage() {
  const [phase, setPhase] = useState<WorkspacePhase>('empty');
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState(0);
  const [bookOpen, setBookOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const timersRef = useRef<number[]>([]);

  // SSE + detail queries attach only once a trip exists — never probe the live
  // backend with a hardcoded id on a fresh visit
  useTripEvents(tripId ?? '');

  const trip = useQuery({
    queryKey: qk.trip(tripId ?? 'none'),
    queryFn: () => api.trip(tripId!),
    enabled: phase === 'planned' && !!tripId
  });
  const tripsQ = useQuery({ queryKey: qk.trips, queryFn: api.trips });
  const resumeTrip = tripsQ.data?.find((t) => t.status === 'PLANNED' || t.status === 'BOOKED') ?? null;

  const planA: Plan | null = trip.data?.plan_a ?? response?.plan_a ?? null;
  const planB: Plan | null = trip.data?.plan_b ?? response?.plan_b ?? null;
  const simNow = trip.data?.trip.sim_now ?? null;

  useEffect(() => () => timersRef.current.forEach((t) => window.clearTimeout(t)), []);

  function handleResponse(r: ChatResponse) {
    setError(null);
    setResponse(r);
    if (r.trip_id && r.trip_id !== 'trip_pending') setTripId(r.trip_id);
    if (r.stage === 'PLANNED') {
      setPhase('planned');
    } else if (r.stage === 'CLARIFYING') {
      setPhase('clarifying');
    } else if (r.stage === 'RECOMMENDING') {
      setPhase('recommending');
    } else {
      setPhase('planned');
    }
  }

  function handleSendStart() {
    setPhase('planning');
    setProgressStep(0);
    // deliberate minimum: 600ms across the four steps (A6.1)
    const step = (i: number) => {
      timersRef.current.push(
        window.setTimeout(() => {
          setProgressStep(i);
          if (i < 3) step(i + 1);
        }, 150)
      );
    };
    step(1);
  }

  return (
    <AppShell tripId={tripId ?? undefined}>
      <div className="grid gap-4 lg:grid-cols-[38fr_62fr] lg:gap-5">
        <div className="flex min-h-0 flex-col gap-4 lg:h-[calc(100vh-9.5rem)]">
          <ChatPanel
            tripId={tripId}
            phase={phase}
            onResponse={handleResponse}
            onSendStart={handleSendStart}
            resumeTrip={resumeTrip ? { id: resumeTrip.id, title: resumeTrip.title } : null}
            onResume={() => {
              if (resumeTrip) {
                setTripId(resumeTrip.id);
                setPhase('planned');
              }
            }}
            quickReplies={
              phase === 'planned'
                ? response?.quick_replies
                : phase === 'clarifying' || phase === 'recommending'
                  ? response?.quick_replies
                  : undefined
            }
          />
          {phase === 'empty' ? (
            <p className="px-1 text-xs leading-relaxed text-ink-3">
              Tip: the Guardian keeps watching after you book — delays, weather and crowds turn into one-tap actions, and
              Plan B is already stored. <Link href="/trips" className="font-medium text-brand hover:underline">See your trips →</Link>
            </p>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-col lg:h-[calc(100vh-9.5rem)]">
          <ItineraryPanel
            planA={planA}
            planB={planB}
            simNow={simNow}
            phase={phase}
            progressStep={progressStep}
            response={response}
            error={error}
            onRetry={() => setError(null)}
            onBook={() => setBookOpen(true)}
            booking={bookOpen}
          />
        </div>
      </div>

      {planA && tripId ? (
        <BookDialog open={bookOpen} onClose={() => setBookOpen(false)} tripId={tripId} plan={planA} />
      ) : null}
    </AppShell>
  );
}
