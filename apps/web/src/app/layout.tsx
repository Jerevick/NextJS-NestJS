import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IBM_Plex_Sans, Crimson_Pro } from 'next/font/google';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'UniCore',
};

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const serif = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: ['400', '600'],
  display: 'swap',
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} ${serif.variable}`}
        style={{ fontFamily: 'var(--font-sans), system-ui' }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
