import { useState } from 'react';
import { Calculator, Copy, Info, RotateCcw, TriangleAlert } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import { limitationService } from '../services';
import {
  DEMO_COUNTING_NOTE,
  DEMO_PERIOD,
  LIMITATION_WARNING,
  MATTER_TYPES,
  PERIOD_UNITS,
} from '../data/limitation/demoLimitationRules';
import { Button } from '../components/common/Button';
import { Badge, DemoBadge } from '../components/common/Badge';
import { formatDate } from '../utils/date';
import { copyText } from '../utils/clipboard';
import './LimitationCalculator.css';

const EMPTY_FORM = {
  matterTypeId: 'civil-suit',
  eventDate: '',
  periodSource: 'demo',
  periodValue: String(DEMO_PERIOD.value),
  periodUnit: DEMO_PERIOD.unit,
  excludedDays: '',
  notes: '',
};

const STATUS_TEXT = {
  upcoming: (n) => `${n} day${n === 1 ? '' : 's'} remaining`,
  today: () => 'The calculated date is today',
  passed: (n) => `${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'} past the calculated date`,
};

/**
 * Demo limitation framework: deterministic date arithmetic only. No statutory
 * period is asserted — the period is either an illustrative demo value or one
 * the user has verified and entered.
 */
export default function LimitationCalculator() {
  useDocumentTitle('Limitation Period Calculator');
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);

  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const usingDemoPeriod = form.periodSource === 'demo';

  function handleSubmit(event) {
    event.preventDefault();
    const outcome = limitationService.calculateDeadline({
      matterTypeId: form.matterTypeId,
      eventDate: form.eventDate,
      periodSource: form.periodSource,
      period: usingDemoPeriod
        ? DEMO_PERIOD
        : { value: Number(form.periodValue), unit: form.periodUnit },
      excludedDays: form.excludedDays,
    });
    if (!outcome.ok) {
      setErrors({
        eventDate: outcome.errors.eventDate,
        periodValue: outcome.errors.period,
        excludedDays: outcome.errors.excludedDays,
      });
      setResult(null);
      return;
    }
    setErrors({});
    setResult({ ...outcome.result, notes: form.notes.trim() });
  }

  function handleReset() {
    setForm(EMPTY_FORM);
    setErrors({});
    setResult(null);
  }

  async function handleCopy() {
    const lines = [
      `Matter type: ${result.matter?.label ?? '—'}`,
      `Event date: ${formatDate(result.eventDate)}`,
      `Period used: ${result.period.value} ${result.period.unit} (${result.period.source === 'demo' ? 'demo value — requires verification' : 'entered by user — requires verification'})`,
      ...(result.excludedDays ? [`Excluded days added: ${result.excludedDays}`] : []),
      `Calculated date: ${formatDate(result.deadline)}`,
      STATUS_TEXT[result.status](result.daysRemaining),
      ...(result.notes ? [`Notes: ${result.notes}`] : []),
      '',
      LIMITATION_WARNING,
    ];
    const ok = await copyText(lines.join('\n'));
    toast({
      title: ok ? 'Summary copied' : 'Could not copy',
      description: ok ? 'The verification warning is included.' : 'Copy the text manually instead.',
      variant: ok ? 'success' : 'error',
    });
  }

  return (
    <div className="limit container">
      <header className="limit__head">
        <p className="eyebrow">Tools</p>
        <h1 className="limit__title">Limitation Period Calculator</h1>
        <p className="limit__lead">
          A date framework for working out an indicative deadline from an event date. It does not
          supply legal periods.
        </p>
      </header>

      <p className="limit__warning" role="note">
        <TriangleAlert size={18} strokeWidth={1.75} aria-hidden="true" />
        <span>{LIMITATION_WARNING}</span>
      </p>

      <div className="limit__grid">
        <form className="limit__form panel" onSubmit={handleSubmit} noValidate>
          <div className="panel__header">
            <h2 className="panel__title">Calculation inputs</h2>
            <DemoBadge>Demo framework</DemoBadge>
          </div>

          <div className="limit__fields">
            <div className="form-field">
              <label className="form-label" htmlFor="matter-type">
                Matter type
              </label>
              <select
                id="matter-type"
                className="form-select"
                value={form.matterTypeId}
                onChange={(e) => set('matterTypeId', e.target.value)}
              >
                {MATTER_TYPES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="form-hint">
                Recorded for context. No limitation period is configured for any matter type in this
                demo.
              </p>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="event-date">
                Event date
              </label>
              <input
                id="event-date"
                type="date"
                className="form-input"
                value={form.eventDate}
                onChange={(e) => set('eventDate', e.target.value)}
                aria-invalid={Boolean(errors.eventDate)}
                aria-describedby={errors.eventDate ? 'event-date-error' : 'event-date-hint'}
                required
              />
              {errors.eventDate ? (
                <p id="event-date-error" className="form-error" role="alert">
                  {errors.eventDate}
                </p>
              ) : (
                <p id="event-date-hint" className="form-hint">
                  The date the period runs from — for example the date of the order, refusal or
                  incident.
                </p>
              )}
            </div>

            <fieldset className="limit__fieldset">
              <legend className="form-label">Period to apply</legend>
              <label className="limit__radio">
                <input
                  type="radio"
                  name="period-source"
                  value="demo"
                  checked={usingDemoPeriod}
                  onChange={() => set('periodSource', 'demo')}
                />
                <span>
                  Demo value — {DEMO_PERIOD.value} {DEMO_PERIOD.unit}
                  <Badge tone="demo" className="limit__inline-badge">
                    Demo value · Requires verification
                  </Badge>
                  <span className="form-hint">
                    Illustrative only. It is not the limitation period for any proceeding.
                  </span>
                </span>
              </label>
              <label className="limit__radio">
                <input
                  type="radio"
                  name="period-source"
                  value="custom"
                  checked={!usingDemoPeriod}
                  onChange={() => set('periodSource', 'custom')}
                />
                <span>
                  Period I have verified
                  <span className="form-hint">
                    Enter the period from the law or source that applies to your matter.
                  </span>
                </span>
              </label>

              <div className="limit__period">
                <div className="form-field">
                  <label className="form-label" htmlFor="period-value">
                    Length
                  </label>
                  <input
                    id="period-value"
                    type="number"
                    min="1"
                    className="form-input"
                    value={usingDemoPeriod ? DEMO_PERIOD.value : form.periodValue}
                    disabled={usingDemoPeriod}
                    onChange={(e) => set('periodValue', e.target.value)}
                    aria-invalid={Boolean(errors.periodValue)}
                    aria-describedby={errors.periodValue ? 'period-error' : undefined}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="period-unit">
                    Unit
                  </label>
                  <select
                    id="period-unit"
                    className="form-select"
                    value={usingDemoPeriod ? DEMO_PERIOD.unit : form.periodUnit}
                    disabled={usingDemoPeriod}
                    onChange={(e) => set('periodUnit', e.target.value)}
                  >
                    {PERIOD_UNITS.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {errors.periodValue && (
                <p id="period-error" className="form-error" role="alert">
                  {errors.periodValue}
                </p>
              )}
            </fieldset>

            <div className="form-field">
              <label className="form-label" htmlFor="excluded-days">
                Excluded days <span className="form-label__optional">(optional)</span>
              </label>
              <input
                id="excluded-days"
                type="number"
                min="0"
                className="form-input"
                placeholder="0"
                value={form.excludedDays}
                onChange={(e) => set('excludedDays', e.target.value)}
                aria-invalid={Boolean(errors.excludedDays)}
                aria-describedby={errors.excludedDays ? 'excluded-error' : 'excluded-hint'}
              />
              {errors.excludedDays ? (
                <p id="excluded-error" className="form-error" role="alert">
                  {errors.excludedDays}
                </p>
              ) : (
                <p id="excluded-hint" className="form-hint">
                  Days you have established should be added, for example time taken to obtain a
                  copy. Whether an exclusion applies is not decided here.
                </p>
              )}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="limit-notes">
                Notes <span className="form-label__optional">(optional)</span>
              </label>
              <textarea
                id="limit-notes"
                className="form-textarea"
                rows={3}
                value={form.notes}
                placeholder="Source you verified the period against, file reference, assumptions…"
                onChange={(e) => set('notes', e.target.value)}
              />
            </div>
          </div>

          <div className="limit__actions">
            <Button type="submit" icon={Calculator}>
              Calculate date
            </Button>
            <Button type="button" variant="secondary" icon={RotateCcw} onClick={handleReset}>
              Reset
            </Button>
          </div>
        </form>

        <section className="limit__result panel" aria-live="polite" aria-label="Calculation result">
          {!result ? (
            <div className="limit__placeholder">
              <span className="limit__placeholder-icon" aria-hidden="true">
                <Calculator size={20} strokeWidth={1.5} />
              </span>
              <p className="limit__placeholder-title">No calculation yet</p>
              <p className="limit__placeholder-text">
                Enter an event date and the period to apply. The result shows every step of the
                arithmetic so it can be checked.
              </p>
            </div>
          ) : (
            <>
              <div className="panel__header">
                <h2 className="panel__title">Calculated date</h2>
                <Badge tone="demo">
                  {result.period.source === 'demo' ? 'Demo value' : 'User-entered period'} ·
                  Requires verification
                </Badge>
              </div>

              <div className="limit__headline">
                <p className="limit__date">{formatDate(result.deadline)}</p>
                <p className={`limit__status limit__status--${result.status}`}>
                  {STATUS_TEXT[result.status](result.daysRemaining)}
                </p>
                {result.eventInFuture && (
                  <p className="limit__flag">The event date is in the future.</p>
                )}
              </div>

              <dl className="limit__facts">
                <div>
                  <dt>Matter type</dt>
                  <dd>{result.matter?.label ?? '—'}</dd>
                </div>
                <div>
                  <dt>Event date</dt>
                  <dd>{formatDate(result.eventDate)}</dd>
                </div>
                <div>
                  <dt>Period applied</dt>
                  <dd>
                    {result.period.value} {result.period.unit}
                    <span className="limit__facts-note">
                      {result.period.source === 'demo'
                        ? 'Demo value — requires verification'
                        : 'Entered by you — requires verification'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Excluded days added</dt>
                  <dd>{result.excludedDays}</dd>
                </div>
                <div>
                  <dt>Days since the event</dt>
                  <dd>{result.daysElapsed}</dd>
                </div>
                <div>
                  <dt>{result.status === 'passed' ? 'Days since that date' : 'Days remaining'}</dt>
                  <dd>{Math.abs(result.daysRemaining)}</dd>
                </div>
              </dl>

              <div className="limit__steps">
                <h3>How this date was calculated</h3>
                <ol>
                  {result.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="form-hint">{DEMO_COUNTING_NOTE}</p>
              </div>

              {result.weekendNote && (
                <p className="limit__flag">
                  <Info size={14} strokeWidth={1.75} aria-hidden="true" />
                  {result.weekendNote}
                </p>
              )}

              {result.notes && (
                <div className="limit__notes">
                  <h3>Your notes</h3>
                  <p>{result.notes}</p>
                </div>
              )}

              <p className="limit__warning limit__warning--inline" role="note">
                <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>{LIMITATION_WARNING}</span>
              </p>

              <div className="limit__actions">
                <Button variant="secondary" icon={Copy} onClick={handleCopy}>
                  Copy summary
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
