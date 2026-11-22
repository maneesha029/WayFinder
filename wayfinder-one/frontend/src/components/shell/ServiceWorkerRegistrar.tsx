'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/pwa';

/** Registers the service worker once on mount (progressive enhancement). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}
