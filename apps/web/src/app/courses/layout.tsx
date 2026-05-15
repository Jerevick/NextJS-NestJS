import type { ReactNode } from 'react';
import { Lora, Plus_Jakarta_Sans } from 'next/font/google';

const heading = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-lms-heading',
  display: 'swap',
});

const reading = Lora({
  subsets: ['latin'],
  variable: '--font-lms-reading',
  display: 'swap',
});

export default function CoursesLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${heading.variable} ${reading.variable}`}
      style={{
        minHeight: '100vh',
        fontFamily: `var(--font-lms-heading), ui-sans-serif, system-ui`,
      }}
    >
      {children}
    </div>
  );
}
