'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { CircleCheck } from 'lucide-react';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { LogoMark } from '@/components/shell/AppShell';

/**
 * Voucher document (target of Voucher.html_url in fixtures mode; the backend
 * serves the HTML in live mode). Paper-ticket styling, print friendly.
 */
export default function VoucherPage() {
  const params = useParams<{ booking_id: string }>();
  const bookingId = params.booking_id;
  const vouchers = useQuery({ queryKey: ['vouchers-all'], queryFn: () => api.vouchers('trip_golden') });
  const bookings = useQuery({ queryKey: qk.bookings('trip_golden'), queryFn: () => api.bookings('trip_golden') });

  const voucher = vouchers.data?.find((v) => v.booking_id === bookingId);
  const booking = bookings.data?.find((b) => b.id === bookingId);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-wash px-4 py-10 print:bg-white">
      <div className="w-full max-w-lg">
        {vouchers.isLoading || bookings.isLoading ? (
          <Skeleton className="h-96 rounded-card" />
        ) : !voucher || !booking ? (
          <div className="rounded-card border border-line bg-surface shadow-card">
            <EmptyState icon={<CircleCheck className="h-5 w-5" aria-hidden />} title="Voucher not found" body="This voucher belongs to a booking that is not confirmed yet, or the link is wrong." />
          </div>
        ) : (
          <>
            <article className="overflow-hidden rounded-card border border-line bg-surface shadow-pop print:shadow-none">
              <div className="flex items-center justify-between gap-3 bg-grad-brand px-5 py-4 text-brand-ink">
                <span className="flex items-center gap-2.5">
                  <LogoMark size={26} />
                  <span className="font-display text-lg">Wayfinder One</span>
                </span>
                <span className="font-mono text-xs opacity-80">voucher / {booking.supplier_ref ?? '—'}</span>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{booking.item_id}</p>
                  <h1 className="font-display text-2xl">{voucher.title}</h1>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-inset bg-surface-2 px-3 py-2.5">
                    <dt className="text-xs text-ink-3">Reference</dt>
                    <dd className="font-mono font-semibold">{voucher.reference}</dd>
                  </div>
                  <div className="rounded-inset bg-surface-2 px-3 py-2.5">
                    <dt className="text-xs text-ink-3">Amount</dt>
                    <dd className="tnum font-mono font-semibold">₹{booking.amount_inr.toLocaleString('en-IN')}</dd>
                  </div>
                  <div className="rounded-inset bg-surface-2 px-3 py-2.5">
                    <dt className="text-xs text-ink-3">Status</dt>
                    <dd className="font-mono font-semibold">{booking.status}</dd>
                  </div>
                  <div className="rounded-inset bg-surface-2 px-3 py-2.5">
                    <dt className="text-xs text-ink-3">Refundable</dt>
                    <dd className="font-mono font-semibold">{booking.refundable ? 'yes' : 'no'}</dd>
                  </div>
                </dl>
                <p className="font-mono text-xs text-ink-3">
                  Simulated booking from the TBO-style sandbox. Present the reference at the counter; no real ticket is
                  issued by this prototype.
                </p>
              </div>
            </article>
            <p className="mt-4 text-center text-xs text-ink-3 print:hidden">Use your browser&apos;s print dialog for a PDF copy.</p>
          </>
        )}
      </div>
    </div>
  );
}
