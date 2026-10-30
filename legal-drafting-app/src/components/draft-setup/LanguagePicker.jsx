import { DRAFT_LANGUAGES } from '../../data/draftLanguages';
import { cn } from '../../utils/cn';
import './LanguagePicker.css';

/** aiDrafting: the AI will write this draft (signed in, AI ticked) — it writes in the chosen language. */
export function LanguagePicker({ value, onChange, aiDrafting = false }) {
  return (
    <fieldset className="lang-picker">
      <legend className="setup-label">Draft language</legend>
      <div className="lang-picker__options">
        {DRAFT_LANGUAGES.map((lang) => (
          <label
            key={lang.id}
            className={cn('lang-picker__option', value === lang.id && 'is-selected')}
          >
            <input
              type="radio"
              name="draft-language"
              value={lang.id}
              checked={value === lang.id}
              onChange={() => onChange(lang.id)}
              className="visually-hidden"
            />
            <span className="lang-picker__label">{lang.label}</span>
            {lang.nativeLabel !== lang.label && (
              <span className="lang-picker__native" lang={lang.id}>
                {lang.nativeLabel}
              </span>
            )}
          </label>
        ))}
      </div>
      <p className="setup-help">
        {value === 'en'
          ? 'Your language choice is saved with the draft.'
          : aiDrafting
            ? 'The AI writes the draft in this language. Check the wording carefully; your choice is saved with the draft.'
            : 'Devanagari drafting is planned. Template drafts are prepared in English for now; your choice is saved with the draft.'}
      </p>
    </fieldset>
  );
}
