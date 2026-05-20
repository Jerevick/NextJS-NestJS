'use client';

import { MuiAppProvider } from '@unicore/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { NotificationsRealtimeProvider } from '@/components/notifications/notifications-realtime-provider';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <SessionProvider>
      <MuiAppProvider>
        <QueryClientProvider client={client}>
          <NotificationsRealtimeProvider>{children}</NotificationsRealtimeProvider>
        </QueryClientProvider>
      </MuiAppProvider>
    </SessionProvider>
  );
}
