'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';

export type ChipTone = 'neutral' | 'brand' | 'green' | 'amber' | 'red' | 'sim' | 'outline';

const tones: Record<ChipTone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  brand: 'bg-brand-soft text-brand border-brand/25',
  green: 'bg-green-bg text-green border-green/25',
  amber: 'bg-amber-bg text-amber border-amber/30',
  red: 'bg-red-bg text-red border-red/25',
  sim: 'bg-sim-bg text-sim border-sim/25',
  outline: 'bg-transparent text-ink-2 border-line'
};

export function Chip({
  tone = 'neutral',
  icon,
  children,
  className,
  title
}: {
  tone?: ChipTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Priority chips MUST / NICE / SKIP_IF_NEEDED (A6.1). */
export function PriorityChip({ priority }: { priority: 'MUST' | 'NICE' | 'SKIP_IF_NEEDED' }) {
  const map = {
    MUST: { tone: 'red' as const, label: 'Must-do' },
    NICE: { tone: 'brand' as const, label: 'Nice-to-have' },
    SKIP_IF_NEEDED: { tone: 'neutral' as const, label: 'Skip if needed' }
  };
  const v = map[priority];
  return (
    <Chip tone={v.tone} className="uppercase tracking-wide text-[10px]">
      {v.label}
    </Chip>
  );
}
