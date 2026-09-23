import { DRAFT_LANGUAGES } from '../../data/draftLanguages';
import { cn } from '../../utils/cn';
import './LanguagePicker.css';

export function LanguagePicker({ value, onChange }) {
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
          : 'Devanagari drafting is planned. Demo drafts are prepared in English for now; your choice is saved with the draft.'}
      </p>
    </fieldset>
  );
}
