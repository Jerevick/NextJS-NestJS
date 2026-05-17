'use client';

import { MuiAppProvider, unicoreAdminTheme } from '@unicore/ui';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <MuiAppProvider theme={unicoreAdminTheme}>{children}</MuiAppProvider>;
}
