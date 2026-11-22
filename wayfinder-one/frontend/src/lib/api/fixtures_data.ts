import type {
  Alert,
  Booking,
  CourtesyDraft,
  DestinationOption,
  Plan,
  PlanItem,
  Provenance,
  Signal,
  Trip
} from '@contracts/types';
import goldenPlanAJson from '@contracts/fixtures/golden_plan_a.json';

/**
 * Fixtures world seed (P1 fixtures mode, A4/A7).
 * Every number follows B5/B6: prices are simulated and fictional, and every datum
 * carries provenance with is_simulated=true — the UI labels it with SimBadge.
 */

export const GOLDEN_PLAN_A = goldenPlanAJson as unknown as Plan;

const SIM_NOW_BASE = '2026-11-22T10:00:00+05:30';

export const SIM_WINDOWS: Record<string, string> = {
  POST_BOOKING: '2026-12-01T10:00:00+05:30',
  'T-72H': '2026-12-02T07:40:00+05:30',
  'T-24H': '2026-12-04T07:40:00+05:30',
  'T-3H': '2026-12-05T04:40:00+05:30',
  LIVE: '2026-12-05T10:20:00+05:30'
};

export function prov(source: string, checkedAt: string, confidence = 1): Provenance {
  return { source, checked_at: checkedAt, is_simulated: true, confidence };
}

export const TBO_PROV = () => prov('TBO Sandbox (sim)', SIM_NOW_BASE);

export function dt(day: string, hm: string): string {
  return `2026-12-${day}T${hm}:00+05:30`;
}

interface ItemArgs {
  id: string;
  type: PlanItem['type'];
  title: string;
  day: number;
  start: string;
  end: string;
  price: number;
  refundable?: boolean;
  cancelBy?: string | null;
  priority?: PlanItem['priority'];
  fixed?: boolean;
  hardDeadline?: string | null;
  dependsOn?: string[];
  riskTags?: PlanItem['risk_tags'];
  indoor?: boolean;
  rebookFee?: number | null;
  origin?: PlanItem['origin'];
  place?: PlanItem['place'];
  co2?: number | null;
}

export function makeItem(a: ItemArgs, checkedAt = SIM_NOW_BASE): PlanItem {
  return {
    id: a.id,
    type: a.type,
    title: a.title,
    day: a.day,
    start: a.start,
    end: a.end,
    origin: a.origin ?? null,
    place: a.place ?? null,
    price_inr: a.price,
    price_provenance: prov('TBO Sandbox (sim)', checkedAt),
    refundable: a.refundable ?? false,
    cancel_by: a.cancelBy ?? null,
    priority: a.priority ?? 'NICE',
    fixed: a.fixed ?? false,
    hard_deadline: a.hardDeadline ?? null,
    depends_on: a.dependsOn ?? [],
    risk_tags: a.riskTags ?? [],
    indoor: a.indoor ?? false,
    co2_kg: a.co2 ?? null,
    rebook_fee_inr: a.rebookFee ?? null,
    booking: null
  };
}

const P = {
  COK: { name: 'Kochi Airport (COK)', lat: 10.152, lng: 76.4019 },
  MUN: { name: 'Munnar', lat: 10.0889, lng: 77.0595 },
  ERA: { name: 'Eravikulam National Park', lat: 10.1667, lng: 77.05 },
  HOT: { name: 'Tea Valley Resort, Munnar', lat: 10.087, lng: 77.062 },
  TEA: { name: 'Tea Museum, Munnar', lat: 10.0866, lng: 77.0586 },
  MAT: { name: 'Mattupetty Dam', lat: 10.1065, lng: 77.1241 },
  LAK: { name: 'Lakkam Waterfalls', lat: 10.097, lng: 77.148 },
  TOP: { name: 'Top Station', lat: 10.1209, lng: 77.2339 },
  SPA: { name: 'Spice plantation, Munnar', lat: 10.1012, lng: 77.0983 },
  FAC: { name: 'Kannan Devan Tea Factory', lat: 10.0792, lng: 77.0605 }
};

