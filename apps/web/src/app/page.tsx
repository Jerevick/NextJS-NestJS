import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page';

export const metadata: Metadata = {
  title: 'UniCore — University SIS + LMS Platform',
  description:
    'One platform for admissions, academics, finance, HR, and learning — built for multi-campus universities and every institution type.',
};

export default function HomePage() {
  return <LandingPage />;
}
