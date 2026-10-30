/**
 * CASEONE Legal Drafting — Phase 5: Indian limitation calculator (deterministic, no AI).
 *
 * The SAME rules and engine run on the server (backend services/limitationEngine.js, generated
 * from this file) and in the browser (Demo Mode). Both are checked against the same expected
 * results in their tests.
 *
 * Scope: a small set of suits under the Limitation Act, 1963 whose period and starting point can be
 * represented exactly. Everything else is reported as unsupported or as needing legal review —
 * the engine never invents a period, an exclusion or a "next working day".
 *
 * Counting (verified):
 *  - Section 12(1): the day from which the period is reckoned is excluded.
 *  - A period in years/months is counted in calendar years/months (British calendar), from the
 *    day after the starting event; the last day is the day before the same calendar date N years
 *    later. Example (Supreme Court, R.K. Transport Co. v. BALCO, 2025 INSC 438): award received
 *    09.04.2022 → reckoned from 10.04.2022 → 3 months expired 09.07.2022.
 *  - No automatic Section 4 (court closed), holiday, vacation or COVID-19 adjustment.
 */

export const LIMITATION_VERIFIED_ON = '2026-10-28';

export const UNSUPPORTED_MESSAGE =
  'This matter is not currently supported for automatic limitation calculation. Consult a qualified legal professional.';

export const STATUS_LABELS = {
  tentative: 'Tentative limitation end date',
  outside: 'Potentially outside the ordinary limitation period',
  review: 'Additional legal review required',
  unavailable: 'Calculation unavailable',
  unsupported: 'Not supported',
};

const ACT = 'Limitation Act, 1963 (Act 36 of 1963)';

export const SOURCES = {
  act: {
    id: 'act',
    title: 'The Limitation Act, 1963 — India Code (official)',
    url: 'https://www.indiacode.nic.in/handle/123456789/1565',
    kind: 'statute',
  },
  actText: {
    id: 'actText',
    title: 'The Limitation Act, 1963 — text as amended (Tripura High Court, official website)',
    url: 'https://www.thc.nic.in/Central%20Governmental%20Acts/Limitation%20Act,%202019.pdf',
    kind: 'statute',
  },
  rkTransport: {
    id: 'rkTransport',
    title: 'R.K. Transport Co. v. Bharat Aluminum Co. Ltd., 2025 INSC 438 (Supreme Court, 03.04.2025) — Sections 4 and 12 computation',
    url: 'https://api.sci.gov.in/supremecourt/2024/48408/48408_2024_11_1501_60626_Judgement_03-Apr-2025.pdf',
    kind: 'judgment',
  },
  covid: {
    id: 'covid',
    title: 'Supreme Court order of 10.01.2022 in M.A. 21/2022 in Suo Motu W.P.(C) 3/2020 (In Re: Cognizance for Extension of Limitation), as circulated by the Punjab & Haryana High Court',
    url: 'https://www.highcourtchd.gov.in/sub_pages/left_menu/covid19/covid19_pdf/limit_ordr_11012022_fdd.pdf',
    kind: 'order',
  },
};

const ARTICLES = {
  14: { article: 'Article 14', description: 'For the price of goods sold and delivered where no fixed period of credit is agreed upon.', starts: 'The date of the delivery of the goods.' },
  15: { article: 'Article 15', description: 'For the price of goods sold and delivered to be paid for after the expiry of a fixed period of credit.', starts: 'When the period of credit expires.' },
  18: { article: 'Article 18', description: 'For the price of work done by the plaintiff for the defendant at his request, where no time has been fixed for payment.', starts: 'When the work is done.' },
  19: { article: 'Article 19', description: 'For money payable for money lent.', starts: 'When the loan is made.' },
  21: { article: 'Article 21', description: 'For money lent under an agreement that it shall be payable on demand.', starts: 'When the loan is made.' },
  54: { article: 'Article 54', description: 'For specific performance of a contract.', starts: 'The date fixed for the performance, or, if no such date is fixed, when the plaintiff has notice that performance is refused.' },
  55: { article: 'Article 55', description: 'For compensation for the breach of any contract, express or implied not herein specially provided for.', starts: 'When the contract is broken or (where there are successive breaches) when the breach in respect of which the suit is instituted occurs or (where the breach is continuing) when it ceases.' },
};

const YES_NO = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
];

