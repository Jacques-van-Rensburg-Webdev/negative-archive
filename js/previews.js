// Pictures that load only while near the screen. showPreview() reads the stored blob when its element
// comes within 400px, and releases the URL when the element scrolls far away or leaves the page, so a
// long archive holds about one screenful of pictures. Strips and lists get the small thumbnail, made
// from the preview the first time it's needed and kept; the detail view and Feed get the full preview.

import { getDb } from './db.js';
import { THUMB_SIZE, resizeImage } from './files.js';
import { THUMB_FIELDS, imageIds, thumbId } from './image-kinds.js';

const NEAR_SCREEN = '400px';
const PAUSE_MS = 50; // between thumbnails in the background pass
const wanted = new WeakMap(); // element → { id, full, db, near, loading }
const shown = new WeakMap(); // element → object URL
const building = new Map(); // preview ID → promise, so two frames don't build the same thumbnail

/** The small thumbnail for a preview, made and stored on first use. The preview itself if it can't be resized; null when there's no preview. */
export function thumbnailBlob(db, previewId) {
  if (!building.has(previewId)) {
    building.set(previewId, (async () => {
      const small = await db.get('blobs', thumbId(previewId));
      if (small?.blob) return small.blob;
      const preview = await db.get('blobs', previewId);
      if (!preview?.blob) return null;
      const blob = await resizeImage(preview.blob, THUMB_SIZE);
      if (!blob) return preview.blob;
      await db.put('blobs', { id: thumbId(previewId), blob, name: `${preview.name} (thumbnail)`, createdAt: new Date().toISOString() });
      return blob;
    })().finally(() => building.delete(previewId)));
  }
  return building.get(previewId);
}

const isImage = (node) => node instanceof HTMLImageElement;

function paint(node, url) {
  if (!isImage(node)) node.style.backgroundImage = url ? `url("${url}")` : '';
  else if (url) node.src = url;
  else node.removeAttribute('src');
}

function release(node) {
  const url = shown.get(node);
  if (!url) return;
  URL.revokeObjectURL(url);
  shown.delete(node);
  paint(node, '');
}

async function load(node) {
  const want = wanted.get(node);
  if (!want || want.loading || shown.has(node)) return;
  want.loading = true;
  const db = await want.db;
  const blob = want.full ? (await db.get('blobs', want.id))?.blob : await thumbnailBlob(db, want.id);
  want.loading = false;
  if (wanted.get(node) !== want || !want.near) return;
  if (!blob) { if (isImage(node)) node.dispatchEvent(new Event('error')); return; } // the screen shows its fallback
  const url = URL.createObjectURL(blob);
  shown.set(node, url);
  paint(node, url);
}

const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      const want = wanted.get(target);
      if (!target.isConnected || !want) { release(target); wanted.delete(target); observer.unobserve(target); return; }
      want.near = isIntersecting;
      if (isIntersecting) load(target); else release(target);
    });
  }, { rootMargin: NEAR_SCREEN })
  : null;

/**
 * Shows the stored image blobId on node (an <img>, or any element as its background) while it's near the screen.
 * full: the blob as stored; otherwise its small thumbnail. An <img> gets an 'error' event when there's no such image.
 */
export function showPreview(node, blobId, { full = false, db = getDb() } = {}) {
  if (!blobId) return;
  wanted.set(node, { id: blobId, full, db, near: !observer, loading: false });
  if (observer) observer.observe(node);
  else load(node);
}

/** Makes the thumbnails an archive doesn't have yet, one at a time. Resolves with how many were made. */
export async function buildThumbnails(db) {
  const [negatives, shots, keys] = await Promise.all([db.getAll('negatives'), db.getAll('shots'), db.transaction(['blobs'], 'readonly', (t) => t.getAllKeys('blobs'))]);
  const have = new Set(keys);
  const missing = [...imageIds([...negatives, ...shots], THUMB_FIELDS)].filter((id) => have.has(id) && !have.has(thumbId(id)));
  for (const id of missing) {
    await thumbnailBlob(db, id);
    await new Promise((resolve) => { setTimeout(resolve, PAUSE_MS); });
  }
  return missing.length;
}
