'use client';

import { useState } from 'react';
import type { AlertLevel, ProofCheck, SlackScore } from '@contracts/types';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip, PriorityChip } from '@/components/ui/Chip';
import { StatusBadge, LevelBadge, HealthBadge } from '@/components/ui/Badge';
import { SimBadge } from '@/components/ui/SimBadge';
import { Gauge, MeterBar } from '@/components/ui/Gauge';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import { Skeleton, TimelineSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Spinner } from '@/components/ui/Spinner';
import { Tooltip } from '@/components/ui/Tooltip';
import { ProofList } from '@/components/itinerary/ProofList';
import { SlackConnector } from '@/components/itinerary/SlackConnector';

const CHECKS: ProofCheck[] = [
  { name: 'budget', passed: true, detail: '₹46,300 of ₹55,000' },
  { name: 'hard_connection:it_a_t1->it_a_e1', passed: true, detail: 'Cab ends 14:20, +20 min to gate, last entry 15:45: 65 min slack' },
  { name: 'no_night_ghat', passed: false, detail: 'Return cab would end at 19:10 — violates the constraint' }
];

const SLACK: SlackScore = {
  trip_id: 'demo',
  health: 'AMBER',
  score: 62,
  components: { time_buffer: 58, delay_risk: 42, weather_risk: 55, crowd_risk: 70, budget_headroom: 84 },
  weakest_item_id: 'it_a_e1',
  explanation: 'Example explanation line from the slack score.',
  computed_at: '2026-12-05T04:40:00+05:30'
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="space-y-3 px-4 py-4">{children}</div>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-20 shrink-0 font-mono text-xs uppercase tracking-wide text-ink-3">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** `/dev/states` (A3 Phase 0): every component in default/loading/empty/error. */
export default function DevStatesPage() {
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [sw, setSw] = useState(true);
  const [gauge, setGauge] = useState(62);
  const levels: AlertLevel[] = ['INFO', 'NUDGE', 'ACTION_NEEDED', 'CRITICAL'];

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Component states</h1>
          <p className="text-sm text-ink-2">Every state, one page — default · loading · empty · error.</p>
        </div>
        <Chip tone="sim">internal</Chip>
      </header>

      <Section title="Buttons">
        <Row label="default">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </Row>
        <Row label="loading">
          <Button loading>Booking…</Button>
        </Row>
        <Row label="disabled">
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </Row>
        <Row label="sizes">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>
      </Section>

      <Section title="Chips & badges">
        <Row label="chips">
          <Chip tone="neutral">Neutral</Chip>
          <Chip tone="brand">Brand</Chip>
          <Chip tone="green">Green</Chip>
          <Chip tone="amber">Amber</Chip>
          <Chip tone="red">Red</Chip>
          <PriorityChip priority="MUST" />
          <PriorityChip priority="NICE" />
          <PriorityChip priority="SKIP_IF_NEEDED" />
        </Row>
        <Row label="status">
          <StatusBadge status="CONFIRMED" />
          <StatusBadge status="PENDING" />
          <StatusBadge status="FAILED" />
          <StatusBadge status="CANCELLED" />
        </Row>
        <Row label="alerts">
          {levels.map((l) => (
            <LevelBadge key={l} level={l} />
          ))}
        </Row>
        <Row label="health">
          <HealthBadge health="GREEN" />
          <HealthBadge health="AMBER" />
          <HealthBadge health="RED" />
        </Row>
        <Row label="sim">
          <SimBadge source="TBO Sandbox (sim)" />
        </Row>
        <Row label="spinner">
          <Spinner label="Loading" />
        </Row>
      </Section>

      <Section title="Gauge & meters">
        <div className="flex flex-wrap items-center gap-6">
          <Gauge value={gauge} health={gauge > 70 ? 'GREEN' : gauge > 40 ? 'AMBER' : 'RED'} label="health" />
          <div className="w-56 space-y-3">
            {Object.entries(SLACK.components).map(([k, v]) => (
              <MeterBar key={k} name={k.replace(/_/g, ' ')} value={v} health="AMBER" hint="Component hint text." />
            ))}
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={gauge}
          onChange={(e) => setGauge(Number(e.target.value))}
          aria-label="Gauge value"
          className="w-56 accent-[var(--brand)]"
        />
      </Section>

      <Section title="Controls">
        <Row label="segmented">
          <Segmented ariaLabel="Demo segmented" options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'Compare' }]} value={seg} onChange={setSeg} />
        </Row>
        <Row label="switch">
          <Switch checked={sw} onChange={setSw} label="Example switch" />
          <Switch checked={false} onChange={() => undefined} disabled label="Disabled" />
        </Row>
        <Row label="tooltip">
          <Tooltip content="Helpful explanation appears here.">
            <Button variant="secondary" size="sm">
              Hover or focus me
            </Button>
          </Tooltip>
        </Row>
      </Section>

      <Section title="Slack connector">
        <SlackConnector fromId="it_a_t1" toId="it_a_e1" slackMin={65} detail="Example: healthy buffer." />
        <SlackConnector fromId="it_a_x" toId="it_a_y" slackMin={10} detail="Example: tight." />
        <SlackConnector fromId="it_a_y" toId="it_a_z" slackMin={-12} detail="Example: missed." />
      </Section>

      <Section title="Proof list">
        <ProofList validation={{ feasible: false, checks: CHECKS, min_slack_min: 10, budget_headroom_inr: 8700, feasibility: 0.55, solver: 'ortools-cp-sat', solve_ms: 412 }} />
      </Section>

      <Section title="Skeletons (loading)">
        <TimelineSkeleton />
        <Skeleton className="h-4 w-40" />
      </Section>

      <Section title="Empty">
        <div className="rounded-card border border-line">
          <EmptyState icon={<span aria-hidden>🧭</span>} title="Guardian is watching. Nothing needs you yet." body="Example empty copy — lists and feeds use this pattern." />
        </div>
      </Section>

      <Section title="Error">
        <div className="rounded-card border border-line">
          <ErrorState error={new Error('Fare for Cab COK→Munnar changed from ₹4,300 to ₹4,650.')} onRetry={() => undefined} />
        </div>
      </Section>
    </div>
  );
}
