'use client';

import { MuiAppProvider } from '@unicore/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { NotificationsRealtimeProvider } from '@/components/notifications/notifications-realtime-provider';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus>
      <MuiAppProvider>
        <QueryClientProvider client={client}>
          <NotificationsRealtimeProvider>{children}</NotificationsRealtimeProvider>
          <Toaster />
        </QueryClientProvider>
      </MuiAppProvider>
    </SessionProvider>
  );
}
