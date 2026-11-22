'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Check, Users, MapPin } from 'lucide-react';
import type { Group, GroupPreference, MergedPreferences, Plan, RegroupSuggestion, SplitReport, VoteTally } from '@contracts/types';
import { ApiError } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { fmtDateTime, fmtMoney } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Switch } from '@/components/ui/Switch';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { pushToast } from '@/components/ui/Toast';

const BUDGETS = [12000, 14000, 16000, 20000];

/** Group tab (A6b): invite, members, prefs, conflicts, vote, split, regroup. */
export function GroupTab({ tripId, planAId, planBId }: { tripId: string; planAId: string | null; planBId: string | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [inviteInput, setInviteInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [method, setMethod] = useState<'EQUAL' | 'BY_BUDGET'>('EQUAL');

  const group = useQuery({ queryKey: qk.group(tripId), queryFn: () => api.group(tripId), retry: false });
  const merged = useQuery({ queryKey: qk.merged(tripId), queryFn: () => api.mergedPrefs(tripId), enabled: !!group.data });
  const votes = useQuery({ queryKey: qk.votes(tripId), queryFn: () => api.votes(tripId), enabled: !!group.data });
  const split = useQuery({ queryKey: qk.split(tripId, method), queryFn: () => api.split(tripId, method), enabled: !!group.data });
  const regroup = useQuery({ queryKey: qk.regroup(tripId), queryFn: () => api.regroup(tripId), enabled: !!group.data, refetchInterval: 10_000 });

  const join = useMutation({
    mutationFn: () => api.joinGroup(inviteInput.trim().toUpperCase()),
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: qk.group(g.trip_id) });
      pushToast({ level: 'success', title: 'Joined the group', body: 'Add your preferences so the planner can merge.' });
    },
    onError: (e) => pushToast({ level: 'warning', title: 'Could not join', body: e instanceof Error ? e.message : 'Unknown code.' })
  });

  const isOwner = !!group.data && group.data.members.find((m) => m.user_id === user?.id)?.role === 'OWNER';

  if (group.isLoading) return <Skeleton className="h-72 rounded-card" />;
  if (group.isError) {
    const err = group.error;
    if (err instanceof ApiError && err.code === 'NOT_FOUND') {
      return (
        <Card>
          <EmptyState
            icon={<Users className="h-5 w-5" aria-hidden />}
            title="No group yet"
            body="Create a group to plan together — up to 5 travellers, one shared trip, owner-only booking."
            action={
              isOwner || !group.data ? (
                <CreateGroupButton tripId={tripId} />
              ) : (
                <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row">
                  <input
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="Invite code (e.g. COORG24)"
                    aria-label="Invite code"
                    className="h-11 flex-1 rounded-inset border border-line bg-surface-2 px-3 font-mono text-sm uppercase"
                  />
                  <Button onClick={() => join.mutate()} loading={join.isPending} disabled={!inviteInput.trim()}>
                    Join group
                  </Button>
                </div>
              )
            }
          />
        </Card>
      );
    }
    return (
      <Card>
        <ErrorState error={err} onRetry={() => group.refetch()} />
      </Card>
    );
  }

  const g: Group = group.data!;

  return (
    <div className="space-y-4" data-testid="group-tab">
      <Card>
        <CardHeader
          title="Members"
          sub="Only the owner can book or approve consequential actions."
          right={
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-ink-3">invite code</span>
              <code className="rounded-inset bg-surface-2 px-2 py-1 font-mono text-sm font-semibold">{g.invite_code}</code>
              <Button
                size="sm"
                variant="secondary"
                aria-label="Copy invite code"
                icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                onClick={async () => {
                  await navigator.clipboard.writeText(g.invite_code);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          }
        />
        <ul className="divide-y divide-line">
          {g.members.map((m) => (
            <MemberRow key={m.user_id} memberId={m.user_id} name={m.name} role={m.role} sharing={m.location_sharing} isSelf={m.user_id === user?.id} joined={m.joined_at} />
          ))}
        </ul>
        {isOwner ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
            <input
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="friend's invite code"
              aria-label="Invite code to join another group"
              className="h-10 flex-1 rounded-inset border border-line bg-surface-2 px-3 font-mono text-sm"
              maxLength={12}
            />
            <Button size="sm" variant="secondary" onClick={() => join.mutate()} disabled={!inviteInput.trim()} loading={join.isPending}>
              Join with code
            </Button>
            <span className="text-xs text-ink-3">{g.members.length}/5 members</span>
          </div>
        ) : null}
      </Card>

      {merged.data ? <ConflictsPanel merged={merged.data} /> : null}
      <PreferenceForm tripId={tripId} userId={user?.id ?? ''} />

      {votes.data ? <VotePanel tally={votes.data} tripId={tripId} planAId={planAId} planBId={planBId} /> : null}
      {split.data ? (
        <Card data-testid="split-table">
          <CardHeader
            title="Cost split"
            sub="Shares sum exactly to the plan total — rounding handled by largest remainder."
            right={
              <Segmented
                ariaLabel="Split method"
                size="sm"
                options={[
                  { value: 'EQUAL', label: 'Equal' },
                  { value: 'BY_BUDGET', label: 'By budget' }
                ]}
                value={method}
                onChange={setMethod}
              />
            }
          />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-3">
                <th className="px-4 py-2 font-medium">Member</th>
                <th className="px-4 py-2 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {split.data.shares.map((s) => (
                <tr key={s.member_id}>
                  <td className="px-4 py-2.5">{s.name}</td>
                  <td className="tnum px-4 py-2.5 text-right font-mono">{fmtMoney(s.share_inr)}</td>
                </tr>
              ))}
              <tr className="bg-surface-2/60 font-semibold">
                <td className="px-4 py-2.5">Total ({split.data.method.toLowerCase()})</td>
                <td className="tnum px-4 py-2.5 text-right font-mono">{fmtMoney(split.data.total_inr)}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      ) : null}

      {regroup.data ? <RegroupCard regroup={regroup.data} /> : null}
      {isOwner ? null : (
        <p className="rounded-inset bg-surface-2 px-3.5 py-2.5 text-xs text-ink-2">
          Book, switch and cancel are disabled for members — only the trip owner can spend money. Vote and set your own
          preferences freely.
        </p>
      )}
    </div>
  );
}