/** Plan B for the golden trip (B5): same flights/hotel, later cab, rain-safe days. */
export function makeGoldenPlanB(version = 1, checkedAt = SIM_NOW_BASE): Plan {
  const items: PlanItem[] = [
    makeItem(
      {
        id: 'it_b_f1',
        type: 'FLIGHT',
        title: 'Flight BLR→COK (sim)',
        day: 1,
        start: dt('05', '07:40'),
        end: dt('05', '09:05'),
        price: 8600,
        fixed: true,
        priority: 'MUST',
        origin: { name: 'Bengaluru Airport (BLR)', lat: 13.1986, lng: 77.7066 },
        place: P.COK
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_b_t1',
        type: 'TRANSFER',
        title: 'Cab COK→Munnar (late start)',
        day: 1,
        start: dt('05', '10:30'),
        end: dt('05', '15:00'),
        price: 4300,
        refundable: true,
        cancelBy: dt('04', '10:30'),
        priority: 'MUST',
        riskTags: ['GHAT_ROAD'],
        dependsOn: ['it_b_f1'],
        origin: P.COK,
        place: P.MUN
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_b_h1',
        type: 'HOTEL',
        title: 'Tea Valley Resort, 4 nights',
        day: 1,
        start: dt('05', '15:30'),
        end: dt('05', '20:00'),
        price: 16000,
        refundable: true,
        cancelBy: dt('03', '18:00'),
        priority: 'MUST',
        hardDeadline: dt('05', '20:00'),
        dependsOn: ['it_b_t1'],
        place: P.HOT
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_b_e1',
        type: 'ACTIVITY',
        title: 'Eravikulam NP timed entry (Sun morning)',
        day: 2,
        start: dt('06', '09:00'),
        end: dt('06', '11:00'),
        price: 1000,
        fixed: true,
        priority: 'MUST',
        riskTags: ['RAIN'],
        hardDeadline: dt('06', '09:45'),
        rebookFee: 400,
        place: P.ERA
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_b_tm',
        type: 'ACTIVITY',
        title: 'Tea Museum',
        day: 2,
        start: dt('06', '13:30'),
        end: dt('06', '15:00'),
        price: 400,
        indoor: true,
        place: P.TEA
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_b_sp',
        type: 'ACTIVITY',
        title: 'Spice plantation + cooking class',
        day: 3,
        start: dt('07', '09:30'),
        end: dt('07', '13:00'),
        price: 2000,
        indoor: true,
        priority: 'MUST',
        place: P.SPA
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_b_tf',
        type: 'ACTIVITY',
        title: 'Tea factory tour',
        day: 4,
        start: dt('08', '10:00'),
        end: dt('08', '12:00'),
        price: 1200,
        indoor: true,
        place: P.FAC
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_b_t2',
        type: 'TRANSFER',
        title: 'Cab Munnar→COK',
        day: 5,
        start: dt('09', '10:00'),
        end: dt('09', '14:30'),
        price: 4300,
        refundable: true,
        cancelBy: dt('08', '10:00'),
        priority: 'MUST',
        riskTags: ['GHAT_ROAD'],
        origin: P.MUN,
        place: P.COK
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_b_f2',
        type: 'FLIGHT',
        title: 'Flight COK→BLR (sim)',
        day: 5,
        start: dt('09', '17:35'),
        end: dt('09', '19:00'),
        price: 7800,
        fixed: true,
        priority: 'MUST',
        origin: P.COK,
        place: { name: 'Bengaluru Airport (BLR)', lat: 13.1986, lng: 77.7066 },
        dependsOn: ['it_b_t2']
      },
      checkedAt
    )
  ];
  const total = items.reduce((s, i) => s + i.price_inr, 0);
  return {
    id: 'plan_b1',
    trip_id: 'trip_golden',
    kind: 'B',
    version,
    items,
    total_cost_inr: total,
    validation: {
      feasible: true,
      checks: [
        { name: 'budget', passed: true, detail: `₹${total.toLocaleString('en-IN')} of ₹55,000` },
        {
          name: 'hard_connection:it_b_e1',
          passed: true,
          detail: 'Hotel base to Eravikulam entry: 45 min buffer before the 09:45 last entry'
        },
        {
          name: 'no_night_ghat',
          passed: true,
          detail: 'Both ghat transfers end before 18:00'
        },
        {
          name: 'rain_safe',
          passed: true,
          detail: 'Day 3 and Day 4 activities are indoor or rain-safe'
        }
      ],
      min_slack_min: 45,
      budget_headroom_inr: 55000 - total,
      feasibility: 0.94,
      solver: 'fixture',
      solve_ms: 0
    },
    summary: 'Rain-safe variant: same flights and hotel, slower mornings, indoor options on wet days.',
    created_at: SIM_NOW_BASE,
    superseded: false
  };
}

