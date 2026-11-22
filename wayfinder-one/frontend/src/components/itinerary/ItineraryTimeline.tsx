'use client';

import { useMemo } from 'react';
import type { Plan, PlanItem } from '@contracts/types';
import { fmtDay } from '@/lib/format';
import { ItemCard } from './ItemCard';
import { SlackConnector } from './SlackConnector';
import { Skeleton } from '@/components/ui/Skeleton';

interface DayGroup {
  day: number;
  label: string;
  items: Array<{ item: PlanItem; slackAfter?: { to: string; min: number; detail?: string } }>;
}

/**
 * Day-grouped timeline with SlackConnectors between consecutive items (A6.1).
 * Slack = gap between an item's end and the next dependent item's start.
 */
export function ItineraryTimeline({
  plan,
  simNow,
  highlightItemId,
  loading,
  onSelectItem
}: {
  plan: Plan | null;
  simNow?: string | null;
  highlightItemId?: string | null;
  loading?: boolean;
  onSelectItem?: (id: string) => void;
}) {
  const days = useMemo<DayGroup[]>(() => {
    if (!plan) return [];
    // within a day, stays (check-in windows) sort after point items so the
    // dependency chain of timed items stays readable
    const sorted = [...plan.items].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      const stayDiff = (a.type === 'HOTEL' ? 1 : 0) - (b.type === 'HOTEL' ? 1 : 0);
      if (stayDiff !== 0) return stayDiff;
      return a.start.localeCompare(b.start);
    });
    const byDay = new Map<number, PlanItem[]>();
    for (const it of sorted) {
      const list = byDay.get(it.day) ?? [];
      list.push(it);
      byDay.set(it.day, list);
    }
    return [...byDay.entries()].map(([day, items]) => ({
      day,
      label: `Day ${day} · ${fmtDay(items[0].start)}`,
      items: items.map((item, idx) => {
        const next = items[idx + 1];
        let slack: { to: string; min: number; detail?: string } | undefined;
        if (next) {
          const gap = Math.round((new Date(next.start).getTime() - new Date(item.end).getTime()) / 60000);
          const chained = next.depends_on.includes(item.id);
          // A connector is meaningful when the solver chains the items, or when
          // there is genuine free time between two non-stay items. Overlapping
          // windows (e.g. hotel check-in spanning an activity) show no connector.
          const overlaps = gap < 0;
          const isStayGap = item.type === 'HOTEL' || next.type === 'HOTEL';
          if (chained || (!overlaps && !isStayGap)) {
            slack = {
              to: next.id,
              min: gap,
              detail: chained
                ? `${item.title} ends at ${item.end.slice(11, 16)}, ${next.title} starts at ${next.start.slice(11, 16)} — ${gap} min between them${next.hard_deadline ? `, last entry ${next.hard_deadline.slice(11, 16)}` : ''}.`
                : `Free time before ${next.title}: ${gap} min.`
            };
          }
        }
        return { item, slackAfter: slack };
      })
    }));
  }, [plan]);

  if (loading) {
    return (
      <div className="space-y-6 px-4 py-4" aria-hidden>
        {[1, 2].map((d) => (
          <div key={d} className="space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-24 w-full rounded-card" />
            <Skeleton className="h-24 w-full rounded-card" />
          </div>
        ))}
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="space-y-5" data-testid="itinerary-timeline">
      {days.map((d) => (
        <section key={d.day} aria-labelledby={`day-${d.day}`}>
          <h3 id={`day-${d.day}`} className="mb-2 flex items-baseline gap-2 px-1 font-display text-lg">
            Day {d.day}
            <span className="font-sans text-sm font-normal text-ink-3">{fmtDay(d.items[0].item.start)}</span>
          </h3>
          <div>
            {d.items.map(({ item, slackAfter }, idx) => (
              <div key={item.id}>
                <ItemCard
                  item={item}
                  simNow={simNow}
                  highlight={highlightItemId === item.id}
                  onJump={onSelectItem}
                />
                {slackAfter && idx < d.items.length - 1 ? (
                  <SlackConnector
                    fromId={item.id}
                    toId={slackAfter.to}
                    slackMin={slackAfter.min}
                    detail={slackAfter.detail}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
