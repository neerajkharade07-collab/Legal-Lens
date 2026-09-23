import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { templatesService } from '../services';
import { useDocuments } from './useDocuments';
import { useDraftSetup } from './useDraftSetup';
import { useToast } from './useToast';

/**
 * "Use Template": reuses the existing flows —
 *  - structured templates (with case-detail fields) → Draft Setup → Draft Workspace
 *  - other library templates → a new local document opened in the Draft Workspace
 */
export function useTemplateActions() {
  const { createDocument } = useDocuments();
  const { openDraftSetup } = useDraftSetup();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [recent, setRecent] = useState(() => templatesService.listRecentTemplateIds());

  const applyTemplate = useCallback(
    (template) => {
      setRecent(templatesService.markTemplateUsed(template.id));
      if (template.typeId) {
        openDraftSetup({
          typeId: template.typeId,
          source: 'template',
          template: { id: template.id, name: template.name },
        });
        return;
      }
      createDocument(templatesService.buildTemplateDocumentPayload(template)).then(
        (doc) => {
          toast({
            title: `${template.name} created`,
            description: 'Drafting template — requires review for your specific matter.',
            variant: 'success',
          });
          navigate(`/draft/${doc.id}`);
        },
        (err) =>
          toast({
            title: 'Could not create the document',
            description: err.message,
            variant: 'error',
          }),
      );
    },
    [openDraftSetup, createDocument, toast, navigate],
  );

  return { applyTemplate, recent };
}