/** Mixed plan that becomes Plan A v2 when the traveller approves the switch (B5 step 5–7). */
export function makeSwitchResultPlan(version = 2, delayMin = 55, checkedAt = SIM_NOW_BASE): Plan {
  const flightStart = dt('05', '07:40');
  const d = (t: string) => shiftTime(t, delayMin);
  const items: PlanItem[] = [
    makeItem(
      {
        id: 'it_a_f1',
        type: 'FLIGHT',
        title: 'Flight BLR→COK (sim, delayed)',
        day: 1,
        start: d(flightStart),
        end: d(dt('05', '09:05')),
        price: 8600,
        fixed: true,
        priority: 'MUST',
        origin: { name: 'Bengaluru Airport (BLR)', lat: 13.1986, lng: 77.7066 },
        place: P.COK
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_a_t1',
        type: 'TRANSFER',
        title: 'Cab COK→Munnar (rebooked)',
        day: 1,
        start: shiftTime(dt('05', '10:30'), delayMin > 60 ? delayMin - 60 : 0),
        end: shiftTime(dt('05', '15:00'), delayMin > 60 ? delayMin - 60 : 0),
        price: 4300,
        refundable: true,
        priority: 'MUST',
        riskTags: ['GHAT_ROAD'],
        dependsOn: ['it_a_f1'],
        origin: P.COK,
        place: P.MUN
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_a_h1',
        type: 'HOTEL',
        title: 'Tea Valley Resort, 4 nights',
        day: 1,
        start: shiftTime(dt('05', '15:30'), delayMin > 60 ? delayMin - 60 : 0),
        end: dt('05', '20:00'),
        price: 16000,
        refundable: true,
        cancelBy: dt('03', '18:00'),
        priority: 'MUST',
        hardDeadline: dt('05', '20:00'),
        dependsOn: ['it_a_t1'],
        place: P.HOT
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_a_e1b',
        type: 'ACTIVITY',
        title: 'Eravikulam NP timed entry (rebooked, Sun slot)',
        day: 2,
        start: dt('06', '09:00'),
        end: dt('06', '11:00'),
        price: 1400,
        fixed: true,
        priority: 'MUST',
        riskTags: ['RAIN'],
        hardDeadline: dt('06', '09:45'),
        rebookFee: 400,
        place: P.ERA
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_a_tm',
        type: 'ACTIVITY',
        title: 'Tea Museum (afternoon slot)',
        day: 2,
        start: dt('06', '13:30'),
        end: dt('06', '15:00'),
        price: 400,
        indoor: true,
        place: P.TEA
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_a_wf',
        type: 'ACTIVITY',
        title: 'Lakkam waterfall guided trek',
        day: 3,
        start: dt('07', '08:30'),
        end: dt('07', '13:00'),
        price: 1600,
        priority: 'MUST',
        riskTags: ['RAIN'],
        place: P.LAK
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_a_ts',
        type: 'ACTIVITY',
        title: 'Top Station sunset point (jeep)',
        day: 4,
        start: dt('08', '16:00'),
        end: dt('08', '19:00'),
        price: 1400,
        priority: 'NICE',
        riskTags: ['RAIN', 'CROWD'],
        place: P.TOP
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_a_t2',
        type: 'TRANSFER',
        title: 'Cab Munnar→COK',
        day: 5,
        start: dt('09', '10:00'),
        end: dt('09', '14:30'),
        price: 4300,
        refundable: true,
        cancelBy: dt('08', '10:00'),
        priority: 'MUST',
        riskTags: ['GHAT_ROAD'],
        origin: P.MUN,
        place: P.COK
      },
      checkedAt
    ),
    makeItem(
      {
        id: 'it_a_f2',
        type: 'FLIGHT',
        title: 'Flight COK→BLR (sim)',
        day: 5,
        start: dt('09', '17:35'),
        end: dt('09', '19:00'),
        price: 7800,
        fixed: true,
        priority: 'MUST',
        origin: P.COK,
        place: { name: 'Bengaluru Airport (BLR)', lat: 13.1986, lng: 77.7066 },
        dependsOn: ['it_a_t2']
      },
      checkedAt
    )
  ];
  const total = items.reduce((s, i) => s + i.price_inr, 0);
  return {
    id: 'plan_a1',
    trip_id: 'trip_golden',
    kind: 'A',
    version,
    items,
    total_cost_inr: total,
    validation: {
      feasible: true,
      checks: [
        { name: 'budget', passed: true, detail: `₹${total.toLocaleString('en-IN')} of ₹55,000` },
        {
          name: 'hard_connection:it_a_e1b',
          passed: true,
          detail: 'Hotel base to Eravikulam entry: 30 min buffer before the 09:45 last entry'
        },
        { name: 'no_night_ghat', passed: true, detail: 'Both ghat transfers end before 18:00' }
      ],
      min_slack_min: 30,
      budget_headroom_inr: 55000 - total,
      feasibility: 0.93,
      solver: 'fixture',
      solve_ms: 0
    },
    summary:
      'Plan A v2 (MIXED): Day-1 afternoon kept calm, Eravikulam rebooked to Sunday 09:00, everything else kept from Plan A.',
    created_at: checkedAt,
    superseded: false
  };
}

