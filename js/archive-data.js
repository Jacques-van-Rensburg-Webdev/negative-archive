// Read helpers shared by the Archive, Roll and Negative screens.
// Counts, strips, frame order and display text, worked out from rolls and negatives.

import { onChange } from './db.js';
import { previewId } from './files.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-08' or '2026-08-15' → 'Aug 2026'. */
export function formatMonth(date) {
  const match = /^(\d{4})-(\d{2})/.exec(date || '');
  return match ? `${MONTHS[Number(match[2]) - 1]} ${match[1]}` : '';
}

export const isToEdit = (n) => n.action === 'Edit' && !n.actionComplete;
export const isEdited = (n) => n.action === 'Edit' && n.actionComplete;

/** Counts for a set of negatives (a roll, or the whole archive). */
export function countNegatives(negatives) {
  const count = (test) => negatives.filter(test).length;
  return {
    frames: negatives.length,
    scanned: count((n) => n.digitized),
    toEdit: count(isToEdit),
    edited: count(isEdited),
    markedEdit: count((n) => n.action === 'Edit'),
    printMaybe: count((n) => n.print === 'Maybe'),
    social: count((n) => n.social === 'Yes'),
  };
}

/** Frame order: frame number, then ID. */
export function sortFrames(negatives) {
  return [...negatives].sort((a, b) => ((a.frame ?? 999) - (b.frame ?? 999)) || a.id.localeCompare(b.id));
}

/** Groups a roll's negatives into physical strips: [{ strip: 2, negatives: [...] }]. */
export function groupStrips(negatives, perStrip = 6) {
  const strips = new Map();
  sortFrames(negatives).forEach((n, i) => {
    const strip = n.strip || Math.floor(i / perStrip) + 1;
    strips.set(strip, [...(strips.get(strip) || []), n]);
  });
  return [...strips].sort((a, b) => a[0] - b[0]).map(([strip, list]) => ({ strip, negatives: list }));
}

/** Frame data for renderFilmStrip(). image is the stored preview's ID; the strip loads it when near the screen. */
export function toFrame(n) {
  const flags = [];
  if (n.exposure === 'Under') flags.push('U');
  if (n.exposure === 'Over') flags.push('O');
  if (n.focus === 'Soft' || n.focus === 'Out of focus') flags.push('S');
  const status = isToEdit(n) ? 'to-edit' : isEdited(n) ? 'edited' : null;
  return { frame: n.frameLabel || String(n.frame ?? '–'), id: n.id, status, flags, image: previewId(n), draft: n.status === 'draft' };
}

/** 'Berlin, Germany' → 'Berlin'; distinct places in first-seen order. */
export function places(negatives) {
  return [...new Set(negatives.map((n) => (n.location || '').split(',')[0].trim()).filter(Boolean))];
}

/** Months a roll was shot in, oldest first: 'Aug 2026' or 'Aug – Sep 2026'. */
export function monthRange(negatives) {
  const months = [...new Set(negatives.map((n) => (n.dateTaken || '').slice(0, 7)).filter((d) => /^\d{4}-\d{2}$/.test(d)))].sort();
  if (!months.length) return '';
  const first = formatMonth(months[0]);
  const last = formatMonth(months.at(-1));
  return first === last ? first : `${first.split(' ')[0]} – ${last}`;
}

/** Newest roll first: latest date taken, then roll ID. */
export function sortRollsNewestFirst(rolls, negativesByRoll) {
  const latest = (roll) => (negativesByRoll.get(roll.id) || []).map((n) => n.dateTaken || '').sort().at(-1) || '';
  return [...rolls].sort((a, b) => latest(b).localeCompare(latest(a)) || b.id.localeCompare(a.id));
}

export function groupByRoll(negatives) {
  const map = new Map();
  negatives.forEach((n) => map.set(n.rollId, [...(map.get(n.rollId) || []), n]));
  return map;
}

/** Reads everything the archive screens need in one transaction. */
export function loadArchive(db) {
  return db.transaction(['rolls', 'negatives', 'cameras', 'lenses'], 'readonly', async (t) => ({
    rolls: await t.getAll('rolls'),
    negatives: await t.getAll('negatives'),
    cameras: new Map((await t.getAll('cameras')).map((c) => [c.id, c.name])),
    lenses: new Map((await t.getAll('lenses')).map((l) => [l.id, l.name])),
  }));
}

/** Calls fn after every database write (other than to images alone) until root leaves the page. */
export function watch(root, db, fn) {
  const stop = onChange(({ name, stores }) => {
    if (!root.isConnected) { stop(); return; }
    if (name === db.name && !stores.every((store) => store === 'blobs')) fn();
  });
}
