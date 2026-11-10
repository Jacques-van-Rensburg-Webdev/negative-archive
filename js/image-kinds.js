// Which stored images are small previews and which are full-size files. Used by backup and merge.

export const THUMB_FIELDS = ['thumbBlobId', 'editThumbBlobId', 'refThumbBlobId'];
export const FULL_FIELDS = ['scanBlobId', 'editBlobId', 'refPhotoBlobId'];

/** The small thumbnail made from a preview, stored beside it (never written into records). */
export const thumbId = (previewId) => `${previewId}-s`;

/** The IDs with their thumbnails, for removing images. */
export const withThumbs = (ids) => ids.filter(Boolean).flatMap((id) => [id, thumbId(id)]);

/** The image IDs a set of negatives and shots use in the given fields. */
export const imageIds = (records, fields) => new Set(records.flatMap((r) => fields.map((f) => r[f])).filter(Boolean));

/** Images used as full-size files only. A reference photo with no preview doubles as its own thumbnail. */
export function fullSizeIds(records) {
  const thumbs = imageIds(records, THUMB_FIELDS);
  return new Set([...imageIds(records, FULL_FIELDS)].filter((id) => !thumbs.has(id)));
}
