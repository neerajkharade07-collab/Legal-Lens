import { useState } from 'react';
import { Calculator, Copy, ExternalLink, Info, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import { limitationService } from '../services';
import {
  ACK_KINDS,
  CIRCUMSTANCES,
  MATTERS,
  STATUS_LABELS,
  displayDate,
  getMatter,
  visibleFields,
} from '../utils/limitationEngine';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { copyText } from '../utils/clipboard';
import { cn } from '../utils/cn';
import './LimitationCalculator.css';

const EMPTY = { matterType: '', answers: {}, acknowledgments: [], circumstances: [] };

const NOTICE =
  'This calculation is for information only. It depends on the facts you enter being accurate and complete and on the law that applies to your claim, and it is not legal advice. Court holidays, vacations and the exceptions listed with the result are not calculated. Confirm the limitation period with a qualified advocate before relying on it.';

const STATUS_TONE = { tentative: 'outline', outside: 'warning', review: 'warning', unavailable: 'neutral', unsupported: 'neutral' };

function daysText(n) {
  if (n === 0) return 'The tentative end date is today.';
  const abs = Math.abs(n);
  const d = `${abs} day${abs === 1 ? '' : 's'}`;
  return n > 0 ? `${d} from today.` : `${d} ago.`;
}

/**
 * Phase 5 — Indian limitation calculator for a small set of suits under the Limitation Act, 1963.
 * Deterministic engine (utils/limitationEngine.js); every result shows its legal basis, steps,
 * assumptions, possible exceptions and sources. Nothing is stored.
 */
export default function LimitationCalculator() {
  useDocumentTitle('Limitation Calculator');
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [outcome, setOutcome] = useState(null); // { result, computedBy }
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  const matter = getMatter(form.matterType);
  const fields = visibleFields(form.matterType, form.answers);
  const mode = limitationService.calculationMode();

  const update = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setOutcome(null);
    setFailure(null);
  };
  const setAnswer = (id, value) => {
    update({ answers: { ...form.answers, [id]: value } });
    setErrors((e) => ({ ...e, [id]: undefined }));
  };
  const setAck = (i, patch) =>
    update({ acknowledgments: form.acknowledgments.map((a, n) => (n === i ? { ...a, ...patch } : a)) });

  async function run(forceMode) {
    setBusy(true);
    setFailure(null);
    try {
      const out = await limitationService.calculate(form, forceMode ? { mode: forceMode } : undefined);
      if (!out.ok) {
        setErrors(out.errors);
        setOutcome(null);
        return;
      }
      setErrors({});
      setOutcome({ result: out.result, computedBy: out.computedBy });
    } catch (err) {
      setOutcome(null);
      setFailure(err?.message || 'The calculation could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    if (!form.matterType) {
      setErrors({ matterType: 'Choose a legal matter.' });
      return;
    }
    run();
  }

  function reset() {
    setForm(EMPTY);
    setErrors({});
    setOutcome(null);
    setFailure(null);
  }

  async function copySummary() {
    const r = outcome.result;
    const lines = [
      `Limitation calculation (CASEONE) — ${r.statusLabel}`,
      `Matter: ${r.matterLabel}`,
      ...(r.legalBasis ? [`Provision: ${r.legalBasis.article}, ${r.legalBasis.statute} — period: ${r.legalBasis.periodText}`] : []),
      ...(r.trigger ? [`Starting event: ${r.trigger.label} — ${displayDate(r.trigger.date)}`] : []),
      ...(r.tentativeEndDate ? [`Tentative limitation end date: ${displayDate(r.tentativeEndDate)}`] : [r.message || r.reason || '']),
      ...(r.calculationSteps.length ? ['', 'Calculation:', ...r.calculationSteps.map((s, i) => `${i + 1}. ${s}`)] : []),
      ...(r.reviewReasons.length ? ['', 'Additional legal review required:', ...r.reviewReasons.map((s) => `- ${s}`)] : []),
      ...(r.warnings.length ? ['', 'Notes:', ...r.warnings.map((s) => `- ${s}`)] : []),
      '',
      `Sources: ${r.sourceReferences.map((s) => s.url).join(' ; ')}`,
      `Calculated on ${displayDate(r.today)}.`,
      '',
      NOTICE,
    ];
    const ok = await copyText(lines.join('\n'));
    toast({
      title: ok ? 'Summary copied' : 'Could not copy',
      description: ok ? 'Paste it where you need it. The notice is included.' : 'Select and copy the text manually instead.',
      variant: ok ? 'success' : 'error',
    });
  }

  const r = outcome?.result;

  return (
    <div className="limit container">
      <header className="limit__head">
        <p className="eyebrow">Tools</p>
        <h1 className="limit__title">Limitation Calculator</h1>
        <p className="limit__lead">
          Estimates the limitation period for selected civil suits under the Limitation Act, 1963, and shows the provision,
          the starting date and every step of the calculation.
        </p>
      </header>

      <div className="limit__grid">
        <form className="limit__form panel" onSubmit={onSubmit} noValidate aria-labelledby="limit-matter-title">
          <div className="panel__header">
            <h2 className="panel__title" id="limit-matter-title">
              Matter details
            </h2>
          </div>

          <div className="limit__fields">
            <div className="form-field">
              <label className="form-label" htmlFor="limit-matter">
                Legal matter
              </label>
              <select
                id="limit-matter"
                className="form-select"
                value={form.matterType}
                aria-invalid={Boolean(errors.matterType)}
                aria-describedby={errors.matterType ? 'limit-matter-error' : 'limit-matter-hint'}
                onChange={(e) => {
                  update({ matterType: e.target.value, answers: {}, acknowledgments: [], circumstances: [] });
                  setErrors({});
                }}
              >
                <option value="">Choose a matter…</option>
                {MATTERS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              {errors.matterType ? (
                <p id="limit-matter-error" className="form-error" role="alert">
                  {errors.matterType}
                </p>
              ) : (
                <p id="limit-matter-hint" className="form-hint">
                  {matter ? matter.summary : 'Only the matters listed are calculated. Choose “Other matter” for anything else.'}
                </p>
              )}
            </div>

            {fields.map((f) => {
              const id = `limit-f-${f.id}`;
              const err = errors[f.id];
              if (f.type === 'choice') {
                return (
                  <fieldset key={f.id} className="limit__fieldset" aria-describedby={err ? `${id}-error` : undefined}>
                    <legend className="form-label">{f.label}</legend>
                    {f.options.map((o) => (
                      <label key={o.value} className="limit__radio">
                        <input
                          type="radio"
                          name={id}
                          value={o.value}
                          checked={form.answers[f.id] === o.value}
                          onChange={() => setAnswer(f.id, o.value)}
                        />
                        <span>{o.label}</span>
                      </label>
                    ))}
                    {err && (
                      <p id={`${id}-error`} className="form-error" role="alert">
                        {err}
                      </p>
                    )}
                  </fieldset>
                );
              }
              return (
                <div key={f.id} className="form-field">
                  <label className="form-label" htmlFor={id}>
                    {f.label}
                  </label>
                  <input
                    id={id}
                    type="date"
                    className="form-input"
                    min="1964-01-01"
                    max="2099-12-31"
                    value={form.answers[f.id] || ''}
                    aria-invalid={Boolean(err)}
                    aria-describedby={err ? `${id}-error` : f.hint ? `${id}-hint` : undefined}
                    onChange={(e) => setAnswer(f.id, e.target.value)}
                  />
                  {err ? (
                    <p id={`${id}-error`} className="form-error" role="alert">
                      {err}
                    </p>
                  ) : (
                    f.hint && (
                      <p id={`${id}-hint`} className="form-hint">
                        {f.hint}
                      </p>
                    )
                  )}
                </div>
              );
            })}

            {matter?.ackAllowed && (
              <fieldset className="limit__fieldset">
                <legend className="form-label">
                  Acknowledgment or part payment <span className="form-label__optional">(optional)</span>
                </legend>
                <p className="form-hint">
                  A written, signed acknowledgment of the debt (Section 18) or a part payment acknowledged in writing (Section 19),
                  made before the period ended, starts a fresh period.
                </p>
                {form.acknowledgments.map((a, i) => (
                  <div key={i} className="limit__ack">
                    <div className="limit__ack-row">
                      <div className="form-field">
                        <label className="form-label" htmlFor={`limit-ack-kind-${i}`}>
                          Type
                        </label>
                        <select id={`limit-ack-kind-${i}`} className="form-select" value={a.kind} onChange={(e) => setAck(i, { kind: e.target.value })}>
                          {ACK_KINDS.map((k) => (
                            <option key={k.value} value={k.value}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-field">
                        <label className="form-label" htmlFor={`limit-ack-date-${i}`}>
                          Date
                        </label>
                        <input
                          id={`limit-ack-date-${i}`}
                          type="date"
                          className="form-input"
                          value={a.date}
                          aria-invalid={Boolean(errors[`acknowledgments.${i}.date`])}
                          onChange={(e) => setAck(i, { date: e.target.value })}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        aria-label={`Remove entry ${i + 1}`}
                        onClick={() => update({ acknowledgments: form.acknowledgments.filter((_, n) => n !== i) })}
                      />
                    </div>
                    {(errors[`acknowledgments.${i}.date`] || errors[`acknowledgments.${i}.kind`]) && (
                      <p className="form-error" role="alert">
                        {errors[`acknowledgments.${i}.date`] || errors[`acknowledgments.${i}.kind`]}
                      </p>
                    )}
                    <label className="limit__radio">
                      <input type="checkbox" checked={a.confirmed} onChange={(e) => setAck(i, { confirmed: e.target.checked })} />
                      <span>
                        {a.kind === 'payment'
                          ? 'The payment was made by the person liable (or their authorised agent), and it is acknowledged in their handwriting or in a writing signed by them.'
                          : 'The acknowledgment is in writing and signed by the person liable (or their authorised agent).'}
                      </span>
                    </label>
                  </div>
                ))}
                {errors.acknowledgments && (
                  <p className="form-error" role="alert">
                    {errors.acknowledgments}
                  </p>
                )}
                {form.acknowledgments.length < 20 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Plus}
                    className="limit__add"
                    onClick={() => update({ acknowledgments: [...form.acknowledgments, { kind: 'acknowledgment', date: '', confirmed: false }] })}
                  >
                    Add acknowledgment or payment
                  </Button>
                )}
              </fieldset>
            )}

            {matter && matter.id !== 'other' && (
              <fieldset className="limit__fieldset">
                <legend className="form-label">
                  Do any of these apply? <span className="form-label__optional">(optional)</span>
                </legend>
                <p className="form-hint">They can change the period. They are not calculated; ticking one marks the result for legal review.</p>
                {CIRCUMSTANCES.map((c) => (
                  <label key={c.id} className="limit__radio">
                    <input
                      type="checkbox"
                      checked={form.circumstances.includes(c.id)}
                      onChange={(e) =>
                        update({
                          circumstances: e.target.checked
                            ? [...form.circumstances, c.id]
                            : form.circumstances.filter((x) => x !== c.id),
                        })
                      }
                    />
                    <span>
                      {c.label} <span className="limit__muted">({c.section})</span>
                    </span>
                  </label>
                ))}
                {errors.circumstances && (
                  <p className="form-error" role="alert">
                    {errors.circumstances}
                  </p>
                )}
              </fieldset>
            )}
          </div>

          <div className="limit__actions">
            <Button type="submit" icon={Calculator} disabled={busy}>
              {busy ? 'Calculating…' : 'Calculate'}
            </Button>
            <Button type="button" variant="secondary" icon={RotateCcw} onClick={reset}>
              Reset
            </Button>
          </div>
          <p className="limit__mode">
            {mode === 'server'
              ? 'Calculated by the CASEONE server for your account. Nothing is saved.'
              : 'Demo Mode: calculated in this browser with the same rules. Nothing is saved or sent.'}
          </p>
        </form>

        <section className="limit__result panel" aria-live="polite" aria-labelledby="limit-result-title">
          <div className="panel__header">
            <h2 className="panel__title" id="limit-result-title">
              Calculation result
            </h2>
            {r && (
              <Badge tone={STATUS_TONE[r.status]} className="limit__status-badge">
                {r.statusLabel}
              </Badge>
            )}
          </div>

          {failure && (
            <div className="limit__failure" role="alert">
              <p>
                <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" /> {STATUS_LABELS.unavailable}: {failure}
              </p>
              <Button variant="secondary" size="sm" onClick={() => run('browser')}>
                Calculate in this browser instead
              </Button>
            </div>
          )}

          {!r && !failure && (
            <div className="limit__placeholder">
              <span className="limit__placeholder-icon" aria-hidden="true">
                <Calculator size={20} strokeWidth={1.5} />
              </span>
              <p className="limit__placeholder-title">No calculation yet</p>
              <p className="limit__placeholder-text">Choose the matter, answer the questions and enter the dates, then press Calculate.</p>
            </div>
          )}

          {r && !r.tentativeEndDate && (
            <div className="limit__unsupported">
              <p className="limit__unsupported-title">{r.status === 'unsupported' ? r.message : r.reason}</p>
              {r.status === 'unsupported' && r.reason && <p className="limit__muted">{r.reason}</p>}
              {r.status === 'unavailable' && <p className="limit__muted">Consult a qualified legal professional.</p>}
            </div>
          )}

          {r && r.tentativeEndDate && (
            <>
              <div className="limit__headline">
                <p className="limit__label">{STATUS_LABELS.tentative}</p>
                <p className="limit__date">{displayDate(r.tentativeEndDate)}</p>
                <p className={cn('limit__status', r.status === 'outside' && 'limit__status--passed')}>
                  {r.endWeekday} · {daysText(r.daysRemaining)}
                  {r.status === 'outside' && ` ${STATUS_LABELS.outside}.`}
                </p>
              </div>

              {r.reviewReasons.length > 0 && (
                <div className="limit__review" role="note">
                  <h3>
                    <TriangleAlert size={15} strokeWidth={1.75} aria-hidden="true" /> {STATUS_LABELS.review}
                  </h3>
                  <ul>
                    {r.reviewReasons.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}

              <dl className="limit__facts">
                <div>
                  <dt>Legal matter</dt>
                  <dd>{r.matterLabel}</dd>
                </div>
                <div>
                  <dt>Applicable provision</dt>
                  <dd>
                    {r.legalBasis.article}, Schedule
                    <span className="limit__facts-note">{r.legalBasis.statute}</span>
                  </dd>
                </div>
                <div>
                  <dt>Starting event</dt>
                  <dd>
                    {r.trigger.label}
                    <span className="limit__facts-note">{displayDate(r.trigger.date)}</span>
                  </dd>
                </div>
                <div>
                  <dt>Limitation period</dt>
                  <dd>{r.limitationPeriod.label}</dd>
                </div>
                {r.adjustedBy.length > 0 && (
                  <div>
                    <dt>Ordinary end date</dt>
                    <dd>
                      {displayDate(r.ordinaryEndDate)}
                      <span className="limit__facts-note">Before the acknowledgment / payment</span>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Provision text</dt>
                  <dd className="limit__quote">
                    “{r.legalBasis.description}” — time runs from: {r.legalBasis.startsText}
                  </dd>
                </div>
              </dl>

              <div className="limit__steps">
                <h3>How the date was calculated</h3>
                <ol>
                  {r.calculationSteps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>

              <div className="limit__steps">
                <h3>Assumptions</h3>
                <ul className="limit__list">
                  {r.assumptions.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="limit__steps">
                <h3>Possible exceptions and notes</h3>
                <ul className="limit__list">
                  {r.warnings.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                  <li>
                    Not calculated: disability (Section 6), fraud or mistake (Section 17), time in another court (Section 14),
                    stays, notice or sanction periods and the defendant’s absence from India (Section 15), and pre-institution
                    mediation in commercial disputes.
                  </li>
                </ul>
              </div>
            </>
          )}

          {r && (
            <>
              <div className="limit__steps">
                <h3>Sources</h3>
                <ul className="limit__sources">
                  {r.sourceReferences.map((s) => (
                    <li key={s.id}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.title} <ExternalLink size={12} strokeWidth={1.75} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="limit__muted">
                  <Info size={13} strokeWidth={1.75} aria-hidden="true" />{' '}
                  {r.verificationStatus.verifiedOn
                    ? `Provision checked against the official text on ${displayDate(r.verificationStatus.verifiedOn)}. Later amendments or court rulings may change it.`
                    : r.verificationStatus.note}{' '}
                  {outcome.computedBy === 'server' ? 'Calculated by the CASEONE server' : 'Calculated in this browser'} on{' '}
                  {displayDate(r.today)}.
                </p>
              </div>
              <div className="limit__actions">
                <Button variant="secondary" icon={Copy} onClick={copySummary}>
                  Copy summary
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="limit__warning" aria-labelledby="limit-notice-title">
        <TriangleAlert size={18} strokeWidth={1.75} aria-hidden="true" />
        <div>
          <h2 id="limit-notice-title" className="limit__notice-title">
            Important notice
          </h2>
          <p>{NOTICE}</p>
        </div>
      </section>
    </div>
  );
}
