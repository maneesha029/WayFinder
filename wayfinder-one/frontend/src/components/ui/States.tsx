'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { ApiError } from '@/lib/api/client';

export function EmptyState({
  icon,
  title,
  body,
  action
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-2">{icon}</div>
      <h3 className="font-display text-lg">{title}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-ink-2">{body}</p>
      {action}
    </div>
  );
}

/** Error state shows the API message verbatim + Retry (A6.1). */
export function ErrorState({
  error,
  onRetry,
  title = 'Something went wrong'
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const message =
    error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Unexpected error. Try again.';
  const code = error instanceof ApiError ? error.code : null;
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-bg text-red">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="font-display text-lg">{title}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-ink-2">{message}</p>
      {code ? <p className="font-mono text-xs text-ink-3">{code}</p> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
