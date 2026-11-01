// Feed data: posting, captions, likes and saves (all local), feed order, and the roll row.

import { formatMonth, places, sortRollsNewestFirst } from './archive-data.js';
import { unsyncedShots } from './sync.js';

/** Reads the latest copy, applies changes, saves. Resolves with the updated negative. */
export function patchNegative(db, id, changes) {
  return db.transaction(['negatives'], 'readwrite', async (t) => {
    const current = await t.get('negatives', id);
    if (!current) throw new Error(`Negative ${id} isn't in the archive.`);
    const next = { ...current, ...changes, updatedAt: new Date().toISOString() };
    await t.put('negatives', next);
    return next;
  });
}

/** Posts to the feed. The caption defaults to the existing caption, else the subject. */
export const postNegative = (db, n, caption) => patchNegative(db, n.id, {
  posted: true,
  postedAt: new Date().toISOString(),
  caption: caption ?? n.caption ?? n.subject,
});

export const unpostNegative = (db, n) => patchNegative(db, n.id, { posted: false, postedAt: undefined });
export const setCaption = (db, n, caption) => patchNegative(db, n.id, { caption });
export const toggleLike = (db, n) => patchNegative(db, n.id, { liked: !n.liked });
export const toggleSave = (db, n) => patchNegative(db, n.id, { saved: !n.saved });

/** Posted negatives, newest post first. */
export const feedPosts = (negatives) => negatives
  .filter((n) => n.posted)
  .sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || '') || b.id.localeCompare(a.id));

/** Red ring: the roll has drafts, shots not synced yet, or negatives with no review (focus and exposure empty). */
export function needsAttention(negatives, shots) {
  return negatives.some((n) => n.status === 'draft' || (!n.focus && !n.exposure)) || unsyncedShots(shots).length > 0;
}

/**
 * The roll row: rolls with negatives or shots, newest first.
 * [{ roll, label: 'Sep · Berlin', attention }]
 */
export function rollRow(rolls, negativesByRoll, shots) {
  const shotsByRoll = new Map();
  shots.forEach((s) => shotsByRoll.set(s.rollId, [...(shotsByRoll.get(s.rollId) || []), s]));
  return sortRollsNewestFirst(rolls, negativesByRoll)
    .filter((roll) => negativesByRoll.has(roll.id) || shotsByRoll.has(roll.id))
    .map((roll) => {
      const negatives = negativesByRoll.get(roll.id) || [];
      const latest = negatives.map((n) => n.dateTaken || '').sort().at(-1) || (roll.loadedAt || '').slice(0, 7);
      const month = formatMonth(latest).split(' ')[0];
      const place = places(negatives)[0] || (shotsByRoll.get(roll.id) || []).map((s) => (s.placeName || '').split(',').at(-1).trim()).find(Boolean);
      return {
        roll,
        label: [month, place].filter(Boolean).join(' · ') || roll.id,
        attention: needsAttention(negatives, shotsByRoll.get(roll.id) || []),
      };
    });
}
