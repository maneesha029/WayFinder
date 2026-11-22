'use client';

import clsx from 'clsx';
import type { AlertLevel, BookingStatus, Health } from '@contracts/types';
import { AlertTriangle, BadgeCheck, CircleAlert, CircleCheck, Info, Bell } from 'lucide-react';

const bookingTone: Record<BookingStatus, { cls: string; label: string }> = {
  NOT_BOOKED: { cls: 'bg-surface-2 text-ink-2', label: 'Not booked' },
  HELD: { cls: 'bg-brand-soft text-brand', label: 'Held' },
  PENDING: { cls: 'bg-amber-bg text-amber', label: 'Pending' },
  CONFIRMED: { cls: 'bg-green-bg text-green', label: 'Confirmed' },
  FAILED: { cls: 'bg-red-bg text-red', label: 'Failed' },
  CANCELLED: { cls: 'bg-surface-2 text-ink-2 line-through decoration-1', label: 'Cancelled' }
};

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const v = bookingTone[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
        v.cls,
        className
      )}
    >
      {v.label}
    </span>
  );
}

export function HealthDot({ health, className }: { health: Health | null | undefined; className?: string }) {
  return (
    <span
      aria-label={health ? `Health: ${health.toLowerCase()}` : 'No health score'}
      title={health ?? undefined}
      className={clsx(
        'inline-block h-2.5 w-2.5 rounded-full',
        health === 'GREEN' && 'bg-green',
        health === 'AMBER' && 'bg-amber',
        health === 'RED' && 'bg-red',
        !health && 'bg-line',
        className
      )}
    />
  );
}

export function HealthBadge({ health }: { health: Health }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
      <HealthDot health={health} />
      <span
        className={clsx(
          'uppercase tracking-wide text-xs',
          health === 'GREEN' && 'text-green',
          health === 'AMBER' && 'text-amber',
          health === 'RED' && 'text-red'
        )}
      >
        {health}
      </span>
    </span>
  );
}

const levelMeta: Record<AlertLevel, { cls: string; icon: typeof Info; label: string }> = {
  INFO: { cls: 'bg-surface-2 text-ink-2', icon: Info, label: 'Info' },
  NUDGE: { cls: 'bg-brand-soft text-brand', icon: Bell, label: 'Nudge' },
  ACTION_NEEDED: { cls: 'bg-amber-bg text-amber', icon: AlertTriangle, label: 'Action needed' },
  CRITICAL: { cls: 'bg-red-bg text-red', icon: CircleAlert, label: 'Critical' }
};

/** Alert level shown as icon + text + colour — never colour alone (A5 a11y). */
export function LevelBadge({ level }: { level: AlertLevel }) {
  const v = levelMeta[level];
  const Icon = v.icon;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        v.cls
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {v.label}
    </span>
  );
}

export function ConfirmBadge({ confirmed }: { confirmed: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 text-xs font-medium',
        confirmed ? 'text-green' : 'text-amber'
      )}
    >
      {confirmed ? <CircleCheck className="h-3.5 w-3.5" aria-hidden /> : <BadgeCheck className="h-3.5 w-3.5" aria-hidden />}
      {confirmed ? 'Confirmed' : 'Awaiting confirmation'}
    </span>
  );
}
