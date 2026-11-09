// Deleting a roll: its negatives, Shoot log and stored images go with it, all in one
// transaction. Only the app's own copies are removed; files on the computer aren't touched.

import { noteDeleted } from './deletions.js';
import { reserveId } from './ids.js';

const negativeImages = (n) => [n.scanBlobId, n.thumbBlobId, n.editBlobId, n.editThumbBlobId, n.refThumbBlobId];
const shotImages = (s) => [s.refPhotoBlobId, s.refThumbBlobId];

/** Deletes the roll and everything on it. Resolves with what went; rejects, changing nothing, if it fails. */
export function deleteRoll(db, rollId) {
  return db.transaction(['rolls', 'negatives', 'shots', 'blobs', 'meta'], 'readwrite', async (t) => {
    if (!(await t.get('rolls', rollId))) throw new Error(`Roll ${rollId} isn't in the archive.`);
    const negatives = await t.byIndex('negatives', 'rollId', rollId);
    const shots = await t.byIndex('shots', 'rollId', rollId);

    for (const n of negatives) {
      await reserveId(t, n.id); // a deleted ID is never reused
      await t.remove('negatives', n.id);
    }
    for (const s of shots) await t.remove('shots', s.id);
    await t.remove('rolls', rollId);
    await noteDeleted(t, { roll: rollId, negatives, shots: shots.map((s) => s.id) }); // so a merge doesn't bring it back

    // A negative moved to another roll can still show a reference photo from this roll's log.
    const stillUsed = new Set((await t.getAll('negatives')).flatMap(negativeImages));
    const images = new Set([...negatives.flatMap(negativeImages), ...shots.flatMap(shotImages)].filter((id) => id && !stillUsed.has(id)));
    for (const id of images) await t.remove('blobs', id);

    return { negatives: negatives.length, shots: shots.length, images: images.size };
  });
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function whatGoes(id, negativeCount, shotCount) {
  const parts = [negativeCount && plural(negativeCount, 'negative'), shotCount && plural(shotCount, 'logged shot')].filter(Boolean);
  if (!parts.length) return `This removes ${id} from the app. It has no negatives or logged shots.`;
  return `This removes ${id} from the app, with ${parts.join(' and ')} and all stored images. Files on your computer aren't affected.`;
}

function actionButton(className, text, onClick) {
  const button = document.createElement('button');
  button.className = `span-2 button ${className}`;
  button.type = 'button';
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

/** The Remove roll and delete data button, with its two confirmation steps. */
export function deleteRollBlock(db, roll, negativeCount, shotCount) {
  const block = document.createElement('div');
  block.className = 'span-4 desktop-half stack-1 mb-6';

  const message = (text, className) => {
    const line = document.createElement('p');
    line.className = className;
    line.setAttribute('role', 'status');
    line.textContent = text;
    return line;
  };

  // One question and its two answers; focus starts on the safe answer.
  function ask(text, first, second, safe) {
    const row = document.createElement('div');
    row.className = 'grid grid-inner';
    row.append(first, second);
    block.replaceChildren(message(text, 'text-sm'), row);
    safe.focus();
  }

  function showStart(note = '') {
    const button = document.createElement('button');
    button.className = 'button button-danger button-block';
    button.type = 'button';
    button.textContent = 'Remove roll and delete data';
    button.addEventListener('click', showFirstCheck);
    block.replaceChildren(button, ...(note ? [message(note, 'text-sm text-muted')] : []));
  }

  function showFirstCheck() {
    const cancel = actionButton('button-secondary', 'Cancel', () => showStart());
    ask(whatGoes(roll.id, negativeCount, shotCount), cancel, actionButton('button-secondary', 'Continue', showSecondCheck), cancel);
  }

  // Keep roll sits where Continue was, so a double tap can't confirm the delete.
  function showSecondCheck() {
    const keep = actionButton('button-secondary', 'Keep roll', () => showStart());
    const yes = actionButton('button-danger', 'Yes, delete', remove);
    ask(`Are you sure? ${roll.id} and its data will be deleted. This can't be undone.`, yes, keep, keep);
  }

  async function remove(event) {
    event.currentTarget.disabled = true;
    try {
      await deleteRoll(db, roll.id);
      window.location.replace('#/archive'); // replace, so Back doesn't land on the deleted roll
    } catch {
      showStart(`Couldn't delete ${roll.id}. Nothing was changed.`);
    }
  }

  showStart();
  return block;
}
