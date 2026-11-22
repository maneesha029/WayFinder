'use client';

import clsx from 'clsx';
import { useState } from 'react';
import type { OptionalityReport } from '@contracts/types';
import { fmtMoney } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Tooltip } from '@/components/ui/Tooltip';
import { Segmented } from '@/components/ui/Segmented';

/**
 * OptionalityCard (A6b): per risky leg “Saver ₹X (expected loss ₹Y) vs Flex ₹Z”,
 * a recommendation sentence — never auto-selects (F12).
 */
export function OptionalityCard({
  report,
  compact = false,
  chosen,
  onChoose
}: {
  report: OptionalityReport;
  compact?: boolean;
  chosen?: Record<string, 'FLEX' | 'SAVER'>;
  onChoose?: (itemId: string, pick: 'FLEX' | 'SAVER') => void;
}) {
  const [expanded, setExpanded] = useState(!compact);

  return (
    <Card data-testid="optionality-card" className={compact ? 'border-dashed bg-surface-2/40 shadow-none' : undefined}>
      <CardHeader
        title="Flex vs saver, priced by risk"
        sub="Where a disruption is likely, flexible fares pay for themselves. Your call — nothing is pre-selected."
        right={
          compact ? (
            <button type="button" className="text-sm font-medium text-brand hover:underline" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Hide' : 'Show'}
            </button>
          ) : undefined
        }
      />
      {expanded ? (
        <div className="space-y-3 px-4 py-3">
          {report.lines.map((l) => {
            const pick = chosen?.[l.item_id] ?? l.recommended;
            return (
              <div key={l.item_id} className="rounded-inset border border-line bg-surface px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs text-ink-3">{l.item_id}</p>
                  <Chip tone={l.recommended === 'FLEX' ? 'amber' : 'green'} className="uppercase text-[10px]">
                    We suggest {l.recommended}
                  </Chip>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={pick === 'SAVER'}
                    onClick={() => onChoose?.(l.item_id, 'SAVER')}
                    className={clsx(
                      'rounded-inset border px-3 py-2 text-left transition-colors',
                      pick === 'SAVER' ? 'border-brand bg-brand-soft' : 'border-line hover:border-ink-3'
                    )}
                  >
                    <span className="block text-xs font-medium uppercase tracking-wide text-ink-3">Saver</span>
                    <span className="tnum block font-semibold">{fmtMoney(report.total_saver_inr)}</span>
                    <span className="tnum block text-xs text-ink-2">expected loss {fmtMoney(l.expected_loss_inr)}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={pick === 'FLEX'}
                    onClick={() => onChoose?.(l.item_id, 'FLEX')}
                    className={clsx(
                      'rounded-inset border px-3 py-2 text-left transition-colors',
                      pick === 'FLEX' ? 'border-brand bg-brand-soft' : 'border-line hover:border-ink-3'
                    )}
                  >
                    <span className="block text-xs font-medium uppercase tracking-wide text-ink-3">Flex</span>
                    <span className="tnum block font-semibold">+{fmtMoney(l.flex_premium_inr)}</span>
                    <span className="block text-xs text-ink-2">free reslot & refund window</span>
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-2">{l.reason}</p>
              </div>
            );
          })}
          <div className="rounded-inset bg-surface-2 px-3 py-2.5 text-sm">
            <Tooltip content="Saver totals include the expected cost of disruptions; flex totals include the premiums.">
              <p className="tnum font-mono text-xs text-ink-2">
                with risk: saver {fmtMoney(report.total_saver_with_risk_inr)} · all-flex {fmtMoney(report.total_flex_inr)}
              </p>
            </Tooltip>
            <p className="mt-1 leading-relaxed">{report.recommendation}</p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
