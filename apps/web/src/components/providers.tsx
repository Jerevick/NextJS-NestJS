'use client';

import { MuiAppProvider } from '@unicore/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <SessionProvider>
      <MuiAppProvider>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </MuiAppProvider>
    </SessionProvider>
  );
}
