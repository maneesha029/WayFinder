'use client';

import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { AppShell } from '@/components/shell/AppShell';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { EvidencePrintView, useEvidence } from '@/components/evidence/EvidenceTimeline';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';

/** `/trips/[id]/evidence` (A6.7): print-ready page. */
export default function EvidencePrintPage({ params }: { params: { id: string } }) {
  const pack = useEvidence(params.id);

  return (
    <AppShell tripId={params.id}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href={`/trips/${params.id}?tab=evidence`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to cockpit
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="print-hidden inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-sm font-medium text-brand-ink hover:bg-brand-strong"
        >
          <Printer className="h-4 w-4" aria-hidden />
          Print / Save as PDF
        </button>
      </div>
      {pack.isLoading ? (
        <Skeleton className="h-96 rounded-card" />
      ) : pack.isError ? (
        <div className="rounded-card border border-line bg-surface shadow-card">
          <ErrorState error={pack.error} onRetry={() => pack.refetch()} />
        </div>
      ) : (
        <EvidencePrintView pack={pack.data!} />
      )}
    </AppShell>
  );
}