/**
 * Supported matters. `fields` drive the form (shown only when `showIf` matches); `resolve`
 * picks the article and the starting date, or explains why no calculation is possible.
 */
export const MATTERS = [
  {
    id: 'goods-price',
    label: 'Price of goods sold and delivered',
    summary: 'Recovering the unpaid price of goods that were delivered.',
    ackAllowed: true,
    fields: [
      { id: 'creditAgreed', type: 'choice', label: 'Was a fixed period of credit agreed for payment?', options: YES_NO },
      { id: 'deliveryDate', type: 'date', label: 'Date the goods were delivered', showIf: { creditAgreed: 'no' } },
      { id: 'creditExpiryDate', type: 'date', label: 'Date the agreed credit period expired', hint: 'The last day of the credit period, e.g. 30 days after delivery if 30 days’ credit was agreed.', showIf: { creditAgreed: 'yes' } },
    ],
    resolve: (a) =>
      a.creditAgreed === 'no'
        ? { article: 14, trigger: 'deliveryDate', triggerLabel: 'Delivery of the goods' }
        : { article: 15, trigger: 'creditExpiryDate', triggerLabel: 'Expiry of the credit period' },
  },
  {
    id: 'work-price',
    label: 'Price of work done (no time fixed for payment)',
    summary: 'Recovering payment for work done at the other party’s request.',
    ackAllowed: true,
    fields: [
      { id: 'paymentTimeFixed', type: 'choice', label: 'Was a time fixed for payment?', options: YES_NO },
      { id: 'workDoneDate', type: 'date', label: 'Date the work was done (completed)', showIf: { paymentTimeFixed: 'no' } },
    ],
    resolve: (a) =>
      a.paymentTimeFixed === 'yes'
        ? { unsupported: 'Article 18 covers work done where no time was fixed for payment. When a time was fixed, a different provision may apply.' }
        : { article: 18, trigger: 'workDoneDate', triggerLabel: 'Work done' },
  },
  {
    id: 'money-lent',
    label: 'Recovery of money lent (loan)',
    summary: 'Recovering a loan with no agreed repayment date, or repayable on demand.',
    ackAllowed: true,
    fields: [
      { id: 'negotiableInstrument', type: 'choice', label: 'Is the loan based on a promissory note or bill of exchange?', options: YES_NO },
      {
        id: 'repaymentTerms',
        type: 'choice',
        label: 'Repayment terms',
        options: [
          { value: 'none', label: 'No repayment date was agreed' },
          { value: 'demand', label: 'Repayable on demand' },
          { value: 'fixed', label: 'A repayment date or instalments were agreed' },
        ],
        showIf: { negotiableInstrument: 'no' },
      },
      { id: 'loanDate', type: 'date', label: 'Date the loan was made (money paid to the borrower)', showIf: { negotiableInstrument: 'no', repaymentTerms: ['none', 'demand'] } },
    ],
    resolve: (a) => {
      if (a.negotiableInstrument === 'yes') return { unsupported: 'Suits on promissory notes and bills of exchange have their own articles, which are not included in this calculator.' };
      if (a.repaymentTerms === 'fixed') return { unsupported: 'Where a repayment date or instalments were agreed, which provision applies and when time starts can depend on the terms.' };
      return a.repaymentTerms === 'demand'
        ? { article: 21, trigger: 'loanDate', triggerLabel: 'Loan made' }
        : { article: 19, trigger: 'loanDate', triggerLabel: 'Loan made' };
    },
  },
  {
    id: 'specific-performance',
    label: 'Specific performance of a contract',
    summary: 'Asking the court to order the other party to perform the contract.',
    ackAllowed: false,
    fields: [
      { id: 'dateFixed', type: 'choice', label: 'Did the contract fix a date for performance?', options: YES_NO },
      { id: 'performanceDate', type: 'date', label: 'Date fixed for performance', showIf: { dateFixed: 'yes' } },
      { id: 'refusalNoticeDate', type: 'date', label: 'Date you had notice that performance was refused', showIf: { dateFixed: 'no' } },
    ],
    resolve: (a) =>
      a.dateFixed === 'yes'
        ? { article: 54, trigger: 'performanceDate', triggerLabel: 'Date fixed for performance' }
        : { article: 54, trigger: 'refusalNoticeDate', triggerLabel: 'Notice that performance was refused' },
  },
  {
    id: 'breach-of-contract',
    label: 'Compensation for breach of contract',
    summary: 'Damages for breach of a contract not covered by a more specific article.',
    ackAllowed: false,
    fields: [
      {
        id: 'breachType',
        type: 'choice',
        label: 'Type of breach',
        options: [
          { value: 'single', label: 'A single breach' },
          { value: 'successive', label: 'Successive breaches (suing for one of them)' },
          { value: 'continuing', label: 'A continuing breach' },
        ],
      },
      { id: 'breachDate', type: 'date', label: 'Date the contract was broken', showIf: { breachType: 'single' } },
      { id: 'successiveBreachDate', type: 'date', label: 'Date of the breach you are suing for', showIf: { breachType: 'successive' } },
      { id: 'breachCeased', type: 'choice', label: 'Has the breach ceased?', options: YES_NO, showIf: { breachType: 'continuing' } },
      { id: 'ceasedDate', type: 'date', label: 'Date the breach ceased', showIf: { breachType: 'continuing', breachCeased: 'yes' } },
    ],
    resolve: (a) => {
      if (a.breachType === 'single') return { article: 55, trigger: 'breachDate', triggerLabel: 'Contract broken' };
      if (a.breachType === 'successive') return { article: 55, trigger: 'successiveBreachDate', triggerLabel: 'Breach sued for' };
      if (a.breachCeased === 'no')
        return { unavailable: 'For a continuing breach, Article 55 runs from when the breach ceases, and under Section 22 a fresh period begins at every moment it continues. No end date can be calculated while it continues.' };
      return { article: 55, trigger: 'ceasedDate', triggerLabel: 'Breach ceased' };
    },
    notes: ['Article 55 applies only where no other article of the Schedule specially provides for the claim (for example the price of goods or money lent).'],
  },
  {
    id: 'other',
    label: 'Other matter (not listed)',
    summary: 'Appeals, criminal matters, consumer complaints, property suits, special laws and others.',
    ackAllowed: false,
    fields: [],
    resolve: () => ({ unsupported: 'Only the matters listed are supported.' }),
  },
];

