'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, Pencil, Send, Trash2 } from 'lucide-react';
import type { CourtesyDraft } from '@contracts/types';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { Chip } from '@/components/ui/Chip';
import { pushToast } from '@/components/ui/Toast';

const channelIcon = { WHATSAPP: '🟢', EMAIL: '✉️', SMS: '💬' } as const;

const stateChip = {
  DRAFT: { tone: 'neutral' as const, label: 'Draft' },
  APPROVED: { tone: 'brand' as const, label: 'Approved' },
  SENT: { tone: 'green' as const, label: 'Sent (simulated)' },
  DISCARDED: { tone: 'neutral' as const, label: 'Discarded' }
};

/**
 * DraftsDrawer (A6.5): per-draft card with recipient, channel, language control
 * (refetches with ?language=), editable body, WhatsApp-style preview, explicit approve.
 */
export function DraftsDrawer({ open, onClose, tripId }: { open: boolean; onClose: () => void; tripId: string }) {
  const [language, setLanguage] = useState<'en' | 'hinglish'>('en');
  const [editing, setEditing] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const drafts = useQuery({
    queryKey: qk.drafts(tripId),
    queryFn: () => api.drafts(tripId),
    enabled: open
  });

  // language control re-fetches drafts in the chosen language (A6.5)
  useEffect(() => {
    if (open) qc.invalidateQueries({ queryKey: qk.drafts(tripId) });
  }, [language, open, tripId, qc]);

  const refetchInLanguage = useQuery({
    queryKey: [...qk.drafts(tripId), language],
    queryFn: () => api.drafts(tripId, language),
    enabled: open && language !== 'en'
  });
  const list = (language === 'en' ? drafts.data : refetchInLanguage.data) ?? [];

  const decide = useMutation({
    mutationFn: ({ id, decision, body }: { id: string; decision: 'APPROVE' | 'EDIT' | 'DISCARD'; body?: string | null }) =>
      api.draftDecision(id, { decision, body: body ?? null }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.drafts(tripId) });
      if (vars.decision === 'APPROVE') {
        pushToast({ level: 'info', title: 'Draft approved', body: 'It sends with the switch approval (simulated outbox).' });
      }
      setEditing((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
    }
  });

  return (
    <Drawer open={open} onClose={onClose} title="Courtesy drafts" testid="drafts-drawer">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-ink-2">The agent writes; you decide. Approved drafts send only with the switch.</p>
        <Segmented
          ariaLabel="Draft language"
          size="sm"
          options={[
            { value: 'en', label: 'English' },
            { value: 'hinglish', label: 'Hinglish' }
          ]}
          value={language}
          onChange={setLanguage}
        />
      </div>

      {drafts.isLoading ? (
        <div className="space-y-3" aria-hidden>
          <Skeleton className="h-40 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </div>
      ) : !list.length ? (
        <EmptyState
          icon={<Send className="h-5 w-5" aria-hidden />}
          title="No drafts yet"
          body="When a disruption suggests a switch, the agent drafts polite messages to your hotel, driver and vendors for review."
        />
      ) : (
        <div className="space-y-4">
          {list.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              pending={decide.isPending}
              editValue={editing[d.id]}
              onEdit={(v) => setEditing((prev) => ({ ...prev, [d.id]: v }))}
              onDecision={(decision, body) => decide.mutate({ id: d.id, decision, body })}
            />
          ))}
        </div>
      )}
    </Drawer>
  );
}

function DraftCard({
  draft,
  pending,
  editValue,
  onEdit,
  onDecision
}: {
  draft: CourtesyDraft;
  pending: boolean;
  editValue?: string;
  onEdit: (v: string) => void;
  onDecision: (d: 'APPROVE' | 'EDIT' | 'DISCARD', body?: string) => void;
}) {
  const editing = editValue !== undefined;
  const body = editing ? editValue : draft.body;
  return (
    <article data-testid={`draft-${draft.id}`} className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <p className="text-sm font-semibold">
          <span aria-hidden className="mr-1.5">{channelIcon[draft.channel]}</span>
          To {draft.recipient_name}
          <span className="ml-2 font-mono text-xs font-normal text-ink-3">{draft.recipient_kind.toLowerCase()} · via {draft.channel.toLowerCase()}</span>
        </p>
        <Chip tone={stateChip[draft.state].tone}>{stateChip[draft.state].label}</Chip>
      </div>

      {editing ? (
        <div className="px-3.5 py-3">
          <label className="sr-only" htmlFor={`draft-body-${draft.id}`}>
            Edit message
          </label>
          <textarea
            id={`draft-body-${draft.id}`}
            data-testid={`draft-body-${draft.id}`}
            value={body}
            rows={4}
            onChange={(e) => onEdit(e.target.value)}
            className="w-full rounded-inset border border-line bg-surface-2 px-3 py-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => onDecision('EDIT', body)} disabled={!body.trim()} loading={pending}>
              Save edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onEdit('')}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-3.5 py-3">
          {/* WhatsApp-style preview bubble */}
          <div className="max-w-[92%] rounded-card rounded-tl-inset bg-[#DCF8C6] px-3 py-2 text-sm leading-relaxed text-[#1F2C18] shadow-sm">
            {draft.body}
            <span className="mt-0.5 block text-right font-mono text-[10px] text-[#5E7A4A]">
              {draft.language} · preview
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.state === 'DRAFT' ? (
              <>
                <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={() => onDecision('APPROVE')} disabled={pending}>
                  Approve
                </Button>
                <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onEdit(draft.body)} disabled={pending}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onDecision('DISCARD')} disabled={pending}>
                  Discard
                </Button>
              </>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-ink-3">
                {draft.state === 'SENT' ? 'Sent from the simulated outbox.' : draft.state === 'APPROVED' ? 'Approved — sends with the switch.' : 'Discarded.'}
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
