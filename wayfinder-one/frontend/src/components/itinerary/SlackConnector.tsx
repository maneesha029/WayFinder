'use client';

import clsx from 'clsx';
import { fmtDuration, slackLabel } from '@/lib/format';
import { Tooltip } from '@/components/ui/Tooltip';

const tone: Record<'ok' | 'tight' | 'missed', { pill: string; dot: string }> = {
  ok: { pill: 'bg-green-bg text-green border-green/25', dot: 'bg-green' },
  tight: { pill: 'bg-amber-bg text-amber border-amber/30', dot: 'bg-amber' },
  missed: { pill: 'bg-red-bg text-red border-red/30', dot: 'bg-red' }
};

/**
 * The signature element (A5): a thin pill between consecutive items showing the
 * time buffer — “slack made visible”.
 */
export function SlackConnector({
  fromId,
  toId,
  slackMin,
  detail
}: {
  fromId: string;
  toId: string;
  slackMin: number;
  detail?: string;
}) {
  const { text, tone: t } = slackLabel(slackMin);
  const meta = tone[t];
  return (
    <div data-testid={`slack-${fromId}-${toId}`} className="relative my-1 flex items-center pl-7">
      <span className="absolute left-3 top-0 h-full w-px bg-line" aria-hidden />
      <Tooltip content={detail ?? `Buffer between these two items: ${fmtDuration(Math.abs(slackMin))}${slackMin < 0 ? ' short' : ''}. Verified by the solver.`}>
        <span
          className={clsx(
            'tnum relative -translate-y-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium',
            meta.pill
          )}
        >
          <span className={clsx('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
          {text}
        </span>
      </Tooltip>
    </div>
  );
}
