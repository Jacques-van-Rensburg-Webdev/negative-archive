// Image files: store an attached scan or edit as a Blob, with a smaller JPEG preview
// (longest side 1280) for contact sheets and the detail view. Hands out object URLs.

const PREVIEW_SIZE = 1280;
const PREVIEW_QUALITY = 0.82;

/** A JPEG preview of the image, or null when this browser can't decode it (e.g. TIFF in Chrome). */
export async function makePreview(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PREVIEW_SIZE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', PREVIEW_QUALITY));
  } catch {
    return null;
  }
}

/** Stores the file and its preview. Resolves with { blobId, thumbBlobId? }. */
export async function saveImage(db, file) {
  const id = `blob-${crypto.randomUUID()}`;
  const preview = await makePreview(file);
  const now = new Date().toISOString();
  await db.transaction(['blobs'], 'readwrite', async (t) => {
    await t.put('blobs', { id, blob: file, name: file.name, createdAt: now });
    if (preview) await t.put('blobs', { id: `${id}-preview`, blob: preview, name: `${file.name} (preview)`, createdAt: now });
  });
  return { blobId: id, thumbBlobId: preview ? `${id}-preview` : undefined };
}

/** Removes stored images (e.g. when a save fails after the files were stored). */
export function removeImages(db, ids) {
  return db.transaction(['blobs'], 'readwrite', async (t) => {
    for (const id of ids.filter(Boolean)) await t.remove('blobs', id);
  });
}

const urls = new Map();

/** An object URL for a stored blob, cached for the page's lifetime. */
export async function blobUrl(db, id) {
  if (!id) return undefined;
  if (!urls.has(id)) {
    const item = await db.get('blobs', id);
    if (!item?.blob) return undefined;
    urls.set(id, URL.createObjectURL(item.blob));
  }
  return urls.get(id);
}

/** Map of negative ID → preview URL (scan, else edit, else Shoot reference photo) for contact sheets. */
export async function previewUrls(db, negatives) {
  const pairs = await Promise.all(negatives.map(async (n) => [n.id, await blobUrl(db, n.thumbBlobId || n.editThumbBlobId || n.refThumbBlobId)]));
  return new Map(pairs.filter(([, url]) => url));
}
