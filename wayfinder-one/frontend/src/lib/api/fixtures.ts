import { CONTRACT_VERSION } from '@contracts/types';
import type {
  AdvisorNote,
  Alert,
  Booking,
  BookResult,
  ChatResponse,
  CourtesyDraft,
  DemoInject,
  EvidenceEvent,
  Group,
  GroupPreference,
  LiveStatus,
  MergedPreferences,
  NotificationPrefs,
  OfflineManifest,
  OptionalityReport,
  Plan,
  RebalancePreview,
  ResponsibleReport,
  SafeCheckin,
  ShareLink,
  SharedTripView,
  SlackScore,
  SplitReport,
  Signal,
  SignalView,
  SwitchRecommendation,
  TokenResponse,
  Trip,
  TripDetail,
  TripSummary,
  TrustedContact,
  User,
  VoteTally,
  Window as SimWindow
} from '@contracts/types';
import { ApiError } from './client';
import {
  BOOKING_SEED_REFS,
  DESTINATION_OPTIONS,
  DraftRecord,
  GOLDEN_PLAN_A,
  GOLDEN_TRIP,
  GROUP_TRIP,
  AdvisorSeed,
  SIM_WINDOWS,
  bookingFor,
  dt,
  makeAdvisorSeeds,
  makeCoorgPlans,
  makeDelaySignal,
  makeDrafts,
  makeGoldenPlanB,
  makeSwitchResultPlan,
  makeItem,
  prov
} from './fixtures_data';

/* ------------------------------------------------------------------ */
/* world                                                               */
/* ------------------------------------------------------------------ */

interface PasswordUser {
  user: User;
  password: string;
}

interface World {
  users: Map<string, PasswordUser>;
  tokens: Map<string, string>;
  prefs: Map<string, NotificationPrefs>;
  trips: Trip[];
  plans: Map<string, { A: Plan; B: Plan | null }>;
  bookings: Booking[];
  alerts: Alert[];
  signals: Signal[];
  switches: Map<string, SwitchRecommendation>;
  drafts: DraftRecord[];
  evidence: EvidenceEvent[];
  groups: Map<string, Group>;
  groupPrefs: Map<string, GroupPreference>;
  votes: Map<string, { user_id: string; plan_id: string; vote: 'A' | 'B' | 'NEITHER' }>;
  notes: Map<string, AdvisorNote[]>;
  contacts: Map<string, TrustedContact[]>;
  checkins: Map<string, SafeCheckin[]>;
  shareLinks: Map<string, ShareLink[]>;
  chatStage: { clarifies: number; plannedTripId: string | null };
  sim: { window: SimWindow | null; simNow: string | null; injected: DemoInject[]; delayMin: number; jamMin: number };
  idem: Map<string, unknown>;
  seenWindows: Set<string>;
  manifestVersion: number;
  driftPending: boolean;
}

const SEED_USERS: Array<[string, string, string, User['role'], string]> = [
  ['usr_demo', 'traveller@demo.wf', 'Asha', 'TRAVELLER', 'demo1234'],
  ['usr_adv', 'advisor@demo.wf', 'Priya Nair', 'ADVISOR', 'demo1234'],
  ['usr_g1', 'g1@demo.wf', 'Asha', 'TRAVELLER', 'demo1234'],
  ['usr_g2', 'g2@demo.wf', 'Rohan', 'TRAVELLER', 'demo1234'],
  ['usr_g3', 'g3@demo.wf', 'Meera', 'TRAVELLER', 'demo1234'],
  ['usr_g4', 'g4@demo.wf', 'Dev', 'TRAVELLER', 'demo1234']
];

let advisorSeedsRef: AdvisorSeed[] = [];

function now(): string {
  return world.sim?.simNow ?? '2026-11-22T10:00:00+05:30';
}

function seedWorld(): World {
  const users = new Map<string, PasswordUser>();
  for (const [id, email, name, role, password] of SEED_USERS) {
    users.set(email, { user: { id, email, name, role, language: 'en' }, password });
  }
  users.set('demo@wayfinder.test', {
    user: { id: 'usr_local', email: 'demo@wayfinder.test', name: 'Local Demo', role: 'TRAVELLER', language: 'en' },
    password: 'demo1234'
  });

  const advisorSeeds = makeAdvisorSeeds();
  const coorg = makeCoorgPlans();

  const trips: Trip[] = [GOLDEN_TRIP, GROUP_TRIP, ...advisorSeeds.map((s) => s.trip)];
  const plans = new Map<string, { A: Plan; B: Plan | null }>();
  plans.set('trip_golden', { A: GOLDEN_PLAN_A, B: makeGoldenPlanB() });
  plans.set('trip_g1', { A: coorg.a, B: coorg.b });
  advisorSeeds.forEach((s, i) => plans.set(`trip_adv${i + 1}`, { A: s.plan, B: null }));

  const w: World = {
    users,
    tokens: new Map(),
    prefs: new Map(),
    trips,
    plans,
    bookings: [],
    alerts: [],
    signals: [],
    switches: new Map(),
    drafts: [],
    evidence: [],
    groups: new Map(),
    groupPrefs: new Map(),
    votes: new Map(),
    notes: new Map(),
    contacts: new Map(),
    checkins: new Map(),
    shareLinks: new Map(),
    chatStage: { clarifies: 0, plannedTripId: null },
    sim: { window: null, simNow: null, injected: [], delayMin: 0, jamMin: 0 },
    idem: new Map(),
    seenWindows: new Set(),
    manifestVersion: 1,
    driftPending: (process.env.NEXT_PUBLIC_FIXTURES_PRICE_DRIFT || '0') === '1'
  };

  // seeded group for the Coorg trip (B10)
  w.groups.set('trip_g1', {
    id: 'grp_1',
    trip_id: 'trip_g1',
    invite_code: 'COORG24',
    members: [
      { user_id: 'usr_g1', name: 'Asha', role: 'OWNER', location_sharing: true, joined_at: '2026-11-20T09:00:00+05:30' },
      { user_id: 'usr_g2', name: 'Rohan', role: 'MEMBER', location_sharing: false, joined_at: '2026-11-20T09:05:00+05:30' },
      { user_id: 'usr_g3', name: 'Meera', role: 'MEMBER', location_sharing: false, joined_at: '2026-11-20T09:10:00+05:30' },
      { user_id: 'usr_g4', name: 'Dev', role: 'MEMBER', location_sharing: true, joined_at: '2026-11-20T09:12:00+05:30' }
    ],
    created_at: '2026-11-20T09:00:00+05:30'
  });
  w.groupPrefs.set('usr_g1', { user_id: 'usr_g1', budget_inr: 20000, interests: ['coffee', 'sunsets'], constraints: [], pace: 'BALANCED', must_dos: ['Abbey Falls'] });
  w.groupPrefs.set('usr_g2', { user_id: 'usr_g2', budget_inr: 12000, interests: ['adventure', 'wildlife'], constraints: [], pace: 'PACKED', must_dos: [] });
  w.groupPrefs.set('usr_g3', { user_id: 'usr_g3', budget_inr: 14000, interests: ['coffee'], constraints: ['vegetarian'], pace: 'RELAXED', must_dos: [] });
  w.groupPrefs.set('usr_g4', { user_id: 'usr_g4', budget_inr: 16000, interests: ['waterfalls', 'adventure'], constraints: [], pace: 'BALANCED', must_dos: [] });
  w.votes.set('usr_g1', { user_id: 'usr_g1', plan_id: 'plan_cg1', vote: 'A' });
  w.votes.set('usr_g2', { user_id: 'usr_g2', plan_id: 'plan_cg1', vote: 'A' });
  w.votes.set('usr_g3', { user_id: 'usr_g3', plan_id: 'plan_cg2', vote: 'B' });
  w.votes.set('usr_g4', { user_id: 'usr_g4', plan_id: 'plan_cg2', vote: 'NEITHER' });

  // advisor notes seeded for the two consented clients
  w.notes.set('trip_adv2', [
    {
      id: 'an_1',
      trip_id: 'trip_adv2',
      advisor_id: 'usr_adv',
      body: 'Client asked for a quieter Hampi slot — suggested Tuesday visit for Vitthala Temple.',
      created_at: '2026-11-21T11:00:00+05:30'
    }
  ]);
  w.notes.set('trip_adv4', [
    {
      id: 'an_2',
      trip_id: 'trip_adv4',
      advisor_id: 'usr_adv',
      body: 'Houseboat supplier chasing confirmation — escalation sent 21 Nov.',
      created_at: '2026-11-21T15:30:00+05:30'
    }
  ]);

  // advisor client trips start in windows so the console shows live feeds
  for (const s of advisorSeeds) {
    const win: SimWindow = s.row.health === 'RED' ? 'LIVE' : s.row.health === 'AMBER' ? 'T-24H' : 'T-72H';
    s.trip.sim_window = win;
    s.trip.sim_now = SIM_WINDOWS[win];
  }

  // trusted contacts seeded for the demo traveller (A6b max 5)
  w.contacts.set('trip_golden', [
    { id: 'tc_1', trip_id: 'trip_golden', name: 'Appa', phone: '+919845201111', email: null },
    { id: 'tc_2', trip_id: 'trip_golden', name: 'Priya (colleague)', phone: null, email: 'priya@example.com' }
  ]);

  // one deterministic share link so the public /share page is demoable across tabs
  // (128-bit token = 32 hex chars, expiring well beyond the demo window)
  w.shareLinks.set('trip_golden', [
    {
      token: 'd3m0share2link2f0r2wayfinder2one2demo00',
      url: '/share/d3m0share2link2f0r2wayfinder2one2demo00',
      expires_at: '2026-12-31T23:59:00+05:30',
      active: true
    }
  ]);

  advisorSeedsRef = advisorSeeds;
  return w;
}

let world: World = seedWorld();
const pendingTimers: number[] = [];

function later(fn: () => void, ms: number): void {
  if (typeof window === 'undefined') {
    fn();
    return;
  }
  pendingTimers.push(window.setTimeout(fn, ms));
}

function clearTimers(): void {
  for (const t of pendingTimers) window.clearTimeout(t);
  pendingTimers.length = 0;
}

export function resetFixtures(): void {
  clearTimers();
  world = seedWorld();
  emitAll('sim.reset', { ok: true });
}

/* ------------------------------------------------------------------ */
/* fixture SSE bus (A3: fake SSE timer)                                */
/* ------------------------------------------------------------------ */

type Listener = (event: string, data: unknown) => void;
const busByTrip = new Map<string, Set<Listener>>();
const busAll = new Set<Listener>();

function emit(tripId: string, event: string, data: unknown): void {
  // trip-scoped events reach only that trip's subscribers — never the global set
  busByTrip.get(tripId)?.forEach((fn) => fn(event, data));
}

function emitAll(event: string, data: unknown): void {
  // world-wide events (sim.reset) reach every subscriber once
  busAll.forEach((fn) => fn(event, data));
  for (const set of busByTrip.values()) set.forEach((fn) => fn(event, data));
}

