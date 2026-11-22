'use client';

import clsx from 'clsx';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** Radio-group styled as a segmented control (used for A|B|Compare, language, split method). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel,
  testid
}: {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  ariaLabel: string;
  testid?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid={testid}
      className="inline-flex rounded-full border border-line bg-surface-2 p-0.5"
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={selected}
            type="button"
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={clsx(
              'rounded-full font-medium transition-all duration-150 ease-out',
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm',
              selected ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
