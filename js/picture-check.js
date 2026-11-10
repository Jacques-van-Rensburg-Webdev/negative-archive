// Check pictures (Data screen): what the records expect against what the database really holds.

import { FULL_FIELDS, THUMB_FIELDS, imageIds, thumbId } from './image-kinds.js';

async function hasBytes(blob) {
  try {
    return Boolean(blob?.size) && (await blob.slice(0, 2).arrayBuffer()).byteLength > 0;
  } catch {
    return false;
  }
}

async function decodes(blob) {
  try {
    (await createImageBitmap(blob)).close();
    return true;
  } catch {
    return false;
  }
}

/** { previews, full: { expected, stored, withBytes }, thumbnails, sampleDecodes: true | false | null } */
export async function checkPictures(db) {
  const [negatives, shots, blobs] = await Promise.all([db.getAll('negatives'), db.getAll('shots'), db.getAll('blobs')]);
  const stored = new Map(blobs.map((b) => [b.id, b.blob]));
  const kind = async (ids) => {
    let withBytes = 0;
    for (const id of ids) if (await hasBytes(stored.get(id))) withBytes += 1;
    return { expected: ids.size, stored: [...ids].filter((id) => stored.has(id)).length, withBytes };
  };
  const previewIds = imageIds([...negatives, ...shots], THUMB_FIELDS);
  const sample = [...previewIds].map((id) => stored.get(id)).find((blob) => blob?.size);
  return {
    previews: await kind(previewIds),
    full: await kind(imageIds([...negatives, ...shots], FULL_FIELDS)),
    thumbnails: [...previewIds].filter((id) => stored.has(thumbId(id))).length,
    sampleDecodes: sample ? await decodes(sample) : null,
  };
}

/** One sentence for the status line. */
export function describeCheck({ previews, full, thumbnails, sampleDecodes }) {
  const part = (name, k) => `${name}: ${k.expected} expected, ${k.stored} stored, ${k.withBytes} with data`;
  const sample = sampleDecodes === null ? 'no preview to test' : `a sample preview ${sampleDecodes ? 'decodes' : 'does not decode'}`;
  return `${part('Previews', previews)} · ${part('Full-size', full)} · Thumbnails: ${thumbnails} · ${sample}.`;
}
