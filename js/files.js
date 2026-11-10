// Image files: store an attached scan or edit as a Blob, with a JPEG preview (longest side 1280)
// for the detail view and a small thumbnail (320) for film strips and lists. Hands out object URLs.

import { thumbId, withThumbs } from './image-kinds.js';

export const PREVIEW_SIZE = 1280;
export const THUMB_SIZE = 320;
const JPEG_QUALITY = 0.82;

/** A JPEG no larger than size on its longest side, or null when this browser can't decode the image (e.g. TIFF in Chrome). */
export async function resizeImage(file, size) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  } catch {
    return null;
  }
}

/** Stores the file, its preview and the preview's thumbnail. Resolves with { blobId, thumbBlobId? }. */
export async function saveImage(db, file) {
  const id = `blob-${crypto.randomUUID()}`;
  const preview = await resizeImage(file, PREVIEW_SIZE);
  const thumb = preview && await resizeImage(preview, THUMB_SIZE);
  const now = new Date().toISOString();
  const previewId = `${id}-preview`;
  await db.transaction(['blobs'], 'readwrite', async (t) => {
    await t.put('blobs', { id, blob: file, name: file.name, createdAt: now });
    if (preview) await t.put('blobs', { id: previewId, blob: preview, name: `${file.name} (preview)`, createdAt: now });
    if (thumb) await t.put('blobs', { id: thumbId(previewId), blob: thumb, name: `${file.name} (thumbnail)`, createdAt: now });
  });
  return { blobId: id, thumbBlobId: preview ? previewId : undefined };
}

/** Removes stored images and their thumbnails (e.g. when a save fails after the files were stored). */
export function removeImages(db, ids) {
  return db.transaction(['blobs'], 'readwrite', async (t) => {
    for (const id of withThumbs(ids)) await t.remove('blobs', id);
  });
}

/** The preview to show for a negative in a strip or list: scan, else edit, else Shoot reference photo. */
export const previewId = (n) => n.thumbBlobId || n.editThumbBlobId || n.refThumbBlobId;

const urls = new Map();

/** An object URL for a stored blob, cached for the page's lifetime. For one-off pictures and the print page. */
export async function blobUrl(db, id) {
  if (!id) return undefined;
  if (!urls.has(id)) {
    const item = await db.get('blobs', id);
    if (!item?.blob) return undefined;
    urls.set(id, URL.createObjectURL(item.blob));
  }
  return urls.get(id);
}

/** Map of negative ID → preview URL, read in one transaction. For the print page, which needs every URL at once. */
export async function previewUrls(db, negatives) {
  const wanted = negatives.map((n) => [n.id, previewId(n)]).filter(([, id]) => id && !urls.has(id));
  const items = await db.transaction(['blobs'], 'readonly', (t) => Promise.all(wanted.map(([, id]) => t.get('blobs', id))));
  items.forEach((item) => { if (item?.blob) urls.set(item.id, URL.createObjectURL(item.blob)); });
  return new Map(negatives.map((n) => [n.id, urls.get(previewId(n))]).filter(([, url]) => url));
}
