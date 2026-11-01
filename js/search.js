// Search: keyword + filters over the archive, with live counts per filter option.
// Pure functions; the screen keeps the state ({ q, film, date, camera, lens, lighting }).

import { formatMonth } from './archive-data.js';

export const FACETS = ['film', 'date', 'camera', 'lens', 'lighting'];

/** Lower case, accents removed: 'Dämeritzsee' → 'dameritzsee'. */
export const normalise = (text) => String(text ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/**
 * One entry per negative with everything search needs.
 * data = { negatives, rolls, cameras: Map, lenses: Map, shots }
 */
export function buildEntries({ negatives, rolls, cameras, lenses, shots = [] }) {
  const rollById = new Map(rolls.map((r) => [r.id, r]));
  const shotById = new Map(shots.map((s) => [s.id, s]));
  return negatives.map((n) => {
    const roll = rollById.get(n.rollId);
    const shot = n.shotId ? shotById.get(n.shotId) : undefined;
    const film = n.filmStock || roll?.filmStock || '';
    const camera = cameras.get(n.cameraId) || '';
    const lens = lenses.get(n.lensId) || '';
    const lighting = shot?.lighting ? { added: true, items: shot.lighting.items || [] } : { added: false, items: [] };
    const text = normalise([
      n.subject, n.category, n.location, n.notes, n.id, n.rollId, roll?.labNumber, n.scanFile, n.editedFile,
      film, camera, lens, shot?.note, lighting.items.join(' '), shot?.lighting?.setup,
    ].filter(Boolean).join(' '));
    const month = /^\d{4}-\d{2}/.test(n.dateTaken || '') ? n.dateTaken.slice(0, 7) : '';
    return { negative: n, text, film, camera, cameraId: n.cameraId || '', lens, lensId: n.lensId || '', month, lighting };
  });
}

function matches(entry, facet, value) {
  switch (facet) {
    case 'film': return entry.film === value;
    case 'camera': return entry.cameraId === value;
    case 'lens': return entry.lensId === value;
    case 'lighting':
      if (value === 'natural') return !entry.lighting.added;
      if (value === 'added') return entry.lighting.added;
      return entry.lighting.items.includes(value.replace(/^item:/, ''));
    case 'date': {
      if (!entry.month) return false;
      if (/^\d{4}$/.test(value)) return entry.month.startsWith(`${value}-`);
      const [from, to] = value.split('..');
      return to === undefined ? entry.month === from : entry.month >= from && entry.month <= to;
    }
    default: return true;
  }
}

const newestFirst = (a, b) => (b.negative.dateTaken || '').localeCompare(a.negative.dateTaken || '') || b.negative.id.localeCompare(a.negative.id);

/** Entries matching the keyword (every word) and every set filter, newest first. */
export function applySearch(entries, state) {
  const words = normalise(state.q).split(/\s+/).filter(Boolean);
  return entries
    .filter((e) => words.every((w) => e.text.includes(w)))
    .filter((e) => FACETS.every((facet) => !state[facet] || matches(e, facet, state[facet])))
    .sort(newestFirst);
}

/** True when nothing is set. */
export const isEmptyState = (state) => !state.q && FACETS.every((facet) => !state[facet]);

// Distinct option values for a facet, from every entry (so options with 0 results still show).
function optionValues(entries, facet) {
  const pairs = new Map();
  entries.forEach((e) => {
    if (facet === 'film' && e.film) pairs.set(e.film, e.film);
    if (facet === 'camera' && e.cameraId) pairs.set(e.cameraId, e.camera || e.cameraId);
    if (facet === 'lens' && e.lensId) pairs.set(e.lensId, e.lens || e.lensId);
    if (facet === 'date' && e.month) pairs.set(e.month, formatMonth(e.month));
    if (facet === 'lighting') {
      pairs.set('natural', 'Natural light');
      if (e.lighting.added) pairs.set('added', 'Added lighting');
      e.lighting.items.forEach((item) => pairs.set(`item:${item}`, item));
    }
  });
  const list = [...pairs].map(([value, label]) => ({ value, label }));
  return facet === 'date' ? list.sort((a, b) => a.value.localeCompare(b.value)) : list.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Options for one facet: [{ value, label, count }]. count = results if that option were
 * chosen, with the keyword and the other filters as they are.
 */
export function facetOptions(entries, state, facet) {
  const base = applySearch(entries, { ...state, [facet]: undefined });
  const withCount = (option) => ({ ...option, count: base.filter((e) => matches(e, facet, option.value)).length });
  if (facet !== 'date') return optionValues(entries, facet).map(withCount);
  const months = optionValues(entries, 'date');
  const years = [...new Set(months.map((m) => m.value.slice(0, 4)))].map((y) => ({ value: y, label: y }));
  return { months: months.map(withCount), years: years.map(withCount) };
}

/** Lighting is only offered once some negative has added lighting (from Shoot, M4). */
export const hasLightingData = (entries) => entries.some((e) => e.lighting.added);

/** Text for a chosen filter value: 'Aug 2026', 'Aug 2026 – Sep 2026', 'Nikon F2A' … */
export function valueLabel(entries, facet, value) {
  if (!value) return '';
  if (facet === 'date') {
    if (/^\d{4}$/.test(value)) return value;
    const [from, to] = value.split('..');
    return to === undefined ? formatMonth(from) : `${formatMonth(from)} – ${formatMonth(to)}`;
  }
  return optionValues(entries, facet).find((o) => o.value === value)?.label || value.replace(/^item:/, '');
}
