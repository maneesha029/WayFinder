'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, PencilLine, Ticket, XCircle } from 'lucide-react';
import type { Booking } from '@contracts/types';
import { ApiError } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { fmtMoney, idemKey, timeAgo } from '@/lib/format';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { OptionalityCard } from './OptionalityCard';
import { pushToast } from '@/components/ui/Toast';

/** Bookings tab (A6.8): BookingList + VoucherList + cancel/modify with quotes. */
export function BookingsTab({ tripId, planTitle }: { tripId: string; planTitle: (itemId: string) => string }) {
  const title = (itemId: string) => {
    const t = planTitle(itemId);
    return t === itemId ? `Removed item (${itemId})` : t;
  };
  const bookings = useQuery({ queryKey: qk.bookings(tripId), queryFn: () => api.bookings(tripId) });
  const vouchers = useQuery({ queryKey: qk.vouchers(tripId), queryFn: () => api.vouchers(tripId) });
  const optionality = useQuery({ queryKey: qk.optionality(tripId), queryFn: () => api.optionality(tripId), staleTime: 60_000 });
  const qc = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [modifyTarget, setModifyTarget] = useState<Booking | null>(null);

  function invalidate() {
    qc.invalidateQueries({ queryKey: qk.bookings(tripId) });
    qc.invalidateQueries({ queryKey: qk.trip(tripId) });
    qc.invalidateQueries({ queryKey: qk.vouchers(tripId) });
    qc.invalidateQueries({ queryKey: qk.slack(tripId) });
  }

  if (bookings.isLoading) {
    return (
      <div className="space-y-3" aria-hidden>
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
      </div>
    );
  }
  if (bookings.isError) {
    return (
      <Card>
        <ErrorState error={bookings.error} onRetry={() => bookings.refetch()} />
      </Card>
    );
  }

  const list = bookings.data ?? [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Bookings" sub="Honest supplier states — nothing is shown as confirmed before it is." />
        {!list.length ? (
          <EmptyState
            icon={<Ticket className="h-5 w-5" aria-hidden />}
            title="Nothing booked yet"
            body="Approve a plan in Review & book and every booking lands here with its supplier reference."
          />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{title(b.item_id)}</p>
                  <p className="font-mono text-xs text-ink-3">
                    {b.supplier_ref ? `ref ${b.supplier_ref}` : 'ref pending'} · {fmtMoney(b.amount_inr)} ·{' '}
                    {b.refundable ? 'refundable' : 'non-refundable'} · updated {timeAgo(b.updated_at)}
                  </p>
                  {b.status === 'PENDING' ? (
                    <p className="mt-0.5 text-xs text-amber">Waiting for supplier confirmation — this updates live, no refresh needed.</p>
                  ) : null}
                  {b.status === 'FAILED' && b.failure_reason ? <p className="text-xs text-red">{b.failure_reason}</p> : null}
                  {b.penalty_inr ? <p className="text-xs text-amber">penalty {fmtMoney(b.penalty_inr)}</p> : null}
                </div>
                <StatusBadge status={b.status} />
                {b.status !== 'CANCELLED' ? (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" icon={<PencilLine className="h-3.5 w-3.5" />} onClick={() => setModifyTarget(b)}>
                      Modify
                    </Button>
                    <Button size="sm" variant="danger" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => setCancelTarget(b)}>
                      Cancel
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <VoucherList
        state={vouchers}
        onRetry={() => vouchers.refetch()}
      />

      {optionality.data ? <OptionalityCard report={optionality.data} /> : null}

      {cancelTarget ? (
        <CancelDialog
          booking={cancelTarget}
          title={title(cancelTarget.item_id)}
          onClose={() => setCancelTarget(null)}
          onDone={() => {
            setCancelTarget(null);
            invalidate();
          }}
        />
      ) : null}
      {modifyTarget ? (
        <ModifyDialog
          booking={modifyTarget}
          title={title(modifyTarget.item_id)}
          onClose={() => setModifyTarget(null)}
          onDone={() => {
            setModifyTarget(null);
            invalidate();
          }}
        />
      ) : null}
    </div>
  );
}

function VoucherList({
  state,
  onRetry
}: {
  state: ReturnType<typeof useQuery<Array<{ booking_id: string; title: string; reference: string; html_url: string }>>>;
  onRetry: () => void;
}) {
  if (state.isError) {
    return (
      <Card>
        <ErrorState error={state.error} onRetry={onRetry} title="Vouchers unavailable" />
      </Card>
    );
  }
  const list = state.data ?? [];
  if (!list.length) return null;
  return (
    <Card>
      <CardHeader title="Vouchers" sub="Only confirmed bookings get vouchers." />
      <ul className="divide-y divide-line">
        {list.map((v) => (
          <li key={v.booking_id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{v.title}</p>
              <p className="font-mono text-xs text-ink-3">{v.reference}</p>
            </div>
            <a
              href={v.html_url}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:border-brand hover:text-brand"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Open voucher
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** CancelDialog (A6.8): quote first (400 APPROVAL_REQUIRED), then explicit approve. */
export function CancelDialog({
  booking,
  title,
  onClose,
  onDone
}: {
  booking: Booking;
  title: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const keyRef = useRefKey('cancel', booking.id);
  const [quote, setQuote] = useState<{ penalty_inr: number; refundable: boolean; cancel_by: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const call = useMutation({
    mutationFn: (approve: boolean) => api.cancelBooking(booking.id, { approve, idempotency_key: keyRef }, keyRef),
    onSuccess: (_b, approve) => {
      if (!approve) return; // quote phase
      pushToast({ level: 'success', title: 'Booking cancelled', body: `${title} — refund/penalty shown in Bookings.` });
      onDone();
    },
    onError: (e, approve) => {
      if (!approve && e instanceof ApiError && e.code === 'APPROVAL_REQUIRED') {
        setQuote({
          penalty_inr: Number(e.details?.penalty_inr ?? 0),
          refundable: Boolean(e.details?.refundable),
          cancel_by: (e.details?.cancel_by as string | null) ?? null
        });
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not reach the supplier. Try again.');
    }
  });

  return (
    <Dialog open onClose={onClose} title={`Cancel — ${title}`} testid="cancel-dialog"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Keep booking
          </Button>
          <Button
            variant="danger"
            data-testid="cancel-approve"
            loading={call.isPending}
            onClick={() => call.mutate(!quote)}
          >
            {quote ? (quote.penalty_inr === 0 ? 'Approve free cancellation' : `Approve cancel · forfeits ${fmtMoney(quote.penalty_inr)}`) : 'Get quote'}
          </Button>
        </div>
      }
    >
      {error ? (
        <p role="alert" className="rounded-inset bg-red-bg px-3.5 py-2.5 text-sm text-red">{error}</p>
      ) : quote ? (
        <div className="space-y-2.5 text-sm leading-relaxed">
          <p className="font-semibold">{quote.refundable ? 'This booking is refundable.' : 'This booking is non-refundable.'}</p>
          <p className="tnum font-mono text-ink-2">
            penalty {fmtMoney(quote.penalty_inr)}
            {quote.cancel_by ? ` · free cancellation ended ${quote.cancel_by.slice(0, 16).replace('T', ' ')}` : ''}
          </p>
          <p className="text-ink-2">Your money is never moved without this explicit approval. The supplier cancels with an idempotent call.</p>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-ink-2">Fetching the exact penalty from the supplier first — no surprises.</p>
      )}
    </Dialog>
  );
}

/** ModifyDialog: same quote/approve pattern (endpoint 56). */
export function ModifyDialog({
  booking,
  title,
  onClose,
  onDone
}: {
  booking: Booking;
  title: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [newStart, setNewStart] = useState('');
  const [quote, setQuote] = useState<{ fee_inr: number; new_price_inr: number; available: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRefKey('modify', booking.id);

  const call = useMutation({
    mutationFn: (approve: boolean) =>
      api.modifyBooking(
        booking.id,
        { approve, idempotency_key: keyRef, new_start: newStart ? `${newStart}:00+05:30` : null, note: null },
        keyRef
      ),
    onSuccess: (_b, approve) => {
      if (!approve) return;
      pushToast({ level: 'success', title: 'Booking modified', body: `${title} moved to ${newStart} IST.` });
      onDone();
    },
    onError: (e, approve) => {
      if (!approve && e instanceof ApiError && e.code === 'APPROVAL_REQUIRED') {
        setQuote({
          fee_inr: Number(e.details?.fee_inr ?? 0),
          new_price_inr: Number(e.details?.new_price_inr ?? 0),
          available: Boolean(e.details?.available)
        });
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not fetch the quote. Try again.');
    }
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Modify — ${title}`}
      testid="modify-dialog"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            data-testid="modify-approve"
            loading={call.isPending}
            disabled={!newStart || (!!quote && !quote.available)}
            onClick={() => call.mutate(!quote)}
          >
            {quote ? `Approve change · fee ${fmtMoney(quote.fee_inr)}` : 'Get quote'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="modify-start" className="mb-1 block text-sm font-medium">
            New start time (IST)
          </label>
          <input
            id="modify-start"
            type="time"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            className="h-11 w-full rounded-inset border border-line bg-surface-2 px-3 font-mono text-sm"
          />
        </div>
        {quote ? (
          <p className="rounded-inset bg-surface-2 px-3.5 py-2.5 text-sm text-ink-2">
            Rebooking costs <span className="tnum font-semibold">{fmtMoney(quote.fee_inr)}</span>
            {quote.available ? '' : ' — slot unavailable'}; new price {fmtMoney(quote.new_price_inr)}. Approve to apply.
          </p>
        ) : null}
        {error ? <p role="alert" className="rounded-inset bg-red-bg px-3.5 py-2.5 text-sm text-red">{error}</p> : null}
      </div>
    </Dialog>
  );
}

function useRefKey(verb: string, scope: string): string {
  const [key] = useState(() => idemKey(verb, scope.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)));
  return key;
}
