// Merge rules for one record found on both devices. Pure functions, used by js/merge.js.

import { currentFileName } from './file-names.js';

const NOT_CONTENT = new Set(['id', 'createdAt', 'updatedAt', 'mergedFrom']);
const content = (record) => JSON.stringify(Object.keys(record)
  .filter((key) => !NOT_CONTENT.has(key) && record[key] !== undefined && record[key] !== null)
  .sort()
  .map((key) => [key, record[key]]));
export const sameContent = (a, b) => content(a) === content(b);

export const withCurrentNames = (n) => ({ ...n, scanFile: currentFileName(n.rollId, n.scanFile), editedFile: currentFileName(n.rollId, n.editedFile) });

/** The same negative, not two that happen to share an ID. Copies from a restore share createdAt. */
export const isSameNegative = (a, b) => a.createdAt === b.createdAt
  || (a.rollId === b.rollId && String(a.frame ?? '') === String(b.frame ?? ''));

const NEGATIVE_FILES = [['scanBlobId', 'thumbBlobId'], ['editBlobId', 'editThumbBlobId'], ['refThumbBlobId']];
const NEGATIVE_NAMES = ['scanFile', 'editedFile'];
const wasEdited = (n) => n.updatedAt !== n.createdAt;

function keepFiles(merged, other, groups) {
  groups.forEach((group) => {
    if (group.some((key) => merged[key]) || !group.some((key) => other[key])) return;
    group.forEach((key) => { merged[key] = other[key]; });
  });
}

function fromWinner(local, winner, loser, groups) {
  const merged = { ...winner, id: local.id };
  keepFiles(merged, loser, groups);
  return merged;
}

/** Resolves with { record, outcome }: outcome 'same', 'kept' (no write needed) or 'updated'. */
export function pickNegative(local, incoming) {
  if (sameContent(local, incoming)) return { record: local, outcome: 'same' };
  let winner = (incoming.updatedAt || '') > (local.updatedAt || '') ? incoming : local;
  if (wasEdited(local) !== wasEdited(incoming)) winner = wasEdited(local) ? local : incoming;
  const loser = winner === local ? incoming : local;
  const merged = fromWinner(local, winner, loser, NEGATIVE_FILES);
  NEGATIVE_NAMES.forEach((key) => { if (!merged[key] && loser[key]) merged[key] = loser[key]; });
  if (merged.scanBlobId) merged.digitized = true;
  const mergedFrom = local.mergedFrom || incoming.mergedFrom;
  if (mergedFrom) merged.mergedFrom = mergedFrom;
  return sameContent(merged, local) ? { record: local, outcome: 'kept' } : { record: merged, outcome: 'updated' };
}

const SHOT_FILES = [['refPhotoBlobId', 'refThumbBlobId']];
const shotTime = (s) => s.updatedAt || s.takenAt || '';

export function pickShot(local, incoming) {
  if (sameContent(local, incoming)) return { record: local, outcome: 'same' };
  const winner = shotTime(incoming) > shotTime(local) ? incoming : local;
  const loser = winner === local ? incoming : local;
  const merged = fromWinner(local, winner, loser, SHOT_FILES);
  ['syncedNegativeId', 'syncedAt'].forEach((key) => { if (!merged[key] && loser[key]) merged[key] = loser[key]; });
  return sameContent(merged, local) ? { record: local, outcome: 'kept' } : { record: merged, outcome: 'updated' };
}

const STATUS_ORDER = ['shooting', 'at_lab', 'developed', 'archived'];
const USER_FIELDS = ['labNumber', 'storageLocation', 'filmStock', 'notes', 'cameraId', 'defaultLensId', 'exposures', 'boxIso', 'shotIso', 'format', 'frameSize'];
const isBlank = (value) => value === undefined || value === null || value === '';

/** Keeps this device's details, fills blanks, takes the furthest status. { roll, changed, differs } */
export function mergeRoll(local, incoming) {
  const roll = { ...local };
  Object.keys(incoming).forEach((key) => { if (isBlank(roll[key]) && !isBlank(incoming[key])) roll[key] = incoming[key]; });
  if (STATUS_ORDER.indexOf(incoming.status) > STATUS_ORDER.indexOf(local.status)) roll.status = incoming.status;
  const differs = USER_FIELDS.some((key) => !isBlank(local[key]) && !isBlank(incoming[key]) && local[key] !== incoming[key]);
  return { roll, changed: JSON.stringify(roll) !== JSON.stringify(local), differs };
}
