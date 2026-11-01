// PDF export plan: which pages, in what order, with page numbers. Pure.
// Archive = cover + (contact sheet + frame index pages) per roll in roll order; one roll = its pages.
// Contact sheets: 8 strips per page on 35mm, 3–4 on 120 (formats.js).

import { groupStrips, isEdited, sortFrames } from './archive-data.js';
import { frameLayout } from './formats.js';
import { rollOrder } from './import-checks.js';

export const ROWS_PER_PAGE = 20;

export const DEFAULT_OPTIONS = {
  scope: 'archive', rollId: undefined, process: 'all', frames: 'all', paper: 'a4',
  include: { cover: true, contact: true, index: true, notes: true, files: false, storage: true },
};

const INCLUDE_KEYS = Object.keys(DEFAULT_OPTIONS.include);

/** Options from a query string (#/export?… or print.html?…); anything missing gets its default. */
export function optionsFromQuery(query) {
  const include = { ...DEFAULT_OPTIONS.include };
  INCLUDE_KEYS.forEach((key) => { if (query.has(key)) include[key] = query.get(key) === '1'; });
  const pick = (key, allowed) => (allowed.includes(query.get(key)) ? query.get(key) : DEFAULT_OPTIONS[key]);
  const rollId = query.get('roll') || undefined;
  return {
    scope: rollId ? 'roll' : 'archive',
    rollId,
    process: pick('process', ['all', 'bw', 'colour']),
    frames: pick('frames', ['all', 'print', 'edited']),
    paper: pick('paper', ['a4', 'letter']),
    include,
  };
}

/** The opposite of optionsFromQuery: only what differs from the defaults. */
export function optionsToQuery(options) {
  const query = new URLSearchParams();
  if (options.scope === 'roll' && options.rollId) query.set('roll', options.rollId);
  ['process', 'frames', 'paper'].forEach((key) => { if (options[key] !== DEFAULT_OPTIONS[key]) query.set(key, options[key]); });
  INCLUDE_KEYS.forEach((key) => { if (options.include[key] !== DEFAULT_OPTIONS.include[key]) query.set(key, options.include[key] ? '1' : '0'); });
  return query.toString();
}

const FRAME_FILTERS = {
  all: () => true,
  print: (n) => n.print === 'Yes',
  edited: isEdited,
};

const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/** The negatives each roll contributes, after scope, process, frame filter; drafts left out. */
export function selectRolls({ rolls, negatives }, options) {
  const keep = FRAME_FILTERS[options.frames];
  return rolls
    .filter((r) => (options.scope === 'roll' ? r.id === options.rollId : options.process === 'all' || (r.process || 'bw') === options.process))
    .sort((a, b) => rollOrder(a.id, b.id))
    .map((roll) => ({ roll, negatives: sortFrames(negatives.filter((n) => n.rollId === roll.id && n.status !== 'draft' && keep(n))) }))
    .filter((r) => r.negatives.length);
}

/**
 * Pages: [{ kind: 'cover' } | { kind: 'contact', roll, strips, part, parts } | { kind: 'index', roll, rows, part, parts }],
 * each with its page number; rolls: [{ roll, negatives, startPage }].
 */
export function planPdf(data, options) {
  const rolls = selectRolls(data, options);
  const pages = [];
  if (options.scope === 'archive' && options.include.cover && rolls.length) pages.push({ kind: 'cover' });
  rolls.forEach((entry) => {
    entry.startPage = pages.length + 1;
    if (options.include.contact) {
      const { perStrip, stripsPerPage } = frameLayout(entry.roll);
      const sheets = chunk(groupStrips(entry.negatives, perStrip), stripsPerPage);
      sheets.forEach((strips, i) => pages.push({ kind: 'contact', roll: entry.roll, strips, part: i + 1, parts: sheets.length }));
    }
    if (options.include.index) {
      const tables = chunk(entry.negatives, ROWS_PER_PAGE);
      tables.forEach((rows, i) => pages.push({ kind: 'index', roll: entry.roll, rows, start: i * ROWS_PER_PAGE, part: i + 1, parts: tables.length, total: entry.negatives.length }));
    }
  });
  pages.forEach((page, i) => { page.number = i + 1; });
  return { pages, rolls, options };
}

/**
 * Moves the last row of an index page that doesn't fit onto the next index page of the same
 * roll (adding one if needed), then renumbers parts and pages. Used by print.html after measuring.
 */
export function spillLastRow(pages, index) {
  const page = pages[index];
  const row = page.rows.pop();
  let next = pages[index + 1];
  if (!next || next.kind !== 'index' || next.roll.id !== page.roll.id) {
    next = { ...page, rows: [], start: page.start + page.rows.length };
    pages.splice(index + 1, 0, next);
  }
  next.rows.unshift(row);
  next.start = page.start + page.rows.length;
  const sameRoll = pages.filter((p) => p.kind === 'index' && p.roll.id === page.roll.id);
  sameRoll.forEach((p, i) => { p.part = i + 1; p.parts = sameRoll.length; });
  pages.forEach((p, i) => { p.number = i + 1; });
}

/** Short label for a page tile: 'Cover', 'R003 · sheet', 'R003 · index 1/2'. */
export function pageLabel(page) {
  if (page.kind === 'cover') return 'Cover';
  const part = page.parts > 1 ? ` ${page.part}/${page.parts}` : '';
  return `${page.roll.id} · ${page.kind === 'contact' ? 'sheet' : 'index'}${part}`;
}
