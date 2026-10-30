/**
 * Legal Drafting Phase 5 — limitation calculator (frontend engine, service, navigation).
 *   npm run test:drafting
 * The expected results in fixtures/limitation-cases.json are the SAME file the backend tests use.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import CASES from './fixtures/limitation-cases.json';

const mem = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  },
};
let calls = [];
let responder = () => ({ status: 500, body: { success: false, message: 'no responder' } });
globalThis.fetch = async (url, init = {}) => {
  const call = { url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : undefined };
  calls.push(call);
  const r = responder(call);
  if (r.throw) throw new TypeError('Failed to fetch');
  return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: new Headers(), json: async () => r.body };
};

const engine = await import('../src/utils/limitationEngine.js');
const { setStorageMode } = await import('../src/services/config.js');
const { setAccessToken } = await import('../src/services/apiClient.js');
const service = await import('../src/services/limitationService.js');
const { PRIMARY_NAV } = await import('../src/data/navigation.js');

const { calculateLimitation, visibleFields, displayDate, localToday, UNSUPPORTED_MESSAGE, MATTERS } = engine;

test('every hand-worked case (shared with the backend) gives exactly the expected result', () => {
  for (const c of CASES.cases) {
    const out = calculateLimitation(c.input, { today: CASES.today });
    assert.equal(out.ok, true, `${c.name}: ${JSON.stringify(out.errors)}`);
    for (const [k, v] of Object.entries(c.expect)) {
      const got = k === 'article' ? out.result.legalBasis?.article : out.result[k];
      assert.deepEqual(got, v, `${c.name} → ${k}`);
    }
  }
  for (const c of CASES.invalid) {
    const out = calculateLimitation(c.input, { today: CASES.today });
    assert.equal(out.ok, false, c.name);
    assert.ok(c.errorField in out.errors, c.name);
  }
});

test('matter list: only verified rules plus "Other"; unsupported shows the required message', () => {
  assert.deepEqual(MATTERS.map((m) => m.id), ['goods-price', 'work-price', 'money-lent', 'specific-performance', 'breach-of-contract', 'other']);
  const r = calculateLimitation({ matterType: 'other', answers: {} }, { today: CASES.today }).result;
  assert.equal(r.message, 'This matter is not currently supported for automatic limitation calculation. Consult a qualified legal professional.');
  assert.equal(r.message, UNSUPPORTED_MESSAGE);
  assert.equal(r.tentativeEndDate, null);
});

test('calendar edges: Section 12(1), leap years and month ends (same as the backend)', () => {
  const iso = (d, p = { years: 3 }) => engine.formatISO(engine.periodEnd(engine.parseDate(d), p));
  assert.equal(iso('2022-04-09', { months: 3 }), '2022-07-09', 'Supreme Court example, 2025 INSC 438');
  assert.equal(iso('2020-02-29'), '2023-02-28');
  assert.equal(iso('2021-02-28'), '2024-02-29');
  assert.equal(iso('2024-01-30', { months: 1 }), '2024-02-29');
  assert.equal(iso('2023-01-30', { months: 1 }), '2023-02-28');
  assert.equal(iso('2023-12-31'), '2026-12-31');
});

test('conditional fields: only the questions that apply are shown', () => {
  const ids = (m, a) => visibleFields(m, a).map((f) => f.id);
  assert.deepEqual(ids('goods-price', { creditAgreed: 'no' }), ['creditAgreed', 'deliveryDate']);
  assert.deepEqual(ids('specific-performance', { dateFixed: 'no' }), ['dateFixed', 'refusalNoticeDate']);
  assert.deepEqual(ids('money-lent', { negotiableInstrument: 'no', repaymentTerms: 'fixed' }), ['negotiableInstrument', 'repaymentTerms']);
  assert.deepEqual(ids('other', {}), []);
});

test('displayed dates never shift with the timezone; today is the local calendar day', () => {
  assert.equal(displayDate('2027-03-15'), '15 March 2027');
  assert.equal(displayDate('2024-02-29'), '29 February 2024');
  assert.equal(displayDate('2023-02-29'), '—');
  assert.equal(localToday(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('Demo Mode: calculated in the browser, nothing sent', async () => {
  setStorageMode('guest');
  calls = [];
  assert.equal(service.calculationMode(), 'browser');
  const out = await service.calculate(CASES.cases[0].input, { today: CASES.today });
  assert.equal(out.ok, true);
  assert.equal(out.computedBy, 'browser');
  assert.equal(out.result.tentativeEndDate, '2027-03-15');
  assert.equal(calls.length, 0);
});

test('account: server calculation with only the calculator fields; invalid input is never sent', async () => {
  setStorageMode('account');
  setAccessToken('tok-5');
  calls = [];
  responder = () => ({ status: 200, body: { success: true, data: { status: 'tentative', tentativeEndDate: '2027-03-15' } } });
  const input = { ...CASES.cases[0].input, acknowledgments: [], circumstances: [], extra: 'x' };
  const out = await service.calculate(input, { today: CASES.today });
  assert.equal(out.computedBy, 'server');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith('/drafting/limitation/calculate'));
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(Object.keys(calls[0].body).sort(), ['acknowledgments', 'answers', 'circumstances', 'matterType']);
  assert.equal(calls[0].body.today, undefined, 'the server decides today');

  calls = [];
  const bad = await service.calculate({ matterType: 'goods-price', answers: { creditAgreed: 'no', deliveryDate: '2023-02-30' } }, { today: CASES.today });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.deliveryDate);
  assert.equal(calls.length, 0);
});

test('account: server 422 → field errors; network failure → rejected (no invented result)', async () => {
  setStorageMode('account');
  responder = () => ({ status: 422, body: { success: false, message: 'Check the highlighted fields.', errors: [{ field: 'deliveryDate', message: 'Enter the date.' }] } });
  const out = await service.calculate(CASES.cases[0].input, { today: CASES.today });
  assert.deepEqual(out, { ok: false, errors: { deliveryDate: 'Enter the date.' } });
  responder = () => ({ throw: true });
  await assert.rejects(service.calculate(CASES.cases[0].input, { today: CASES.today }), /reach the CASEONE server/);
});

test('the calculator is still in the Legal Drafting navigation at /limitation', () => {
  assert.ok(PRIMARY_NAV.some((i) => i.to === '/limitation' && i.label === 'Limitation Calculator'));
});
