'use client';

import clsx from 'clsx';
import type { PlanItem } from '@contracts/types';
import { BedDouble, Bus, MapPin, Mountain, Plane, Ticket, Waves, Wind } from 'lucide-react';
import { fmtMoney, fmtDate, fmtTime, freshness } from '@/lib/format';
import { SimBadge } from '@/components/ui/SimBadge';
import { Chip, PriorityChip } from '@/components/ui/Chip';
import { StatusBadge } from '@/components/ui/Badge';

const typeAccent: Record<PlanItem['type'], string> = {
  FLIGHT: 'var(--accent-flight)',
  TRANSFER: 'var(--accent-transfer)',
  HOTEL: 'var(--accent-hotel)',
  ACTIVITY: 'var(--accent-activity)'
};

export function TypeIcon({ type, className }: { type: PlanItem['type']; className?: string }) {
  const cls = className ?? 'h-4 w-4';
  return type === 'FLIGHT' ? (
    <Plane className={cls} aria-hidden />
  ) : type === 'HOTEL' ? (
    <BedDouble className={cls} aria-hidden />
  ) : type === 'TRANSFER' ? (
    <Bus className={cls} aria-hidden />
  ) : (
    <Ticket className={cls} aria-hidden />
  );
}

const riskLabels: Record<string, string> = {
  RAIN: 'Rain-exposed',
  GHAT_ROAD: 'Ghat road',
  CROWD: 'Crowd peak',
  STRIKE: 'Strike risk',
  HEAT: 'Heat'
};

/** Price line: ₹ · source · freshness + SimBadge (A6.1 / J2). */
export function PriceLine({ item, simNow }: { item: PlanItem; simNow?: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="tnum font-semibold">{fmtMoney(item.price_inr)}</span>
      <span className="font-mono text-xs text-ink-3">
        {item.price_provenance.source} · {freshness(item.price_provenance.checked_at, simNow)}
      </span>
      {item.price_provenance.is_simulated ? <SimBadge source={item.price_provenance.source} /> : null}
    </span>
  );
}

export function ItemCard({
  item,
  simNow,
  highlight,
  dense,
  onJump
}: {
  item: PlanItem;
  simNow?: string | null;
  highlight?: boolean;
  dense?: boolean;
  onJump?: (id: string) => void;
}) {
  return (
    <article
      data-testid={`item-card-${item.id}`}
      className={clsx(
        'group relative overflow-hidden rounded-card border bg-surface shadow-card transition-shadow duration-150 hover:shadow-pop',
        highlight ? 'border-brand ring-2 ring-brand/30' : 'border-line',
        dense && 'shadow-none'
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: typeAccent[item.type] }} aria-hidden />
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3 pl-5">
        <div className="min-w-44 flex-1">
          <div className="flex items-start gap-2">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ background: `color-mix(in srgb, ${typeAccent[item.type]} 12%, white)`, color: typeAccent[item.type] }}
            >
              <TypeIcon type={item.type} className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <h4 className="font-medium leading-snug">{item.title}</h4>
              <p className="tnum font-mono text-xs text-ink-3">
                {item.origin ? `${item.origin.name} → ` : ''}
                {item.place?.name ?? '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="tnum font-mono text-sm">
            {fmtTime(item.start)}
            <span className="text-ink-3">–{fmtTime(item.end)}</span>
          </p>
          <p className="text-xs text-ink-3">{fmtDate(item.start)}</p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <PriceLine item={item} simNow={simNow} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-line/70 px-4 py-2 pl-5">
        <PriorityChip priority={item.priority} />
        {item.refundable ? (
          <Chip tone="green" title="Refundable — check the cancel-by date">
            Refundable{item.cancel_by ? ` until ${fmtDate(item.cancel_by)}` : ''}
          </Chip>
        ) : (
          <Chip tone="outline" title="Non-refundable">
            Non-refundable
          </Chip>
        )}
        {item.risk_tags.map((r) => (
          <Chip key={r} tone={r === 'RAIN' ? 'brand' : 'amber'} icon={r === 'RAIN' ? <Waves className="h-3 w-3" aria-hidden /> : r === 'CROWD' ? <MapPin className="h-3 w-3" aria-hidden /> : <Mountain className="h-3 w-3" aria-hidden />}>
            {riskLabels[r] ?? r}
          </Chip>
        ))}
        {item.indoor ? (
          <Chip tone="neutral" icon={<Wind className="h-3 w-3 rotate-90" aria-hidden />}>
            Indoor
          </Chip>
        ) : null}
        {item.co2_kg !== null ? <Chip tone="green">≈{item.co2_kg.toFixed(1)} kg CO₂</Chip> : null}
        {item.rebook_fee_inr ? <Chip tone="outline">Rebook fee {fmtMoney(item.rebook_fee_inr)}</Chip> : null}
        {item.hard_deadline ? (
          <Chip tone="amber" title="Miss this and the item is lost">
            Last entry {fmtTime(item.hard_deadline)}
          </Chip>
        ) : null}
        {item.booking ? <StatusBadge status={item.booking.status} className="ml-auto" /> : null}
      </div>

      {onJump ? (
        <button type="button" className="sr-only" onClick={() => onJump(item.id)}>
          Focus {item.title}
        </button>
      ) : null}
    </article>
  );
}
