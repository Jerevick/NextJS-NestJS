'use client';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { ThemeProvider, type Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { unicoreLightTheme } from './theme.js';

export function MuiAppProvider({
  children,
  theme = unicoreLightTheme,
}: {
  children: ReactNode;
  theme?: Theme;
}) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  );
}
