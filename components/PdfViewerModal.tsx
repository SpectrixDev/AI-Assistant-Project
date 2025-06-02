
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';

// Worker source is set in pdfUtils.ts, ensure it's loaded.

interface PdfViewerModalProps {
  file?: File; // File is optional
  fileName: string;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({ file, fileName, onClose }) => {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const renderPage = useCallback(async (pageNumber: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    setIsLoading(true);
    try {
      const page: PDFPageProxy = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Could not get canvas context');
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      await page.render(renderContext).promise;
      setCurrentPageNumber(pageNumber);
    } catch (err) {
      console.error('Error rendering page:', err);
      setError(err instanceof Error ? err.message : 'Failed to render PDF page.');
    } finally {
      setIsLoading(false);
    }
  }, [pdfDoc]);

  useEffect(() => {
    if (!file) {
      setError("PDF file data is not available. This may be a document from a previous session.");
      setIsLoading(false);
      setPdfDoc(null); // Ensure pdfDoc is cleared
      setNumPages(0); // Reset numPages
      return;
    }

    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      setPdfDoc(null);
      setCurrentPageNumber(1);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const typedArray = new Uint8Array(arrayBuffer);
        const loadingTask = pdfjsLib.getDocument(typedArray);
        const loadedPdfDoc = await loadingTask.promise;
        
        setPdfDoc(loadedPdfDoc);
        setNumPages(loadedPdfDoc.numPages);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF file.');
        setIsLoading(false);
      }
    };
    loadPdf();
  }, [file]);

  useEffect(() => {
    if (pdfDoc && numPages > 0 && currentPageNumber <= numPages) { // Ensure currentPageNumber is valid
      renderPage(currentPageNumber);
    }
  }, [pdfDoc, numPages, currentPageNumber, renderPage]);


  const goToPrevPage = () => {
    if (currentPageNumber > 1) {
      // renderPage will be called by useEffect due to currentPageNumber change
      setCurrentPageNumber(prev => prev - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPageNumber < numPages) {
      // renderPage will be called by useEffect due to currentPageNumber change
      setCurrentPageNumber(prev => prev + 1);
    }
  };
  
  // Close modal on escape key
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);


  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" 
        onClick={onClose} 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="pdf-viewer-title"
    >
      <div 
        className="bg-white rounded-lg shadow-xl flex flex-col max-h-[90vh] w-full max-w-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent click inside from closing
      >
        <header className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 id="pdf-viewer-title" className="text-lg font-semibold text-slate-700 truncate" title={fileName}>
            {fileName}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition-colors p-1"
            aria-label="Close PDF viewer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-grow overflow-y-auto p-4 bg-slate-100 flex items-center justify-center">
          {isLoading && !error && <p className="text-slate-600">Loading PDF...</p>}
          {error && <p className="text-red-600 p-4 bg-red-50 rounded-md">{error}</p>}
          {!isLoading && !error && pdfDoc && (
            <canvas ref={canvasRef} className="max-w-full max-h-full shadow-lg"></canvas>
          )}
           {!isLoading && !error && !pdfDoc && file && <p className="text-slate-600">PDF could not be loaded.</p>}
           {!isLoading && !error && !file && !pdfDoc && <p className="text-red-600 p-4 bg-red-50 rounded-md">No PDF file data available to display.</p>}
        </div>

        {pdfDoc && numPages > 0 && !error && ( // Check pdfDoc as well
          <footer className="p-3 border-t border-slate-200 flex justify-center items-center space-x-4 bg-slate-50">
            <button
              onClick={goToPrevPage}
              disabled={currentPageNumber <= 1 || isLoading}
              className="px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {currentPageNumber} of {numPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPageNumber >= numPages || isLoading}
              className="px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </footer>
        )}
      </div>
    </div>
  );
};