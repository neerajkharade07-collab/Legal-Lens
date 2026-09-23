/**
 * Limitation calculator — future: Limitation Calculator API with verified rules.
 *
 * Deterministic date arithmetic only. No legal period is decided here: the
 * caller supplies the period (an illustrative demo value or a user-verified
 * one) and every result is marked demo / requires verification.
 */
import { MATTER_TYPES, DEMO_PERIOD } from '../data/limitation/demoLimitationRules';
import { USE_MOCKS, demoAnalysisMeta, notConnected } from './config';

export { MATTER_TYPES, DEMO_PERIOD };

const DAY_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' → UTC midnight Date, or null. */
export function parseISODate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
    ? date
    : null;
}

export function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

/** Adds months, clamping to the last day of the target month (31 Jan + 1 month → 28/29 Feb). */
function addMonths(date, months) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const target = new Date(Date.UTC(y, m, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), lastDay)),
  );
}

export function addPeriod(date, { value, unit }) {
  if (unit === 'days') return new Date(date.getTime() + value * DAY_MS);
  if (unit === 'months') return addMonths(date, value);
  if (unit === 'years') return addMonths(date, value * 12);
  throw new Error(`Unknown unit: ${unit}`);
}

export function daysBetween(from, to) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** Today's date (local calendar day) as UTC midnight. */
export function todayUTC(now = new Date()) {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * @param {{ eventDate:string, period:{value:number, unit:'days'|'months'|'years'}, periodSource:'demo'|'custom',
 *           excludedDays?:number, matterTypeId?:string, today?:Date }} input
 * @returns {{ ok:true, result } | { ok:false, errors: Record<string,string> }}
 */
export function calculateDeadline(input) {
  if (!USE_MOCKS) throw notConnected('Limitation Calculator API');
  const errors = {};
  const event = parseISODate(input.eventDate);
  if (!event) errors.eventDate = 'Enter a valid event date.';
  const value = Number(input.period?.value);
  const unit = input.period?.unit;
  const max = { days: 36500, months: 1200, years: 100 }[unit];
  if (!max) errors.period = 'Choose a unit.';
  else if (!Number.isInteger(value) || value < 1 || value > max)
    errors.period = `Enter a whole number between 1 and ${max} ${unit}.`;
  const excluded =
    input.excludedDays === '' || input.excludedDays == null ? 0 : Number(input.excludedDays);
  if (!Number.isInteger(excluded) || excluded < 0 || excluded > 3650)
    errors.excludedDays = 'Enter 0–3650 days.';
  if (Object.keys(errors).length) return { ok: false, errors };

  const periodEnd = addPeriod(event, { value, unit });
  const deadline = new Date(periodEnd.getTime() + excluded * DAY_MS);
  const today = input.today ?? todayUTC();
  const remaining = daysBetween(today, deadline);
  const weekday = deadline.getUTCDay();
  const matter = MATTER_TYPES.find((m) => m.id === input.matterTypeId) ?? null;

  return {
    ok: true,
    result: {
      matter,
      eventDate: toISODate(event),
      period: { value, unit, source: input.periodSource === 'demo' ? 'demo' : 'custom' },
      excludedDays: excluded,
      periodEndDate: toISODate(periodEnd),
      deadline: toISODate(deadline),
      daysRemaining: remaining,
      daysElapsed: daysBetween(event, today),
      status: remaining > 0 ? 'upcoming' : remaining === 0 ? 'today' : 'passed',
      weekendNote:
        weekday === 0 || weekday === 6
          ? `The calculated date falls on a ${weekday === 0 ? 'Sunday' : 'Saturday'}. Whether the period extends is not calculated — verify.`
          : null,
      eventInFuture: event.getTime() > today.getTime(),
      steps: [
        `Event date: ${toISODate(event)}`,
        `+ ${value} ${unit} → ${toISODate(periodEnd)}`,
        ...(excluded
          ? [`+ ${excluded} excluded day${excluded === 1 ? '' : 's'} → ${toISODate(deadline)}`]
          : []),
      ],
      meta: demoAnalysisMeta(),
    },
  };
}