/** Circumstances the engine does not compute; any of them requires legal review. */
export const CIRCUMSTANCES = [
  { id: 'disability', label: 'The person entitled to sue was a minor, insane or an idiot when the period began', section: 'Section 6' },
  { id: 'fraud-mistake', label: 'Fraud, concealment or mistake is involved', section: 'Section 17' },
  { id: 'earlier-proceeding', label: 'An earlier case on the same matter was pursued in a court that could not decide it', section: 'Section 14' },
  { id: 'stay-or-notice', label: 'The suit was stayed by an injunction or order, or a legal notice / government sanction was required', section: 'Section 15' },
  { id: 'defendant-abroad', label: 'The defendant was absent from India for part of the period', section: 'Section 15(5)' },
  { id: 'commercial-mediation', label: 'Pre-institution mediation under the Commercial Courts Act, 2015 took place', section: 'Commercial Courts Act, 2015, s. 12A' },
];

export const ACK_KINDS = [
  { value: 'acknowledgment', label: 'Written acknowledgment (s. 18)' },
  { value: 'payment', label: 'Part payment (s. 19)' },
];

export const MIN_DATE = '1964-01-01'; // the Act came into force on 1 January 1964
export const MAX_DATE = '2099-12-31';
const MAX_ACKS = 20;
const COVID_FROM = '2020-03-15';
const COVID_TO = '2022-02-28';

