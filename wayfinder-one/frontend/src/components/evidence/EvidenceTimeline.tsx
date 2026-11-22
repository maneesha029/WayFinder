'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import clsx from 'clsx';
import { Check, Copy, Printer } from 'lucide-react';
import type { EvidenceEvent, EvidencePack } from '@contracts/types';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { fmtDateTime, fmtMoney } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

const kindIcon: Record<EvidenceEvent['kind'], string> = {
  SIGNAL: '📡',
  ALERT: '🔔',
  SWITCH: '🔀',
  BOOKING: '🎫',
  COST: '💸',
  DRAFT: '✉️',
  NOTE: '📝'
};

export function useEvidence(tripId: string, enabled = true) {
  return useQuery({ queryKey: qk.evidence(tripId), queryFn: () => api.evidence(tripId), enabled });
}

/** Evidence tab (A6.7): timeline, totals, claim sections with copy + print. */
export function EvidenceTab({ tripId }: { tripId: string }) {
  const pack = useEvidence(tripId);

  if (pack.isLoading) {
    return (
      <div className="space-y-3" aria-hidden>
        <Skeleton className="h-44 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
      </div>
    );
  }
  if (pack.isError) {
    return (
      <Card>
        <ErrorState error={pack.error} onRetry={() => pack.refetch()} title="Evidence unavailable" />
      </Card>
    );
  }
  const data = pack.data!;
  if (!data.events.length) {
    return (
      <Card>
        <EmptyState
          icon={<Printer className="h-5 w-5" aria-hidden />}
          title="No evidence yet"
          body="Every booking, signal, alert and switch writes a timestamped event. After a disruption, this becomes a claim-ready pack."
        />
      </Card>
    );
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="px-4 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Total delay</p>
          <p className="tnum font-display text-2xl">{data.total_delay_min} min</p>
        </Card>
        <Card className="px-4 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Extra cost</p>
          <p className="tnum font-display text-2xl">{fmtMoney(data.extra_cost_inr)}</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Timeline" sub="Every event with its source — the story a claim officer can follow." />
        <ol className="relative space-y-0 px-4 py-3">
          {data.events.map((e, i) => (
            <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
              {i < data.events.length - 1 ? <span className="absolute left-[15px] top-8 h-full w-px bg-line" aria-hidden /> : null}
              <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-sm" aria-hidden>
                {kindIcon[e.kind]}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{e.detail}</span>
                </p>
                <p className="font-mono text-xs text-ink-3">
                  {e.kind.toLowerCase()} · {e.source} · {fmtDateTime(e.ts)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="space-y-3">
        {data.claim_sections.map((c) => (
          <ClaimCard key={c.type} section={c} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/trips/${tripId}/evidence/print`}
          target="_blank"
          rel="noopener"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-4 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-strong"
        >
          <Printer className="h-4 w-4" aria-hidden />
          Print / Save as PDF
        </a>
        <span className="text-xs text-ink-3">Facts only — the pack never asserts eligibility for a claim.</span>
      </div>
    </div>
  );
}

function ClaimCard({ section }: { section: EvidencePack['claim_sections'][number] }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card data-testid={`claim-${section.type.toLowerCase()}`}>
      <CardHeader
        title={section.type.charAt(0) + section.type.slice(1).toLowerCase()}
        right={section.amount_inr !== null && section.amount_inr !== undefined ? <span className="tnum font-mono text-sm">{fmtMoney(section.amount_inr)}</span> : undefined}
      />
      <div className="px-4 py-3">
        <p className="text-sm leading-relaxed text-ink-2">{section.summary}</p>
        {section.attachments.length ? (
          <p className="mt-1.5 font-mono text-xs text-ink-3">attachments: {section.attachments.join(', ')}</p>
        ) : null}
        <Button
          size="sm"
          variant="secondary"
          className="mt-3"
          icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          onClick={async () => {
            await navigator.clipboard.writeText(`${section.type}\n${section.summary}`);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          }}
        >
          {copied ? 'Copied' : 'Copy summary'}
        </Button>
      </div>
    </Card>
  );
}

/** Shared print view used by /trips/[id]/evidence. */
export function EvidencePrintView({ pack }: { pack: EvidencePack }) {
  return (
    <div className="print-page mx-auto max-w-3xl rounded-card border border-line bg-surface p-6 shadow-card sm:p-10">
      <header className="mb-6 border-b border-line pb-4">
        <h1 className="font-display text-2xl">Evidence pack</h1>
        <p className="mt-1 font-mono text-xs text-ink-3">
          trip {pack.trip_id} · generated {fmtDateTime(pack.generated_at)} · delay {pack.total_delay_min} min · extra cost{' '}
          {fmtMoney(pack.extra_cost_inr)}
        </p>
      </header>
      <h2 className="mb-2 font-display text-lg">Timeline</h2>
      <ol className="mb-6 space-y-1.5">
        {pack.events.map((e) => (
          <li key={e.id} className="text-sm leading-relaxed">
            <span className="font-mono text-xs text-ink-3">{fmtDateTime(e.ts)}</span> — {e.detail}{' '}
            <span className={clsx('font-mono text-xs text-ink-3')}>({e.source})</span>
          </li>
        ))}
      </ol>
      <h2 className="mb-2 font-display text-lg">Claim sections</h2>
      <div className="space-y-3">
        {pack.claim_sections.map((c) => (
          <section key={c.type} className="rounded-inset border border-line px-3.5 py-3">
            <p className="text-sm font-semibold">
              {c.type}
              {c.amount_inr !== null && c.amount_inr !== undefined ? ` · ${fmtMoney(c.amount_inr)}` : ''}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{c.summary}</p>
          </section>
        ))}
      </div>
      <p className="mt-6 border-t border-line pt-3 text-xs text-ink-3">
        Produced by WAYFINDER ONE from recorded events and sources. This pack reports facts; it does not assert claim
        eligibility.
      </p>
    </div>
  );
}
