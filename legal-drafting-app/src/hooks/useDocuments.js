import { useContext } from 'react';
import { DocumentsContext } from '../context/contexts';

export function useDocuments() {
  const context = useContext(DocumentsContext);
  if (!context) throw new Error('useDocuments must be used inside <DocumentsProvider>.');
  return context;
}
