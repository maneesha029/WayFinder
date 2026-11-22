'use client';

import clsx from 'clsx';
import type { Validation } from '@contracts/types';
import { Check, CircleX, Cpu } from 'lucide-react';
import { fmtDuration, fmtMoney } from '@/lib/format';

/**
 * ProofList (A6.1): the solver's checks, verbatim. “Verified by solver, not guessed.”
 */
export function ProofList({ validation }: { validation: Validation }) {
  return (
    <div data-testid="proof-list" className="rounded-card border border-line bg-surface-2/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
          <Cpu className="h-4 w-4 text-brand" aria-hidden />
          Verified by solver, not guessed
        </p>
        <p className="font-mono text-xs text-ink-3">
          {validation.solver} · {validation.solve_ms} ms · feasibility {Math.round(validation.feasibility * 100)}%
        </p>
      </div>
      <ul className="divide-y divide-line/70">
        {validation.checks.map((c) => (
          <li key={c.name} className="flex items-start gap-2.5 px-4 py-2.5">
            <span
              aria-hidden
              className={clsx(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                c.passed ? 'bg-green-bg text-green' : 'bg-red-bg text-red'
              )}
            >
              {c.passed ? <Check className="h-3 w-3" /> : <CircleX className="h-3 w-3" />}
            </span>
            <span className={clsx('sr-only', !c.passed && 'not-sr-only')}>{c.passed ? 'passed' : 'failed'}:</span>
            <p className="text-sm leading-relaxed">
              <span className="font-mono text-xs text-ink-3">{c.name}</span>
              <span className="mx-1.5 text-line">|</span>
              {c.detail}
            </p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 font-mono text-xs text-ink-3">
        <span>
          min slack <span className="tnum">{fmtDuration(validation.min_slack_min)}</span>
        </span>
        <span>
          budget headroom <span className="tnum">{fmtMoney(validation.budget_headroom_inr)}</span>
        </span>
        <span>
          {validation.feasible ? 'feasible' : 'infeasible'}
        </span>
      </div>
    </div>
  );
}
