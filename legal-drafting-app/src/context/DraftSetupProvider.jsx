import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DraftSetupContext } from './contexts';
import { DraftSetupModal } from '../components/draft-setup/DraftSetupModal';
import { draftingService, documentsService } from '../services';
import { extractDemoFields } from '../utils/extractDemoFields';
import { useDocuments } from '../hooks/useDocuments';
import { useToast } from '../hooks/useToast';
import { SAVE_LOCATION } from '../services/config';

/**
 * Owns the Draft Setup modal so any screen (dashboard cards, hero, navbar,
 * templates, deep links) can open it with an optional preselected type.
 */
export function DraftSetupProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    typeId: null,
    source: null,
    template: null,
    session: 0,
  });
  const { createDocument, addDocument } = useDocuments();
  const { toast } = useToast();
  const navigate = useNavigate();

  /** template: optional { id, name } when started from the Template Library. */
  const openDraftSetup = useCallback(
    ({ typeId = null, source = 'unknown', template = null } = {}) => {
      setState((current) => ({
        open: true,
        typeId,
        source,
        template,
        session: current.session + 1,
      }));
    },
    [],
  );

  const closeDraftSetup = useCallback(() => {
    setState((current) => ({ ...current, open: false }));
  }, []);

  const submitDraftSetup = useCallback(
    async (values) => {
      // The local draft record (type, setup, template choice) — same as before.
      const payload = await draftingService.generatePreliminaryDraft({
        ...values,
        source: state.source,
        templateId: state.template?.id,
        templateName: state.template?.name,
      });

      let doc;
      if (values.useAi) {
        // POST /api/drafting/generate — the server writes the draft with OpenAI
        // and saves it (plus version 1) to the user's account.
        doc = await documentsService.generateAiDraft({
          typeId: payload.typeId,
          language: payload.setup.language,
          description: payload.setup.description,
          fields: extractDemoFields(payload.typeId, payload.setup.description).values,
          title: payload.name,
        });
        addDocument(doc);
      } else {
        // Structured template with live case-detail fields, saved to the account.
        doc = await createDocument(payload);
      }

      setState((current) => ({ ...current, open: false }));
      navigate(`/draft/${doc.id}`);
      toast({
        title: values.useAi ? 'AI draft created' : 'Preliminary draft created',
        description: values.useAi
          ? 'AI-generated — check every detail and all [DETAIL REQUIRED] placeholders.'
          : `Saved ${SAVE_LOCATION}. Review every detail before use.`,
        variant: 'success',
      });
      return doc;
    },
    [createDocument, addDocument, navigate, toast, state.source, state.template],
  );

  const value = useMemo(
    () => ({ openDraftSetup, closeDraftSetup, isOpen: state.open }),
    [openDraftSetup, closeDraftSetup, state.open],
  );

  return (
    <DraftSetupContext.Provider value={value}>
      {children}
      {state.open && (
        <DraftSetupModal
          key={state.session}
          initialTypeId={state.typeId}
          onClose={closeDraftSetup}
          onSubmit={submitDraftSetup}
        />
      )}
    </DraftSetupContext.Provider>
  );
}
