'use client';

import type { ComponentProps } from 'react';
import dynamic from 'next/dynamic';

import type { HlsVideoPlayer as HlsVideoPlayerComponent } from './hls-video-player';
import type { LessonPdfViewer as LessonPdfViewerComponent } from './lesson-pdf-viewer';

const loadingStyle = {
  marginTop: '1.5rem',
  padding: '1rem',
  color: '#64748b',
  fontSize: '0.9rem',
} as const;

export const LessonPdfViewer = dynamic<ComponentProps<typeof LessonPdfViewerComponent>>(
  () => import('./lesson-pdf-viewer.js').then((m) => m.LessonPdfViewer),
  { ssr: false, loading: () => <p style={loadingStyle}>Loading document viewer…</p> },
);

export const HlsVideoPlayer = dynamic<ComponentProps<typeof HlsVideoPlayerComponent>>(
  () => import('./hls-video-player.js').then((m) => m.HlsVideoPlayer),
  { ssr: false, loading: () => <p style={loadingStyle}>Loading video player…</p> },
);
