'use client';

import clsx from 'clsx';

/** role="switch" toggle (channel toggles, tracking toggle, location sharing). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  testid
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  testid?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-testid={testid}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors duration-150',
        checked ? 'border-brand bg-brand' : 'border-line bg-surface-2',
        'disabled:cursor-not-allowed disabled:opacity-50'
      )}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ease-out',
          checked ? 'translate-x-5' : 'translate-x-1'
        )}
        aria-hidden
      />
    </button>
  );
}
