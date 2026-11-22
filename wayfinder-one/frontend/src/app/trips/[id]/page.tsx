'use client';

import { Suspense, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  CalendarRange,
  FileText,
  Gauge as GaugeIcon,
  HeartPulse,
  Leaf,
  ListChecks,
  Navigation,
  Ticket,
  Users
} from 'lucide-react';
import { AppShell } from '@/components/shell/AppShell';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { useTripEvents } from '@/hooks/useTripEvents';
import { fmtMoney } from '@/lib/format';
import { HealthMeter } from '@/components/guardian/HealthMeter';
import { GuardianFeed } from '@/components/guardian/GuardianFeed';
import { ItineraryTimeline } from '@/components/itinerary/ItineraryTimeline';
import { ProofList } from '@/components/itinerary/ProofList';
import { BookingsTab } from '@/components/bookings/BookingList';
import { BookDialog } from '@/components/bookings/BookDialog';
import { SwitchDecisionCard } from '@/components/switch/SwitchDecisionCard';
import { DraftsDrawer } from '@/components/drafts/DraftsDrawer';
import { PriorityBoard } from '@/components/priorities/PriorityBoard';
import { LiveMap, CommitmentList, RerouteOptionCard, TrackingToggle } from '@/components/live/LiveMap';
import { EvidenceTab } from '@/components/evidence/EvidenceTimeline';
import { GroupTab } from '@/components/group/GroupTab';
import { ResponsibleTab } from '@/components/responsible/ResponsibleTab';
import { SafetyPanel } from '@/components/safety/SafetyPanel';
import { OfflinePanel } from '@/components/offline/OfflinePanel';
import { Tabs, type TabDef } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';

const TABS: TabDef[] = [
  { id: 'itinerary', label: 'Itinerary', icon: <CalendarRange className="h-4 w-4" aria-hidden /> },
  { id: 'guardian', label: 'Guardian', icon: <Bell className="h-4 w-4" aria-hidden /> },
  { id: 'bookings', label: 'Bookings', icon: <Ticket className="h-4 w-4" aria-hidden /> },
  { id: 'live', label: 'Live', icon: <Navigation className="h-4 w-4" aria-hidden /> },
  { id: 'evidence', label: 'Evidence', icon: <FileText className="h-4 w-4" aria-hidden /> },
  { id: 'priorities', label: 'Priorities', icon: <ListChecks className="h-4 w-4" aria-hidden /> },
  { id: 'group', label: 'Group', icon: <Users className="h-4 w-4" aria-hidden /> },
  { id: 'responsible', label: 'Responsible', icon: <Leaf className="h-4 w-4" aria-hidden /> },
  { id: 'safety', label: 'Safety & Offline', icon: <HeartPulse className="h-4 w-4" aria-hidden /> }
];

/** `/trips/[id]` — the cockpit (A6.3/A6b): tabs, health rail, switch banner. */
export default function TripCockpitPage() {
  return (
    <Suspense fallback={<div className="p-10"><Skeleton className="h-96 rounded-card" /></div>}>
      <Cockpit />
    </Suspense>
  );
}

