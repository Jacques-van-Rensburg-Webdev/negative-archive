// Reads the exposure a phone camera recorded in a photo's EXIF: shutter, f-number, ISO,
// exposure bias, brightness (APEX) and lens. JPEG headers first, then a scan (HEIC). Null when stripped.

const TAGS = {
  0x8769: 'exifIfd',
  0x829a: 'exposureTime',
  0x829d: 'fNumber',
  0x8827: 'iso',
  0x9203: 'brightness',
  0x9204: 'bias',
  0xa434: 'lens',
};
const SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

/** The TIFF block inside the APP1 "Exif" segment, or null. */
function tiffStart(view) {
  if (view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null; // start of image data: no EXIF before it
    if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966 && view.getUint16(offset + 8) === 0) return offset + 10;
    offset += 2 + length;
  }
  return null;
}

function readIfd(view, tiff, ifdOffset, little, out) {
  const count = view.getUint16(tiff + ifdOffset, little);
  for (let i = 0; i < count; i += 1) {
    const entry = tiff + ifdOffset + 2 + i * 12;
    const name = TAGS[view.getUint16(entry, little)];
    if (!name) continue;
    const type = view.getUint16(entry + 2, little);
    const n = view.getUint32(entry + 4, little);
    const at = (SIZES[type] || 1) * n > 4 ? tiff + view.getUint32(entry + 8, little) : entry + 8;
    if (at + (SIZES[type] || 1) * n > view.byteLength) continue;
    if (type === 3) out[name] = view.getUint16(at, little);
    else if (type === 4) out[name] = view.getUint32(at, little);
    else if (type === 5) out[name] = view.getUint32(at, little) / view.getUint32(at + 4, little);
    else if (type === 10) out[name] = view.getInt32(at, little) / view.getInt32(at + 4, little);
    else if (type === 2) out[name] = new TextDecoder().decode(new Uint8Array(view.buffer, view.byteOffset + at, n)).replace(/\0+$/, '');
  }
}

/**
 * Fallback for HEIC and anything else: the first "Exif\0\0" followed by a TIFF header
 * (II*\0 or MM\0*). HEIC keeps its EXIF item that way, after a 4-byte offset.
 */
function scanForTiff(view) {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  for (let i = 0; i + 10 <= bytes.length; i += 1) {
    if (bytes[i] !== 0x45 || bytes[i + 1] !== 0x78 || bytes[i + 2] !== 0x69 || bytes[i + 3] !== 0x66 || bytes[i + 4] || bytes[i + 5]) continue;
    const order = view.getUint16(i + 6);
    const magic = view.getUint16(i + 8, order === 0x4949);
    if ((order === 0x4949 || order === 0x4d4d) && magic === 42) return i + 6;
  }
  return null;
}

/** What kind of file the bytes say it is. */
export function fileKind(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength >= 2 && view.getUint16(0) === 0xffd8) return 'JPEG';
  if (view.byteLength >= 12 && view.getUint32(4) === 0x66747970) { // 'ftyp'
    const brand = String.fromCharCode(...new Uint8Array(buffer, 8, 4));
    return /hei|mif/.test(brand) ? `HEIC (${brand})` : `ISO media (${brand})`;
  }
  if (view.byteLength >= 4 && view.getUint32(0) === 0x89504e47) return 'PNG';
  return 'unknown';
}

/** Every tag it could read, plus where the EXIF block was: { tags, found: 'JPEG header' | 'scan' | null }. */
export function readExifTags(buffer) {
  const view = new DataView(buffer);
  let tiff = null;
  let found = null;
  try { tiff = tiffStart(view); } catch { tiff = null; }
  if (tiff !== null) found = 'JPEG header';
  else {
    tiff = scanForTiff(view);
    if (tiff !== null) found = 'scan';
  }
  const tags = {};
  if (tiff === null) return { tags, found };
  try {
    const little = view.getUint16(tiff) === 0x4949;
    readIfd(view, tiff, view.getUint32(tiff + 4, little), little, tags);
    if (tags.exifIfd) readIfd(view, tiff, tags.exifIfd, little, tags);
  } catch { /* keep what was read */ }
  delete tags.exifIfd;
  return { tags, found };
}

/** { exposureTime, fNumber, iso, bias?, brightness?, lens? } from a JPEG or HEIC ArrayBuffer, or null. */
export function readExposure(buffer) {
  const { tags } = readExifTags(buffer);
  const valid = (v) => Number.isFinite(v) && v > 0;
  return valid(tags.exposureTime) && valid(tags.fNumber) && valid(tags.iso) ? tags : null;
}

export const readFileExposure = async (file) => readExposure(await file.arrayBuffer());
