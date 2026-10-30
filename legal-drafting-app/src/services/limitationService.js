/**
 * Limitation calculator — Phase 5.
 *
 * Signed-in account: calculated by the CASEONE server (POST /api/drafting/limitation/calculate),
 * which validates the input and uses India's date for "today".
 * Demo Mode (not signed in): calculated in this browser with the SAME engine and rules
 * (utils/limitationEngine.js). Nothing is stored anywhere in either case.
 */
import { apiRequest } from './apiClient';
import { getStorageMode } from './config';
import { calculateLimitation, localToday, validateInput } from '../utils/limitationEngine';

export function calculationMode() {
  return getStorageMode() === 'account' ? 'server' : 'browser';
}

/** Only the fields the calculator uses (nothing else is sent). */
export function toRequest(input) {
  return {
    matterType: input.matterType,
    answers: { ...(input.answers || {}) },
    acknowledgments: (input.acknowledgments || []).map((a) => ({ kind: a.kind, date: a.date, confirmed: a.confirmed === true })),
    circumstances: [...(input.circumstances || [])],
  };
}

/**
 * @returns {Promise<{ ok: true, result, computedBy: 'server'|'browser' } | { ok: false, errors }>}
 * Rejects (ApiError) only when the server could not be reached or failed.
 */
export async function calculate(input, { mode = calculationMode(), today = localToday() } = {}) {
  const request = toRequest(input);
  // Same checks as the server, so mistakes are shown at once.
  const { errors } = validateInput(request, { today });
  if (Object.keys(errors).length) return { ok: false, errors };
  if (mode === 'server') {
    try {
      const json = await apiRequest('/drafting/limitation/calculate', { method: 'POST', body: request });
      return { ok: true, result: json.data, computedBy: 'server' };
    } catch (err) {
      if (err?.status === 422 && Array.isArray(err.errors)) {
        return { ok: false, errors: Object.fromEntries(err.errors.map((e) => [e.field, e.message])) };
      }
      throw err;
    }
  }
  const out = calculateLimitation(request, { today });
  return out.ok ? { ok: true, result: out.result, computedBy: 'browser' } : out;
}
