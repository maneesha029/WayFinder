import clsx from 'clsx';
import type { ReactNode } from 'react';

export function Card({
  children,
  className,
  inset,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        inset ? 'rounded-inset bg-surface-2' : 'rounded-card border border-line bg-surface shadow-card',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div>
        <h3 className="font-display text-lg leading-tight">{title}</h3>
        {sub ? <p className="mt-0.5 text-sm text-ink-2">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}
