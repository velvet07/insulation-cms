'use client';

import { useState, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// React-pdf stílusok importálása
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// PDF.js worker beállítása - react-pdf által használt verzióval
if (typeof window !== 'undefined') {
  // Használjuk a react-pdf által használt pdfjs-dist verzióját
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface PdfViewerProps {
  url: string;
  className?: string;
}

export function PdfViewer({ url, className = '' }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.5);

  // Memoizált options a felesleges újratöltés elkerülésére
  const documentOptions = useMemo(() => ({
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
  }), []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  }

  function onDocumentLoadError(error: Error) {
    console.error('PDF load error:', error);
    setError('A PDF nem tölthető be. Kérjük, próbálja meg letölteni.');
    setLoading(false);
  }

  return (
    <div className={`w-full ${className}`}>
      {loading && (
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">PDF betöltése...</p>
        </div>
      )}
      
      {error && (
        <div className="flex flex-col items-center justify-center h-96 p-8">
          <p className="text-red-500 mb-4">{error}</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            PDF megnyitása új ablakban
          </a>
        </div>
      )}

      <div className="flex flex-col items-center w-full">
        {numPages && numPages > 1 && (
          <div className="mb-4 flex items-center gap-4">
            <button
              onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
              disabled={pageNumber <= 1}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50"
            >
              Előző
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {pageNumber} / {numPages}
            </span>
            <button
              onClick={() => setPageNumber((prev) => Math.min(numPages, prev + 1))}
              disabled={pageNumber >= numPages}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded disabled:opacity-50"
            >
              Következő
            </button>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => setScale((prev) => Math.max(0.5, prev - 0.1))}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded"
              >
                -
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[60px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((prev) => Math.min(3, prev + 0.1))}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded"
              >
                +
              </button>
            </div>
          </div>
        )}

        {!error && (
          <div className="w-full border rounded-lg overflow-auto bg-gray-50 dark:bg-gray-900 flex justify-center p-4" style={{ maxHeight: '80vh' }}>
            <Document
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center h-96">
                  <p className="text-gray-500">PDF betöltése...</p>
                </div>
              }
              options={documentOptions}
            >
              {!loading && (
                <Page
                  key={`page-${pageNumber}-${scale}`}
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="shadow-lg mx-auto"
                  width={undefined}
                />
              )}
            </Document>
          </div>
        )}
      </div>
    </div>
  );
}
