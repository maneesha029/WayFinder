'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CarFront, Navigation, ShieldCheck } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LiveStatus } from '@contracts/types';
import { api } from '@/lib/api/endpoints';
import { qk } from '@/lib/queryKeys';
import { fmtDuration, fmtMoney, fmtTime, slackLabel } from '@/lib/format';
import { useDemoRoute } from '@/hooks/useDemoRoute';
import { useDemoState, setDrivePos } from '@/lib/demoStore';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Switch } from '@/components/ui/Switch';
import { SimBadge } from '@/components/ui/SimBadge';
import { pushToast } from '@/components/ui/Toast';

const W = 460;
const H = 300;
const PAD = 28;

function makeProjector(points: Array<{ lat: number; lng: number }>) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return (lat: number, lng: number) => ({
    x: PAD + ((lng - minLng) / (maxLng - minLng)) * (W - PAD * 2),
    y: H - PAD - ((lat - minLat) / (maxLat - minLat)) * (H - PAD * 2)
  });
}

/** LiveMap (A6.6): MapLibre GL reads the self-hosted PMTiles file when present;
 * otherwise the crafted SVG route fallback renders. Never bulk-fetches OSM tiles. */
export function LiveMap({ live }: { live: LiveStatus }) {
  const [hasMapFile, setHasMapFile] = useState(false);
  const mapDiv = useRef<HTMLDivElement>(null);
  const demo = useDemoState();

  useEffect(() => {
    fetch('/maps/south-india.pmtiles', { method: 'HEAD' })
      .then((r) => setHasMapFile(r.ok))
      .catch(() => setHasMapFile(false));
  }, []);

  // MapLibre path: only wired when the regional PMTiles file is present.
  useEffect(() => {
    if (!hasMapFile || !mapDiv.current) return;
    let map: { remove: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        const { Protocol } = await import('pmtiles');
        const protocol = new Protocol();
        maplibregl.addProtocol('pmtiles', protocol.tile as unknown as Parameters<typeof maplibregl.addProtocol>[1]);
        map = new maplibregl.Map({
          container: mapDiv.current!,
          style: {
            version: 8,
            sources: {
              basemap: {
                type: 'raster',
                tiles: ['pmtiles:///maps/south-india.pmtiles/{z}/{x}/{y}.png'],
                attribution: '© OpenStreetMap contributors'
              }
            },
            layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }]
          },
          center: [live.location?.lng ?? 76.4, live.location?.lat ?? 10.1],
          zoom: 9.2
        });
        if (cancelled) map.remove();
      } catch {
        /* fall back to SVG */
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [hasMapFile, live.location?.lat, live.location?.lng]);

  const route = useDemoRoute();
  const rawPoints = route.data ?? [];
  const points = useMemo(() => {
    if (!rawPoints.length) return [];
    const project = makeProjector(rawPoints);
    return rawPoints.map((p) => project(p.lat, p.lng));
  }, [rawPoints]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const here = points.length && (demo.driving || demo.drivePos > 0) ? points[Math.min(points.length - 1, Math.round(demo.drivePos * (points.length - 1)))] : null;
  const dest = points[points.length - 1];
  const start = points[0];

  return (
    <Card data-testid="live-map" className="overflow-hidden">
      <CardHeader
        title="Live position"
        sub={
          <span className="inline-flex flex-wrap items-center gap-2">
            {live.tracking_on ? 'Tracking on — latest point only, never a history.' : 'Tracking off.'}
            <SimBadge source="Simulated drive" />
          </span>
        }
        right={
          <Chip tone={live.tracking_on ? 'green' : 'neutral'} icon={<Navigation className="h-3 w-3" aria-hidden />}>
            {live.tracking_on ? 'on' : 'off'}
          </Chip>
        }
      />
      {hasMapFile ? (
        <div ref={mapDiv} className="h-72 w-full" aria-label="Live map" role="application" />
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-72 w-full bg-paper-wash" role="img" aria-label="Route map (schematic fallback — the PMTiles regional file is not built yet; run `make maps`)">
          <defs>
            <linearGradient id="route-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2F5D9E" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
            <pattern id="terrain" width="26" height="26" patternUnits="userSpaceOnUse">
              <rect width="26" height="26" fill="#F1F3F6" />
              <path d="M0 26 L26 0" stroke="#DDE1E7" strokeWidth="1" />
              <path d="M0 8 L8 0 M18 26 L26 18" stroke="#E7EAEF" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#terrain)" />
          {path ? <path d={path} fill="none" stroke="url(#route-grad)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" /> : null}
          {start ? (
            <>
              <circle cx={start.x} cy={start.y} r="5" fill="#2F5D9E" />
              <text x={start.x + 8} y={start.y - 6} fontSize="10" fill="#4A5160" fontFamily="var(--font-mono)">Kochi airport</text>
            </>
          ) : null}
          {dest ? (
            <>
              <circle cx={dest.x} cy={dest.y} r="5" fill="#157A55" />
              <text x={dest.x - 62} y={dest.y - 8} fontSize="10" fill="#4A5160" fontFamily="var(--font-mono)">Munnar</text>
            </>
          ) : null}
          {here ? (
            <g>
              <circle cx={here.x} cy={here.y} r="11" fill="#1D4ED8" opacity="0.2" className="animate-pulse" />
              <circle cx={here.x} cy={here.y} r="5.5" fill="#1D4ED8" stroke="#fff" strokeWidth="2" />
            </g>
          ) : null}
          <text x={W - PAD} y={H - 8} fontSize="9" textAnchor="end" fill="#61697A">
            © OpenStreetMap contributors · schematic fallback
          </text>
        </svg>
      )}
      <DriveControls tripId={live.trip_id} />
    </Card>
  );
}

function DriveControls({ tripId }: { tripId: string }) {
  const demo = useDemoState();
  const qc = useQueryClient();
  const route = useDemoRoute();
  const points = route.data ?? [];
  const ping = useMutation({
    mutationFn: (pos: number) => {
      if (!points.length) return Promise.resolve(null as never);
      const p = points[Math.min(points.length - 1, Math.round(pos * (points.length - 1)))];
      return api.location(tripId, { lat: p.lat, lng: p.lng, speed_kmh: 28, ts: new Date().toISOString() });
    },
    onSuccess: (l) => {
      if (l) qc.setQueryData(qk.live(tripId), l);
    }
  });

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
      <CarFront className="h-4.5 w-4.5 text-ink-2" aria-hidden />
      <label className="flex min-w-52 flex-1 items-center gap-2.5 text-sm text-ink-2" htmlFor="drive-slider">
        Simulated drive
        <input
          id="drive-slider"
          data-testid="drive-slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={demo.drivePos}
          onChange={(e) => {
            const v = Number(e.target.value);
            setDrivePos(v);
            ping.mutate(v);
          }}
          className="h-1.5 flex-1 cursor-pointer accent-[var(--brand)]"
        />
        <span className="tnum font-mono text-xs">{Math.round(demo.drivePos * 100)}%</span>
      </label>
    </div>
  );
}

