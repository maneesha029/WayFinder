'use client';

import clsx from 'clsx';
import { useRef, type ReactNode } from 'react';

export interface TabDef {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

/** Roving-tabindex tablist with arrow-key navigation (A5 a11y). */
export function Tabs({
  tabs,
  active,
  onChange,
  ariaLabel,
  variant = 'underline'
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  variant?: 'underline' | 'rail';
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKey(e: React.KeyboardEvent, idx: number) {
    const keys = ['ArrowLeft', 'ArrowRight'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = (idx + dir + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx(
        variant === 'underline'
          ? 'scroll-thin flex gap-1 overflow-x-auto border-b border-line'
          : 'flex flex-col gap-0.5'
      )}
    >
      {tabs.map((t, i) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            data-testid={`tab-${t.id}`}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={clsx(
              'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors duration-150',
              variant === 'underline' ? 'px-3.5 py-2.5' : 'rounded-inset px-3 py-2',
              selected
                ? variant === 'underline'
                  ? 'text-brand after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand'
                  : 'bg-brand-soft text-brand'
                : 'text-ink-2 hover:text-ink'
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && t.count > 0 ? (
              <span className="tnum ml-0.5 rounded-full bg-amber-bg px-1.5 text-xs font-semibold text-amber">{t.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
