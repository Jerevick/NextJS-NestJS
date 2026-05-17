import { createTheme, type Theme } from '@mui/material/styles';

const navy = '#1e3a5f';
const amber = '#f59e0b';

export const unicoreLightTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: navy },
    secondary: { main: amber },
    background: { default: '#f8fafc', paper: '#ffffff' },
  },
  typography: {
    fontFamily: 'var(--font-sans, "IBM Plex Sans", system-ui, sans-serif)',
    h1: { fontFamily: 'var(--font-serif, "Crimson Pro", Georgia, serif)' },
    h2: { fontFamily: 'var(--font-serif, "Crimson Pro", Georgia, serif)' },
    h3: { fontFamily: 'var(--font-serif, "Crimson Pro", Georgia, serif)' },
  },
  shape: { borderRadius: 8 },
});

export const unicoreAdminTheme: Theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#2563eb' },
    secondary: { main: amber },
    background: { default: '#0a0a0a', paper: '#111827' },
    text: { primary: '#e2e8f0', secondary: '#94a3b8' },
  },
  typography: {
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  },
  shape: { borderRadius: 8 },
});
