'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ToastHost } from '@/components/ui/Toast';
import { ServiceWorkerRegistrar } from '@/components/shell/ServiceWorkerRegistrar';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <ToastHost />
      <ServiceWorkerRegistrar />
    </QueryClientProvider>
  );
}
