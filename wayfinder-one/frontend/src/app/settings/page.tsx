'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Clock, Globe2, Send, ShieldCheck } from 'lucide-react';
import type { Channel, NotificationPrefs } from '@contracts/types';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { AppShell } from '@/components/shell/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { pushToast } from '@/components/ui/Toast';
import { useLocaleSwitch, useCurrentLocale } from '@/lib/locale';
import { pushToast as toast } from '@/components/ui/Toast';

const CHANNELS: Array<{ id: Channel; label: string; hint: string }> = [
  { id: 'IN_APP', label: 'In-app', hint: 'Alerts inside Wayfinder. Always recommended.' },
  { id: 'PUSH', label: 'Web push', hint: 'Browser notifications, even with the tab closed.' },
  { id: 'WHATSAPP', label: 'WhatsApp', hint: 'Alerts and approved drafts to your number.' },
  { id: 'EMAIL', label: 'Email', hint: 'A quieter channel for the full picture.' }
];

const SENSITIVITY_HINTS: Record<NotificationPrefs['sensitivity'], string> = {
  LOW: 'Only Action needed and Critical reach you. Nudges and info are filed in the Guardian feed.',
  NORMAL: 'Nudges come through; info stays in the feed. Quiet hours still batch the soft stuff.',
  HIGH: 'Everything reaches you, batched during quiet hours.'
};

