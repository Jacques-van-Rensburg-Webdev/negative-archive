// Queue lists: what's left to edit, print and post. Ticking an item off returns what it
// changed, so Undo can put it back.

import { groupByRoll, sortFrames, sortRollsNewestFirst } from './archive-data.js';
import { patchNegative, postNegative } from './feed.js';

export const LISTS = {
  edit: { label: 'Edit', done: 'edited', empty: 'Nothing left to edit.', test: (n) => n.action === 'Edit' && !n.actionComplete },
  print: { label: 'Print', done: 'printed', empty: 'Nothing waiting to be printed.', test: (n) => n.print === 'Yes' && !n.printed },
  post: { label: 'Post', done: 'posted', empty: 'Nothing waiting to be posted.', test: (n) => n.social === 'Yes' && !n.posted },
};

/** In a list? Drafts from Shoot are left out until they're catalogued. */
export const inList = (n, list) => n.status !== 'draft' && LISTS[list].test(n);

export function queueCounts(negatives) {
  return Object.fromEntries(Object.keys(LISTS).map((list) => [list, negatives.filter((n) => inList(n, list)).length]));
}

/** A list grouped by roll, newest roll first, frames in order: [{ roll, negatives }]. */
export function queueGroups(negatives, rolls, list) {
  const items = negatives.filter((n) => inList(n, list));
  const byRoll = groupByRoll(items);
  return sortRollsNewestFirst(rolls.filter((r) => byRoll.has(r.id)), groupByRoll(negatives))
    .map((roll) => ({ roll, negatives: sortFrames(byRoll.get(roll.id)) }));
}

/** Ticks an item off its list. Resolves with { negative, previous } for Undo. */
export async function markDone(db, n, list) {
  if (list === 'edit') return { negative: await patchNegative(db, n.id, { actionComplete: true }), previous: { actionComplete: n.actionComplete } };
  if (list === 'print') return { negative: await patchNegative(db, n.id, { printed: true }), previous: { printed: n.printed } };
  return { negative: await postNegative(db, n), previous: { posted: n.posted, postedAt: n.postedAt, caption: n.caption } };
}

export const undoDone = (db, n, previous) => patchNegative(db, n.id, previous);
