'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, HardDriveDownload, RefreshCw } from 'lucide-react';
import type { OfflineManifest } from '@contracts/types';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { downloadOfflinePack, readPackMeta, type PackResult } from '@/lib/pwa';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/Skeleton';
import { pushToast } from '@/components/ui/Toast';
import { fmtDateTime } from '@/lib/format';

const kindLabels: Record<string, string> = {
  ITINERARY: 'Itinerary + plans',
  VOUCHER: 'Voucher',
  PLAN_B: 'Evidence & Plan B',
  CONTACTS: 'Trusted contacts',
  MAP: 'Regional map',
  SOS: 'SOS page'
};

function kb(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Offline panel (A6b PWA): download the offline pack + regional map into Cache
 * Storage, show size + last sync, manifest version.
 */
export function OfflinePanel({ tripId }: { tripId: string }) {
  const manifest = useQuery({ queryKey: qk.manifest(tripId), queryFn: () => api.offlineManifest(tripId) });
  const meta = useQuery({ queryKey: ['packMeta', tripId], queryFn: () => readPackMeta(tripId) });

  const download = useMutation({
    mutationFn: async () => {
      const pack = await downloadOfflinePack(tripId, (p) => api.offlinePack(p).then(() => p as never));
      // also try the regional map file if the project built it (make maps)
      try {
        const res = await fetch('/maps/south-india.pmtiles', { method: 'HEAD' });
        if (res.ok) {
          const cache = await caches.open('wf-offline-pack-v1');
          const full = await fetch('/maps/south-india.pmtiles');
          await cache.put('/maps/south-india.pmtiles', full.clone());
          pack.bytes += Number(full.headers.get('content-length') ?? 0);
        }
      } catch {
        /* map stays online-only */
      }
      return pack;
    },
    onSuccess: (p: PackResult) => {
      pushToast({ level: 'success', title: 'Offline pack downloaded', body: `${kb(p.bytes)} cached · manifest v${p.version}` });
      window.setTimeout(() => window.location.reload(), 600);
    },
    onError: (e) => pushToast({ level: 'warning', title: 'Download failed', body: e instanceof Error ? e.message : undefined })
  });

  if (manifest.isLoading) {
    return (
      <Card data-testid="offline-panel">
        <CardHeader title="Offline trip pack" sub="Itinerary, vouchers, Plan B, contacts and the regional map." />
        <div className="px-4 py-4">
          <Skeleton className="h-24 rounded-inset" />
        </div>
      </Card>
    );
  }

  return (
    <Card data-testid="offline-panel">
      <CardHeader
        title="Offline trip pack"
        sub="Itinerary, vouchers, Plan B, contacts and the regional map — usable with the network off."
        right={
          <Button
            size="sm"
            data-testid="offline-download"
            icon={<HardDriveDownload className="h-3.5 w-3.5" />}
            onClick={() => download.mutate()}
            loading={download.isPending}
          >
            {meta.data ? 'Re-download' : 'Download for offline'}
          </Button>
        }
      />
      {manifest.isError || !manifest.data ? (
        <p className="px-4 py-4 text-sm text-ink-2">Manifest unavailable.</p>
      ) : (
        <div className="px-4 py-3.5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Chip tone="neutral" className="font-mono">
              manifest v{manifest.data.version}
            </Chip>
            {meta.data ? (
              <Chip tone="green" icon={<Download className="h-3 w-3" aria-hidden />}>
                {kb(meta.data.bytes)} cached · synced {fmtDateTime(meta.data.syncedAt)}
              </Chip>
            ) : (
              <Chip tone="neutral">not downloaded yet</Chip>
            )}
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-inset border border-line">
            {manifest.data.resources.map((r) => (
              <li key={r.url} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  <span className="font-mono text-xs text-ink-3">{kindLabels[r.kind] ?? r.kind}</span> · {r.url}
                </span>
                <span className="tnum font-mono text-xs text-ink-3">{kb(r.bytes)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between px-3 py-2 text-sm text-ink-2">
              <span>
                <span className="font-mono text-xs text-ink-3">Regional map</span> · /maps/south-india.pmtiles
              </span>
              <span className="font-mono text-xs text-ink-3">
                {download.isPending ? 'checking…' : 'included when built (`make maps`)'}
              </span>
            </li>
          </ul>
          <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-ink-3">
            <RefreshCw className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            The pack version bumps whenever the plan or bookings change; a stale pack is flagged before the trip goes
            offline.
          </p>
        </div>
      )}
    </Card>
  );
}
