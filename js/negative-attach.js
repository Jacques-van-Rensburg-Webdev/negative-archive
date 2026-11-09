// Attaching a scan or edit straight from the picture area on Negative detail.

import { removeImages, saveImage } from './files.js';
import { el } from './negative-sections.js';

const NOUN = { scan: 'scan', edit: 'edit' };

/** Stores the file on the negative. Resolves with the saved negative; rejects, changing nothing, if it fails. */
export async function attachFile(db, negativeId, kind, file) {
  const { blobId, thumbBlobId } = await saveImage(db, file);
  try {
    return await db.transaction(['negatives'], 'readwrite', async (t) => {
      const n = await t.get('negatives', negativeId);
      if (!n) throw new Error(`Negative ${negativeId} isn't in the archive.`);
      const fields = kind === 'edit'
        ? { editBlobId: blobId, editThumbBlobId: thumbBlobId, editedFile: n.editedFile || file.name }
        : { scanBlobId: blobId, thumbBlobId, scanFile: n.scanFile || file.name, digitized: true };
      const saved = { ...n, ...fields, updatedAt: new Date().toISOString() };
      await t.put('negatives', saved);
      return saved;
    });
  } catch (error) {
    await removeImages(db, [blobId, thumbBlobId]);
    throw error;
  }
}

/** The picture area when no file is attached: a button and its file input. report(text, busy) updates the status line. */
export function attachControls(db, n, kind, fileName, busy, report) {
  const noun = NOUN[kind];
  const button = el('button', 'negative-image-attach');
  button.type = 'button';
  button.disabled = busy;
  button.append(el('span', 'text-sm', `No ${noun} attached`));
  if (fileName) button.append(el('span', 'text-xs text-mono', fileName));
  button.append(el('span', 'button button-sm mt-1', `Attach ${noun}`));

  const input = el('input', 'negative-image-file');
  input.type = 'file';
  input.accept = 'image/*,.tif,.tiff';
  input.hidden = true;
  button.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const [file] = input.files;
    if (!file) return;
    report('Saving…', true);
    try {
      await attachFile(db, n.id, kind, file);
      report(`Attached ${file.name}`);
    } catch (error) {
      report(`Not attached: ${error.message}`);
    }
  });
  return [button, input];
}

/** The picture area when a file is attached but this browser can't display it (e.g. TIFF in Chrome). */
export function noPreview(kind, fileName) {
  const box = el('span', 'negative-image-placeholder');
  box.append(el('span', 'text-sm', `${kind === 'edit' ? 'Edit' : 'Scan'} attached`));
  if (fileName) box.append(el('span', 'text-xs text-mono', fileName));
  box.append(el('span', 'text-xs', 'Preview not available in this browser'));
  return box;
}
