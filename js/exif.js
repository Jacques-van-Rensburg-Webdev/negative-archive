// Reads the exposure a phone camera recorded in a JPEG's EXIF: shutter, f-number, ISO,
// exposure bias, brightness (APEX) and lens. Returns null for files without EXIF (HEIC, stripped).

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

/** { exposureTime, fNumber, iso, bias?, brightness?, lens? } from a JPEG ArrayBuffer, or null. */
export function readExposure(buffer) {
  try {
    const view = new DataView(buffer);
    const tiff = tiffStart(view);
    if (tiff === null) return null;
    const little = view.getUint16(tiff) === 0x4949;
    const out = {};
    readIfd(view, tiff, view.getUint32(tiff + 4, little), little, out);
    if (out.exifIfd) readIfd(view, tiff, out.exifIfd, little, out);
    delete out.exifIfd;
    const valid = (v) => Number.isFinite(v) && v > 0;
    return valid(out.exposureTime) && valid(out.fNumber) && valid(out.iso) ? out : null;
  } catch {
    return null;
  }
}

export const readFileExposure = async (file) => readExposure(await file.arrayBuffer());