/** `/settings` (A6b): channels, WhatsApp, quiet hours, sensitivity, language. */
export default function SettingsPage() {
  const qc = useQueryClient();
  const prefs = useQuery({ queryKey: qk.prefs, queryFn: api.getPrefs });
  const [draft, setDraft] = useState<NotificationPrefs | null>(null);
  const receipts = useQuery<Array<{ channel: string; to_masked: string; alert_id: string; state: string; at: string }>>({
    queryKey: ['receipts'],
    queryFn: async () => []
  });
  const switchLocale = useLocaleSwitch();
  const uiLocale = useCurrentLocale();

  useEffect(() => {
    if (prefs.data && !draft) setDraft(prefs.data);
  }, [prefs.data, draft]);

  const save = useMutation({
    mutationFn: (p: NotificationPrefs) => api.putPrefs(p),
    onSuccess: (p) => {
      qc.setQueryData(qk.prefs, p);
      pushToast({ level: 'success', title: 'Preferences saved', body: 'The Guardian follows these on every alert.' });
    },
    onError: (e) => pushToast({ level: 'warning', title: 'Could not save', body: e instanceof Error ? e.message : undefined })
  });

  const pushOptIn = useMutation({
    mutationFn: async () => {
      // real permission flow first, then register the subscription (simulated
      // endpoint key in fixtures mode)
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission was not granted.');
      return api.pushSubscription({ endpoint: 'simulated-endpoint', p256dh: 'sim', auth: 'sim' });
    },
    onSuccess: () => toast({ level: 'success', title: 'Push enabled', body: 'This browser will receive alerts when the tab is closed.' }),
    onError: (e) => toast({ level: 'warning', title: 'Push not enabled', body: e instanceof Error ? e.message : undefined })
  });

  if (prefs.isLoading || !draft) {
    return (
      <AppShell>
        <Skeleton className="h-96 rounded-card" />
      </AppShell>
    );
  }
  if (prefs.isError) {
    return (
      <AppShell>
        <Card>
          <ErrorState error={prefs.error} onRetry={() => prefs.refetch()} />
        </Card>
      </AppShell>
    );
  }

  const whatsappOn = draft.channels.includes('WHATSAPP');
  const numberOk = !whatsappOn || /^\+\d{8,15}$/.test(draft.whatsapp_number ?? '');

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4">
        <header>
          <h1 className="font-display text-2xl">Notifications &amp; language</h1>
          <p className="text-sm text-ink-2">You decide what interrupts you. CRITICAL always breaks through quiet hours.</p>
        </header>

        <Card>
          <CardHeader title="Channels" sub="Where alerts are allowed to reach you." />
          <ul className="divide-y divide-line">
            {CHANNELS.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3" data-testid={`settings-channel-${c.id.toLowerCase()}`}>
                <Switch
                  checked={draft.channels.includes(c.id)}
                  label={`${c.label} channel`}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      channels: v ? [...new Set([...draft.channels, c.id])] : draft.channels.filter((x) => x !== c.id)
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs leading-relaxed text-ink-2">{c.hint}</p>
                </div>
                {c.id === 'PUSH' && draft.channels.includes('PUSH') ? (
                  <Button size="sm" variant="secondary" onClick={() => pushOptIn.mutate()} loading={pushOptIn.isPending}>
                    Enable in browser
                  </Button>
                ) : null}
              </li>
            ))}
            {whatsappOn ? (
              <li className="border-t border-line px-4 py-3">
                <label htmlFor="wa-number" className="mb-1 block text-sm font-medium">
                  WhatsApp number (E.164)
                </label>
                <div className="flex gap-2">
                  <input
                    id="wa-number"
                    value={draft.whatsapp_number ?? ''}
                    onChange={(e) => setDraft({ ...draft, whatsapp_number: e.target.value })}
                    placeholder="+919845201111"
                    className={`h-11 flex-1 rounded-inset border bg-surface-2 px-3 font-mono text-sm ${numberOk ? 'border-line' : 'border-red'}`}
                  />
                  <Button
                    variant="secondary"
                    icon={<Send className="h-3.5 w-3.5" />}
                    onClick={() => toast({ level: 'info', title: 'Test sent (simulated outbox)', body: 'Check the Guardian feed for the receipt.' })}
                  >
                    Send test
                  </Button>
                </div>
                {!numberOk ? <p className="mt-1 text-xs text-red">Use +countrycode, 8–15 digits.</p> : null}
              </li>
            ) : null}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Quiet hours" sub="Info and nudges batch during these hours; CRITICAL ignores them." />
          <div className="grid grid-cols-2 gap-3 px-4 py-3.5">
            <div>
              <label htmlFor="quiet-start" className="mb-1 block text-sm font-medium">
                From
              </label>
              <input
                id="quiet-start"
                data-testid="settings-quiet-start"
                type="time"
                value={draft.quiet_hours_start ?? ''}
                onChange={(e) => setDraft({ ...draft, quiet_hours_start: e.target.value || null })}
                className="h-11 w-full rounded-inset border border-line bg-surface-2 px-3 font-mono text-sm"
              />
            </div>
            <div>
              <label htmlFor="quiet-end" className="mb-1 block text-sm font-medium">
                Until
              </label>
              <input
                id="quiet-end"
                type="time"
                value={draft.quiet_hours_end ?? ''}
                onChange={(e) => setDraft({ ...draft, quiet_hours_end: e.target.value || null })}
                className="h-11 w-full rounded-inset border border-line bg-surface-2 px-3 font-mono text-sm"
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Sensitivity" sub="What is allowed to interrupt you." />
          <div className="space-y-2.5 px-4 py-3.5" data-testid="settings-sensitivity">
            {(Object.keys(SENSITIVITY_HINTS) as NotificationPrefs['sensitivity'][]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={draft.sensitivity === s}
                onClick={() => setDraft({ ...draft, sensitivity: s })}
                className={`w-full rounded-inset border px-3.5 py-2.5 text-left transition-colors ${
                  draft.sensitivity === s ? 'border-brand bg-brand-soft' : 'border-line hover:border-ink-3'
                }`}
              >
                <span className="text-sm font-semibold">{s.charAt(0) + s.slice(1).toLowerCase()}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-2">{SENSITIVITY_HINTS[s]}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-1.5"><Globe2 className="h-4 w-4 text-brand" aria-hidden />Language</span>} sub="UI language. Hinglish uses Hindi UI and tells the agent to reply in Hinglish." />
          <div className="px-4 py-3.5">
            <Segmented
              ariaLabel="Language"
              options={[
                { value: 'en', label: 'English' },
                { value: 'hi', label: 'हिन्दी' }
              ]}
              value={uiLocale}
              onChange={(l) => switchLocale(l as 'en' | 'hi')}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="inline-flex items-center gap-1.5"><BellRing className="h-4 w-4 text-brand" aria-hidden />Delivery receipts</span>} sub="From notification.sent — proof of what was delivered where." />
          <ul className="divide-y divide-line">
            {(receipts.data ?? []).slice(-6).reverse().map((r, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-mono text-xs">
                  {r.channel} → {r.to_masked}
                </span>
                <span className="font-mono text-xs text-ink-3">
                  {r.state.toLowerCase()} · {new Date(r.at).toLocaleTimeString('en-IN')}
                </span>
              </li>
            ))}
            {!(receipts.data ?? []).length ? (
              <li className="px-4 py-3 text-sm text-ink-3">No deliveries yet this session. Trigger an alert from the demo panel.</li>
            ) : null}
          </ul>
        </Card>

        <div className="flex items-center justify-between rounded-card border border-line bg-surface px-4 py-3 shadow-card">
          <p className="flex items-center gap-1.5 text-xs leading-relaxed text-ink-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-green" aria-hidden />
            Preferences apply to every channel. Location is never part of notifications — only your latest point is ever stored.
          </p>
          <Button data-testid="settings-save" onClick={() => save.mutate(draft)} loading={save.isPending} disabled={!numberOk}>
            Save preferences
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