/** CommitmentList: next commitment with slack chip. */
export function CommitmentList({ live }: { live: LiveStatus }) {
  const c = live.next_commitment;
  return (
    <Card>
      <CardHeader title="Next commitment" sub="What you must reach next, with solver-checked slack." />
      {c ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div>
            <p className="font-medium">{c.title}</p>
            <p className="tnum font-mono text-xs text-ink-3">
              arrive by {fmtTime(c.arrive_by)} · ETA {fmtDuration(c.eta_min)}
            </p>
          </div>
          <Chip tone={c.health === 'GREEN' ? 'green' : c.health === 'AMBER' ? 'amber' : 'red'} className="tnum">
            slack {slackLabel(c.slack_min).text}
          </Chip>
        </div>
      ) : (
        <p className="px-4 py-4 text-sm text-ink-2">No commitment in the current window.</p>
      )}
    </Card>
  );
}

/** RerouteOptionCard (A6.6): mode, ETA, slack, cost delta, source. */
export function RerouteOptionCard({
  option,
  onApply
}: {
  option: LiveStatus['reroute_options'][number];
  onApply: (o: LiveStatus['reroute_options'][number]) => void;
}) {
  return (
    <article data-testid={`reroute-${option.id}`} className="rounded-card border border-line bg-surface px-3.5 py-3 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{option.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{option.note}</p>
        </div>
        <div className="text-right">
          <p className="tnum font-mono text-xs text-ink-3">
            {option.eta_min !== null ? `ETA ${fmtDuration(option.eta_min)}` : 'any slot'} · slack {fmtDuration(option.slack_min)}
          </p>
          <p className="tnum font-mono text-sm font-semibold">
            {option.delta_cost_inr > 0 ? `+${fmtMoney(option.delta_cost_inr)}` : 'no extra cost'}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-ink-3">
          {option.mode.toLowerCase()} · {option.provenance.source}
        </span>
        {option.action ? (
          <Button size="sm" variant="secondary" onClick={() => onApply(option)}>
            {option.action.label}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

/** Tracking toggle with the privacy sentence (A6.6). */
export function TrackingToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Location sharing</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-green" aria-hidden />
            Location is used only during active travel windows and kept only as your latest point — there is no history.
          </p>
        </div>
        <Switch checked={on} onChange={(v) => { onChange(v); pushToast({ level: 'info', title: v ? 'Tracking on' : 'Tracking off', body: v ? 'Only your latest point is stored.' : 'No location is sent.' }); }} label="Share location during travel windows" testid="tracking-toggle" />
      </div>
    </Card>
  );
}
