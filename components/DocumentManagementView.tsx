
import React, { useState, useCallback, Fragment } from 'react';
import type { UploadedDocument } from '../types';
import { extractTextFromPDF } from '../utils/pdfUtils';
import { DocumentIcon, TrashIcon, PlusCircleIcon, EyeIcon } from './icons'; // Added EyeIcon
import { PdfViewerModal } from './PdfViewerModal';

interface DocumentManagementViewProps {
  documents: UploadedDocument[]; // This will receive documents which may or may not have the .file property
  onAddDocument: (document: UploadedDocument) => void;
  onRemoveDocument: (documentId: string) => void;
}

export const DocumentManagementView: React.FC<DocumentManagementViewProps> = ({ documents, onAddDocument, onRemoveDocument }) => {
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewingDocument, setViewingDocument] = useState<UploadedDocument | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setParseError(null);
    }
  };

  const handleFileUpload = useCallback(async () => {
    if (!selectedFile) {
      setParseError("Please select a PDF file first.");
      return;
    }
    if (selectedFile.type !== "application/pdf") {
      setParseError("Invalid file type. Please upload a PDF.");
      setSelectedFile(null);
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      return;
    }

    setIsParsing(true);
    setParseError(null);
    try {
      const textContent = await extractTextFromPDF(selectedFile);
      const newDocument: UploadedDocument = {
        id: Date.now().toString(),
        name: selectedFile.name,
        textContent,
        file: selectedFile, // Store the file object for current session viewing
      };
      onAddDocument(newDocument);
      setSelectedFile(null);
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err) {
      console.error("Error parsing PDF:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error during PDF parsing.";
      setParseError(`Failed to parse PDF: ${errorMessage}`);
    } finally {
      setIsParsing(false);
    }
  }, [selectedFile, onAddDocument]);

  const handleViewDocument = (doc: UploadedDocument) => {
    if (doc.file) { // Only set for viewing if the file object exists
        setViewingDocument(doc);
    } else {
        alert("The content of this document cannot be viewed as it was loaded from a previous session and the file itself is not stored. Please re-upload to view.");
    }
  };

  const handleCloseViewer = () => {
    setViewingDocument(null);
  };

  return (
    <Fragment>
      <div className="space-y-6 p-1">
        <h2 className="text-2xl font-semibold text-slate-700 mb-6">Document Management</h2>

        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-medium text-slate-600 mb-3">Upload PDF Document</h3>
          <div className="flex flex-col sm:flex-row sm:items-end space-y-3 sm:space-y-0 sm:space-x-3">
            <div className="flex-grow">
              <label htmlFor="pdf-upload" className="block text-sm font-medium text-slate-700 mb-1">
                Select PDF file
              </label>
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500
                           file:mr-4 file:py-2 file:px-4
                           file:rounded-md file:border-0
                           file:text-sm file:font-semibold
                           file:bg-primary-50 file:text-primary-700
                           hover:file:bg-primary-100 transition-colors"
              />
            </div>
            <button
              onClick={handleFileUpload}
              disabled={isParsing || !selectedFile}
              className="flex items-center justify-center px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
            >
              <PlusCircleIcon className="w-5 h-5 mr-2" />
              {isParsing ? 'Parsing...' : 'Upload & Parse'}
            </button>
          </div>
          {parseError && <p className="text-sm text-red-600 mt-2">{parseError}</p>}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-lg font-medium text-slate-600 mb-4">Uploaded Documents</h3>
          {documents.length === 0 ? (
            <p className="text-slate-500">No documents uploaded yet.</p>
          ) : (
            <ul className="space-y-3">
              {documents.map((doc) => (
                <li key={doc.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-md border border-slate-200">
                  <div className="flex items-center space-x-3 flex-grow min-w-0">
                    <DocumentIcon className="w-6 h-6 text-primary-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium text-slate-700 truncate block" title={doc.name}>{doc.name}</span>
                      <p className="text-xs text-slate-500">Contains {doc.textContent.split(/\s+/).length} words</p>
                    </div>
                  </div>
                  <div className="flex items-center flex-shrink-0 ml-2">
                    {doc.file ? (
                      <button
                          onClick={() => handleViewDocument(doc)}
                          className="text-primary-600 hover:text-primary-800 p-1 rounded-full hover:bg-primary-100 transition-colors mr-1"
                          title="View document"
                          aria-label={`View document ${doc.name}`}
                      >
                          <EyeIcon className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        className="text-slate-400 p-1 rounded-full mr-1 cursor-not-allowed"
                        title="File data not available for persisted document (re-upload to view)"
                        aria-label={`View document ${doc.name} (unavailable)`}
                        disabled
                      >
                        <EyeIcon className="w-5 h-5" />
                      </button>
                    )}
                    <button
                        onClick={() => onRemoveDocument(doc.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition-colors"
                        title="Remove document"
                        aria-label={`Remove document ${doc.name}`}
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {viewingDocument && viewingDocument.file && ( // Ensure viewingDocument.file exists before rendering modal
        <PdfViewerModal
          file={viewingDocument.file}
          fileName={viewingDocument.name}
          onClose={handleCloseViewer}
        />
      )}
    </Fragment>
  );
};