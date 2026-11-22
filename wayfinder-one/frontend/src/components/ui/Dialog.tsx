'use client';

import clsx from 'clsx';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Dialog (A5 a11y): traps focus, restores it on close, Esc closes, labelled by title.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'md',
  testid
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg';
  testid?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => !el.hasAttribute('aria-disabled'));
    const first = focusables()[0];
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const list = focusables();
        if (!list.length) return;
        const active = document.activeElement as HTMLElement;
        const idx = list.indexOf(active);
        e.preventDefault();
        const next = e.shiftKey ? (idx <= 0 ? list.length - 1 : idx - 1) : idx === list.length - 1 ? 0 : idx + 1;
        list[next].focus();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" data-testid={testid}>
      <div className="absolute inset-0 bg-ink/45" aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={clsx(
          'anim-drawer-in relative flex max-h-[92vh] w-full flex-col rounded-t-card bg-surface shadow-pop sm:rounded-card',
          width === 'md' ? 'sm:max-w-lg' : 'sm:max-w-2xl'
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="font-display text-xl leading-tight">{title}</h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
          >
            <X className="h-4.5 w-4.5" aria-hidden />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-line px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>
  );
}
