/** Legal research — future: Legal Research API. Demo returns labelled placeholders only. */
import { getResearchTopics } from '../data/intelligence/researchTopics';
import { readStorage, writeStorage } from '../utils/storage';
import { USE_MOCKS, demoAnalysisMeta, notConnected, simulateLatency } from './config';

const savedKey = (docId) => `research-saved:${docId}`;

export function getSuggestedTopics(typeId) {
  return getResearchTopics(typeId);
}

export async function searchResearch(query, typeId) {
  if (!USE_MOCKS) throw notConnected('Legal Research API');
  const q = query.trim();
  const slug = q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40);
  const results = [
    {
      id: `${slug}-overview`,
      title: `${q}: overview`,
      sourceType: 'Research note (demo placeholder)',
      summary:
        'Placeholder summary. A connected research service would summarise authoritative material on this topic, with sources.',
      details:
        'No research has been performed. This card only shows how a research result will appear once verified sources are connected.',
    },
    {
      id: `${slug}-statute`,
      title: `${q}: statutory framework — source required`,
      sourceType: 'Statute (source required)',
      summary:
        'Relevant provision — to be identified and verified. No provision is suggested in demo mode.',
      details: 'Statutory material will only be shown when it comes from a verified source.',
    },
    {
      id: `${slug}-case`,
      title: `${q}: case law — sample placeholder`,
      sourceType: 'Case law (sample — not a real authority)',
      summary:
        'Sample legal authority — not a real citation. Case law will be shown only from verified sources.',
      details: 'No court decision is referred to. Do not rely on this placeholder.',
    },
  ].map((r) => ({ ...r, verification: 'unverified', query: q, typeId }));
  return simulateLatency({ query: q, results, meta: demoAnalysisMeta() }, 500);
}

export function listSaved(docId) {
  return readStorage(savedKey(docId), []);
}

export function saveForLater(docId, item) {
  const current = listSaved(docId);
  const next = current.some((i) => i.id === item.id)
    ? current
    : [{ ...item, savedAt: new Date().toISOString() }, ...current];
  writeStorage(savedKey(docId), next);
  return next;
}

export function removeSaved(docId, id) {
  const next = listSaved(docId).filter((i) => i.id !== id);
  writeStorage(savedKey(docId), next);
  return next;
}
