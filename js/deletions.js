// A small record of what was deleted, kept in the meta store and in backups, so that merging
// a backup from another device doesn't bring deleted rolls and shots back.

export const DELETIONS_KEY = 'deleted-records';

/** { rolls: { R003: deleted at }, negatives: { id: rollId }, shots: [id] }, tolerating an absent record. */
export const readDeletions = (entry) => ({
  rolls: { ...entry?.value?.rolls },
  negatives: { ...entry?.value?.negatives },
  shots: [...(entry?.value?.shots || [])],
});

/** Call inside a transaction that includes 'meta'. */
export async function noteDeleted(t, { roll, negatives = [], shots = [] }) {
  const value = readDeletions(await t.get('meta', DELETIONS_KEY));
  if (roll) value.rolls[roll] = new Date().toISOString();
  negatives.forEach((n) => { value.negatives[n.id] = n.rollId; });
  value.shots = [...new Set([...value.shots, ...shots])];
  await t.put('meta', { key: DELETIONS_KEY, value });
}

/** A new roll under a deleted roll's number: the number is in use again. */
export async function clearRollNote(t, rollId) {
  const value = readDeletions(await t.get('meta', DELETIONS_KEY));
  if (!value.rolls[rollId]) return;
  delete value.rolls[rollId];
  await t.put('meta', { key: DELETIONS_KEY, value });
}
