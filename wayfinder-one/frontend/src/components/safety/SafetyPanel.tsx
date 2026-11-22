'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Phone, Plus, ShieldAlert } from 'lucide-react';
import type { SafeCheckin, ShareLink } from '@contracts/types';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { fmtDateTime, fmtTime, idemKey } from '@/lib/format';
import { readQueue, replayQueue } from '@/lib/pwa';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Chip } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { pushToast } from '@/components/ui/Toast';

/**
 * SafetyPanel (A6b): trusted contacts (max 5), safe-arrival check-ins for risky
 * items, large SOS with confirm step + offline queue replay, share-link manager.
 * B6.3b has no GET for check-ins or share links, so the UI keeps the session's
 * own scheduled check-ins / created links in the query cache.
 */
export function SafetyPanel({ tripId, riskyItems }: { tripId: string; riskyItems: Array<{ id: string; title: string }> }) {
  const qc = useQueryClient();
  const contacts = useQuery({ queryKey: qk.contacts(tripId), queryFn: () => api.contacts(tripId) });
  const checkins = useQuery({ queryKey: qk.checkins(tripId), queryFn: async (): Promise<SafeCheckin[]> => [] });
  const [addOpen, setAddOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [checkinItem, setCheckinItem] = useState<string | null>(null);
  const [replaying, setReplaying] = useState(false);

  const add = useMutation({
    mutationFn: (c: { name: string; phone?: string | null; email?: string | null }) =>
      api.addContact(tripId, { name: c.name, phone: c.phone ?? null, email: c.email ?? null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.contacts(tripId) });
      setAddOpen(false);
      pushToast({ level: 'success', title: 'Contact added', body: 'They are notified on missed check-ins and SOS.' });
    },
    onError: (e) => pushToast({ level: 'warning', title: 'Could not add contact', body: e instanceof Error ? e.message : undefined })
  });

  async function replayQueued() {
    setReplaying(true);
    const { api: a } = await import('@/lib/api/endpoints');
    const sent = await replayQueue(async (action) => {
      if (action.path.endsWith('/sos')) {
        await a.sos(tripId, action.body as { message?: string }, action.idempotencyKey);
      } else if (action.path.includes('/confirm')) {
        await a.confirmCheckin(action.path.split('/')[2]);
      }
    });
    setReplaying(false);
    if (sent > 0) {
      pushToast({ level: 'success', title: `${sent} queued action${sent > 1 ? 's' : ''} sent`, body: 'Replayed with their original idempotency keys.' });
    }
  }

  const queuedCount = typeof navigator !== 'undefined' ? readQueue().length : 0;

  return (
    <div className="space-y-4" data-testid="safety-panel">
      <Card>
        <CardHeader
          title="Trusted contacts"
          sub="Notified for missed check-ins and SOS. Max 5."
          right={
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setAddOpen(true)}
              disabled={(contacts.data?.length ?? 0) >= 5}
            >
              Add
            </Button>
          }
        />
        {contacts.isLoading ? (
          <div className="px-4 py-4">
            <Skeleton className="h-20 rounded-inset" />
          </div>
        ) : !contacts.data?.length ? (
          <EmptyState icon={<Phone className="h-5 w-5" aria-hidden />} title="No contacts yet" body="Add the people who should know if something goes wrong." />
        ) : (
          <ul className="divide-y divide-line">
            {contacts.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="font-mono text-xs text-ink-3">{c.phone ?? c.email ?? '—'}</p>
                </div>
                <Chip tone="neutral">{c.phone ? 'SMS + WhatsApp' : 'email'}</Chip>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Safe-arrival check-ins" sub="Confirm after a risky leg; a missed check-in notifies your contacts." />
        <div className="flex flex-wrap items-center gap-2 px-4 py-3.5">
          {riskyItems.length ? (
            riskyItems.map((i) => (
              <Button key={i.id} size="sm" variant="secondary" onClick={() => setCheckinItem(i.id)}>
                Schedule after {i.title}
              </Button>
            ))
          ) : (
            <p className="text-sm text-ink-3">No risky legs on this plan.</p>
          )}
          {queuedCount > 0 ? (
            <Button size="sm" variant="secondary" className="ml-auto" onClick={replayQueued} loading={replaying}>
              Send {queuedCount} queued now
            </Button>
          ) : null}
        </div>
        <CheckinList tripId={tripId} checkins={checkins.data ?? []} />
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="sos-button"
          onClick={() => setSosOpen(true)}
          className="flex h-14 items-center gap-2.5 rounded-card bg-red px-6 text-base font-bold uppercase tracking-wide text-white shadow-card transition-transform hover:scale-[1.02] focus-visible:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
        >
          <ShieldAlert className="h-5 w-5" aria-hidden />
          SOS
        </button>
        <p className="max-w-sm text-xs leading-relaxed text-ink-2">
          Sends your location (latest point only) to trusted contacts and the trip owner. Works offline — queued and
          replayed with the same key on reconnect.
        </p>
      </div>

      <ShareManager tripId={tripId} />

      {addOpen ? <AddContactDialog onClose={() => setAddOpen(false)} onSave={(c) => add.mutate(c)} saving={add.isPending} /> : null}
      {sosOpen ? <SosDialog tripId={tripId} onClose={() => setSosOpen(false)} /> : null}
      {checkinItem ? <CheckinDialog tripId={tripId} itemId={checkinItem} onClose={() => setCheckinItem(null)} /> : null}
    </div>
  );
}

function CheckinList({ tripId, checkins }: { tripId: string; checkins: SafeCheckin[] }) {
  const qc = useQueryClient();
  const confirm = useMutation({
    mutationFn: (id: string) => api.confirmCheckin(id),
    onSuccess: (c) => {
      pushToast({ level: 'success', title: 'Checked in safe', body: `Confirmed at ${fmtTime(new Date().toISOString())} IST.` });
      // keep the session list in sync (no GET endpoint for check-ins in B6.3b)
      qc.setQueryData<SafeCheckin[]>(qk.checkins(tripId), (prev) => (prev ?? []).map((x) => (x.id === c.id ? c : x)));
    }
  });
  if (!checkins.length) return <p className="px-4 pb-4 text-sm text-ink-3">No check-ins scheduled yet.</p>;
  return (
    <ul className="divide-y divide-line border-t border-line">
      {checkins.map((c) => (
        <li key={c.id} className="flex items-center justify-between px-4 py-3">
          <span className="text-sm">
            After <span className="font-mono text-xs">{c.item_id}</span> · due {fmtTime(c.due_at)}
          </span>
          {c.state === 'PENDING' ? (
            <Button size="sm" variant="secondary" onClick={() => confirm.mutate(c.id)} loading={confirm.isPending}>
              I&apos;m safe
            </Button>
          ) : (
            <Chip tone={c.state === 'CONFIRMED' ? 'green' : 'red'}>{c.state.toLowerCase()}</Chip>
          )}
        </li>
      ))}
    </ul>
  );
}

function CheckinDialog({ tripId, itemId, onClose }: { tripId: string; itemId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [dueAt, setDueAt] = useState('');
  const create = useMutation({
    mutationFn: () => api.createCheckin(tripId, { item_id: itemId, due_at: `${dueAt}:00+05:30` }),
    onSuccess: (c) => {
      qc.setQueryData<SafeCheckin[]>(qk.checkins(tripId), (prev) => [...(prev ?? []), c]);
      pushToast({ level: 'success', title: 'Check-in scheduled', body: `We will ping you after ${itemId}.` });
      onClose();
    }
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Schedule check-in after ${itemId}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!dueAt} loading={create.isPending} onClick={() => create.mutate()}>
            Schedule
          </Button>
        </div>
      }
    >
      <label htmlFor="checkin-due" className="mb-1 block text-sm font-medium">
        Due at (IST)
      </label>
      <input
        id="checkin-due"
        type="time"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
        className="h-11 w-full rounded-inset border border-line bg-surface-2 px-3 font-mono text-sm"
      />
    </Dialog>
  );
}

function SosDialog({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const [note, setNote] = useState('');
  const send = useMutation({
    mutationFn: async () => {
      const key = idemKey('sos', tripId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12));
      if (!navigator.onLine) {
        const { enqueueAction } = await import('@/lib/pwa');
        enqueueAction({ id: key, path: `/trips/${tripId}/sos`, method: 'POST', body: { message: note || undefined }, idempotencyKey: key });
        return { queued: true as const, notified: [] as string[] };
      }
      const r = await api.sos(tripId, { message: note || undefined }, key);
      return { queued: false as const, notified: r.notified };
    },
    onSuccess: (r) => {
      pushToast({
        level: r.queued ? 'warning' : 'success',
        title: r.queued ? 'SOS queued' : 'SOS sent',
        body: r.queued
          ? 'You are offline. It will send automatically the moment you are back online — same idempotency key, no duplicates.'
          : `Notified: ${r.notified.join(', ') || 'trip owner'}`
      });
      onClose();
    }
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Send SOS"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button className="!bg-red hover:!bg-red-strong" loading={send.isPending} onClick={() => send.mutate()}>
            Send SOS now
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="rounded-inset bg-red-bg px-3.5 py-2.5 text-sm leading-relaxed text-red">
          This alerts your trusted contacts and the trip owner with your latest location. Use it for real emergencies.
        </p>
        <label htmlFor="sos-note" className="block text-sm font-medium">
          Note (optional)
        </label>
        <input
          id="sos-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          className="h-11 w-full rounded-inset border border-line bg-surface-2 px-3 text-sm"
          placeholder="What happened?"
        />
      </div>
    </Dialog>
  );
}

function ShareManager({ tripId }: { tripId: string }) {
  const qc = useQueryClient();
  const [ttl, setTtl] = useState(24);
  const [copied, setCopied] = useState<string | null>(null);
  const links = useQuery({ queryKey: qk.share(tripId), queryFn: async (): Promise<ShareLink[]> => [] });
  const create = useMutation({
    mutationFn: () => api.createShare(tripId, ttl),
    onSuccess: (l) => {
      qc.setQueryData<ShareLink[]>(qk.share(tripId), (prev) => [...(prev ?? []), l]);
      pushToast({ level: 'success', title: 'Share link created', body: 'Shows live status only — never PII, never booking refs.' });
    }
  });
  const revoke = useMutation({
    mutationFn: () => api.revokeShare(tripId),
    onSuccess: () => {
      qc.setQueryData<ShareLink[]>(qk.share(tripId), (prev) => (prev ?? []).map((l) => ({ ...l, active: false })));
      pushToast({ level: 'info', title: 'All share links revoked' });
    }
  });
  const list = links.data ?? [];

  return (
    <Card data-testid="share-manager">
      <CardHeader
        title="Share live trip"
        sub="A read-only page: health, next stop, ETA. No booking refs, no phone numbers, expiring, revocable."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="share-ttl" className="text-xs text-ink-3">
              expiry
            </label>
            <select
              id="share-ttl"
              value={ttl}
              onChange={(e) => setTtl(Number(e.target.value))}
              className="h-9 rounded-inset border border-line bg-surface-2 px-2 text-sm"
            >
              <option value={4}>4 h</option>
              <option value={24}>24 h</option>
              <option value={72}>3 days</option>
            </select>
            <Button size="sm" data-testid="share-create" icon={<Link2 className="h-3.5 w-3.5" />} onClick={() => create.mutate()} loading={create.isPending}>
              Create link
            </Button>
            {list.some((l) => l.active) ? (
              <Button size="sm" variant="danger" data-testid="share-revoke" onClick={() => revoke.mutate()} loading={revoke.isPending}>
                Revoke all
              </Button>
            ) : null}
          </div>
        }
      />
      {list.length ? (
        <ul className="divide-y divide-line">
          {list.map((l) => (
            <li key={l.token} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
              <code className="max-w-56 truncate rounded-inset bg-surface-2 px-2 py-1 font-mono text-xs">{l.url}</code>
              <Chip tone={l.active ? 'green' : 'neutral'}>{l.active ? 'active' : 'revoked'}</Chip>
              <span className="font-mono text-xs text-ink-3">expires {fmtDateTime(l.expires_at)}</span>
              <div className="ml-auto flex gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}${l.url}`);
                    setCopied(l.token);
                    window.setTimeout(() => setCopied(null), 1500);
                  }}
                >
                  {copied === l.token ? 'Copied' : 'Copy link'}
                </Button>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-8 items-center rounded-full border border-line px-3 text-sm text-ink-2 hover:border-brand hover:text-brand"
                >
                  Open
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3.5 text-sm text-ink-3">No links yet. Created links appear here and on the public share page.</p>
      )}
    </Card>
  );
}

function AddContactDialog({
  onClose,
  onSave,
  saving
}: {
  onClose: () => void;
  onSave: (c: { name: string; phone?: string | null; email?: string | null }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const phoneOk = phone === '' || /^\+\d{8,15}$/.test(phone);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add trusted contact"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={!name.trim() || !phoneOk || (!phone && !email)}
            onClick={() => onSave({ name: name.trim(), phone: phone || null, email: email || null })}
          >
            Save contact
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="tc-name" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <input id="tc-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-inset border border-line bg-surface-2 px-3 text-sm" />
        </div>
        <div>
          <label htmlFor="tc-phone" className="mb-1 block text-sm font-medium">
            Phone (E.164)
          </label>
          <input
            id="tc-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+919845201111"
            className="h-11 w-full rounded-inset border border-line bg-surface-2 px-3 font-mono text-sm"
          />
          {!phoneOk ? <p className="mt-1 text-xs text-red">Use +countrycode number, 8–15 digits.</p> : null}
        </div>
        <div>
          <label htmlFor="tc-email" className="mb-1 block text-sm font-medium">
            Email (optional)
          </label>
          <input id="tc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-inset border border-line bg-surface-2 px-3 text-sm" />
        </div>
      </div>
    </Dialog>
  );
}
