'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/endpoints';

/**
 * The simulated-drive route (B6.3 #26). Live mode: GET /demo/route.
 * Fixtures mode: served by the local world. Cached for the session — the
 * route never changes mid-run, so drive-play and the map share one fetch.
 */
export function useDemoRoute() {
  return useQuery({
    queryKey: ['demoRoute'],
    queryFn: () => api.demoRoute(),
    staleTime: Infinity,
    select: (d) => d.points
  });
}