function CreateGroupButton({ tripId }: { tripId: string }) {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: () => api.createGroup(tripId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.group(tripId) })
  });
  return (
    <Button onClick={() => create.mutate()} loading={create.isPending}>
      Create the group
    </Button>
  );
}

function MemberRow({
  memberId,
  name,
  role,
  sharing,
  isSelf,
  joined
}: {
  memberId: string;
  name: string;
  role: 'OWNER' | 'MEMBER';
  sharing: boolean;
  isSelf: boolean;
  joined: string;
}) {
  // GroupMember.location_sharing is the member's own consent (B6.1); there is no
  // endpoint for changing another member's consent, so other rows stay disabled.
  const [on, setOn] = useState(sharing);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand">{name.slice(0, 1)}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {name}
          {role === 'OWNER' ? <Chip tone="brand" className="ml-2 text-[10px] uppercase">owner</Chip> : null}
        </p>
        <p className="font-mono text-xs text-ink-3">
          {memberId} · joined {fmtDateTime(joined).split('·')[0]}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-ink-3" aria-hidden />
        <Switch
          checked={isSelf ? on : sharing}
          disabled={!isSelf}
          label={`${name} shares location`}
          testid={`member-share-${memberId}`}
          onChange={(v) => {
            setOn(v);
            try {
              window.localStorage.setItem(`wf.share.${memberId}`, v ? '1' : '0');
            } catch {
              /* private mode */
            }
            pushToast({
              level: 'info',
              title: v ? 'Location sharing on' : 'Location sharing off',
              body: 'Latest point only, used during active travel windows — no history.'
            });
          }}
        />
      </div>
    </li>
  );
}

function ConflictsPanel({ merged }: { merged: MergedPreferences }) {
  return (
    <Card data-testid="conflicts-panel">
      <CardHeader title="Merged preferences" sub="How the group's wishes were combined — no silent overrides." />
      <div className="space-y-2.5 px-4 py-3.5">
        {merged.conflicts.map((c) => (
          <div key={c.field} className="rounded-inset border border-line bg-surface-2/60 px-3 py-2.5 text-sm">
            <p className="font-medium">{c.field.replace(/_/g, ' ')}</p>
            <p className="mt-1 font-mono text-xs text-ink-3">
              {Object.entries(c.values)
                .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                .join(' · ')}
            </p>
            <p className="mt-1 text-xs text-ink-2">Resolution: {c.resolution}</p>
          </div>
        ))}
        <div className="rounded-inset bg-brand-soft/60 px-3 py-2.5 text-sm">
          <p className="font-medium">Merged intent</p>
          <p className="tnum mt-1 font-mono text-xs text-ink-2">
            {merged.merged_intent.destination ?? '—'} · budget {fmtMoney(merged.merged_intent.budget_inr ?? 0)} · pace{' '}
            {merged.merged_intent.pace?.toLowerCase() ?? '—'}
          </p>
          <p className="mt-1 text-xs text-ink-2">
            interests: {merged.merged_intent.interests.join(', ') || '—'} · hard constraints:{' '}
            {merged.merged_intent.constraints.join(', ') || 'none'}
          </p>
        </div>
      </div>
    </Card>
  );
}

