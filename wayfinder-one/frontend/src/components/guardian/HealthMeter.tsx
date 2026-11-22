'use client';

import type { SlackScore } from '@contracts/types';
import { Gauge, MeterBar } from '@/components/ui/Gauge';
import { HealthBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

const componentNames: Record<string, { name: string; hint: string }> = {
  time_buffer: { name: 'Time buffer', hint: 'How much spare time sits between commitments (higher = safer).' },
  delay_risk: { name: 'Delay risk', hint: 'Exposure to transport delays on fixed legs.' },
  weather_risk: { name: 'Weather risk', hint: 'Rain/heat exposure of outdoor items in the coming windows.' },
  crowd_risk: { name: 'Crowd risk', hint: 'Crowd-peak exposure of timed entries and viewpoints.' },
  budget_headroom: { name: 'Budget headroom', hint: 'Money left vs your budget after every planned cost.' }
};

/**
 * HealthMeter (A6.3): ring gauge 0–100 with the health label and explanation,
 * five component bars with tooltips, weakest-link jump.
 */
export function HealthMeter({
  slack,
  onJumpToItem,
  itemTitle
}: {
  slack: SlackScore;
  onJumpToItem?: (itemId: string) => void;
  itemTitle?: (itemId: string) => string;
}) {
  return (
    <Card data-testid="health-meter" className="overflow-hidden">
      <div className="flex items-center gap-4 border-b border-line bg-paper-wash px-4 py-4">
        <Gauge value={slack.score} health={slack.health} label={slack.health} size={116} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Journey health</p>
          <HealthBadge health={slack.health} />
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{slack.explanation}</p>
        </div>
      </div>
      <div className="space-y-3 px-4 py-3.5">
        {Object.entries(slack.components).map(([key, value]) => {
          const meta = componentNames[key] ?? { name: key, hint: 'Component of the slack score.' };
          return <MeterBar key={key} name={meta.name} value={value} health={slack.health} hint={meta.hint} />;
        })}
      </div>
      {slack.weakest_item_id ? (
        <div className="border-t border-line px-4 py-2.5">
          <button
            type="button"
            onClick={() => onJumpToItem?.(slack.weakest_item_id!)}
            className="text-sm font-medium text-brand hover:underline"
          >
            Weakest link: {itemTitle ? itemTitle(slack.weakest_item_id) : slack.weakest_item_id} — jump to item →
          </button>
        </div>
      ) : null}
    </Card>
  );
}
