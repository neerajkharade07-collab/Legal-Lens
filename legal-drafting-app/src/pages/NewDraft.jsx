import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getDocumentType } from '../data/documentTypes';
import { useDraftSetup } from '../hooks/useDraftSetup';
import { PageLoader } from '../components/common/PageLoader';

/**
 * Deep link: /draft/new?type=<id> opens the Draft Setup modal on the dashboard
 * (with the type preselected when valid).
 */
export default function NewDraft() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { openDraftSetup } = useDraftSetup();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const type = getDocumentType(params.get('type'));
    navigate('/', { replace: true });
    openDraftSetup({ typeId: type?.id ?? null, source: 'link' });
  }, [params, navigate, openDraftSetup]);

  return <PageLoader />;
}
