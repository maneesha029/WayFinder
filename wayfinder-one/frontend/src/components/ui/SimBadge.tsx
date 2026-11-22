'use client';

import { useRef, useState } from 'react';
import { FlaskConical } from 'lucide-react';

/**
 * Marks every simulated datum (A5/B6: Provenance.is_simulated=true → SimBadge).
 * Shown inline next to prices, times and statuses so trust is never ambiguous.
 */
export function SimBadge({ source }: { source?: string }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={source ? `Simulated: ${source}` : 'Simulated demo data'}
        className="inline-flex items-center gap-1 rounded-full bg-sim-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sim hover:brightness-95"
        onMouseEnter={() => {
          if (timer.current) window.clearTimeout(timer.current);
          setOpen(true);
        }}
        onMouseLeave={() => {
          timer.current = window.setTimeout(() => setOpen(false), 120);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        <FlaskConical className="h-3 w-3" aria-hidden />
        Sim
      </button>
      {open && (
        <span
          role="tooltip"
          className="anim-pop-in absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-56 -translate-x-1/2 rounded-inset bg-ink px-2.5 py-1.5 text-xs font-normal normal-case text-white shadow-pop"
        >
          Simulated data{source ? ` — ${source}` : ' for the demo'}. Real sources show their own name and freshness.
        </span>
      )}
    </span>
  );
}
