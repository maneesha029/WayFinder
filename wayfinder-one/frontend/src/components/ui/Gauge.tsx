'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import type { Health } from '@contracts/types';

const healthColor: Record<Health, string> = {
  GREEN: 'var(--green)',
  AMBER: 'var(--amber)',
  RED: 'var(--red)'
};

/** Ring gauge 0–100; animates between values over 400ms ease-out (A5 motion). */
export function Gauge({
  value,
  health,
  size = 128,
  label,
  sub
}: {
  value: number;
  health: Health;
  size?: number;
  label?: string;
  sub?: string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(value), 40);
    return () => window.clearTimeout(t);
  }, [value]);

  const stroke = size * 0.085;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, shown)) / 100) * c;
  const arc = 0.8; // 288° dial, like an instrument cluster
  const dashArray = `${c * arc} ${c}`;
  const offset = c * (1 - arc);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden className="-rotate-[126deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          strokeDashoffset={offset}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={healthColor[health]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dasharray 400ms var(--ease-out)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum font-display text-3xl leading-none" data-testid="gauge-value">
          {Math.round(shown)}
        </span>
        {label ? <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-2">{label}</span> : null}
        {sub ? <span className="text-xs text-ink-3">{sub}</span> : null}
      </div>
    </div>
  );
}

/** Horizontal component bar with tooltip semantics handled by the caller (HealthMeter). */
export function MeterBar({
  name,
  value,
  health,
  hint
}: {
  name: string;
  value: number;
  health: Health;
  hint: string;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(value), 60);
    return () => window.clearTimeout(t);
  }, [value]);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-ink-2" title={hint}>
          {name}
        </span>
        <span className="tnum font-mono text-xs text-ink-3">{Math.round(shown)}</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${name}: ${hint}`}
      >
        <div
          className={clsx('h-full rounded-full')}
          style={{
            width: `${Math.min(100, Math.max(0, shown))}%`,
            background: healthColor[health],
            transition: 'width 400ms var(--ease-out)'
          }}
        />
      </div>
    </div>
  );
}
