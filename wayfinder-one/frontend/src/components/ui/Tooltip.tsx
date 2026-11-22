'use client';

import clsx from 'clsx';
import { useId, useState, type ReactNode } from 'react';

/** Accessible tooltip: hover + focus, works with keyboard (A5 a11y). */
export function Tooltip({
  content,
  children,
  side = 'top',
  className
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const pos =
    side === 'top'
      ? 'bottom-full left-1/2 mb-1.5 -translate-x-1/2'
      : side === 'bottom'
        ? 'top-full left-1/2 mt-1.5 -translate-x-1/2'
        : 'left-full top-1/2 ml-1.5 -translate-y-1/2';
  return (
    <span
      className={clsx('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={clsx(
            'anim-pop-in pointer-events-none absolute z-50 w-max max-w-56 rounded-inset bg-ink px-2.5 py-1.5 text-xs font-normal leading-snug text-white shadow-pop',
            pos
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