// ---------------------------------------------------------------- date-only arithmetic

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' → day number (days since 1970-01-01, UTC), or null if not a real date. */
export function parseDate(value) {
  const m = ISO.exec(typeof value === 'string' ? value : '');
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = Date.UTC(y, mo - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return t / 86400000;
}

/** The user's calendar day as 'YYYY-MM-DD' (browser); no timezone shift. */
export function localToday(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Today's date in India (Asia/Kolkata) as 'YYYY-MM-DD' — used by the server. */
export function indiaToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** 'YYYY-MM-DD' → "10 January 2026" (no timezone shift); '—' when not a date. */
export function displayDate(value) {
  const day = parseDate(value);
  return day === null ? '—' : fmt(day);
}

export function formatISO(day) {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

const daysInMonth = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** Same calendar date `years`/`months` later; a date that does not exist (31 Feb) → 1st of the next month. */
function addCalendar(day, { years = 0, months = 0 }) {
  const dt = new Date(day * 86400000);
  const total = dt.getUTCMonth() + months + years * 12;
  const y = dt.getUTCFullYear() + Math.floor(total / 12);
  const m0 = ((total % 12) + 12) % 12;
  const d = dt.getUTCDate();
  if (d > daysInMonth(y, m0)) return Date.UTC(y, m0 + 1, 1) / 86400000;
  return Date.UTC(y, m0, d) / 86400000;
}

/**
 * Last day of a period that starts to run on `triggerDay` (that day excluded — Section 12(1)).
 * Counting begins the next day; the period ends the day before the same date N years later.
 */
export function periodEnd(triggerDay, period) {
  return addCalendar(triggerDay + 1, period) - 1;
}

const weekday = (day) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(day * 86400000).getUTCDay()];

const fmt = (day) => {
  const dt = new Date(day * 86400000);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${dt.getUTCDate()} ${months[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
};

// ---------------------------------------------------------------- form helpers

const matches = (cond, answers) =>
  Object.entries(cond || {}).every(([k, v]) => (Array.isArray(v) ? v.includes(answers[k]) : answers[k] === v));

export function getMatter(id) {
  return MATTERS.find((m) => m.id === id) || null;
}

/** Fields of a matter that apply to the current answers (conditional fields). */
export function visibleFields(matterId, answers = {}) {
  const matter = getMatter(matterId);
  if (!matter) return [];
  return matter.fields.filter((f) => !f.showIf || matches(f.showIf, answers));
}

// ---------------------------------------------------------------- validation

/**
 * @returns {{ errors: Record<string,string>, clean: object }}
 */
export function validateInput(input, { today } = {}) {
  const errors = {};
  const src = input && typeof input === 'object' ? input : {};
  const matter = getMatter(src.matterType);
  const todayDay = parseDate(today);
  if (!matter) {
    errors.matterType = 'Choose a legal matter from the list.';
    return { errors, clean: null };
  }
  if (todayDay === null) errors.today = 'Today’s date is not available.';
  const rawAnswers = src.answers && typeof src.answers === 'object' && !Array.isArray(src.answers) ? src.answers : {};
  const answers = {};
  const known = new Set(matter.fields.map((f) => f.id));
  Object.keys(rawAnswers).forEach((k) => {
    if (!known.has(k)) errors[`answers.${k}`] = 'Unknown field.';
  });
  // Walk the fields in order so conditions see earlier answers.
  matter.fields.forEach((f) => {
    if (f.showIf && !matches(f.showIf, answers)) return;
    const v = rawAnswers[f.id];
    if (f.type === 'choice') {
      if (!f.options.some((o) => o.value === v)) errors[f.id] = 'Choose an option.';
      else answers[f.id] = v;
    } else if (f.type === 'date') {
      const day = parseDate(v);
      if (v === undefined || v === null || v === '') errors[f.id] = 'Enter the date.';
      else if (day === null) errors[f.id] = 'Enter a valid date (YYYY-MM-DD).';
      else if (v < MIN_DATE) errors[f.id] = 'Dates before 1 January 1964 (when the Limitation Act, 1963 came into force) are not supported.';
      else if (v > MAX_DATE) errors[f.id] = 'Enter a date before the year 2100.';
      else answers[f.id] = v;
    }
  });

  const acks = [];
  const rawAcks = src.acknowledgments == null ? [] : src.acknowledgments;
  if (!Array.isArray(rawAcks)) errors.acknowledgments = 'Invalid list.';
  else if (rawAcks.length && !matter.ackAllowed) errors.acknowledgments = 'Acknowledgments and part payments are only considered for the money claims in this calculator.';
  else if (rawAcks.length > MAX_ACKS) errors.acknowledgments = `Enter at most ${MAX_ACKS} entries.`;
  else {
    rawAcks.forEach((a, i) => {
      const day = parseDate(a && a.date);
      if (!a || typeof a !== 'object') errors[`acknowledgments.${i}`] = 'Invalid entry.';
      else if (!ACK_KINDS.some((k) => k.value === a.kind)) errors[`acknowledgments.${i}.kind`] = 'Choose acknowledgment or part payment.';
      else if (day === null) errors[`acknowledgments.${i}.date`] = 'Enter a valid date.';
      else if (todayDay !== null && day > todayDay) errors[`acknowledgments.${i}.date`] = 'This date is in the future.';
      else if (a.confirmed !== undefined && typeof a.confirmed !== 'boolean') errors[`acknowledgments.${i}.confirmed`] = 'Invalid value.';
      else acks.push({ kind: a.kind, date: a.date, confirmed: a.confirmed === true, index: i });
    });
  }

  const rawCirc = src.circumstances == null ? [] : src.circumstances;
  const circumstances = [];
  if (!Array.isArray(rawCirc) || rawCirc.length > CIRCUMSTANCES.length) errors.circumstances = 'Invalid list.';
  else
    rawCirc.forEach((c) => {
      if (!CIRCUMSTANCES.some((x) => x.id === c)) errors.circumstances = 'Unknown circumstance.';
      else if (!circumstances.includes(c)) circumstances.push(c);
    });

  return { errors, clean: { matter, answers, acks, circumstances, todayDay } };
}

// ---------------------------------------------------------------- calculation

/**
 * @param {object} input { matterType, answers, acknowledgments?, circumstances? }
 * @param {{ today: 'YYYY-MM-DD' }} ctx today's date (server: India; browser: the user's calendar day)
 * @returns {{ ok: false, errors } | { ok: true, result }}
 */
export function calculateLimitation(input, { today } = {}) {
  const { errors, clean } = validateInput(input, { today });
  if (Object.keys(errors).length) return { ok: false, errors };
  const { matter, answers, acks, circumstances, todayDay } = clean;
  const base = {
    matterType: matter.id,
    matterLabel: matter.label,
    today: formatISO(todayDay),
    verificationStatus: { status: 'verified', verifiedOn: LIMITATION_VERIFIED_ON, note: 'Provision checked against the official text of the Limitation Act, 1963.' },
    sourceReferences: [SOURCES.act, SOURCES.actText],
  };

  const resolved = matter.resolve(answers);
  if (resolved.unsupported || resolved.unavailable) {
    const unsupported = Boolean(resolved.unsupported);
    return {
      ok: true,
      result: {
        ...base,
        status: unsupported ? 'unsupported' : 'unavailable',
        statusLabel: STATUS_LABELS[unsupported ? 'unsupported' : 'unavailable'],
        message: unsupported ? UNSUPPORTED_MESSAGE : resolved.unavailable,
        reason: resolved.unsupported || resolved.unavailable,
        legalBasis: null,
        verificationStatus: unsupported ? { status: 'not-applicable', verifiedOn: null, note: 'No automatic calculation for this matter.' } : base.verificationStatus,
        tentativeEndDate: null,
        calculationSteps: [],
        assumptions: [],
        warnings: [],
        reviewReasons: [],
      },
    };
  }

  const art = ARTICLES[resolved.article];
  const period = { years: 3 }; // every article supported here prescribes three years
  const triggerISO = answers[resolved.trigger];
  const triggerDay = parseDate(triggerISO);
  const ordinaryEnd = periodEnd(triggerDay, period);
  const steps = [
    `${art.article} applies: “${art.description}” Period: three years. Time runs from: ${art.starts}`,
    `Starting event: ${resolved.triggerLabel.toLowerCase()} on ${fmt(triggerDay)}.`,
    `Section 12(1): that day is excluded, so counting begins on ${fmt(triggerDay + 1)}.`,
    `Three calendar years from ${fmt(triggerDay + 1)} end on ${fmt(ordinaryEnd)} (${weekday(ordinaryEnd)}).`,
  ];
  const warnings = [];
  const reviewReasons = [];
  const assumptions = [
    'The facts entered are correct and complete, and this article is the one that applies to the claim.',
    'The claim is a suit filed in a civil court in India under the Limitation Act, 1963, not a matter governed by a special law with its own period.',
    'Court holidays, vacations and closures are not taken into account.',
  ];
  (matter.notes || []).forEach((n) => assumptions.push(n));

  // Sections 18 / 19 — fresh period from a valid acknowledgment or part payment.
  let end = ordinaryEnd;
  const appliedAcks = [];
  const sorted = [...acks].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.index - b.index));
  sorted.forEach((a) => {
    const day = parseDate(a.date);
    const label = a.kind === 'payment' ? 'Part payment' : 'Written acknowledgment';
    const section = a.kind === 'payment' ? 'Section 19' : 'Section 18';
    if (day < triggerDay) {
      warnings.push(`${label} on ${fmt(day)} is before the starting event and was not used.`);
      return;
    }
    if (!a.confirmed) {
      reviewReasons.push(`${label} on ${fmt(day)} was not used: confirm that it meets the conditions of ${section}.`);
      return;
    }
    if (day > end) {
      warnings.push(`${label} on ${fmt(day)} was made after the period had already ended (${fmt(end)}), so ${section} gives no fresh period. Whether it has any other legal effect needs legal advice.`);
      reviewReasons.push(`${label} made after the period ended.`);
      return;
    }
    const fresh = periodEnd(day, period);
    if (fresh > end) {
      steps.push(`${section}: ${label.toLowerCase()} on ${fmt(day)}, before the period ended → a fresh three-year period runs from that day (day excluded) to ${fmt(fresh)}.`);
      end = fresh;
    }
    appliedAcks.push({ kind: a.kind, date: a.date, section });
  });
  if (appliedAcks.length) {
    assumptions.push(
      'Each acknowledgment was in writing and signed by the person liable (or their authorised agent), and each payment was made by the person liable (or their authorised agent) with an acknowledgment of the payment in their handwriting or in a writing signed by them — as Sections 18 and 19 require.',
    );
  }

  // Circumstances that can change the period but are not computed.
  circumstances.forEach((id) => {
    const c = CIRCUMSTANCES.find((x) => x.id === id);
    reviewReasons.push(`${c.section}: ${c.label.charAt(0).toLowerCase()}${c.label.slice(1)}. This may change the period and is not calculated.`);
  });

  // Supreme Court COVID-19 limitation orders (15.03.2020 – 28.02.2022) — not computed.
  const covidFrom = parseDate(COVID_FROM);
  const covidTo = parseDate(COVID_TO);
  if (triggerDay + 1 <= covidTo && end >= covidFrom) {
    reviewReasons.push(
      'The period overlaps 15 March 2020 – 28 February 2022. The Supreme Court directed that this period be excluded for limitation (order of 10.01.2022 in Suo Motu W.P.(C) 3/2020). Its effect on this date is not calculated.',
    );
  }

  // Section 4 — never applied automatically.
  const wd = weekday(end);
  if (wd === 'Saturday' || wd === 'Sunday') {
    warnings.push(`The end date is a ${wd}. If the court is closed that day, Section 4 allows filing on the day it re-opens — check the court’s calendar. The date shown is not moved.`);
  } else {
    warnings.push('If the court is closed on the end date, Section 4 allows filing on the day it re-opens. The date shown is not moved for holidays or vacations.');
  }

  // 28/29 February boundary: say how it was counted.
  const tdt = new Date(triggerDay * 86400000);
  if (tdt.getUTCMonth() === 1 && tdt.getUTCDate() >= 28) {
    warnings.push(`The starting date is at the end of February. Counted from ${fmt(triggerDay + 1)}, the period ends on ${fmt(end)}. Some calculations use the same calendar date instead; to be safe, treat the earlier possible date as the last day.`);
  }
  if (triggerDay > todayDay) warnings.push('The starting date is in the future, so the period has not started yet.');

  const daysRemaining = end - todayDay;
  let status;
  if (reviewReasons.length) status = 'review';
  else if (daysRemaining < 0) status = 'outside';
  else status = 'tentative';

  const sourceReferences = [SOURCES.act, SOURCES.actText, SOURCES.rkTransport];
  if (reviewReasons.some((r) => r.includes('Suo Motu'))) sourceReferences.push(SOURCES.covid);

  return {
    ok: true,
    result: {
      ...base,
      status,
      statusLabel: STATUS_LABELS[status],
      message: null,
      legalBasis: {
        statute: ACT,
        article: art.article,
        description: art.description,
        periodText: 'Three years',
        startsText: art.starts,
        sections: ['Section 3', 'Section 12(1)', ...(appliedAcks.length ? [...new Set(appliedAcks.map((a) => a.section))] : [])],
      },
      trigger: { field: resolved.trigger, label: resolved.triggerLabel, date: triggerISO },
      limitationPeriod: { years: 3, label: 'Three years' },
      ordinaryEndDate: formatISO(ordinaryEnd),
      tentativeEndDate: formatISO(end),
      adjustedBy: appliedAcks,
      daysRemaining,
      endWeekday: wd,
      calculationSteps: steps,
      assumptions,
      warnings,
      reviewReasons,
      sourceReferences,
    },
  };
}