export function fixtureSse(
  tripId: string,
  handlers: Record<string, (payload: unknown) => void>,
  onStatus?: (ok: boolean) => void
): { close: () => void } {
  const listener: Listener = (event, data) => {
    handlers[event]?.(data);
  };
  if (!busByTrip.has(tripId)) busByTrip.set(tripId, new Set());
  busByTrip.get(tripId)!.add(listener);
  onStatus?.(true);
  // initial clock snapshot so a late subscriber is in sync
  later(() => emit(tripId, 'sim.clock', { window: world.sim.window, sim_now: world.sim.simNow }), 30);
  return {
    close: () => {
      busByTrip.get(tripId)?.delete(listener);
      busAll.delete(listener);
    }
  };
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const ENVELOPE_HEADERS = 'fix';

function fail(status: number, code: string, message: string, details: Record<string, unknown> | null = null): never {
  throw new ApiError(status, { code: code as never, message, details, request_id: `${ENVELOPE_HEADERS}_${Math.random().toString(36).slice(2, 8)}` });
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => (typeof window === 'undefined' ? r() : window.setTimeout(r, ms)));
}

function currentUser(token: string | null): User {
  if (!token) fail(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  const uid = world.tokens.get(token!) ?? (token!.startsWith('fix-') ? token!.split('|')[1] : null);
  if (!uid) fail(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  for (const u of world.users.values()) if (u.user.id === uid) return u.user;
  fail(401, 'UNAUTHENTICATED', 'Sign in to continue.');
}

function tripOr404(id: string): Trip {
  const t = world.trips.find((x) => x.id === id);
  if (!t) fail(404, 'NOT_FOUND', 'Trip not found.');
  return t;
}

function plansFor(tripId: string): { A: Plan; B: Plan | null } {
  return world.plans.get(tripId) ?? { A: GOLDEN_PLAN_A, B: makeGoldenPlanB() };
}

function tripBookings(tripId: string): Booking[] {
  return world.bookings.filter((b) => b.trip_id === tripId);
}

function tripAlerts(tripId: string): Alert[] {
  return world.alerts.filter((a) => a.trip_id === tripId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

function unread(tripId: string): number {
  return tripAlerts(tripId).filter((a) => a.state === 'NEW').length;
}

function slackFor(tripId: string): SlackScore | null {
  const t = tripOr404(tripId);
  const seed = advisorSeedsRef.find((s) => s.trip.id === tripId);
  if (seed) {
    return {
      trip_id: tripId,
      health: seed.row.health,
      score: seed.row.score,
      components: {
        time_buffer: Math.max(10, seed.row.score - 4),
        delay_risk: seed.row.health === 'RED' ? 18 : seed.row.health === 'AMBER' ? 44 : 82,
        weather_risk: seed.row.health === 'AMBER' ? 48 : 70,
        crowd_risk: 62,
        budget_headroom: 74
      },
      weakest_item_id: null,
      explanation: seed.row.next_risk,
      computed_at: t.sim_now ?? now()
    };
  }
  return goldenSlack(tripId);
}

function goldenSlack(tripId: string): SlackScore | null {
  const t = tripOr404(tripId);
  if (tripId !== 'trip_golden' && tripId !== 'trip_g1') return null;
  const delay = world.sim.delayMin;
  const jam = world.sim.jamMin;
  const win = world.sim.window;
  const switched = [...world.switches.values()].some((r) => r.state === 'EXECUTED');

  // B5 target bands: baseline GREEN; delay 55 → AMBER; delay 120 → RED.
  let score = 84;
  let health: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
  let explanation = 'Tightest link: the cab-to-Eravikulam connection (65 min of slack). Weather risk on the waterfall day.';
  let weakest: string | null = switched ? 'it_a_e1b' : 'it_a_e1';
  let comps = { time_buffer: 86, delay_risk: 88, weather_risk: 72, crowd_risk: 70, budget_headroom: 88 };

  if (tripId === 'trip_g1') {
    return {
      trip_id: tripId,
      health: 'GREEN',
      score: 82,
      components: { time_buffer: 80, delay_risk: 76, weather_risk: 72, crowd_risk: 74, budget_headroom: 66 },
      weakest_item_id: 'cg_a6',
      explanation: 'Rafting carries a rain risk; Tadiandamol half-trek is the tightest afternoon.',
      computed_at: t.sim_now ?? now()
    };
  }

  if (delay >= 120) {
    score = 34;
    health = 'RED';
    explanation = 'The delayed flight breaks Day 1: Eravikulam entry (15:45 last entry) is no longer reachable from the cab. Switch to Plan B.';
    comps = { time_buffer: 22, delay_risk: 12, weather_risk: 44, crowd_risk: 60, budget_headroom: 84 };
  } else if (delay >= 55) {
    score = 52;
    health = 'AMBER';
    explanation = switched
      ? 'Recovered by the MIXED switch: Eravikulam moves to Sunday 09:00. Day 3 rain watch continues.'
      : `Flight delay of ${delay} min leaves the Eravikulam connection with ${delay > 60 ? 'no' : '10 min of'} slack. A MIXED switch recovers the day.`;
    comps = switched
      ? { time_buffer: 74, delay_risk: 70, weather_risk: 52, crowd_risk: 62, budget_headroom: 86 }
      : { time_buffer: 30, delay_risk: 26, weather_risk: 52, crowd_risk: 62, budget_headroom: 86 };
  } else if (win === 'LIVE') {
    score = jam > 0 ? 45 : 58;
    health = jam > 0 ? 'RED' : 'AMBER';
    explanation =
      jam > 0
        ? `A ${jam}-min jam on the ghat road eats into your next commitment's slack. Reroute options are in the Live tab.`
        : 'You are inside the travel window. Next commitment: Eravikulam entry, arrive by 15:45.';
    weakest = jam > 0 ? 'it_a_e1' : null;
    comps = jam > 0 ? { time_buffer: 34, delay_risk: 40, weather_risk: 58, crowd_risk: 56, budget_headroom: 86 } : { time_buffer: 52, delay_risk: 60, weather_risk: 58, crowd_risk: 56, budget_headroom: 86 };
  } else if (win === 'T-3H') {
    score = 66;
    health = 'AMBER';
    explanation = 'Inside 3 hours of departure. Connections are still comfortable; delay risk is the live variable.';
    comps = { time_buffer: 64, delay_risk: 58, weather_risk: 56, crowd_risk: 62, budget_headroom: 88 };
  } else if (win === 'T-24H') {
    score = 74;
    health = 'AMBER';
    explanation = 'AMBER-borderline: heavy rain is forecast on Day 3 (waterfall trek). Plan B stays warm and bookable.';
    comps = { time_buffer: 78, delay_risk: 74, weather_risk: 42, crowd_risk: 64, budget_headroom: 88 };
  } else if (win === 'T-72H') {
    score = 82;
    health = 'GREEN';
    explanation = 'GREEN with a watch on weather: Day-3 rain band developing. Nothing needs you yet.';
    comps = { time_buffer: 86, delay_risk: 84, weather_risk: 58, crowd_risk: 70, budget_headroom: 88 };
  } else if (win === 'POST_BOOKING') {
    score = 86;
    health = 'GREEN';
    explanation = 'All confirmed. Hotel confirmation is pending with the supplier — the Guardian is watching it.';
    comps = { time_buffer: 88, delay_risk: 90, weather_risk: 74, crowd_risk: 70, budget_headroom: 86 };
  }

  return {
    trip_id: tripId,
    health,
    score,
    components: comps,
    weakest_item_id: weakest,
    explanation,
    computed_at: t.sim_now ?? now()
  };
}

function detailFor(tripId: string): TripDetail {
  const t = tripOr404(tripId);
  const p = plansFor(tripId);
  return {
    trip: t,
    plan_a: p.A,
    plan_b: p.B,
    bookings: tripBookings(tripId),
    slack: slackFor(tripId),
    unread_alerts: unread(tripId)
  };
}

function bumpManifest(): void {
  world.manifestVersion += 1;
}

function evidence(kind: EvidenceEvent['kind'], source: string, detail: string, ref: Record<string, unknown> = {}): void {
  world.evidence.push({ id: `ev_${world.evidence.length + 1}`, trip_id: 'trip_golden', ts: now(), kind, source, detail, ref });
}

function addAlert(
  a: Omit<Alert, 'id' | 'created_at' | 'state' | 'channels_sent' | 'audience_user_ids' | 'recommended_action'> & {
    id?: string;
    recommended_action?: Alert['recommended_action'];
  }
): Alert {
  const alert: Alert = {
    id: a.id ?? `al_${world.alerts.length + 1}`,
    trip_id: a.trip_id,
    level: a.level,
    window: a.window,
    title: a.title,
    body: a.body,
    provenance: a.provenance,
    recommended_action: a.recommended_action ?? null,
    state: 'NEW',
    audience_user_ids: [],
    channels_sent: ['IN_APP'],
    created_at: now()
  };
  world.alerts.push(alert);
  emit(a.trip_id, 'alert.created', alert);
  later(() => emit(a.trip_id, 'notification.sent', { channel: 'IN_APP', to_masked: 'asha@d***', alert_id: alert.id, state: 'DELIVERED' }), 800);
  return alert;
}

/* ------------------------------------------------------------------ */
/* demo: clock + injects (B6.3 20–26, A6.9)                            */
/* ------------------------------------------------------------------ */

function ensureWindowAlerts(tripId: string): void {
  if (tripId !== 'trip_golden') return;
  const win = world.sim.window;
  if (!win || world.seenWindows.has(win)) return;
  world.seenWindows.add(win);

  if (win === 'POST_BOOKING') {
    addAlert({
      trip_id: tripId,
      level: 'INFO',
      window: win,
      title: 'Flights and cab confirmed',
      body: 'Booking refs SIM-F-7721 and SIM-C-1180 are in your Bookings tab. Tea Valley Resort is awaiting supplier confirmation — we will ping you the moment it lands.',
      provenance: prov('TBO Sandbox (sim)', now())
    });
    addAlert({
      trip_id: tripId,
      level: 'INFO',
      window: win,
      title: 'Plan B stored and kept warm',
      body: 'A rain-safe Plan B (₹45,600) is stored. We re-check its prices and availability every 30 minutes.',
      provenance: prov('TBO Sandbox (sim)', now()),
      recommended_action: { action: 'VIEW', label: 'See Plan B', params: { tab: 'itinerary', plan: 'B' } }
    });
  } else if (win === 'T-72H') {
    addAlert({
      trip_id: tripId,
      level: 'NUDGE',
      window: win,
      title: 'Heavy rain forecast on Day 3',
      body: 'The Lakkam waterfall trek sits in the rain band for Saturday. Plan B swaps it for an indoor spice plantation + cooking class. No action needed yet.',
      provenance: prov('Open-Meteo (sim)', now(), 0.85),
      recommended_action: { action: 'VIEW', label: 'See Plan B', params: { tab: 'itinerary', plan: 'B' } }
    });
    addAlert({
      trip_id: tripId,
      level: 'INFO',
      window: win,
      title: 'Local Pulse: nothing flagged',
      body: 'News scan found no bandh, strike or landslide reports for Munnar on your dates.',
      provenance: prov('News scan (sim)', now(), 0.7)
    });
  } else if (win === 'T-24H') {
    addAlert({
      trip_id: tripId,
      level: 'NUDGE',
      window: win,
      title: 'Web check-in opens tonight',
      body: 'Flight BLR→COK (6E-207) opens web check-in 48 h before departure. Window seats go first on this route.',
      provenance: prov('Airline feed (sim)', now(), 0.9),
      recommended_action: { action: 'CHECK_IN', label: 'Open airline check-in', params: { url: 'https://www.airline.example/checkin/6E207' } }
    });
    addAlert({
      trip_id: tripId,
      level: 'INFO',
      window: win,
      title: 'Plan B re-checked',
      body: 'Prices and availability re-verified a few minutes ago. Plan B is still bookable at ₹45,600.',
      provenance: prov('TBO Sandbox (sim)', now())
    });
  } else if (win === 'T-3H' && world.sim.delayMin === 0) {
    addAlert({
      trip_id: tripId,
      level: 'INFO',
      window: win,
      title: 'You are 3 hours from departure',
      body: 'Leave for the airport by 05:10 to keep 30 min of slack at security. Your BLR cab is not prebooked — the airport taxi queue is short at that hour.',
      provenance: prov('Traffic estimate (sim)', now(), 0.75)
    });
  }
  // T-3H with a delay inject gets its alert from the inject handler itself.
}

function applyFlightDelay(tripId: string, minutes: number): void {
  world.sim.delayMin = minutes;
  const signal = makeDelaySignal(`sg_${world.signals.length + 1}`, tripId, minutes, now());
  world.signals.push(signal);
  emit(tripId, 'signal.created', signal);
  evidence('SIGNAL', signal.provenance.source, `Flight status: delayed ${minutes} min (signal ${signal.id}).`, { signal_id: signal.id });

  // shift the fixed flight and its dependent cab in Plan A
  const p = plansFor(tripId);
  const shift = (iso: string) => new Date(iso).getTime() + minutes * 60000;
  const fmt = (t: number) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t));
    const g = (k: string) => parts.find((x) => x.type === k)?.value ?? '';
    return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}:00+05:30`;
  };
  const f1 = p.A.items.find((i) => i.id === 'it_a_f1');
  const t1 = p.A.items.find((i) => i.id === 'it_a_t1');
  if (f1) {
    f1.start = fmt(shift(f1.start));
    f1.end = fmt(shift(f1.end));
    f1.title = `Flight BLR→COK (sim, delayed ${minutes} min)`;
  }
  if (t1) {
    t1.start = fmt(shift(t1.start));
    t1.end = fmt(shift(t1.end));
    t1.title = 'Cab COK→Munnar (delayed pickup)';
  }
  p.A.validation.min_slack_min = minutes > 60 ? -35 : 10;
  p.A.validation.feasibility = minutes > 60 ? 0.35 : 0.55;
  emit(tripId, 'plan.updated', { plan_id: p.A.id, kind: 'A', version: p.A.version, reason: `Flight delay of ${minutes} min applied to Day 1` });

  // switch proposal + drafts (B5 step 5)
  const sw: SwitchRecommendation = {
    id: 'sw_1',
    trip_id: tripId,
    mode: 'MIXED',
    reason:
      minutes > 60
        ? 'The 2-hour delay breaks Day 1 — Eravikulam entry is unreachable before the 15:45 cut-off. Plan B\'s afternoon keeps the day calm; the rest of Plan A is kept.'
        : 'The 55-min delay leaves 10 min of slack at the Eravikulam gate — too tight. Plan B\'s afternoon keeps the day calm; the rest of Plan A is kept.',
    feasibility_a: minutes > 60 ? 0.35 : 0.55,
    feasibility_b: 0.94,
    slack_a_min: minutes > 60 ? -35 : 10,
    slack_b_min: 45,
    delta_cost_inr: 1800,
    lost_items: [{ item_id: 'it_a_mb', title: 'Mattupetty Dam boating', priority: 'NICE' }],
    kept_booking_item_ids: ['it_a_f1', 'it_a_f2', 'it_a_h1', 'it_a_wf', 'it_a_ts', 'it_a_t2', 'it_a_tm'],
    changed_booking_item_ids: ['it_a_t1', 'it_a_e1'],
    resulting_plan: makeSwitchResultPlan(p.A.version + 1, minutes, now()),
    sources: [prov('Flight status feed (sim)', now(), 0.9), prov('Open-Meteo (sim)', now(), 0.85)],
    state: 'PROPOSED',
    created_at: now()
  };
  world.switches.set(tripId, sw);
  emit(tripId, 'switch.proposed', sw);
  evidence('SWITCH', 'Guardian', `Switch recommendation proposed (MIXED, +₹1,800). ${sw.reason}`, { recommendation_id: sw.id });

  for (const d of makeDrafts(sw.id, minutes, now())) {
    world.drafts.push(d);
    emit(tripId, 'draft.created', d);
  }

  addAlert({
    trip_id: tripId,
    level: minutes > 60 ? 'CRITICAL' : 'ACTION_NEEDED',
    window: 'T-3H',
    title: minutes > 60 ? 'Flight delayed 2 hours — Day 1 breaks' : 'Your flight is delayed 55 min',
    body:
      minutes > 60
        ? 'Eravikulam entry (last entry 15:45) is no longer reachable. Plan B recovers the day with a MIXED switch.'
        : 'Eravikulam entry (last entry 15:45) is now at risk. Plan B recovers it with a MIXED switch.',
    provenance: prov('Flight status feed (sim)', now(), 0.9),
    recommended_action: { action: 'SWITCH_PLAN', label: 'Review switch', params: { recommendation_id: sw.id } }
  });

  emit(tripId, 'slack.updated', slackFor(tripId));
}

function injectRain(tripId: string, day: number, intensity: string): void {
  const signal: Signal = {
    id: `sg_${world.signals.length + 1}`,
    trip_id: tripId,
    kind: 'WEATHER',
    item_id: day === 3 ? 'it_a_wf' : null,
    severity: intensity === 'HEAVY' ? 2 : 1,
    summary: `${intensity === 'HEAVY' ? 'Heavy' : 'Light'} rain forecast on Day ${day} for Munnar.`,
    payload: { rain: intensity, day },
    provenance: prov('Open-Meteo (sim)', now(), 0.85)
  };
  world.signals.push(signal);
  emit(tripId, 'signal.created', signal);
  addAlert({
    trip_id: tripId,
    level: 'NUDGE',
    window: world.sim.window ?? 'T-24H',
    title: `${intensity === 'HEAVY' ? 'Heavy' : 'Light'} rain on Day ${day}`,
    body:
      day === 3
        ? 'The waterfall trek is exposed. Plan B already swaps it for an indoor spice class — switching is one tap when you want it.'
        : 'Pack the poncho; indoor alternatives are marked on the itinerary.',
    provenance: signal.provenance
  });
  evidence('SIGNAL', signal.provenance.source, signal.summary, { signal_id: signal.id });
}

function injectBandh(tripId: string, day: number): void {
  const signal: Signal = {
    id: `sg_${world.signals.length + 1}`,
    trip_id: tripId,
    kind: 'LOCAL_EVENT',
    item_id: null,
    severity: 1,
    summary: `Bandh reported in Munnar on Day ${day} (low confidence).`,
    payload: { day, kind: 'BANDH' },
    provenance: prov('Local news scan (sim)', now(), 0.6)
  };
  world.signals.push(signal);
  emit(tripId, 'signal.created', signal);
  addAlert({
    trip_id: tripId,
    level: 'INFO',
    window: world.sim.window ?? 'T-24H',
    title: `Bandh reported for Day ${day}`,
    body: 'One local report of a shutdown on your dates (low confidence, 0.6). Plan B\'s indoor day is unaffected. We keep watching.',
    provenance: signal.provenance
  });
  evidence('SIGNAL', signal.provenance.source, signal.summary, { signal_id: signal.id });
}

function injectJam(tripId: string, minutes: number): void {
  world.sim.jamMin = minutes;
  const signal: Signal = {
    id: `sg_${world.signals.length + 1}`,
    trip_id: tripId,
    kind: 'TRAFFIC',
    item_id: 'it_a_t1',
    severity: 2,
    summary: `${minutes}-min jam reported on the Kochi→Munnar ghat road.`,
    payload: { jam_min: minutes },
    provenance: prov('Traffic estimate (sim)', now(), 0.7)
  };
  world.signals.push(signal);
  emit(tripId, 'signal.created', signal);
  addAlert({
    trip_id: tripId,
    level: 'ACTION_NEEDED',
    window: 'LIVE',
    title: `${minutes}-min jam on the ghat road`,
    body: 'Your next commitment loses slack. Reroute options are ready in the Live tab — nothing changes until you pick one.',
    provenance: signal.provenance,
    recommended_action: { action: 'VIEW', label: 'Open Live tab', params: { tab: 'live' } }
  });
  emit(tripId, 'slack.updated', slackFor(tripId));
  emit(tripId, 'live.updated', liveFor(tripId));
  evidence('SIGNAL', signal.provenance.source, signal.summary, { signal_id: signal.id });
}

/* ------------------------------------------------------------------ */
/* live (endpoint 15/16)                                               */
/* ------------------------------------------------------------------ */

export const DEMO_ROUTE: Array<{ lat: number; lng: number }> = buildRoute();

function buildRoute(): Array<{ lat: number; lng: number }> {
  const waypoints: Array<[number, number]> = [
    [10.152, 76.4019],
    [10.1201, 76.345],
    [10.115, 76.4734],
    [10.0605, 76.6523],
    [10.0782, 76.8501],
    [10.0849, 76.9717],
    [10.0889, 77.0595]
  ];
  const pts: Array<{ lat: number; lng: number }> = [];
  for (let s = 0; s < waypoints.length - 1; s++) {
    const [a, b] = [waypoints[s], waypoints[s + 1]];
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      if (s > 0 && i === 0) continue;
      pts.push({ lat: a[0] + ((b[0] - a[0]) * i) / steps, lng: a[1] + ((b[1] - a[1]) * i) / steps });
    }
  }
  return pts;
}

let lastPing: { lat: number; lng: number; ts: string } | null = null;

function liveFor(tripId: string): LiveStatus {
  const t = tripOr404(tripId);
  const simNow = t.sim_now ?? now();
  const pos = lastPing ?? DEMO_ROUTE[0];
  const idx = nearestRouteIndex(pos);
  const remain = DEMO_ROUTE.length - 1 - idx;
  const totalMin = 270;
  const etaMin = Math.max(1, Math.round((remain / (DEMO_ROUTE.length - 1)) * totalMin) + world.sim.jamMin);
  const arriveBy = dt('05', '15:45');
  const driveEnd = new Date(new Date(simNow).getTime() + etaMin * 60000);
  const slack = Math.round((new Date(arriveBy).getTime() - driveEnd.getTime()) / 60000);
  const health = slack < 0 ? 'RED' : slack <= 15 ? 'AMBER' : 'GREEN';
  const jam = world.sim.jamMin;
  return {
    trip_id: tripId,
    as_of: simNow,
    location: { name: 'Kochi → Munnar road', lat: pos.lat, lng: pos.lng },
    tracking_on: !!lastPing,
    next_commitment: {
      item_id: 'it_a_e1',
      title: 'Eravikulam NP timed entry',
      arrive_by: arriveBy,
      eta_min: etaMin,
      slack_min: slack,
      health
    },
    reroute_options:
      jam > 0
        ? [
            {
              id: 'ro_1',
              mode: 'SHIFT_SLOT',
              title: 'Move Eravikulam to Day 2, 09:00',
              eta_min: null,
              slack_min: 720,
              delta_cost_inr: 400,
              note: 'Rebooking fee ₹400, old ticket forfeited',
              provenance: prov('TBO Sandbox (sim)', simNow),
              action: { action: 'SWITCH_PLAN', label: 'Switch', params: { recommendation_id: 'sw_1' } }
            },
            {
              id: 'ro_2',
              mode: 'DRIVE',
              title: 'Skip the Cheeyappara viewpoint stop',
              eta_min: etaMin - 20,
              slack_min: slack + 20,
              delta_cost_inr: 0,
              note: 'Saves 20 min; viewpoint visit moves to Day 4 morning',
              provenance: prov('OSRM (sim)', simNow),
              action: { action: 'KEEP_PLAN', label: 'Apply', params: {} }
            },
            {
              id: 'ro_3',
              mode: 'CAB',
              title: 'Second cab joins from Aluva toll',
              eta_min: etaMin - 35,
              slack_min: slack + 35,
              delta_cost_inr: 2600,
              note: 'Parallel ride from the toll — expensive but keeps the entry',
              provenance: prov('TBO Sandbox (sim)', simNow),
              action: null
            }
          ]
        : [],
    geofence_prompt: null
  };
}

function nearestRouteIndex(pos: { lat: number; lng: number }): number {
  let best = 0;
  let bestD = Infinity;
  DEMO_ROUTE.forEach((p, i) => {
    const d = (p.lat - pos.lat) ** 2 + (p.lng - pos.lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/* ------------------------------------------------------------------ */
/* chat (endpoint 1)                                                   */
/* ------------------------------------------------------------------ */

const DESTS = ['munnar', 'coorg', 'hampi', 'goa', 'alleppey', 'kochi', 'kerala'];

function extractIntent(message: string): {
  dest?: string;
  days?: number;
  budget?: number;
  travellers?: number;
  interests: string[];
} {
  const m = message.toLowerCase();
  const dest = DESTS.find((d) => m.includes(d));
  const days = /(\d+)\s*(?:-|\s)?\s*day/.exec(m)?.[1] ? parseInt(/(\d+)\s*(?:-|\s)?\s*day/.exec(m)![1], 10) : undefined;
  const budgetM = /₹\s?([\d,]+)(k)?/.exec(m);
  const budget = budgetM ? parseInt(budgetM[1].replace(/,/g, ''), 10) * (budgetM[2] ? 1000 : 1) : /(\d{2,3})\s?k/.exec(m) ? parseInt(/(\d{2,3})\s?k/.exec(m)![1], 10) * 1000 : undefined;
  const travellers = /for\s+(\d+)|(\d+)\s+people/.exec(m) ? parseInt(/(?:for\s+)?(\d+)/.exec(m)![1], 10) : undefined;
  const interests: string[] = [];
  const tags: Array<[string, RegExp]> = [
    ['tea estates', /tea estate|tea/],
    ['waterfalls', /waterfall|falls/],
    ['sunsets', /sunset/],
    ['beaches', /beach/],
    ['heritage', /heritage|ruins|temples/],
    ['coffee', /coffee/],
    ['adventure', /adventure|trek|rafting/],
    ['wildlife', /wildlife|safari|elephant/]
  ];
  for (const [tag, re] of tags) if (re.test(m)) interests.push(tag);
  return { dest, days, budget, travellers, interests };
}

const GOLDEN_REQUEST =
  'Plan a 5-day budget trip from Bengaluru for 2 people, early December, around ₹55,000. We like tea estates, waterfalls and sunsets. Avoid driving on ghat roads after dark.';

function blankIntent(): import('@contracts/types').TripIntent {
  return {
    origin: null,
    destination: null,
    start_date: null,
    nights: null,
    travellers: null,
    budget_inr: null,
    interests: [],
    constraints: [],
    pace: null,
    must_dos: [],
    missing: []
  };
}

function handleChat(body: { message: string; trip_id: string | null; locale: string; input_mode?: string }): ChatResponse {
  const message = body.message;
  const lower = message.toLowerCase();

  // post-booking Q&A (J8): trip given and already planned/booked
  if (body.trip_id && world.chatStage.plannedTripId === body.trip_id) {
    const t = tripOr404(body.trip_id);
    const p = plansFor(body.trip_id);
    const bks = tripBookings(body.trip_id);
    if (/status|booking|confirm|voucher|pending/.test(lower) && bks.length) {
      const pending = bks.filter((b) => b.status === 'PENDING');
      const msg = pending.length
        ? `${bks.length - pending.length} of ${bks.length} bookings are confirmed${pending.some((b) => b.item_id === 'it_a_h1') ? ' — Tea Valley Resort is still PENDING with the supplier' : ''}. Your tightest link is still the cab-to-Eravikulam connection.`
        : `Everything is confirmed (${bks.length} bookings). Next commitment: ${p.A.items[2]?.title ?? 'Eravikulam entry'}, Day 1 15:00.`;
      return answer(msg, body.trip_id, t);
    }
    if (/cancel|modify|change/.test(lower)) {
      return answer('I can quote a cancellation or modification — open the booking in the Bookings tab and I will fetch the exact penalty before you approve anything.', body.trip_id, t);
    }
    if (/what time|when|slack|next/.test(lower)) {
      const next = p.A.items.find((i) => i.day === 1 && i.fixed);
      return answer(`${next?.title ?? 'The flight'} is your next fixed commitment at ${next?.start.slice(11, 16)} IST. The cab-to-Eravikulam connection has ${p.A.validation.min_slack_min} min of slack, verified by the solver.`, body.trip_id, t);
    }
  }

  const intent = extractIntent(message);
  const isDemo = lower.includes('tea estates') && lower.includes('bengaluru');

  // RECOMMENDING: no destination given at all (AC-03 path)
  if (!intent.dest && !isDemo) {
    return {
      trip_id: body.trip_id ?? 'trip_pending',
      stage: 'RECOMMENDING',
      assistant_message:
        'I can plan any of these right now — inventory is live for five destinations. Pick one and tell me the days and budget, or just say "Munnar in December".',
      intent: { ...blankIntent(), missing: ['destination', 'dates', 'budget'] },
      quick_replies: ['Munnar in December', 'Coorg with friends', 'Hampi heritage'],
      destination_options: DESTINATION_OPTIONS,
      plan_a: null,
      plan_b: null,
      proposed_action: null
    };
  }

  // CLARIFYING (≤2 follow-ups), then force-complete
  const complete = (intent.dest || isDemo) && intent.days && (intent.budget || intent.travellers);
  if (!complete) {
    world.chatStage.clarifies += 1;
    if (world.chatStage.clarifies > 2) return planGolden(body);
    return {
      trip_id: body.trip_id ?? 'trip_pending',
      stage: 'CLARIFYING',
      assistant_message: world.chatStage.clarifies === 1
        ? `Nice — ${intent.dest ?? 'that'} works well in early December. How many days, and roughly what budget per trip should I aim for?`
        : 'Almost there — how many days should I plan, and what budget feels right? Any must-dos?',
      intent: { ...blankIntent(), destination: capitalize(intent.dest ?? 'Munnar'), missing: intent.days ? ['budget'] : ['dates', 'budget'] },
      quick_replies: world.chatStage.clarifies === 1 ? ['5 days, ₹55,000', '3 days, ₹40,000'] : ['5 days, ₹55,000'],
      destination_options: [],
      plan_a: null,
      plan_b: null,
      proposed_action: null
    };
  }

  if (isDemo || (intent.dest ?? '').includes('munnar')) return planGolden(body);
  return planGolden(body, intent.dest);
}

function answer(message: string, tripId: string, t: Trip): ChatResponse {
  return {
    trip_id: tripId,
    stage: 'ANSWER',
    assistant_message: message,
    intent: t.intent,
    quick_replies: ['What is next?', 'Open vouchers', 'Anything at risk?'],
    destination_options: [],
    plan_a: null,
    plan_b: null,
    proposed_action: null
  };
}

function planGolden(body: { message: string; trip_id: string | null }, dest?: string): ChatResponse {
  // the golden trip already exists as seed; chat "plans" it into PLANNED state
  const trip = tripOr404('trip_golden');
  world.chatStage = { clarifies: 0, plannedTripId: 'trip_golden' };
  const p = plansFor('trip_golden');
  if (dest && !dest.includes('munnar')) {
    return answer(
      `I have solver-verified inventory for ${capitalize(dest)} too — say "plan ${dest} 5 days ₹55,000" and I will build it. For now here is the flagship Munnar plan.`,
      'trip_golden',
      trip
    );
  }
  return {
    trip_id: 'trip_golden',
    stage: 'PLANNED',
    assistant_message: `Here is a Munnar plan for 2 on ₹${p.A.total_cost_inr.toLocaleString('en-IN')} with ₹${p.A.validation.budget_headroom_inr.toLocaleString('en-IN')} to spare. Your tightest link is the cab to Eravikulam (${p.A.validation.min_slack_min} min of slack). A rain-safe Plan B is stored.`,
    intent: trip.intent,
    quick_replies: ['Book Plan A', 'Make it cheaper', 'More relaxed'],
    destination_options: [],
    plan_a: p.A,
    plan_b: p.B,
    proposed_action: null
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------ */
/* group helpers                                                       */
/* ------------------------------------------------------------------ */

function mergedPrefs(tripId: string): MergedPreferences {
  const g = world.groups.get(tripId);
  const prefs = [...world.groupPrefs.values()];
  const budgets = prefs.map((p) => p.budget_inr ?? 0).filter((b) => b > 0);
  const constraints = [...new Set(prefs.flatMap((p) => p.constraints))];
  const interests = [...new Set(prefs.flatMap((p) => p.interests))];
  const mustDos = [...new Set(prefs.flatMap((p) => p.must_dos))];
  const paces = prefs.map((p) => p.pace).filter(Boolean);
  const conflicts = [
    {
      field: 'budget_inr',
      values: Object.fromEntries(prefs.map((p) => [p.user_id, p.budget_inr])),
      resolution: 'Min of member budgets'
    },
    {
      field: 'pace',
      values: Object.fromEntries(prefs.map((p) => [p.user_id, p.pace])),
      resolution: 'Merged to BALANCED (middle preference)'
    },
    {
      field: 'constraints',
      values: Object.fromEntries(prefs.filter((p) => p.constraints.length).map((p) => [p.user_id, p.constraints])),
      resolution: 'Union applied as hard constraints'
    }
  ];
  const baseTrip = tripOr404(tripId);
  return {
    merged_intent: {
      ...baseTrip.intent,
      budget_inr: budgets.length ? Math.min(...budgets) : null,
      interests,
      constraints,
      must_dos: mustDos,
      pace: paces.includes('BALANCED') ? 'BALANCED' : (paces[0] ?? 'BALANCED')
    },
    conflicts
  };
}

function voteTally(tripId: string): VoteTally {
  const votes = [...world.votes.values()];
  const counts: Record<string, number> = { A: 0, B: 0, NEITHER: 0 };
  for (const v of votes) counts[v.vote] += 1;
  const members = world.groups.get(tripId)?.members.length ?? 4;
  const leader = counts.A > counts.B ? 'A' : counts.B > counts.A ? 'B' : null;
  const decided = (counts.A > members / 2 || counts.B > members / 2) as boolean;
  return {
    trip_id: tripId,
    votes: Object.fromEntries(votes.map((v) => [v.user_id, v.vote])),
    counts,
    leader,
    decided,
    rule: 'Majority of members; owner breaks ties'
  };
}

/** Largest-remainder apportionment — shares sum EXACTLY to the total (B6.6b). */
function largestRemainder(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const floors = raw.map((r) => Math.floor(r));
  let rem = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => [i, r - Math.floor(r)] as const)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  for (const [i] of order.slice(0, rem)) floors[i] += 1;
  return floors;
}

function splitReport(tripId: string, method: 'EQUAL' | 'BY_BUDGET'): SplitReport {
  const p = plansFor(tripId).A;
  const g = world.groups.get(tripId);
  const members = g?.members ?? [];
  const weights =
    method === 'EQUAL'
      ? members.map(() => 1)
      : members.map((m) => world.groupPrefs.get(m.user_id)?.budget_inr ?? 12000);
  const shares = largestRemainder(p.total_cost_inr, weights);
  return {
    trip_id: tripId,
    method,
    total_inr: p.total_cost_inr,
    shares: members.map((m, i) => ({ member_id: m.user_id, name: m.name, share_inr: shares[i], item_ids: [] }))
  };
}

/* ------------------------------------------------------------------ */
/* safety / responsible / optionality                                   */
/* ------------------------------------------------------------------ */

function responsibleReport(tripId: string): ResponsibleReport {
  return {
    trip_id: tripId,
    total_co2_kg: 262.1,
    by_mode: { FLIGHT: 202.4, TRANSFER: 54.7, ACTIVITY: 5.0 },
    insights: [
      {
        item_id: 'it_a_ts',
        kind: 'CROWD_RELIEF',
        title: 'Shift Top Station to the 07:30 jeep slot',
        detail: 'The 16:00 slot is the crowd peak. The 07:30 slot has clear views and cooler temps; same price.',
        alternative_offer_id: 'offer_top_early',
        co2_saving_kg: 0,
        delta_cost_inr: 0
      },
      {
        item_id: 'it_a_wf',
        kind: 'LOCAL_ECONOMY',
        title: 'Community spice garden workshop',
        detail: 'A Munnar collective runs a cooking class on a cooperative farm — a local-economy alternative for the trek day.',
        alternative_offer_id: 'offer_spice_local',
        co2_saving_kg: 0,
        delta_cost_inr: 600
      },
      {
        item_id: 'it_a_t2',
        kind: 'CO2',
        title: 'Return by rail would cut ~68 kg CO₂',
        detail: 'Kochi→Bengaluru by train instead of the short flight saves about 68 kg CO₂ per traveller. Adds ~6 h travel time.',
        alternative_offer_id: null,
        co2_saving_kg: 68,
        delta_cost_inr: -3200
      },
      {
        item_id: 'it_a_tm',
        kind: 'ECO_HERITAGE',
        title: '1905 heritage tea factory tour',
        detail: 'The Kannan Devan factory tour supports the heritage preservation trust.',
        alternative_offer_id: 'offer_factory_heritage',
        co2_saving_kg: 0,
        delta_cost_inr: 0
      }
    ],
    method: 'DEFRA 2023 conversion factors (illustrative — confirm source before final demo)'
  };
}

function optionalityReport(tripId: string): OptionalityReport {
  return {
    trip_id: tripId,
    lines: [
      {
        item_id: 'it_a_e1',
        disruption_prob: 0.35,
        expected_loss_inr: 1400,
        flex_premium_inr: 400,
        recommended: 'FLEX',
        reason: 'Fixed-slot ticket with a hard 15:45 entry, in a rain band. Expected loss ₹1,400 > ₹400 flex premium.'
      },
      {
        item_id: 'it_a_t1',
        disruption_prob: 0.18,
        expected_loss_inr: 250,
        flex_premium_inr: 300,
        recommended: 'SAVER',
        reason: 'Ghat-road cab is already refundable until 4 Dec 09:50; extra flex buys little.'
      },
      {
        item_id: 'it_a_f1',
        disruption_prob: 0.12,
        expected_loss_inr: 600,
        flex_premium_inr: 2200,
        recommended: 'SAVER',
        reason: 'Airline re-accommodation covers long delays; flex premium is 3.6× the expected loss.'
      }
    ],
    total_saver_inr: 46300,
    total_saver_with_risk_inr: 46300 + 2250,
    total_flex_inr: 46300 + 2900,
    recommendation: 'Buy flex only for the Eravikulam entry (+₹400); keep saver fares for the rest. Total with risk: ₹48,550 saver-first vs ₹49,200 all-flex.'
  };
}

/* ------------------------------------------------------------------ */
/* offline (endpoint 51/52)                                            */
/* ------------------------------------------------------------------ */

function offlineManifest(tripId: string): OfflineManifest {
  const bundle = JSON.stringify(offlinePack(tripId));
  const resources: OfflineManifest['resources'] = [
    { url: `/api/v1/trips/${tripId}/offline-pack`, kind: 'ITINERARY', bytes: bundle.length },
    { url: `/api/v1/trips/${tripId}/evidence`, kind: 'PLAN_B', bytes: 4120 }
  ];
  for (const b of tripBookings(tripId)) {
    if (b.status === 'CONFIRMED') {
      resources.push({ url: `/vouchers/${b.id}`, kind: 'VOUCHER', bytes: 5100 });
    }
  }
  const contacts = world.contacts.get(tripId) ?? [];
  if (contacts.length) resources.push({ url: `/api/v1/trips/${tripId}/trusted-contacts`, kind: 'CONTACTS', bytes: JSON.stringify(contacts).length });
  return {
    trip_id: tripId,
    version: world.manifestVersion,
    generated_at: now(),
    resources,
    expires_at: dt('10', '00:00')
  };
}

function offlinePack(tripId: string): Record<string, unknown> {
  const p = plansFor(tripId);
  return {
    trip: tripOr404(tripId),
    plans: { A: p.A, B: p.B },
    bookings: tripBookings(tripId),
    alerts: tripAlerts(tripId),
    contacts: world.contacts.get(tripId) ?? [],
    checkins: world.checkins.get(tripId) ?? [],
    generated_at: now()
  };
}

/* ------------------------------------------------------------------ */
/* switch execution                                                    */
/* ------------------------------------------------------------------ */

function executeSwitch(rec: SwitchRecommendation, draftIds: string[], key: string): Record<string, unknown> {
  rec.state = 'EXECUTED';
  const trip = tripOr404('trip_golden');
  const p = plansFor('trip_golden');
  const simNow = now();

  // changed bookings cancelled + rebooked; lost item's booking cancelled (AC-10)
  const cancel = (itemId: string, penalty: number) => {
    const b = world.bookings.find((x) => x.item_id === itemId && x.trip_id === 'trip_golden' && x.status !== 'CANCELLED');
    if (b) {
      b.status = 'CANCELLED';
      b.penalty_inr = penalty;
      b.updated_at = simNow;
    }
    return b;
  };
  cancel('it_a_t1', 0);
  cancel('it_a_e1', 1000);
  cancel('it_a_mb', 900);
  // rebooked bookings keep the original item_id (same itinerary slot, new booking)
  const oldCab = world.bookings.find((b) => b.item_id === 'it_a_t1' && b.trip_id === 'trip_golden');
  world.bookings.push({
    id: `bk_t1_r${Math.random().toString(36).slice(2, 6)}`,
    trip_id: 'trip_golden',
    plan_id: 'plan_a1',
    item_id: 'it_a_t1',
    status: 'CONFIRMED',
    supplier_ref: 'SIM-C-1180-R2',
    amount_inr: oldCab?.amount_inr ?? 4300,
    refundable: true,
    failure_reason: null,
    penalty_inr: null,
    updated_at: simNow
  });
  world.bookings.push({
    id: `bk_e1_r${Math.random().toString(36).slice(2, 6)}`,
    trip_id: 'trip_golden',
    plan_id: 'plan_a1',
    item_id: 'it_a_e1',
    status: 'CONFIRMED',
    supplier_ref: 'ERV-88213-R2',
    amount_inr: 1400,
    refundable: false,
    failure_reason: null,
    penalty_inr: null,
    updated_at: simNow
  });

  // plans: resulting plan becomes Plan A v2; Plan B regenerated warm
  p.A = rec.resulting_plan;
  p.B = makeGoldenPlanB(2, simNow);
  trip.status = 'BOOKED';

  // drafts approved → sent (simulated); the delay alert is resolved
  for (const d of world.drafts) {
    if (draftIds.includes(d.id)) {
      d.state = 'SENT';
    } else if (d.state === 'DRAFT') {
      d.state = 'DISCARDED';
    }
  }
  const delayAlert = world.alerts.find((a) => a.level === 'ACTION_NEEDED' || a.level === 'CRITICAL');
  if (delayAlert && delayAlert.state === 'NEW') delayAlert.state = 'APPROVED';
  emit('trip_golden', 'plan.updated', { plan_id: p.B.id, kind: 'B', version: 2, reason: 'Plan B regenerated after switch' });

  evidence('SWITCH', 'Switch Engine', 'Switch approved and executed. Kept 7 bookings unchanged, rebooked cab and Eravikulam entry, dropped Mattupetty boating.', { recommendation_id: rec.id });
  evidence('DRAFT', 'Courtesy Agent', `${draftIds.length} courtesy messages approved and sent (simulated).`, { draft_ids: draftIds });
  evidence('COST', 'Booking', 'Extra cost ₹1,800: Eravikulam Sunday slot ₹1,400 + rebooking fee ₹400.', { delta_inr: 1800 });
  bumpManifest();

  emit('trip_golden', 'plan.switched', {
    recommendation: rec,
    trip,
    plan_a: p.A,
    plan_b: p.B,
    bookings: tripBookings('trip_golden'),
    drafts: world.drafts,
    evidence_event_ids: []
  });
  emit('trip_golden', 'slack.updated', slackFor('trip_golden'));

  return {
    recommendation: rec,
    trip,
    plan_a: p.A,
    plan_b: p.B,
    bookings: tripBookings('trip_golden'),
    drafts: world.drafts,
    evidence_event_ids: world.evidence.slice(-3).map((e) => e.id)
  };
}

/* ------------------------------------------------------------------ */
/* router                                                              */
/* ------------------------------------------------------------------ */

export async function fixtureFetch<T>(
  method: string,
  path: string,
  body: unknown,
  token: string | null,
  idem?: string
): Promise<T> {
  const [rawPath, query = ''] = path.split('?');
  const qp = new URLSearchParams(query);
  await wait(90);

  // ---- auth ----
  if (rawPath === '/auth/login' && method === 'POST') {
    const { email, password } = body as { email: string; password: string };
    const u = world.users.get(email);
    if (!u || u.password !== password) fail(401, 'UNAUTHENTICATED', 'Email or password is incorrect.');
    const tok = `fix-${Math.random().toString(36).slice(2)}|${u.user.id}`;
    world.tokens.set(tok, u.user.id);
    return {
      access_token: tok,
      token_type: 'bearer',
      expires_in: 3600,
      user: u.user
    } as T;
  }
  if (rawPath === '/auth/register' && method === 'POST') {
    const { email, password, name, role } = body as { email: string; password: string; name: string; role: string };
    if (world.users.has(email)) fail(409, 'CONFLICT', 'That email already has an account.');
    const user: User = { id: `usr_${Math.random().toString(36).slice(2, 8)}`, email, name, role: role as User['role'], language: 'en' };
    world.users.set(email, { user, password });
    const tok = `fix-${Math.random().toString(36).slice(2)}|${user.id}`;
    world.tokens.set(tok, user.id);
    return { access_token: tok, token_type: 'bearer', expires_in: 3600, user } as T;
  }
  if (rawPath === '/auth/me' && method === 'GET') {
    return currentUser(token) as T;
  }
  if (rawPath === '/auth/sse-token' && method === 'POST') {
    currentUser(token);
    return { token: `fix-sse-${Math.random().toString(36).slice(2, 10)}`, expires_in: 60 } as T;
  }

  // ---- prefs ----
  if (rawPath === '/me/preferences' && method === 'GET') {
    const u = currentUser(token);
    if (!world.prefs.has(u.id)) {
      world.prefs.set(u.id, { user_id: u.id, channels: ['IN_APP'], whatsapp_number: null, quiet_hours_start: null, quiet_hours_end: null, sensitivity: 'NORMAL', language: u.language });
    }
    return world.prefs.get(u.id) as T;
  }
  if (rawPath === '/me/preferences' && method === 'PUT') {
    const u = currentUser(token);
    world.prefs.set(u.id, body as NotificationPrefs);
    return body as T;
  }
  if (rawPath === '/me/push-subscription' && method === 'POST') {
    currentUser(token);
    return { ok: true } as T;
  }

  // ---- health ----
  if (rawPath === '/health' && method === 'GET') {
    return { status: 'ok', contract_version: CONTRACT_VERSION, llm_mode: 'mock', supplier: 'mock', db: 'fixtures' } as T;
  }

  // ---- chat ----
  if (rawPath === '/chat' && method === 'POST') {
    await wait(850);
    return handleChat(body as { message: string; trip_id: string | null; locale: string }) as T;
  }

  // ---- demo ----
  if (rawPath === '/demo/state' && method === 'GET') {
    return { trip_id: 'trip_golden', window: world.sim.window, sim_now: world.sim.simNow, injected: world.sim.injected } as T;
  }
  if (rawPath === '/demo/clock' && method === 'POST') {
    const { window: win } = body as { window: SimWindow };
    world.sim.window = win;
    world.sim.simNow = SIM_WINDOWS[win];
    const trip = tripOr404('trip_golden');
    trip.sim_window = win;
    trip.sim_now = SIM_WINDOWS[win];
    ensureWindowAlerts('trip_golden');
    emit('trip_golden', 'sim.clock', { window: win, sim_now: world.sim.simNow });
    emit('trip_golden', 'slack.updated', slackFor('trip_golden'));
    return { window: win, sim_now: world.sim.simNow } as T;
  }
  if (rawPath === '/demo/inject' && method === 'POST') {
    const inj = body as DemoInject;
    world.sim.injected.push(inj);
    if (inj.kind === 'FLIGHT_DELAY') {
      const minutes = Number(inj.params.minutes ?? 55);
      applyFlightDelay('trip_golden', minutes);
    } else if (inj.kind === 'RAIN') {
      injectRain('trip_golden', Number(inj.params.day ?? 3), String(inj.params.intensity ?? 'HEAVY'));
    } else if (inj.kind === 'BANDH') {
      injectBandh('trip_golden', Number(inj.params.day ?? 2));
    } else if (inj.kind === 'TRAFFIC_JAM') {
      injectJam('trip_golden', Number(inj.params.minutes ?? 25));
    }
    return { signal_ids: world.signals.slice(-1).map((s) => s.id) } as T;
  }
  if (rawPath === '/demo/reset' && method === 'POST') {
    resetFixtures();
    return { ok: true } as T;
  }
  if (rawPath === '/demo/seed-trip' && method === 'POST') {
    return detailFor('trip_golden') as T;
  }
  if (rawPath === '/demo/route' && method === 'GET') {
    return { points: DEMO_ROUTE } as T;
  }

  // ---- trips ----
  if (rawPath === '/trips' && method === 'GET') {
    const u = currentUser(token);
    const mine = world.trips.filter((t) => (t.owner_id === u.id || isMember(t, u.id)) && !t.id.startsWith('trip_adv'));
    return mine.map((t): TripSummary => {
      const s = slackFor(t.id);
      const p = plansFor(t.id);
      const startItem = p.A?.items[0];
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        health: s?.health ?? null,
        start_date: t.intent.start_date ?? null,
        total_cost_inr: p.A?.total_cost_inr ?? null
      };
    }) as T;
  }
  let m: RegExpMatchArray | null;
  if ((m = matchPath(rawPath, '/trips/{id}')) && method === 'GET') {
    return detailFor(m[1]) as T;
  }

  // ---- booking ----
  if ((m = matchPath(rawPath, '/trips/{id}/book')) && method === 'POST') {
    await wait(650);
    const { plan, approve } = body as { plan: 'A' | 'B'; approve: boolean };
    if (!approve) fail(400, 'APPROVAL_REQUIRED', 'Booking needs your explicit approval.', { reason: 'approve must be true' });
    if (idem && world.idem.has(idem)) return world.idem.get(idem) as T;

    if (world.driftPending) {
      world.driftPending = false;
      fail(409, 'PRICE_CHANGED', 'Fare for Cab COK→Munnar changed from ₹4,300 to ₹4,650.', {
        items: [{ item_id: 'it_a_t1', old_inr: 4300, new_inr: 4650 }]
      });
    }

    const trip = tripOr404(m[1]);
    const p = plansFor(m[1]);
    const chosen = plan === 'B' && p.B ? p.B : p.A;
    const simNow = now();
    const created: Booking[] = [];
    chosen.items.forEach((item, i) => {
      const ref = BOOKING_SEED_REFS[i % BOOKING_SEED_REFS.length] ?? `SIM-X-${i}`;
      const isHotel = item.type === 'HOTEL';
      const b = bookingFor(item, chosen.id, trip.id, isHotel ? 'PENDING' : 'CONFIRMED', isHotel ? null : `SIM-${item.type.slice(0, 1)}-${1000 + i}`, simNow);
      created.push(b);
      world.bookings.push(b);
    });
    trip.status = 'BOOKED';
    evidence('BOOKING', 'TBO Sandbox (sim)', `Plan ${plan} booked: ${created.filter((b) => b.status === 'CONFIRMED').length} confirmed, ${created.filter((b) => b.status === 'PENDING').length} pending supplier confirmation.`, { bookings: created.map((b) => b.id) });
    bumpManifest();

    const pending = created.filter((b) => b.status === 'PENDING');
    for (const pb of pending) {
      later(() => {
        pb.status = 'CONFIRMED';
        pb.supplier_ref = 'SIM-H-3011';
        pb.updated_at = now();
        emit(pb.trip_id, 'booking.updated', pb);
        evidence('BOOKING', 'TBO Sandbox (sim)', `Hotel confirmation received (${pb.supplier_ref}).`, { booking_id: pb.id });
        addAlert({
          trip_id: pb.trip_id,
          level: 'INFO',
          window: 'POST_BOOKING',
          title: 'Hotel confirmed',
          body: `Tea Valley Resort is confirmed — ref SIM-H-3011. Vouchers are in the Bookings tab.`,
          provenance: prov('TBO Sandbox (sim)', now())
        });
        bumpManifest();
      }, 20000);
    }

    const result: BookResult = {
      status: pending.length ? 'PENDING' : 'CONFIRMED',
      bookings: created,
      message: pending.length
        ? `${created.length - pending.length} confirmed, ${pending.length} pending supplier confirmation.`
        : `${created.length} confirmed.`
    };
    if (idem) world.idem.set(idem, result);
    emit(trip.id, 'booking.updated', created[0]);
    return result as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/bookings')) && method === 'GET') {
    return tripBookings(m[1]) as T;
  }
  if ((m = matchPath(rawPath, '/bookings/{id}/cancel')) && method === 'POST') {
    await wait(500);
    const b = world.bookings.find((x) => x.id === m![1]);
    if (!b) fail(404, 'NOT_FOUND', 'Booking not found.');
    const req = body as { approve: boolean };
    if (!req.approve) {
      const item = plansFor(b.trip_id).A.items.find((i) => i.id === b.item_id);
      const refundable = b.refundable && (!item?.cancel_by || new Date(item.cancel_by) > new Date(now()));
      fail(400, 'APPROVAL_REQUIRED', refundable ? 'No penalty — this booking is refundable.' : `Cancelling forfeits ₹${b.amount_inr.toLocaleString('en-IN')}.`, {
        penalty_inr: refundable ? 0 : b.amount_inr,
        refundable,
        cancel_by: item?.cancel_by ?? null
      });
    }
    b.status = 'CANCELLED';
    b.penalty_inr = b.refundable ? 0 : b.amount_inr;
    b.updated_at = now();
    emit(b.trip_id, 'booking.updated', b);
    evidence('BOOKING', 'TBO Sandbox (sim)', `Booking ${b.id} cancelled (penalty ₹${(b.penalty_inr ?? 0).toLocaleString('en-IN')}).`, { booking_id: b.id });
    bumpManifest();
    return b as T;
  }
  if ((m = matchPath(rawPath, '/bookings/{id}/modify')) && method === 'POST') {
    await wait(500);
    const b = world.bookings.find((x) => x.id === m![1]);
    if (!b) fail(404, 'NOT_FOUND', 'Booking not found.');
    const req = body as { approve: boolean; new_start?: string | null };
    if (!req.approve) {
      fail(400, 'APPROVAL_REQUIRED', 'Rebooking costs ₹400.', { fee_inr: 400, new_price_inr: b.amount_inr, available: true });
    }
    b.status = 'CONFIRMED';
    b.updated_at = now();
    if (req.new_start) {
      const item = plansFor(b.trip_id).A.items.find((i) => i.id === b.item_id);
      if (item) {
        item.start = req.new_start;
        emit(b.trip_id, 'plan.updated', { plan_id: plansFor(b.trip_id).A.id, kind: 'A', version: plansFor(b.trip_id).A.version, reason: `Booking ${b.id} moved` });
      }
    }
    emit(b.trip_id, 'booking.updated', b);
    return b as T;
  }

  // ---- slack / alerts / signals ----
  if ((m = matchPath(rawPath, '/trips/{id}/slack')) && method === 'GET') {
    return slackFor(m[1]) as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/alerts')) && method === 'GET') {
    const state = qp.get('state');
    const list = tripAlerts(m[1]);
    return (state ? list.filter((a) => a.state === state) : list) as T;
  }
  if ((m = matchPath(rawPath, '/alerts/{id}/ack')) && method === 'POST') {
    const { action } = body as { action: 'APPROVE' | 'DISMISS' | 'SEEN' };
    const a = world.alerts.find((x) => x.id === m![1]);
    if (!a) fail(404, 'NOT_FOUND', 'Alert not found.');
    a.state = action === 'APPROVE' ? 'APPROVED' : action === 'DISMISS' ? 'DISMISSED' : 'SEEN';
    return a as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/signals')) && method === 'GET') {
    const views: SignalView[] = world.signals
      .filter((s) => s.trip_id === m![1])
      .map((s) => ({
        signal: s,
        used_in: tripAlerts(m![1]).filter((a) => a.body.includes(s.summary.slice(0, 20)) || a.provenance.source === s.provenance.source).map((a) => a.id)
      }));
    return views as T;
  }

  // ---- switch + drafts ----
  if ((m = matchPath(rawPath, '/trips/{id}/switch')) && method === 'GET') {
    return (world.switches.get(m![1]) ?? null) as T;
  }
  if ((m = matchPath(rawPath, '/switch/{id}/decision')) && method === 'POST') {
    await wait(800);
    const rec = [...world.switches.values()].find((r) => r.id === m![1]);
    if (!rec) fail(404, 'NOT_FOUND', 'Switch recommendation not found.');
    if (rec.state !== 'PROPOSED') fail(409, 'INVALID_STATE', 'This recommendation is no longer pending.');
    if (idem && world.idem.has(idem)) return world.idem.get(idem) as T;
    const { decision, approve_draft_ids } = body as { decision: 'APPROVE' | 'REJECT'; approve_draft_ids: string[] };
    if (decision === 'REJECT') {
      rec.state = 'REJECTED';
      return { recommendation: rec, trip: tripOr404('trip_golden'), plan_a: plansFor('trip_golden').A, plan_b: plansFor('trip_golden').B, bookings: tripBookings('trip_golden'), drafts: world.drafts, evidence_event_ids: [] } as T;
    }
    if (rec.id === 'sw_1' && rec.trip_id === 'trip_golden') {
      const result = executeSwitch(rec, approve_draft_ids, idem ?? '');
      if (idem) world.idem.set(idem, result);
      return result as T;
    }
    fail(502, 'SUPPLIER_UNAVAILABLE', 'Supplier unavailable — nothing was changed. Plan A is still active.');
  }
  if ((m = matchPath(rawPath, '/trips/{id}/drafts')) && method === 'GET') {
    const lang = qp.get('language');
    const list = world.drafts.filter((d) => d.trip_id === m![1]);
    if (lang && ['en', 'hi', 'hinglish'].includes(lang)) {
      return list.map((d) => ({ ...d, language: lang, body: d.alt[lang] ?? d.body })) as T;
    }
    return list as T;
  }
  if ((m = matchPath(rawPath, '/drafts/{id}/decision')) && method === 'POST') {
    const d = world.drafts.find((x) => x.id === m![1]);
    if (!d) fail(404, 'NOT_FOUND', 'Draft not found.');
    const { decision, body: newBody } = body as { decision: 'APPROVE' | 'EDIT' | 'DISCARD'; body?: string | null };
    if (decision === 'EDIT' && !newBody) fail(422, 'VALIDATION_ERROR', 'EDIT needs a body.');
    if (decision === 'EDIT') d.body = newBody!;
    if (decision === 'APPROVE') d.state = 'APPROVED';
    if (decision === 'DISCARD') d.state = 'DISCARDED';
    return d as T;
  }

  // ---- evidence ----
  if ((m = matchPath(rawPath, '/trips/{id}/evidence')) && method === 'GET') {
    const events = world.evidence;
    const delayEv = world.sim.delayMin;
    const switchExecuted = [...world.switches.values()].some((r) => r.state === 'EXECUTED');
    return {
      trip_id: m![1],
      generated_at: now(),
      events,
      total_delay_min: delayEv,
      extra_cost_inr: switchExecuted ? 1800 : 0,
      claim_sections: [
        {
          type: 'AIRLINE',
          summary: `Flight 6E-207 BLR→COK departed ${world.sim.delayMin > 60 ? '09:40' : '08:35'} vs 07:40 scheduled (${world.sim.delayMin || 0} min delay). Ref SIM-F-7721.`,
          amount_inr: null,
          attachments: ['bk_f1', `sg_${Math.max(1, world.signals.length)}`]
        },
        {
          type: 'SUPPLIER',
          summary: 'Eravikulam NP entry rebooked from 5 Dec 15:00 to 6 Dec 09:00; ₹400 rebooking fee and ₹1,000 original ticket forfeited.',
          amount_inr: 1400,
          attachments: ['bk_e1']
        },
        {
          type: 'INSURANCE',
          summary: 'Trip delay expenses: extra transfer cost and rebooking fees during the disruption.',
          amount_inr: 1800,
          attachments: ['ev_c1']
        }
      ]
    } as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/evidence/print')) && method === 'GET') {
    return detailFor(m![1]) as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/evidence/pdf')) && method === 'GET') {
    fail(501, 'INTERNAL', 'PDF is produced by the print page in fixtures mode (use Print → Save as PDF).');
  }

  // ---- live ----
  if ((m = matchPath(rawPath, '/trips/{id}/live')) && method === 'GET') {
    return liveFor(m![1]) as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/location')) && method === 'POST') {
    const ping = body as { lat: number; lng: number; speed_kmh?: number; ts: string };
    lastPing = { lat: ping.lat, lng: ping.lng, ts: ping.ts };
    return liveFor(m![1]) as T;
  }

  // ---- vouchers ----
  if ((m = matchPath(rawPath, '/trips/{id}/vouchers')) && method === 'GET') {
    const confirmed = tripBookings(m![1]).filter((b) => b.status === 'CONFIRMED');
    const item = (itemId: string) => plansFor(m![1]).A.items.find((i) => i.id === itemId)?.title ?? itemId;
    return confirmed.map((b) => ({
      booking_id: b.id,
      title: item(b.item_id),
      reference: b.supplier_ref ?? '—',
      html_url: `/vouchers/${b.id}`
    })) as T;
  }

  // ---- priorities / rebalance / swap ----
  if ((m = matchPath(rawPath, '/trips/{id}/priorities')) && method === 'PUT') {
    const { priorities } = body as { priorities: Array<{ item_id: string; priority: string }> };
    const p = plansFor(m![1]).A;
    for (const upd of priorities) {
      const item = p.items.find((i) => i.id === upd.item_id);
      if (!item) fail(422, 'VALIDATION_ERROR', `Unknown item ${upd.item_id}.`);
      item.priority = upd.priority as Plan['items'][number]['priority'];
    }
    emit(m![1], 'plan.updated', { plan_id: p.id, kind: 'A', version: p.version, reason: 'Priorities updated' });
    return p as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/rebalance')) && method === 'POST') {
    await wait(450);
    const req = body as { lost_min: number; from_item_id: string; apply: boolean; approve: boolean };
    const p = plansFor(m![1]).A;
    const fromIdx = p.items.findIndex((i) => i.id === req.from_item_id);
    const candidates = p.items
      .slice(fromIdx + 1)
      .filter((i) => i.priority === 'NICE' && !i.fixed && !i.booking);
    const dropped: Array<{ item_id: string; title: string; priority: 'MUST' | 'NICE' | 'SKIP_IF_NEEDED' }> = [];
    let recovered = 0;
    for (const c of candidates) {
      const dur = Math.round((new Date(c.end).getTime() - new Date(c.start).getTime()) / 60000);
      if (recovered >= req.lost_min) break;
      dropped.push({ item_id: c.id, title: c.title, priority: c.priority });
      recovered += dur;
    }
    const previewItems = p.items.filter((i) => !dropped.find((d) => d.item_id === i.id));
    const preview: RebalancePreview = {
      plan_preview: { ...p, items: previewItems, total_cost_inr: previewItems.reduce((s, i) => s + i.price_inr, 0) },
      dropped,
      shortened: [],
      summary: dropped.length
        ? `Dropped ${dropped.map((d) => d.title).join(', ')} to recover ~${recovered} min. All MUST items kept.`
        : 'No NICE items are droppable after this point — nothing to rebalance.',
      applied: false
    };
    if (!req.apply) return preview as T;
    if (!req.approve) fail(400, 'APPROVAL_REQUIRED', 'Applying a rebalance needs your explicit approval.');
    if (idem && world.idem.has(idem)) return world.idem.get(idem) as T;
    p.items = previewItems;
    p.total_cost_inr = preview.plan_preview.total_cost_inr;
    p.version += 1;
    preview.applied = true;
    bumpManifest();
    emit(m![1], 'plan.updated', { plan_id: p.id, kind: 'A', version: p.version, reason: 'Time bank rebalance applied' });
    evidence('SWITCH', 'Time Bank', `Rebalance applied: ${preview.summary}`, {});
    return preview as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/swap-item')) && method === 'POST') {
    await wait(450);
    const req = body as { item_id: string; offer_id: string; apply: boolean; approve: boolean };
    const p = plansFor(m![1]).A;
    const swaps: Record<string, { title: string; price: number; co2: number | null; indoor: boolean }> = {
      offer_top_early: { title: 'Top Station sunrise jeep (07:30 slot)', price: 1400, co2: 3.4, indoor: false },
      offer_spice_local: { title: 'Community spice garden workshop', price: 2200, co2: 1.1, indoor: true },
      offer_factory_heritage: { title: '1905 heritage tea factory tour', price: 400, co2: 0.8, indoor: true }
    };
    const sw = swaps[req.offer_id];
    if (!sw) fail(422, 'VALIDATION_ERROR', 'Unknown alternative offer.');
    const item = p.items.find((i) => i.id === req.item_id);
    if (!item) fail(422, 'VALIDATION_ERROR', 'Unknown item.');
    const deltaCost = sw.price - item.price_inr;
    const deltaCo2 = item.co2_kg !== null && sw.co2 !== null ? sw.co2 - item.co2_kg : null;
    const previewItems = p.items.map((i) =>
      i.id === req.item_id ? { ...i, title: sw.title, price_inr: sw.price, indoor: sw.indoor, co2_kg: sw.co2 } : i
    );
    const preview = {
      plan_preview: { ...p, items: previewItems, total_cost_inr: previewItems.reduce((s, i) => s + i.price_inr, 0) },
      delta_cost_inr: deltaCost,
      delta_co2_kg: deltaCo2,
      lost_items: [],
      changed_booking_item_ids: item.booking ? [item.id] : [],
      summary: `Swap "${item.title}" → "${sw.title}". Delta ${deltaCost >= 0 ? '+' : '−'}₹${Math.abs(deltaCost).toLocaleString('en-IN')}${deltaCo2 !== null ? `, CO₂ ${deltaCo2 >= 0 ? '+' : '−'}${Math.abs(deltaCo2).toFixed(1)} kg` : ''}. Solver re-validates on apply.`,
      applied: false
    };
    if (!req.apply) return preview as T;
    if (!req.approve) fail(400, 'APPROVAL_REQUIRED', 'Applying a swap needs your explicit approval.');
    if (idem && world.idem.has(idem)) return world.idem.get(idem) as T;
    p.items = previewItems;
    p.total_cost_inr = preview.plan_preview.total_cost_inr;
    p.version += 1;
    preview.applied = true;
    bumpManifest();
    emit(m![1], 'plan.updated', { plan_id: p.id, kind: 'A', version: p.version, reason: 'Responsible alternative applied' });
    return preview as T;
  }

  // ---- optionality / responsible ----
  if ((m = matchPath(rawPath, '/trips/{id}/optionality')) && method === 'GET') {
    return optionalityReport(m![1]) as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/responsible')) && method === 'GET') {
    return responsibleReport(m![1]) as T;
  }

  // ---- group ----
  if ((m = matchPath(rawPath, '/trips/{id}/group')) && method === 'POST') {
    const u = currentUser(token);
    const t = tripOr404(m![1]);
    if (t.owner_id !== u.id) fail(403, 'FORBIDDEN', 'Only the trip owner can create the group.');
    if (world.groups.has(m![1])) fail(409, 'CONFLICT', 'This trip already has a group.');
    const g: Group = {
      id: `grp_${world.groups.size + 1}`,
      trip_id: m![1],
      invite_code: Math.random().toString(36).slice(2, 10).toUpperCase(),
      members: [{ user_id: u.id, name: u.name, role: 'OWNER', location_sharing: false, joined_at: now() }],
      created_at: now()
    };
    world.groups.set(m![1], g);
    return g as T;
  }
  if (rawPath === '/groups/join' && method === 'POST') {
    const { invite_code } = body as { invite_code: string };
    const u = currentUser(token);
    const g = [...world.groups.values()].find((x) => x.invite_code === invite_code.toUpperCase());
    if (!g) fail(404, 'NOT_FOUND', 'Unknown invite code.');
    if (g.members.length >= 5) fail(409, 'CONFLICT', 'Group is full (max 5 members).');
    if (!g.members.find((x) => x.user_id === u.id)) {
      g.members.push({ user_id: u.id, name: u.name, role: 'MEMBER', location_sharing: false, joined_at: now() });
      emit(g.trip_id, 'group.updated', g);
    }
    return g as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/group')) && method === 'GET') {
    const g = world.groups.get(m![1]);
    if (!g) fail(404, 'NOT_FOUND', 'No group on this trip yet.');
    return g as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/group/preferences')) && method === 'PUT') {
    const pref = body as GroupPreference;
    world.groupPrefs.set(pref.user_id, pref);
    return mergedPrefs(m![1]) as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/group/merged')) && method === 'GET') {
    return mergedPrefs(m![1]) as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/votes')) && method === 'POST') {
    const u = currentUser(token);
    const { plan_id, vote } = body as { plan_id: string; vote: 'A' | 'B' | 'NEITHER' };
    world.votes.set(u.id, { user_id: u.id, plan_id, vote });
    const tally = voteTally(m![1]);
    emit(m![1], 'vote.updated', tally);
    return tally as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/votes')) && method === 'GET') {
    return voteTally(m![1]) as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/split')) && method === 'GET') {
    const method = (qp.get('method') as 'EQUAL' | 'BY_BUDGET') ?? 'EQUAL';
    return splitReport(m![1], method) as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/regroup')) && method === 'GET') {
    if (m![1] === 'trip_g1' && world.sim.jamMin > 0) {
      return {
        reason: 'Meera is 35 min behind on the Madikeri road; the rest of you are already at Abbey Falls parking.',
        point: { name: 'Abbey Falls parking', lat: 12.5665, lng: 75.696 },
        meet_by: dt('13', '10:45'),
        member_etas_min: { usr_g1: 2, usr_g2: 5, usr_g3: 35, usr_g4: 8 },
        affected_user_ids: ['usr_g3']
      } as T;
    }
    return null as T;
  }

  // ---- safety ----
  if ((m = matchPath(rawPath, '/trips/{id}/trusted-contacts')) && method === 'GET') {
    return (world.contacts.get(m![1]) ?? []) as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/trusted-contacts')) && method === 'POST') {
    const u = currentUser(token);
    const list = world.contacts.get(m![1]) ?? [];
    if (list.length >= 5) fail(409, 'CONFLICT', 'Maximum 5 trusted contacts.');
    const { name, phone, email } = body as { name: string; phone?: string | null; email?: string | null };
    if (!name?.trim()) fail(422, 'VALIDATION_ERROR', 'Name is required.');
    const c: TrustedContact = { id: `tc_${Math.random().toString(36).slice(2, 8)}`, trip_id: m![1], name: name.trim(), phone: phone ?? null, email: email ?? null };
    list.push(c);
    world.contacts.set(m![1], list);
    return c as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/safe-checkins')) && method === 'POST') {
    const { item_id, due_at } = body as { item_id: string; due_at: string };
    const list = world.checkins.get(m![1]) ?? [];
    const c: SafeCheckin = { id: `sc_${Math.random().toString(36).slice(2, 8)}`, trip_id: m![1], item_id, due_at, state: 'PENDING' };
    list.push(c);
    world.checkins.set(m![1], list);
    return c as T;
  }
  if ((m = matchPath(rawPath, '/safe-checkins/{id}/confirm')) && method === 'POST') {
    for (const list of world.checkins.values()) {
      const c = list.find((x) => x.id === m![1]);
      if (c) {
        c.state = 'CONFIRMED';
        return c as T;
      }
    }
    fail(404, 'NOT_FOUND', 'Check-in not found.');
  }
  if ((m = matchPath(rawPath, '/trips/{id}/sos')) && method === 'POST') {
    const u = currentUser(token);
    const contacts = world.contacts.get(m![1]) ?? [];
    return { notified: contacts.map((c) => c.name), queued: false } as T;
  }

  // ---- share ----
  if ((m = matchPath(rawPath, '/trips/{id}/share')) && method === 'POST') {
    const u = currentUser(token);
    const t = tripOr404(m![1]);
    if (t.owner_id !== u.id) fail(403, 'FORBIDDEN', 'Only the trip owner can create share links.');
    const { ttl_hours } = (body as { ttl_hours?: number }) ?? {};
    const token32 = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const link: ShareLink = {
      token: token32,
      url: `/share/${token32}`,
      expires_at: new Date(new Date(now()).getTime() + (ttl_hours ?? 24) * 3600000).toISOString(),
      active: true
    };
    const list = world.shareLinks.get(m![1]) ?? [];
    list.push(link);
    world.shareLinks.set(m![1], list);
    return link as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/share')) && method === 'DELETE') {
    const list = world.shareLinks.get(m![1]) ?? [];
    for (const l of list) l.active = false;
    return { ok: true } as T;
  }
  if ((m = matchPath(rawPath, '/share/{token}')) && method === 'GET') {
    for (const [tripId, links] of world.shareLinks) {
      const l = links.find((x) => x.token === m![1]);
      if (l && l.active && new Date(l.expires_at) > new Date(now())) {
        const t = tripOr404(tripId);
        const s = slackFor(tripId);
        const p = plansFor(tripId);
        const simNow = t.sim_now ?? now();
        const upcoming = p.A?.items.find((i) => new Date(i.end).getTime() > new Date(simNow).getTime());
        return {
          title: t.title,
          health: s?.health ?? 'GREEN',
          next_stop: upcoming?.place?.name ?? upcoming?.title ?? null,
          eta: upcoming ? upcoming.start : null,
          last_location_name: lastPing ? 'Kochi → Munnar road' : t.intent.destination ?? null,
          as_of: simNow
        } as T;
      }
    }
    fail(404, 'NOT_FOUND', 'This link has expired or was revoked.');
  }

  // ---- offline ----
  if ((m = matchPath(rawPath, '/trips/{id}/offline-manifest')) && method === 'GET') {
    return offlineManifest(m![1]) as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/offline-pack')) && method === 'GET') {
    return offlinePack(m![1]) as T;
  }

  // ---- advisor ----
  if (rawPath === '/advisor/trips' && method === 'GET') {
    currentUser(token);
    const sev = { RED: 0, AMBER: 1, GREEN: 2 } as const;
    const rows = advisorSeedsRef.map((s) => ({
      trip_id: s.trip.id,
      traveller_name: s.row.traveller_name,
      title: s.trip.title,
      status: s.trip.status,
      health: s.row.health,
      score: s.row.score,
      next_risk: s.row.next_risk,
      unread_alerts: s.row.unread_alerts,
      start_date: s.trip.intent.start_date ?? null,
      has_consent: s.row.consent
    }));
    return rows.sort((a, b) => sev[a.health] - sev[b.health] || a.score - b.score) as T;
  }
  if ((m = matchPath(rawPath, '/advisor/trips/{id}')) && method === 'GET') {
    const detail = detailFor(m![1]);
    return { detail, notes: world.notes.get(m![1]) ?? [] } as T;
  }
  if ((m = matchPath(rawPath, '/advisor/trips/{id}/notes')) && method === 'POST') {
    const u = currentUser(token);
    const { body: noteBody } = body as { body: string };
    const note: AdvisorNote = {
      id: `an_${Math.random().toString(36).slice(2, 8)}`,
      trip_id: m![1],
      advisor_id: u.id,
      body: noteBody,
      created_at: now()
    };
    const list = world.notes.get(m![1]) ?? [];
    list.push(note);
    world.notes.set(m![1], list);
    return note as T;
  }
  if ((m = matchPath(rawPath, '/trips/{id}/advisor')) && method === 'POST') {
    const u = currentUser(token);
    const t = tripOr404(m![1]);
    if (t.owner_id !== u.id) fail(403, 'FORBIDDEN', 'Only the trip owner can invite an advisor.');
    const { advisor_email, consent_to_act } = body as { advisor_email: string; consent_to_act: boolean };
    const adv = world.users.get(advisor_email);
    if (!adv) fail(404, 'NOT_FOUND', 'No advisor with that email.');
    t.advisor_id = adv.user.id;
    t.advisor_consent = consent_to_act;
    evidence('NOTE', 'Audit', `Advisor ${advisor_email} invited${consent_to_act ? ' with consent to act' : ' (read-only)'}.`, {});
    return t as T;
  }

  fail(404, 'NOT_FOUND', `No fixture handler for ${method} ${rawPath}`);
}

function matchPath(path: string, pattern: string): RegExpMatchArray | null {
  const re = new RegExp('^' + pattern.replace(/\{[^}]+\}/g, '([^/]+)') + '$');
  return path.match(re);
}

function isMember(t: Trip, userId: string): boolean {
  const g = world.groups.get(t.id);
  return !!g?.members.find((m) => m.user_id === userId);
}
