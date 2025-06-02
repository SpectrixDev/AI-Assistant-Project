
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Set workerSrc for pdfjs-dist. This is crucial.
// It ensures that the worker script is loaded correctly.
// The version in the URL should match the installed pdfjs-dist version.
// Using a dynamic version string like `${pdfjsLib.version}` is robust.
if (typeof window !== 'undefined') { // Ensure this runs only in the browser
  // Point the workerSrc to the esm.sh hosted worker, consistent with how pdfjs-dist is imported.
  // pdfjsLib.version will correctly resolve to the version being used from esm.sh (e.g., "5.3.31")
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
}


export const extractTextFromPDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Workaround for pdfjs type issue with {data: arrayBuffer}
  const typedArray = new Uint8Array(arrayBuffer);
  const loadingTask = pdfjsLib.getDocument(typedArray);

  const pdf = await loadingTask.promise;
  let textContent = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContentItems = await page.getTextContent();
    // textContentItems.items is an array of TextItem
    textContent += textContentItems.items.map((item) => (item as TextItem).str).join(' ') + '\n';
  }
  return textContent;
};
