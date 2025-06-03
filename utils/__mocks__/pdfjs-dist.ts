// utils/__mocks__/pdfjs-dist.ts
export const GlobalWorkerOptions = {
  workerSrc: '',
};

export const getDocument = (source: any) => ({
  promise: Promise.resolve({
    numPages: 1,
    getPage: (pageNumber: number) => Promise.resolve({
      getTextContent: () => Promise.resolve({
        items: [{ str: 'mocked PDF text' }],
      }),
    }),
  }),
});

// If pdfUtils.ts or other files import other things from pdfjs-dist,
// add them here as well. For now, this covers what's in pdfUtils.ts.
export const version = 'mocked-version';
