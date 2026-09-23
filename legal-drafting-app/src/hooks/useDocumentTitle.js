import { useEffect } from 'react';

const BASE = 'Legal Lens';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : `${BASE} — Legal Drafting Assistant`;
  }, [title]);
}
