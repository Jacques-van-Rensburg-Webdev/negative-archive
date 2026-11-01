// Checks across rows for the import plan: template rolls, repeated file names, frame order.
// Each pushes { type, id?, detail } onto the problems list; none of them change data.

import { isColourRoll } from './import-map.js';

const SHARE = 0.8; // "most": share of rows that must match for a roll-level finding

// B&W rolls first, then colour, each in roll order: R001 … R006, R001C …
export const rollOrder = (a, b) => (isColourRoll(a) - isColourRoll(b)) || a.localeCompare(b);

const fileNumber = (name) => Number((/(\d+)(?:\D*)\.\w+$/.exec(name || '') || [])[1]);

// Template rolls: subjects mostly copied from an earlier roll AND mostly no film type (R005, R006).
// A roll with copied subjects but real film data (R001C) is kept and flagged instead.
export function findTemplateRolls(byRoll, problems) {
  const seen = new Set();
  const templates = new Set();
  [...byRoll.keys()].sort(rollOrder).forEach((rollId) => {
    const rows = byRoll.get(rollId);
    const subjects = rows.map((row) => row.negative.subject.toLowerCase()).filter(Boolean);
    const copies = subjects.filter((s) => seen.has(s)).length;
    const noFilm = rows.filter((row) => !row.negative.filmStock).length;
    if (subjects.length >= 3 && copies / subjects.length >= SHARE) {
      if (noFilm / rows.length >= SHARE) {
        templates.add(rollId);
        return;
      }
      problems.push({ type: 'check', detail: `${rollId}: most subjects match an earlier roll's; they may be placeholders` });
    }
    subjects.forEach((s) => seen.add(s));
  });
  return templates;
}

export function checkFiles(kept, problems) {
  const byFile = new Map();
  kept.forEach((n) => {
    if (!n.scanFile) return;
    byFile.set(n.scanFile, [...(byFile.get(n.scanFile) || []), n.rollId]);
  });
  const pairs = new Map();
  byFile.forEach((rolls) => {
    const unique = [...new Set(rolls)].sort();
    for (let i = 1; i < unique.length; i += 1) {
      const key = `${unique[i]}|${unique[0]}`;
      pairs.set(key, (pairs.get(key) || 0) + 1);
    }
  });
  pairs.forEach((count, key) => {
    const [later, earlier] = key.split('|');
    problems.push({ type: 'check', detail: `${later} file names repeat ${earlier}'s (${count} files)` });
  });
}

export function checkOrder(rollId, negatives, problems) {
  const sorted = [...negatives].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 1; i < sorted.length; i += 1) {
    const [a, b] = [sorted[i - 1], sorted[i]];
    if (a.frame !== undefined && b.frame !== undefined && b.frame < a.frame) {
      problems.push({ type: 'check', id: b.id, detail: `${a.id} and ${b.id}: frames ${a.frameLabel} / ${b.frameLabel} out of order` });
    }
  }
  const numbers = sorted.map((n) => fileNumber(n.scanFile)).filter((n) => !Number.isNaN(n));
  const falling = numbers.filter((n, i) => i > 0 && n < numbers[i - 1]).length;
  if (numbers.length >= 3 && falling >= (numbers.length - 1) * SHARE) {
    problems.push({ type: 'check', detail: `${rollId} file names run in reverse order against the frames` });
  }
}
