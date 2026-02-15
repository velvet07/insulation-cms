'use client';

import { useState, useMemo } from 'react';

interface PdfViewerProps {
  url: string;
  className?: string;
}

/**
 * PDF megjelenítő — a böngésző beépített PDF viewer-jét használja iframe-ben,
 * a Next.js API proxy-n keresztül (CORS-mentes, qpdf titkosítást is kezeli).
 */
export function PdfViewer({ url, className = '' }: PdfViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Proxy URL: a szerver oldalon tölti le a PDF-et (nincs CORS, nincs encryption probléma)
  // A fájlnév az URL path-ban van, hogy a böngésző PDF viewer azt jelenítse meg címként
  const proxyUrl = useMemo(() => {
    if (!url) return '';
    const segments = url.split('/');
    const filename = segments[segments.length - 1] || 'document.pdf';
    return `/api/pdf-proxy/${encodeURIComponent(filename)}?url=${encodeURIComponent(url)}`;
  }, [url]);

  if (!url) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <p className="text-gray-500">Nincs PDF URL megadva.</p>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {loading && !error && (
        <div className="flex items-center justify-center h-24">
          <p className="text-gray-500">PDF betöltése...</p>
        </div>
      )}
      
      {error && (
        <div className="flex flex-col items-center justify-center h-96 p-8">
          <p className="text-red-500 mb-4">A PDF nem tölthető be az előnézetben.</p>
          <a
            href={proxyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            PDF megnyitása új ablakban
          </a>
        </div>
      )}

      <iframe
        src={proxyUrl}
        className={`w-full border-0 rounded-lg bg-gray-50 dark:bg-gray-900 ${loading ? 'h-0 overflow-hidden' : ''}`}
        style={{ minHeight: loading ? 0 : '600px', height: loading ? 0 : '80vh' }}
        title="PDF előnézet"
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
      />
    </div>
  );
}
