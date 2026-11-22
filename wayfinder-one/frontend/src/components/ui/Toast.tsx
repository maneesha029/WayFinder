'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Bell, CheckCircle2, Info, X } from 'lucide-react';

type ToastLevel = 'info' | 'success' | 'warning' | 'critical';

interface ToastItem {
  id: number;
  level: ToastLevel;
  title: string;
  body?: string;
}

type Listener = (t: ToastItem) => void;

let seq = 0;
const listeners = new Set<Listener>();
const log = new Set<ToastItem>();

/** Module-level emit so SSE handlers and stores can toast without React context. */
export function pushToast(t: { level?: ToastLevel; title: string; body?: string }) {
  const item: ToastItem = { id: ++seq, level: t.level ?? 'info', title: t.title, body: t.body };
  log.add(item);
  listeners.forEach((fn) => fn(item));
}

const levelMeta = {
  info: { icon: Info, cls: 'border-line bg-surface', iconCls: 'text-brand' },
  success: { icon: CheckCircle2, cls: 'border-green/30 bg-green-bg', iconCls: 'text-green' },
  warning: { icon: Bell, cls: 'border-amber/40 bg-amber-bg', iconCls: 'text-amber' },
  critical: { icon: AlertTriangle, cls: 'border-red/40 bg-red-bg', iconCls: 'text-red' }
};

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const fn: Listener = (t) => {
      setItems((prev) => [...prev.slice(-3), t]);
      const ttl = t.level === 'critical' || t.level === 'warning' ? 6500 : 4200;
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), ttl);
    };
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const live = useMemo(() => items.filter(Boolean), [items]);
  const hasCritical = items.some((i) => i.level === 'critical');

  return (
    <div
      aria-live={hasCritical ? 'assertive' : 'polite'}
      aria-atomic="false"
      className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-80 flex-col gap-2 sm:bottom-5"
    >
      {live.map((t) => {
        const meta = levelMeta[t.level];
        const Icon = meta.icon;
        return (
          <div
            key={t.id}
            className={clsx('anim-alert-in pointer-events-auto rounded-card border bg-surface p-3.5 shadow-pop', meta.cls)}
            data-testid={`toast-${t.level}`}
          >
            <div className="flex items-start gap-2.5">
              <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', meta.iconCls)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{t.title}</p>
                {t.body ? <p className="mt-0.5 text-sm leading-snug text-ink-2">{t.body}</p> : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                className="rounded-full p-1 text-ink-3 hover:bg-surface-2"
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
