import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Lock, TriangleAlert } from 'lucide-react';
import { Modal, ModalCloseButton } from '../common/Modal';
import { Button } from '../common/Button';
import { getDocumentType } from '../../data/documentTypes';
import { DEFAULT_LANGUAGE } from '../../data/draftLanguages';
import { getDraftSetupConfig, MIN_DESCRIPTION_LENGTH } from '../../data/draftSetupConfig';
import { analyzeDescription } from '../../utils/descriptionAnalysis';
import { DocumentTypePicker } from './DocumentTypePicker';
import { DescriptionDetail } from './DescriptionDetail';
import { LanguagePicker } from './LanguagePicker';
import { FrameworkOption } from './FrameworkOption';
import './DraftSetupModal.css';
import { DRAFTING_GUEST_MODE } from '../../services/config';

const MAX_LENGTH = 5000;
const GENERIC_PLACEHOLDER =
  'Describe what happened, important dates, people involved, amounts, evidence and what document you need.';

/**
 * Draft Setup: document type → description → language/options → generate.
 * State is local to one opening of the modal (the provider remounts it).
 */
export function DraftSetupModal({ initialTypeId, onClose, onSubmit }) {
  const [typeId, setTypeId] = useState(() =>
    getDocumentType(initialTypeId) ? initialTypeId : null,
  );
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [useBnsFramework, setUseBnsFramework] = useState(true);
  const [useAi, setUseAi] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | submitting | error
  const [submitError, setSubmitError] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const textareaRef = useRef(null);
  const typeInputRef = useRef(null);
  const keepEditingRef = useRef(null);

  const type = getDocumentType(typeId);
  const config = getDraftSetupConfig(typeId);
  const isFir = typeId === 'fir-complaint';
  const submitting = status === 'submitting';

  const checks = useMemo(
    () => config?.checks ?? getDraftSetupConfig('fir-complaint').checks,
    [config],
  );
  const analysis = useMemo(() => analyzeDescription(description, checks), [description, checks]);

  function requestClose() {
    if (submitting) return;
    if (confirmingDiscard) {
      // Escape / close while confirming returns to editing — only "Discard" discards.
      setConfirmingDiscard(false);
      textareaRef.current?.focus();
      return;
    }
    if (description.trim().length > 0) {
      setConfirmingDiscard(true);
      // Move focus to the confirmation so keyboard users land on it.
      requestAnimationFrame(() => keepEditingRef.current?.focus());
      return;
    }
    onClose();
  }

  function handleTypeChange(id) {
    setTypeId(id);
    setErrors((current) => ({ ...current, type: undefined }));
  }

  function handleDescriptionChange(event) {
    setDescription(event.target.value);
    if (errors.description && event.target.value.trim().length >= MIN_DESCRIPTION_LENGTH) {
      setErrors((current) => ({ ...current, description: undefined }));
    }
  }

  function fillSample() {
    if (!config) return;
    setDescription(config.sample);
    setErrors((current) => ({ ...current, description: undefined }));
    textareaRef.current?.focus();
  }

  function validate() {
    const next = {};
    if (!type) next.type = 'Choose the type of document you want to draft.';
    if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      next.description = `Add a little more detail — at least ${MIN_DESCRIPTION_LENGTH} characters.`;
    }
    setErrors(next);
    if (next.type) typeInputRef.current?.focus();
    else if (next.description) textareaRef.current?.focus();
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event?.preventDefault();
    if (submitting || !validate()) return;
    setStatus('submitting');
    setSubmitError(null);
    try {
      await onSubmit({
        typeId,
        description,
        language,
        useBnsFramework: isFir ? useBnsFramework : null,
        useAi,
        descriptionDetail: {
          score: analysis.score,
          level: analysis.level.id,
          found: analysis.found,
        },
      });
    } catch (err) {
      setStatus('error');
      setSubmitError(err instanceof Error ? err.message : 'The draft could not be generated.');
    }
  }

  function handleTextareaKeyDown(event) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) handleSubmit(event);
  }

  return (
    <Modal
      open
      size="lg"
      onClose={requestClose}
      labelledBy="draft-setup-title"
      describedBy="draft-setup-desc"
      initialFocusRef={type ? textareaRef : typeInputRef}
      closeOnBackdrop={!submitting}
      className="setup"
    >
      <header className="setup__header">
        <div className="setup__heading">
          <p className="eyebrow">New draft{type ? ` · ${type.name}` : ''}</p>
          <h2 id="draft-setup-title" className="setup__title">
            Tell us more about what you want to draft
          </h2>
          <p id="draft-setup-desc" className="setup__desc">
            Describe the matter in your own words. You will be able to fill in and edit every detail
            in the drafting workspace next.
          </p>
        </div>
        <ModalCloseButton onClick={requestClose} disabled={submitting} />
      </header>

      <form id="draft-setup-form" className="setup__body" onSubmit={handleSubmit} noValidate>
        <fieldset className="setup__fieldset" disabled={submitting}>
          <DocumentTypePicker
            value={typeId}
            onChange={handleTypeChange}
            inputRef={typeInputRef}
            invalid={Boolean(errors.type)}
            errorId="draft-type-error"
          />
          {errors.type && (
            <p id="draft-type-error" className="setup-error" role="alert">
              {errors.type}
            </p>
          )}

          <div className="setup__field">
            <div className="setup__label-row">
              <label htmlFor="draft-description" className="setup-label">
                Describe the matter
              </label>
              {config && description.length === 0 && (
                <button type="button" className="setup__sample" onClick={fillSample}>
                  Fill with a fictional example
                </button>
              )}
            </div>
            <textarea
              id="draft-description"
              ref={textareaRef}
              className="setup__textarea"
              rows={8}
              maxLength={MAX_LENGTH}
              value={description}
              onChange={handleDescriptionChange}
              onKeyDown={handleTextareaKeyDown}
              placeholder={config?.placeholder ?? GENERIC_PLACEHOLDER}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={`draft-description-meta${errors.description ? ' draft-description-error' : ''}`}
            />
            <div className="setup__meta" id="draft-description-meta">
              <span>
                Plain language is fine. Avoid sharing more personal data than the draft needs.
              </span>
              <span className="setup__count">
                {description.length.toLocaleString('en-IN')} / {MAX_LENGTH.toLocaleString('en-IN')}
              </span>
            </div>
            {errors.description && (
              <p id="draft-description-error" className="setup-error" role="alert">
                {errors.description}
              </p>
            )}
          </div>

          <DescriptionDetail analysis={analysis} id="draft-detail" />

          <div className={isFir ? 'setup__options setup__options--split' : 'setup__options'}>
            <LanguagePicker value={language} onChange={setLanguage} />
            {isFir && <FrameworkOption checked={useBnsFramework} onChange={setUseBnsFramework} />}
          </div>

          <label className="setup__ai">
            <input
              type="checkbox"
              checked={useAi}
              disabled={DRAFTING_GUEST_MODE}
              onChange={(e) => setUseAi(e.target.checked)}
            />
            <span>
              <strong>Write the full draft with AI</strong>
              <span className="setup__ai-hint">
                {DRAFTING_GUEST_MODE
                  ? 'Not connected in Demo Mode (AI drafting needs a signed-in Legal Lens server session). This demo creates the structured template with live case-detail fields.'
                  : 'Uses the Legal Lens server (OpenAI). Missing facts are left as [DETAIL REQUIRED]; the AI must not invent sections, citations or deadlines. Leave unticked for the structured template with live case-detail fields.'}
              </span>
            </span>
          </label>

          {status === 'error' && submitError && (
            <div className="setup__alert" role="alert">
              <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>
                {submitError}
                {useAi
                  ? ' You can untick “Write the full draft with AI” to create a template draft instead.'
                  : ' Please try again.'}
              </span>
            </div>
          )}
        </fieldset>
      </form>

      <footer className="setup__footer">
        {confirmingDiscard ? (
          <div className="setup__confirm" role="alertdialog" aria-labelledby="discard-title">
            <p id="discard-title" className="setup__confirm-text">
              Discard this description? It has not been saved.
            </p>
            <div className="setup__actions">
              <Button
                ref={keepEditingRef}
                variant="secondary"
                onClick={() => {
                  setConfirmingDiscard(false);
                  textareaRef.current?.focus();
                }}
              >
                Keep editing
              </Button>
              <Button onClick={onClose}>Discard</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="setup__privacy">
              <Lock size={13} strokeWidth={1.75} aria-hidden="true" />
              {DRAFTING_GUEST_MODE
                ? 'Demo Mode: drafts are saved only in this browser.'
                : 'Drafts are saved to your Legal Lens account.'}
            </p>
            <div className="setup__actions">
              <Button variant="secondary" onClick={requestClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="draft-setup-form"
                iconRight={submitting ? undefined : ArrowRight}
                aria-busy={submitting}
                className="setup__submit"
              >
                {submitting && <span className="setup__spinner" aria-hidden="true" />}
                {submitting
                  ? useAi
                    ? 'Writing with AI…'
                    : 'Creating…'
                  : 'Generate Preliminary Draft'}
              </Button>
            </div>
          </>
        )}
        <p className="visually-hidden" aria-live="polite">
          {submitting ? 'Preparing your preliminary draft.' : ''}
        </p>
      </footer>
    </Modal>
  );
}
