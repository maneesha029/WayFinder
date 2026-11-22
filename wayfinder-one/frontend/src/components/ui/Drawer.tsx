'use client';

import clsx from 'clsx';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Drawer (A5/A6.5): Esc closes; bottom sheet on mobile, right rail on desktop. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  testid
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  testid?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>('button, input, textarea')?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && panel) {
        const list = Array.from(
          panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        ).filter((el) => !el.hasAttribute('aria-disabled'));
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
    <div className="fixed inset-0 z-50" data-testid={testid}>
      <div className="absolute inset-0 bg-ink/45" aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className="anim-slide-right-in absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-pop sm:max-w-md sm:border-l sm:border-line"
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="font-display text-xl leading-tight">{title}</h2>
          <button
            type="button"
            aria-label="Close drawer"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-line px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>
  );
}
