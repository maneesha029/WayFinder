'use client';

import clsx from 'clsx';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-brand text-brand-ink hover:bg-brand-strong active:bg-brand-strong shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
  secondary: 'bg-surface text-ink border border-line hover:border-ink-3 hover:bg-surface-2',
  ghost: 'bg-transparent text-brand hover:bg-brand-soft',
  danger: 'bg-transparent text-red border border-red/40 hover:bg-red-bg',
  quiet: 'bg-surface-2 text-ink hover:bg-line/60'
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2', // 44px touch target (A5)
  lg: 'h-12 px-6 text-base gap-2'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      /* A5: disabled = opacity .5 + aria-disabled, keep focusable for screen readers */
      aria-disabled={disabled || loading || undefined}
      className={clsx(
        'inline-flex select-none items-center justify-center rounded-full font-medium transition-all duration-150 ease-out',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
      onClick={disabled || loading ? undefined : rest.onClick}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});
