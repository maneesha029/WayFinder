'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import type { Plan } from '@contracts/types';
import { ApiError } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { idemKey, fmtMoney } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SimBadge } from '@/components/ui/SimBadge';
import { OptionalityCard } from './OptionalityCard';

interface DriftItem {
  item_id: string;
  old_inr: number;
  new_inr: number;
}

/**
 * BookDialog (A6.2): itemised review → explicit approve → honest per-item states.
 * PRICE_CHANGED opens a re-confirm view with old→new prices. The idempotency key
 * is created once and reused across retries (A7).
 */
export function BookDialog({
  open,
  onClose,
  tripId,
  plan
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  plan: Plan;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const [drift, setDrift] = useState<DriftItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef(idemKey('book', tripId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)));

  useEffect(() => {
    if (!open) {
      setDrift(null);
      setError(null);
      keyRef.current = idemKey('book', tripId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12));
    }
  }, [open, tripId]);

  const book = useMutation({
    mutationFn: () => api.book(tripId, { plan: plan.kind, approve: true, idempotency_key: keyRef.current }, keyRef.current),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.trip(tripId) });
      qc.invalidateQueries({ queryKey: qk.bookings(tripId) });
      qc.invalidateQueries({ queryKey: qk.slack(tripId) });
      qc.invalidateQueries({ queryKey: qk.trips });
      qc.invalidateQueries({ queryKey: qk.vouchers(tripId) });
      // approved → straight to the trip dashboard's Bookings page (A6 flow fix)
      onClose();
      router.push(`/trips/${tripId}?tab=bookings`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'PRICE_CHANGED') {
        setDrift((e.details?.items as DriftItem[] | undefined) ?? []);
        return;
      }
      setError(e instanceof Error ? e.message : 'Booking failed. Try again.');
    }
  });

  const refundable = plan.items.filter((i) => i.refundable);
  const total = drift
    ? plan.items.reduce((s, i) => {
        const d = drift.find((x) => x.item_id === i.id);
        return s + (d ? d.new_inr : i.price_inr);
      }, 0)
    : plan.total_cost_inr;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      testid="book-dialog"
      width="md"
      title={drift ? 'Prices moved' : `Review & book — Plan ${plan.kind}`}
      footer={
        drift ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              data-testid="book-approve"
              onClick={() => {
                setError(null);
                book.mutate();
              }}
              loading={book.isPending}
            >
              Approve new total {fmtMoney(total)}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs leading-snug text-ink-2">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-green" aria-hidden />
              Nothing is booked until you approve. Retries reuse the same key.
            </p>
            <Button data-testid="book-approve" onClick={() => book.mutate()} loading={book.isPending}>
              Approve and book · {fmtMoney(total)}
            </Button>
          </div>
        )
      }
    >
      {drift ? (
        <div className="space-y-3" role="alert">
          <p className="flex items-start gap-2 text-sm text-amber">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Fares moved since we checked. Nothing was booked. Review the new prices and approve if you still want it.
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">
            {drift.map((d) => {
              const item = plan.items.find((i) => i.id === d.item_id);
              return (
                <li key={d.item_id} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                  <span>{item?.title ?? d.item_id}</span>
                  <span className="tnum font-mono">
                    {fmtMoney(d.old_inr)} → <span className="font-semibold">{fmtMoney(d.new_inr)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line">
            {plan.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.title}</p>
                  <p className="text-xs text-ink-3">
                    {i.refundable ? 'Refundable' : 'Non-refundable'}
                    {i.cancel_by ? ` · free cancellation until ${i.cancel_by.slice(0, 10)}` : ''}
                  </p>
                </div>
                <span className="tnum font-mono text-sm">{fmtMoney(i.price_inr)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-inset bg-surface-2 px-3.5 py-2.5">
            <span className="text-sm">
              Total · <span className="text-ink-2">{refundable.length} of {plan.items.length} refundable</span>
            </span>
            <span className="tnum font-display text-xl">{fmtMoney(total)}</span>
          </div>
          <p className="text-xs leading-relaxed text-ink-2">
            Meals and shopping are not included. Every price carries its source and checked time.
            <SimBadge source="TBO Sandbox" />
          </p>
          <OptionalityCardInline tripId={tripId} />
          {error ? (
            <p role="alert" className="rounded-inset bg-red-bg px-3.5 py-2.5 text-sm text-red">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}

function OptionalityCardInline({ tripId }: { tripId: string }) {
  const report = useQuery({ queryKey: qk.optionality(tripId), queryFn: () => api.optionality(tripId), staleTime: 60_000 });
  if (!report.data) return null;
  return <OptionalityCard compact report={report.data} />;
}
