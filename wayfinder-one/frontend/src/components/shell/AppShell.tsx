'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarRange, Compass, LogOut, Settings, Sparkles, WifiOff } from 'lucide-react';
import { CONTRACT_VERSION } from '@contracts/types';
import { useAuth, clearSession, getAuthUser, subscribeAuth } from '@/lib/auth';
import { API_MODE, DEMO_MODE } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { useDemoState } from '@/lib/demoStore';
import { HealthDot } from '@/components/ui/Badge';
import { DemoPanel, DemoHotkeyHint } from '@/components/demo/DemoPanel';
import { Tooltip } from '@/components/ui/Tooltip';

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="wf-brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14.5" fill="url(#wf-brand)" />
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
      <path d="M16 7.5 L18.6 16 L16 24.5 L13.4 16 Z" fill="#F6F3EC" />
      <path d="M16 7.5 L18.6 16 L13.4 16 Z" fill="#fff" opacity="0.85" />
      <circle cx="16" cy="16" r="1.6" fill="#F6F3EC" />
    </svg>
  );
}

function OfflineBanner() {
  const t = useTranslations('offline');
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div data-testid="offline-banner" className="border-b border-amber/30 bg-amber-bg px-4 py-2 text-center text-sm font-medium text-amber">
      <WifiOff className="mr-1.5 inline h-4 w-4" aria-hidden />
      {t('banner')}
    </div>
  );
}

function TripSwitcher({ currentId }: { currentId?: string }) {
  const router = useRouter();
  const t = useTranslations('nav');
  const trips = useQuery({ queryKey: qk.trips, queryFn: api.trips });
  if (!trips.data?.length) return null;
  return (
    <label className="relative inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
      <CalendarRange className="h-4 w-4 text-ink-3" aria-hidden />
      <span className="sr-only">{t('switchTrip')}</span>
      <select
        aria-label={t('switchTrip')}
        value={currentId ?? trips.data[0].id}
        onChange={(e) => router.push(`/trips/${e.target.value}`)}
        className="max-w-44 cursor-pointer bg-transparent pr-1 font-medium outline-none"
      >
        {trips.data.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Top bar + footer chrome for authenticated pages (A5 navigation).
 * Health dot reflects the trip switcher's current trip.
 */
export function AppShell({ children, tripId }: { children: ReactNode; tripId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const demo = useDemoState();
  const t = useTranslations('nav');
  const tf = useTranslations('footer');
  const tApp = useTranslations('app');
  const [panelOpen, setPanelOpen] = useState(false);
  const slack = useQuery({
    queryKey: qk.slack(tripId ?? 'none'),
    queryFn: () => api.slack(tripId!),
    enabled: !!tripId,
    staleTime: 5_000
  });

  // route guard (A3 Phase 0). Deferred + store-driven: during hydration the
  // useAuth snapshot can still be the server value (null), so the check reads
  // the auth store directly and reacts to real logout events.
  useEffect(() => {
    const check = () => {
      if (!getAuthUser()) router.replace('/login');
    };
    const t = window.setTimeout(check, 0);
    const unsub = subscribeAuth(check);
    return () => {
      window.clearTimeout(t);
      unsub();
    };
  }, [router]);

  // demo panel hotkey (A6.9)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (e.key.toLowerCase() === 'd' && DEMO_MODE) setPanelOpen((v) => !v);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <OfflineBanner />
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-14 max-w-content items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label={tApp('home')}>
            <LogoMark />
            <span className="font-display text-lg font-semibold tracking-tight">
              Wayfinder <span className="text-brand">One</span>
            </span>
          </Link>

          <div className="mx-1 hidden min-[420px]:block">
            <TripSwitcher currentId={tripId} />
          </div>

          {tripId && slack.data ? (
            <Tooltip content={`Journey health: ${slack.data.health} (${slack.data.score}/100)`}>
              <Link
                href={`/trips/${tripId}?tab=guardian`}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1"
                aria-label={`Trip health ${slack.data.health}`}
              >
                <HealthDot health={slack.data.health} />
                <span className="tnum font-mono text-xs">{slack.data.score}</span>
              </Link>
            </Tooltip>
          ) : null}

          <div className="ml-auto flex items-center gap-1.5">
            {DEMO_MODE ? <DemoHotkeyHint onClick={() => setPanelOpen(true)} window={demo.window} /> : null}
            <Tooltip content={t('advisor')} side="bottom">
              <Link
                href="/advisor"
                aria-label={t('advisor')}
                data-active={pathname.startsWith('/advisor')}
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
              >
                <Sparkles className="h-4.5 w-4.5" aria-hidden />
              </Link>
            </Tooltip>
            <Tooltip content={t('settings')} side="bottom">
              <Link
                href="/settings"
                aria-label={t('settings')}
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
              >
                <Settings className="h-4.5 w-4.5" aria-hidden />
              </Link>
            </Tooltip>
            <span className="mx-1 hidden text-sm text-ink-2 sm:block">{user.name}</span>
            <Tooltip content={t('signOut')} side="bottom">
              <button
                type="button"
                aria-label={t('signOut')}
                onClick={() => {
                  clearSession();
                  router.replace('/login');
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"
              >
                <LogOut className="h-4.5 w-4.5" aria-hidden />
              </button>
            </Tooltip>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-content flex-1 px-4 pb-10 pt-5 sm:px-6">
        {children}
      </main>

      <footer className="border-t border-line bg-surface/60">
        <div className="mx-auto flex max-w-content flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-xs text-ink-3 sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5" aria-hidden />
            WAYFINDER ONE
          </span>
          <span className="font-mono">{tf('contract', { version: CONTRACT_VERSION })}</span>
          <span className="font-mono uppercase">{tf('mode', { mode: API_MODE })}</span>
          <span>{tf('mapAttribution')}</span>
          <span className="ml-auto">{tf('simulatedPrices')}</span>
        </div>
      </footer>

      {DEMO_MODE ? <DemoPanel open={panelOpen} onClose={() => setPanelOpen(false)} tripId={tripId ?? 'trip_golden'} /> : null}
    </div>
  );
}