function PreferenceForm({ tripId, userId }: { tripId: string; userId: string }) {
  const qc = useQueryClient();
  const existing = useQuery({ queryKey: qk.merged(tripId), queryFn: () => api.mergedPrefs(tripId) });
  const [budget, setBudget] = useState<number>(14000);
  const [veggie, setVeggie] = useState(false);
  const [pace, setPace] = useState<'RELAXED' | 'BALANCED' | 'PACKED'>('BALANCED');
  const [mustDo, setMustDo] = useState('');
  const saved = useMutation({
    mutationFn: () =>
      api.putGroupPrefs(tripId, {
        user_id: userId,
        budget_inr: budget,
        interests: [],
        constraints: veggie ? ['vegetarian'] : [],
        pace,
        must_dos: mustDo.trim() ? [mustDo.trim()] : []
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.merged(tripId) });
      qc.invalidateQueries({ queryKey: qk.group(tripId) });
      pushToast({ level: 'success', title: 'Preference saved', body: 'Merged intent recalculated.' });
    }
  });

  if (!userId) return null;
  return (
    <Card>
      <CardHeader title="Your preferences" sub="Only your own preference is written; the merge shows everyone's." />
      <div className="grid gap-3 px-4 py-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="group-budget" className="mb-1 block text-sm font-medium">
            Budget
          </label>
          <select
            id="group-budget"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="h-11 w-full rounded-inset border border-line bg-surface-2 px-3 text-sm"
          >
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                {fmtMoney(b)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium">Pace</span>
          <Segmented
            ariaLabel="Pace"
            size="sm"
            options={[
              { value: 'RELAXED', label: 'Relaxed' },
              { value: 'BALANCED', label: 'Balanced' },
              { value: 'PACKED', label: 'Packed' }
            ]}
            value={pace}
            onChange={setPace}
          />
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={veggie} onChange={setVeggie} label="Vegetarian food only" />
          <span className="text-sm">Vegetarian food only</span>
        </div>
        <div>
          <label htmlFor="group-must" className="mb-1 block text-sm font-medium">
            Must-do
          </label>
          <input
            id="group-must"
            value={mustDo}
            onChange={(e) => setMustDo(e.target.value)}
            placeholder="e.g. Abbey Falls"
            className="h-11 w-full rounded-inset border border-line bg-surface-2 px-3 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <Button onClick={() => saved.mutate()} loading={saved.isPending} data-testid="group-prefs-save">
            Save my preference
          </Button>
          {existing.data?.merged_intent.budget_inr ? (
            <span className="ml-3 text-xs text-ink-3">current merged budget {fmtMoney(existing.data.merged_intent.budget_inr)}</span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function VotePanel({ tally, tripId, planAId, planBId }: { tally: VoteTally; tripId: string; planAId: string | null; planBId: string | null }) {
  const qc = useQueryClient();
  const vote = useMutation({
    mutationFn: (v: 'A' | 'B' | 'NEITHER') =>
      api.vote(tripId, { plan_id: v === 'A' ? planAId ?? 'plan_a' : v === 'B' ? planBId ?? 'plan_b' : 'neither', vote: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.votes(tripId) });
      qc.invalidateQueries({ queryKey: qk.split(tripId, 'EQUAL') });
    }
  });
  const options: Array<['A' | 'B' | 'NEITHER', string]> = [
    ['A', `Plan A (${tally.counts.A ?? 0})`],
    ['B', `Plan B (${tally.counts.B ?? 0})`],
    ['NEITHER', `Neither (${tally.counts.NEITHER ?? 0})`]
  ];
  return (
    <Card data-testid="vote-panel">
      <CardHeader
        title="Vote on the plans"
        sub={tally.rule}
        right={<Chip tone={tally.decided ? 'green' : 'neutral'}>{tally.decided ? `decided: ${tally.leader}` : 'voting open'}</Chip>}
      />
      <div className="flex flex-wrap gap-2 px-4 py-3.5">
        {options.map(([v, label]) => (
          <Button key={v} size="sm" variant={tally.leader === v && tally.counts[v] ? 'primary' : 'secondary'} onClick={() => vote.mutate(v)} loading={vote.isPending}>
            {label}
          </Button>
        ))}
      </div>
    </Card>
  );
}

function RegroupCard({ regroup }: { regroup: RegroupSuggestion }) {
  return (
    <Card data-testid="regroup-card" className="border-brand/40">
      <CardHeader title="Regroup suggested" sub={regroup.reason} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5 text-sm">
        <span>
          Meet at <span className="font-medium">{regroup.point.name}</span>
        </span>
        <span className="font-mono text-xs text-ink-3">by {fmtDateTime(regroup.meet_by)}</span>
        {Object.entries(regroup.member_etas_min).map(([id, min]) => (
          <Chip key={id} tone={min > 20 ? 'amber' : 'neutral'} className="tnum">
            {id.replace('usr_', '')} +{min} min
          </Chip>
        ))}
      </div>
    </Card>
  );
}