/** Shift an ISO +05:30 wall-clock time by N minutes, returning the same format. */
function shiftTime(iso: string, minutes: number): string {
  const shifted = new Date(iso).getTime() + minutes * 60000;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(shifted));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00+05:30`;
}

export const GOLDEN_TRIP: Trip = {
  id: 'trip_golden',
  title: 'Munnar: tea estates & waterfalls',
  status: 'PLANNED',
  intent: {
    origin: 'Bengaluru',
    destination: 'Munnar',
    start_date: '2026-12-05',
    nights: 4,
    travellers: 2,
    budget_inr: 55000,
    interests: ['tea estates', 'waterfalls', 'sunsets'],
    constraints: ['no night ghat driving'],
    pace: 'BALANCED',
    must_dos: [],
    missing: []
  },
  active_plan: 'A',
  plan_a_id: 'plan_a1',
  plan_b_id: 'plan_b1',
  sim_now: null,
  sim_window: null,
  owner_id: 'usr_demo',
  group_id: null,
  advisor_id: null,
  advisor_consent: false,
  created_at: SIM_NOW_BASE
};

export const DESTINATION_OPTIONS: DestinationOption[] = [
  {
    name: 'Munnar, Kerala',
    why: 'Tea estates, waterfalls and sunsets — matches your interests; ghat roads manageable in daylight.',
    est_budget_inr: 46300,
    available: true
  },
  {
    name: 'Coorg, Karnataka',
    why: 'Coffee country with river walks; easy drive from Bengaluru.',
    est_budget_inr: 46301,
    available: true
  },
  {
    name: 'Hampi, Karnataka',
    why: 'Boulder-strewn ruins and golden evenings; winter is the best season.',
    est_budget_inr: 38500,
    available: true
  },
  {
    name: 'Goa (South)',
    why: 'Quiet beaches in December; flights are priced higher close to the holidays.',
    est_budget_inr: 62000,
    available: true
  },
  {
    name: 'Kerala circuit (Kochi → Munnar → Alleppey)',
    why: 'Multi-stop: backwaters after the hills; the planner handles inter-city transfers.',
    est_budget_inr: 71000,
    available: true
  },
  {
    name: 'Wayanad, Kerala',
    why: 'Rainforests and caves.',
    est_budget_inr: 41000,
    available: false
  }
];

/* ---------- Coorg group trip (S-G) ---------- */

const CG = {
  BLR: { name: 'Bengaluru (Mekhri Circle pickup)', lat: 13.0133, lng: 77.5807 },
  MAD: { name: 'Madikeri, Coorg', lat: 12.4242, lng: 75.7382 },
  ABB: { name: 'Abbey Falls', lat: 12.5671, lng: 75.6951 },
  DUB: { name: 'Dubare Elephant Camp', lat: 12.4444, lng: 75.7564 },
  RAJ: { name: "Raja's Seat", lat: 12.4225, lng: 75.7355 },
  TAL: { name: 'Talakaveri', lat: 12.4525, lng: 75.6453 },
  PLA: { name: 'Coffee plantation, Madikeri', lat: 12.418, lng: 75.729 },
  RAFT: { name: 'Barapole River rafting', lat: 12.3995, lng: 75.6639 },
  TAD: { name: 'Tadiandamol trailhead', lat: 12.5431, lng: 75.7046 },
  BYL: { name: 'Bylakuppe Golden Temple', lat: 12.3906, lng: 75.9766 },
  SAF: { name: 'Nagarhole safari gate', lat: 12.2806, lng: 76.5214 }
};

export function makeCoorgPlans(): { a: Plan; b: Plan } {
  const aItems: PlanItem[] = [
    makeItem({
      id: 'cg_t1',
      type: 'TRANSFER',
      title: 'Cab BLR→Madikeri',
      day: 1,
      start: dt('12', '06:00'),
      end: dt('12', '12:00'),
      price: 6500,
      refundable: true,
      cancelBy: dt('11', '06:00'),
      priority: 'MUST',
      origin: CG.BLR,
      place: CG.MAD,
      co2: 41.2
    }),
    makeItem({
      id: 'cg_h1',
      type: 'HOTEL',
      title: 'Plantation homestay, Madikeri — 3 nights',
      day: 1,
      start: dt('12', '13:00'),
      end: dt('12', '20:00'),
      price: 18001,
      refundable: true,
      cancelBy: dt('10', '18:00'),
      priority: 'MUST',
      hardDeadline: dt('12', '20:00'),
      place: CG.MAD
    }),
    makeItem({ id: 'cg_a1', type: 'ACTIVITY', title: "Raja's Seat sunset", day: 1, start: dt('12', '17:15'), end: dt('12', '18:30'), price: 200, place: CG.RAJ }),
    makeItem({ id: 'cg_a2', type: 'ACTIVITY', title: 'Abbey Falls walk', day: 2, start: dt('13', '08:30'), end: dt('13', '10:30'), price: 300, riskTags: ['CROWD'], place: CG.ABB }),
    makeItem({ id: 'cg_a3', type: 'ACTIVITY', title: 'Dubare elephant camp', day: 2, start: dt('13', '11:30'), end: dt('13', '13:30'), price: 900, priority: 'NICE', place: CG.DUB }),
    makeItem({ id: 'cg_a4', type: 'ACTIVITY', title: 'Coffee plantation tour', day: 2, start: dt('13', '15:30'), end: dt('13', '17:00'), price: 1200, place: CG.PLA }),
    makeItem({ id: 'cg_a5', type: 'ACTIVITY', title: 'Talakaveri sunrise drive', day: 3, start: dt('14', '05:45'), end: dt('14', '09:00'), price: 400, priority: 'MUST', place: CG.TAL }),
    makeItem({ id: 'cg_a6', type: 'ACTIVITY', title: 'Barapole rafting (grade 2–3)', day: 3, start: dt('14', '10:30'), end: dt('14', '13:00'), price: 1500, riskTags: ['RAIN'], place: CG.RAFT }),
    makeItem({ id: 'cg_a7', type: 'ACTIVITY', title: 'Tadiandamol half-trek', day: 3, start: dt('14', '15:30'), end: dt('14', '18:00'), price: 1800, priority: 'NICE', riskTags: ['RAIN'], place: CG.TAD }),
    makeItem({ id: 'cg_a8', type: 'ACTIVITY', title: 'Bylakuppe Golden Temple', day: 4, start: dt('15', '09:30'), end: dt('15', '11:30'), price: 300, indoor: true, place: CG.BYL }),
    makeItem({ id: 'cg_a9', type: 'ACTIVITY', title: 'Nagarhole safari', day: 4, start: dt('15', '14:00'), end: dt('15', '16:00'), price: 1800, priority: 'NICE', place: CG.SAF }),
    makeItem({ id: 'cg_a10', type: 'ACTIVITY', title: 'Homestay BBQ night', day: 4, start: dt('15', '19:30'), end: dt('15', '22:00'), price: 2700, indoor: true }),
    makeItem({
      id: 'cg_t2',
      type: 'TRANSFER',
      title: 'Cab Madikeri→BLR',
      day: 5,
      start: dt('16', '07:00'),
      end: dt('16', '13:00'),
      price: 6500,
      refundable: true,
      cancelBy: dt('15', '07:00'),
      priority: 'MUST',
      origin: CG.MAD,
      place: CG.BLR,
      co2: 41.2
    })
  ];
  const bItems: PlanItem[] = aItems.map((it) =>
    it.id === 'cg_a7'
      ? makeItem({
          id: 'cg_b7',
          type: 'ACTIVITY',
          title: 'Indoor cupping session + spa evening',
          day: 3,
          start: dt('14', '15:30'),
          end: dt('14', '18:00'),
          price: 1600,
          indoor: true,
          place: CG.PLA
        })
      : it.id === 'cg_a6'
        ? { ...it, id: 'cg_b6', title: 'Plantation kitchen workshop (rain-safe)', risk_tags: [], indoor: true, place: CG.PLA }
        : { ...it }
  );
  const mk = (items: PlanItem[], kind: 'A' | 'B', id: string): Plan => {
    const total = items.reduce((s, i) => s + i.price_inr, 0);
    return {
      id,
      trip_id: 'trip_g1',
      kind,
      version: 1,
      items,
      total_cost_inr: kind === 'A' ? 46301 : total,
      validation: {
        feasible: true,
        checks: [
          { name: 'budget', passed: true, detail: `₹${total.toLocaleString('en-IN')} of ₹48,000 pooled` },
          { name: 'daily_hours', passed: true, detail: 'No day exceeds 10 h of activity' }
        ],
        min_slack_min: 40,
        budget_headroom_inr: 48000 - total,
        feasibility: kind === 'A' ? 0.9 : 0.92,
        solver: 'fixture',
        solve_ms: 0
      },
      summary:
        kind === 'A'
          ? 'Coorg for 4: coffee, waterfalls and one big trek, split four ways.'
          : 'Rain-safe Coorg: same stays and transfers, indoor swaps on wet afternoons.',
      created_at: SIM_NOW_BASE,
      superseded: false
    };
  };
  return { a: mk(aItems, 'A', 'plan_cg1'), b: mk(bItems, 'B', 'plan_cg2') };
}

export const GROUP_TRIP: Trip = {
  id: 'trip_g1',
  title: 'Coorg with the crew',
  status: 'PLANNED',
  intent: {
    origin: 'Bengaluru',
    destination: 'Coorg',
    start_date: '2026-12-12',
    nights: 3,
    travellers: 4,
    budget_inr: 12000,
    interests: ['coffee', 'waterfalls', 'adventure'],
    constraints: ['vegetarian'],
    pace: 'BALANCED',
    must_dos: ['Abbey Falls'],
    missing: []
  },
  active_plan: 'A',
  plan_a_id: 'plan_cg1',
  plan_b_id: 'plan_cg2',
  sim_now: null,
  sim_window: null,
  owner_id: 'usr_g1',
  group_id: 'grp_1',
  advisor_id: null,
  advisor_consent: false,
  created_at: SIM_NOW_BASE
};

/* ---------- Advisor client trips (S-A) ---------- */

export interface AdvisorSeed {
  trip: Trip;
  plan: Plan;
  row: {
    traveller_name: string;
    health: 'GREEN' | 'AMBER' | 'RED';
    score: number;
    next_risk: string;
    unread_alerts: number;
    consent: boolean;
  };
}

export function makeAdvisorSeeds(): AdvisorSeed[] {
  const defs = [
    { name: 'Kabir Shah', title: 'Goa long weekend', dest: 'Goa', health: 'RED', score: 38, risk: 'Flight delayed 120 min — check-in cut-off at risk', unread: 3, consent: false, day: 18 },
    { name: 'Ananya Rao', title: 'Hampi heritage trail', dest: 'Hampi', health: 'AMBER', score: 61, risk: 'Crowd peak at Vitthala Temple on Saturday', unread: 1, consent: true, day: 20 },
    { name: 'Vihaan Iyer', title: 'Munnar in December', dest: 'Munnar', health: 'GREEN', score: 84, risk: 'None flagged for the next 72 h', unread: 0, consent: false, day: 5 },
    { name: 'Sara Menon', title: 'Alleppey backwaters', dest: 'Alleppey', health: 'RED', score: 31, risk: 'Houseboat confirmation overdue with supplier', unread: 2, consent: true, day: 22 },
    { name: 'Arjun Bose', title: 'Coorg coffee break', dest: 'Coorg', health: 'AMBER', score: 57, risk: 'Rain band on Day 2 — Plan B ready', unread: 1, consent: false, day: 12 },
    { name: 'Ira Krishnan', title: 'Kochi food weekend', dest: 'Kochi', health: 'GREEN', score: 88, risk: 'None flagged for the next 72 h', unread: 0, consent: false, day: 26 }
  ] as const;

  return defs.map((d, idx) => {
    const tripId = `trip_adv${idx + 1}`;
    const items: PlanItem[] = [
      makeItem({
        id: `av${idx}_t1`,
        type: 'TRANSFER',
        title: `Cab ${d.dest} airport → stay`,
        day: 1,
        start: dt(String(d.day).padStart(2, '0'), '10:30'),
        end: dt(String(d.day).padStart(2, '0'), '12:00'),
        price: 2800,
        refundable: true,
        priority: 'MUST'
      }),
      makeItem({
        id: `av${idx}_h1`,
        type: 'HOTEL',
        title: `${d.dest} stay, 2 nights`,
        day: 1,
        start: dt(String(d.day).padStart(2, '0'), '13:00'),
        end: dt(String(d.day).padStart(2, '0'), '20:00'),
        price: 9200 + idx * 350,
        refundable: true,
        priority: 'MUST',
        hardDeadline: dt(String(d.day).padStart(2, '0'), '20:00')
      }),
      makeItem({
        id: `av${idx}_a1`,
        type: 'ACTIVITY',
        title: `${d.dest} signature experience`,
        day: 2,
        start: dt(String(d.day + 1).padStart(2, '0'), '09:30'),
        end: dt(String(d.day + 1).padStart(2, '0'), '12:30'),
        price: 1800,
        priority: 'NICE'
      })
    ];
    const total = items.reduce((s, i) => s + i.price_inr, 0);
    const plan: Plan = {
      id: `plan_av${idx + 1}`,
      trip_id: tripId,
      kind: 'A',
      version: 1,
      items,
      total_cost_inr: total,
      validation: {
        feasible: d.score > 50,
        checks: [{ name: 'budget', passed: true, detail: `₹${total.toLocaleString('en-IN')} of ₹${(total + 8000).toLocaleString('en-IN')}` }],
        min_slack_min: Math.max(10, d.score - 30),
        budget_headroom_inr: 8000,
        feasibility: d.score / 100,
        solver: 'fixture',
        solve_ms: 0
      },
      summary: `${d.dest} plan for ${d.name.split(' ')[0]}.`,
      created_at: SIM_NOW_BASE,
      superseded: false
    };
    const trip: Trip = {
      id: tripId,
      title: d.title,
      status: d.score < 45 ? 'ACTIVE' : 'BOOKED',
      intent: {
        origin: null,
        destination: d.dest,
        start_date: `2026-12-${String(d.day).padStart(2, '0')}`,
        nights: 2,
        travellers: 2,
        budget_inr: null,
        interests: [],
        constraints: [],
        pace: 'BALANCED',
        must_dos: [],
        missing: []
      },
      active_plan: 'A',
      plan_a_id: plan.id,
      plan_b_id: null,
      sim_now: null,
      sim_window: null,
      owner_id: `usr_c${idx + 1}`,
      group_id: null,
      advisor_id: 'usr_adv',
      advisor_consent: d.consent,
      created_at: SIM_NOW_BASE
    };
    return {
      trip,
      plan,
      row: { traveller_name: d.name, health: d.health, score: d.score, next_risk: d.risk, unread_alerts: d.unread, consent: d.consent }
    };
  });
}

/* ---------- Shared text banks ---------- */

/** Internal record: bodies in all three supported languages (A6.5 language control). */
export type DraftRecord = CourtesyDraft & { alt: Record<string, string> };

export function makeDrafts(recommendationId: string, delayMin: number, checkedAt: string): DraftRecord[] {
  const time = delayMin > 60 ? '11:30' : '10:30';
  const mk = (
    id: string,
    kind: CourtesyDraft['recipient_kind'],
    name: string,
    en: string,
    hi: string,
    hinglish: string
  ): DraftRecord => ({
    id,
    trip_id: 'trip_golden',
    recommendation_id: recommendationId,
    recipient_kind: kind,
    recipient_name: name,
    channel: 'WHATSAPP',
    language: 'en',
    subject: null,
    body: en,
    state: 'DRAFT',
    created_at: checkedAt,
    alt: { en, hi, hinglish }
  });

  return [
    mk(
      'dr_1',
      'HOTEL',
      'Tea Valley Resort',
      'Hello! Our flight has been delayed by ' + delayMin + ' minutes, so check-in will now be around 15:30 on 5 Dec instead of 14:30. Could you please hold the room until 18:00? — Asha, booking TVR-4471',
      'नमस्ते! हमारी फ्लाइट ' + delayMin + ' मिनट देर से है, इसलिए चेक-इन 5 दिसंबर को 14:30 की जगह लगभग 15:30 होगा। कृपया कमरा 18:00 बजे तक होल्ड रखें। — आशा, बुकिंग TVR-4471',
      'Namaste! Flight ' + delayMin + ' min late hai, toh check-in 5 Dec ko 14:30 ki jagah around 15:30 hoga. Room 18:00 tak hold rakhiye please. — Asha, booking TVR-4471'
    ),
    mk(
      'dr_2',
      'DRIVER',
      'Kochi airport cab (SIM-C-1180)',
      'Hi! The flight now lands at ' + (delayMin > 60 ? '10:00' : '10:00') + ', so please pick up at ' + time + ' from Kochi airport gate 2 instead of 09:50. Flight 6E-207.',
      'नमस्ते! फ्लाइट अब ' + (delayMin > 60 ? '10:00' : '10:00') + ' पर उतरेगी, कृपया 09:50 की जगह ' + time + ' पर कोच्चि एयरपोर्ट गेट 2 से पिकअप करें। फ्लाइट 6E-207।',
      'Hi! Flight ab ' + (delayMin > 60 ? '10:00' : '10:00') + ' pe land karegi, toh pickup 09:50 ki jagah ' + time + ' pe, Kochi airport gate 2. Flight 6E-207.'
    ),
    mk(
      'dr_3',
      'VENDOR',
      'Eravikulam NP ticketing',
      'Hello! Due to a flight delay we request rescheduling of the timed entry (ref ERV-88213) from 5 Dec 15:00 to 6 Dec 09:00. We understand the ₹400 rebooking fee applies. — Asha',
      'नमस्ते! फ्लाइट में देरी के कारण हम समय-बद्ध प्रवेश (संदर्भ ERV-88213) को 5 दिसंबर 15:00 से 6 दिसंबर 09:00 पर पुनर्निर्धारित करने का अनुरोध करते हैं। हम ₹400 पुनर्बुकिंग शुल्क लागू होने को समझते हैं। — आशा',
      'Hello! Flight delay ki wajah se timed entry (ref ERV-88213) 5 Dec 15:00 se 6 Dec 09:00 pe reschedule karna hai. ₹400 rebooking fee chalega. — Asha'
    )
  ];
}

export function makeDelaySignal(id: string, tripId: string, minutes: number, checkedAt: string): Signal {
  return {
    id,
    trip_id: tripId,
    kind: 'FLIGHT_STATUS',
    item_id: 'it_a_f1',
    severity: minutes > 60 ? 3 : 2,
    summary: `Flight BLR→COK delayed ${minutes} min (scheduled 07:40, now ${minutes > 60 ? '09:40' : '08:35'}).`,
    payload: { delay_min: minutes, flight_ref: '6E-207' },
    provenance: prov('Flight status feed (sim)', checkedAt, 0.9)
  };
}

export const BOOKING_SEED_REFS = ['SIM-F-7721', 'SIM-C-1180', 'SIM-H-3011', 'SIM-E-8821', 'SIM-A-5502', 'SIM-A-5503', 'SIM-A-5504', 'SIM-C-1181', 'SIM-F-7722'];

export function bookingFor(item: PlanItem, planId: string, tripId: string, status: Booking['status'], ref: string | null, at: string, penalty: number | null = null): Booking {
  return {
    id: `bk_${item.id.replace('it_a_', '')}`,
    trip_id: tripId,
    plan_id: planId,
    item_id: item.id,
    status,
    supplier_ref: ref,
    amount_inr: item.price_inr,
    refundable: item.refundable,
    failure_reason: null,
    penalty_inr: penalty,
    updated_at: at
  };
}

export type { Alert };
