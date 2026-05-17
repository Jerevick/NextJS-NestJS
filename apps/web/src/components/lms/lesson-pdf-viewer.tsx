'use client';

import { useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const DEFAULT_ZOOM_STEP = 0.25;

/** In-app PDF with zoom (`react-pdf`); falls back to iframe when fetching/rendering fails (CORS/password). Prompt **8.2 (2)**. */
export function LessonPdfViewer({
  fileUrl,
  lessonTitle,
  openHref,
}: {
  fileUrl: string;
  lessonTitle: string;
  /** Tab link (same URL as viewer unless caller overrides). */
  openHref?: string;
}) {
  const tabHref = openHref ?? fileUrl;
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [fallback, setFallback] = useState(false);
  const scale = useMemo(() => zoom, [zoom]);

  if (fallback) {
    return (
      <section style={{ marginTop: '1.5rem' }}>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
          Embedding the PDF directly failed (often CORS or auth). Showing browser embed instead.
        </p>
        <iframe
          src={fileUrl}
          title={lessonTitle}
          style={{
            width: '100%',
            minHeight: 520,
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            background: '#0f172a',
          }}
        />
        <p style={{ margin: '0.65rem 0 0', fontSize: '0.85rem' }}>
          <a href={tabHref} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
            Open PDF · new tab →
          </a>
        </p>
      </section>
    );
  }

  return (
    <section style={{ marginTop: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.65rem',
          alignItems: 'center',
          marginBottom: 10,
          fontSize: '0.85rem',
          color: '#475569',
        }}
      >
        <span style={{ fontWeight: 650 }}>Zoom</span>
        <button
          type="button"
          onClick={() =>
            setZoom((z) => Math.max(0.5, Math.round((z - DEFAULT_ZOOM_STEP) * 100) / 100))
          }
          style={{
            padding: '4px 10px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={() =>
            setZoom((z) => Math.min(2.5, Math.round((z + DEFAULT_ZOOM_STEP) * 100) / 100))
          }
          style={{
            padding: '4px 10px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
          aria-label="Zoom in"
        >
          +
        </button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <a
          href={tabHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#2563eb', marginLeft: 'auto' }}
        >
          Open PDF · new tab →
        </a>
      </div>
      <div
        style={{
          overflow: 'auto',
          maxHeight: '72vh',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '0.75rem',
          background: '#f1f5f9',
        }}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          onLoadError={() => setFallback(true)}
        >
          {Array.from({ length: numPages }, (_, i) => (
            <div key={i + 1} style={{ marginBottom: '1rem' }}>
              <Page
                pageNumber={i + 1}
                scale={scale}
                renderTextLayer
                renderAnnotationLayer
                loading={
                  <p style={{ fontSize: '0.85rem', color: '#64748b', padding: '1rem 0' }}>
                    Loading page {i + 1}…
                  </p>
                }
              />
            </div>
          ))}
        </Document>
      </div>
    </section>
  );
}