function Cockpit() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const tripId = params.id;
  const tab = search.get('tab') ?? 'itinerary';
  useTripEvents(tripId);

  const [draftsOpen, setDraftsOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);

  const detail = useQuery({ queryKey: qk.trip(tripId), queryFn: () => api.trip(tripId) });
  const switchRec = useQuery({ queryKey: qk.switch(tripId), queryFn: () => api.switchRec(tripId) });
  const alerts = useQuery({ queryKey: qk.alerts(tripId), queryFn: () => api.alerts(tripId) });
  const live = useQuery({ queryKey: qk.live(tripId), queryFn: () => api.live(tripId), enabled: tab === 'live' });

  const itemTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of [detail.data?.plan_a, detail.data?.plan_b]) {
      for (const i of p?.items ?? []) map.set(i.id, i.title);
    }
    return (id: string) => map.get(id) ?? id;
  }, [detail.data]);

  const riskyItems = (detail.data?.plan_a?.items ?? []).filter((i) => i.risk_tags.length || i.hard_deadline);

  function setTab(t: string) {
    router.replace(`/trips/${tripId}?tab=${t}`, { scroll: false });
  }

  if (detail.isLoading) {
    return (
      <AppShell tripId={tripId}>
        <div className="space-y-4">
          <Skeleton className="h-10 w-72 rounded-card" />
          <Skeleton className="h-96 rounded-card" />
        </div>
      </AppShell>
    );
  }
  if (detail.isError) {
    return (
      <AppShell tripId={tripId}>
        <Card>
          <ErrorState error={detail.error} onRetry={() => detail.refetch()} title="Trip unavailable" />
        </Card>
      </AppShell>
    );
  }

  const d = detail.data!;
  const planA = d.plan_a;
  const planB = d.plan_b;
  const tabs = TABS.filter((t) => t.id !== 'group' || d.trip.group_id !== null || d.trip.id === 'trip_g1');
  const activeTab = tabs.find((t) => t.id === tab) ? tab : 'itinerary';
  const latestAlerts = (alerts.data ?? []).slice(0, 2);
  const activeSwitch = switchRec.data;

  return (
    <AppShell tripId={tripId}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl leading-tight">{d.trip.title}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {d.trip.intent.origin ? `${d.trip.intent.origin} → ${d.trip.intent.destination}` : d.trip.intent.destination} ·{' '}
            {d.trip.intent.nights ?? '—'} nights · {d.trip.intent.travellers ?? '—'} travellers
            {planA ? <span className="tnum font-mono"> · {fmtMoney(planA.total_cost_inr)}</span> : null}
            {d.trip.sim_window ? <span className="font-mono text-ink-3"> · sim {d.trip.sim_window.toLowerCase()}</span> : null}
          </p>
        </div>
        {planA ? (
          <Button data-testid="book-cta" onClick={() => setBookOpen(true)}>
            Review &amp; book
          </Button>
        ) : null}
      </div>

      {activeSwitch && activeSwitch.state === 'PROPOSED' ? (
        <div className="mb-4">
          <SwitchDecisionCard rec={activeSwitch} tripId={tripId} onOpenDrafts={() => setDraftsOpen(true)} banner />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="mb-3 lg:hidden">
            <Tabs tabs={tabs} active={activeTab} onChange={setTab} ariaLabel="Trip sections" />
          </div>

          {/* desktop left rail + main column */}
          <div className="grid gap-5 lg:grid-cols-[170px_minmax(0,1fr)]">
            <nav className="hidden lg:block" aria-label="Trip sections">
              <Tabs tabs={tabs} active={activeTab} onChange={setTab} ariaLabel="Trip sections" variant="rail" />
            </nav>

            <div className="min-w-0" role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
              {activeTab === 'itinerary' ? (
                planA ? (
                  <div className="space-y-4">
                    {planB ? (
                      <p className="rounded-card border border-dashed border-brand/40 bg-brand-soft/40 px-4 py-2.5 text-sm text-ink-2">
                        <span className="font-semibold text-brand">Plan B is warm:</span> {planB.summary} Stored and re-checked on a
                        schedule — compare it in the itinerary view.
                      </p>
                    ) : null}
                    <ItineraryTimeline plan={planA} simNow={d.trip.sim_now} highlightItemId={highlight} />
                    <ProofList validation={planA.validation} />
                  </div>
                ) : (
                  <Card>
                    <EmptyState
                      icon={<CalendarRange className="h-5 w-5" aria-hidden />}
                      title="No plan yet"
                      body="This trip has no approved plan. Ask the planner for one."
                    />
                  </Card>
                )
              ) : null}

              {activeTab === 'guardian' ? (
                <GuardianFeed tripId={tripId} onOpenSwitch={() => setTab('guardian')} onOpenTab={setTab} />
              ) : null}

              {activeTab === 'bookings' ? <BookingsTab tripId={tripId} planTitle={itemTitle} /> : null}

              {activeTab === 'live' ? (
                <div className="space-y-4" data-testid="live-tab">
                  <LiveTabInner live={live.data ?? null} isLoading={live.isLoading} error={live.error} onRetry={() => live.refetch()} onApplyOption={() => setTab('guardian')} />
                </div>
              ) : null}

              {activeTab === 'evidence' ? <EvidenceTab tripId={tripId} /> : null}

              {activeTab === 'priorities' ? (
                planA ? (
                  <PriorityBoard tripId={tripId} plan={planA} />
                ) : (
                  <Card>
                    <EmptyState icon={<ListChecks className="h-5 w-5" aria-hidden />} title="Nothing to rank yet" body="Plan a trip first — priorities shape how the solver rebalances lost time." />
                  </Card>
                )
              ) : null}

              {activeTab === 'group' ? <GroupTab tripId={tripId} planAId={planA?.id ?? null} planBId={planB?.id ?? null} /> : null}

              {activeTab === 'responsible' ? (
                planA ? (
                  <ResponsibleTab tripId={tripId} plan={planA} />
                ) : (
                  <Card>
                    <EmptyState icon={<Leaf className="h-5 w-5" aria-hidden />} title="Nothing to measure yet" body="Carbon and community insights appear once a plan exists." />
                  </Card>
                )
              ) : null}

              {activeTab === 'safety' ? (
                <div className="space-y-4">
                  <SafetyPanel tripId={tripId} riskyItems={riskyItems.map((i) => ({ id: i.id, title: i.title }))} />
                  <OfflinePanel tripId={tripId} />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* right rail: sticky health meter + latest alerts (A5 desktop layout) */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            {d.slack ? (
              <HealthMeter
                slack={d.slack}
                itemTitle={itemTitle}
                onJumpToItem={(id) => {
                  setHighlight(id);
                  setTab('itinerary');
                  window.setTimeout(() => setHighlight(null), 4000);
                }}
              />
            ) : null}
            <div>
              <h2 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-ink-2">
                <GaugeIcon className="h-4 w-4" aria-hidden />
                Latest from the Guardian
                {d.unread_alerts ? <span className="tnum rounded-full bg-amber-bg px-1.5 text-xs font-semibold text-amber">{d.unread_alerts}</span> : null}
              </h2>
              {latestAlerts.length ? (
                <div className="space-y-3">
                  {latestAlerts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setTab('guardian')}
                      className="w-full rounded-card border border-line bg-surface p-3 text-left shadow-card transition-shadow hover:shadow-pop"
                    >
                      <p className="text-sm font-semibold leading-snug">{a.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-2">{a.body}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <Card className="px-3.5 py-3">
                  <p className="text-sm text-ink-2">All quiet. The Guardian checks on a schedule.</p>
                </Card>
              )}
            </div>
          </div>
        </aside>
      </div>

      {planA ? <BookDialog open={bookOpen} onClose={() => setBookOpen(false)} tripId={tripId} plan={planA} /> : null}
      <DraftsDrawer open={draftsOpen} onClose={() => setDraftsOpen(false)} tripId={tripId} />
    </AppShell>
  );
}

function LiveTabInner({
  live,
  isLoading,
  error,
  onRetry,
  onApplyOption
}: {
  live: Awaited<ReturnType<typeof api.live>> | null;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onApplyOption: () => void;
}) {
  const [tracking, setTracking] = useState(false);
  if (isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (error || !live) {
    return (
      <Card>
        <ErrorState error={error ?? new Error('Live status unavailable')} onRetry={onRetry} />
      </Card>
    );
  }
  return (
    <>
      <LiveMap live={live} />
      <CommitmentList live={live} />
      {live.reroute_options.length ? (
        <div className="space-y-2.5">
          <h3 className="px-1 text-sm font-semibold text-ink-2">Reroute options</h3>
          {live.reroute_options.map((o) => (
            <RerouteOptionCard key={o.id} option={o} onApply={onApplyOption} />
          ))}
        </div>
      ) : null}
      <TrackingToggle on={tracking} onChange={setTracking} />
    </>
  );
}
