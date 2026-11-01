// Pure helpers for the Add / edit form: carried-over values, the next frame, option lists,
// form values → negative fields, and validation.

import { sortFrames } from './archive-data.js';
import { frameLayout } from './formats.js';
import { rollOrder } from './import-checks.js';
import { parseFrame } from './import-map.js';

const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/;

/** '3-4' → '5', '6A' → '7', '' → '1'. */
export function nextFrameLabel(label) {
  const numbers = String(label ?? '').match(/\d+/g);
  return numbers ? String(Number(numbers.at(-1)) + 1) : '1';
}

export function loadForm(db) {
  return db.transaction(['rolls', 'negatives', 'cameras', 'lenses', 'filmStocks'], 'readonly', async (t) => ({
    rolls: await t.getAll('rolls'),
    negatives: await t.getAll('negatives'),
    cameras: await t.getAll('cameras'),
    lenses: await t.getAll('lenses'),
    films: await t.getAll('filmStocks'),
  }));
}

/** Values for the next new entry on a roll: gear from the roll, the rest from its last frame. */
export function carryOver(roll, negatives) {
  const onRoll = sortFrames(negatives.filter((n) => n.rollId === roll.id));
  const last = onRoll.at(-1);
  const strip = last?.strip || 1;
  const fullStrip = onRoll.filter((n) => n.strip === strip).length >= frameLayout(roll).perStrip;
  return {
    rollId: roll.id,
    cameraId: roll.cameraId || last?.cameraId,
    lensId: roll.defaultLensId || last?.lensId,
    filmStock: roll.filmStock || last?.filmStock,
    dateTaken: last?.dateTaken,
    location: last?.location,
    category: last?.category,
    strip: last ? strip + (fullStrip ? 1 : 0) : 1,
    frameLabel: last ? nextFrameLabel(last.frameLabel ?? last.frame) : '1',
  };
}

export function buildLists(data, extra) {
  const withCurrent = (pairs, value) => (value && !pairs.some(([v]) => v === value) ? [...pairs, [value, value]] : pairs);
  const rolls = [...data.rolls].sort((a, b) => rollOrder(a.id, b.id)).map((r) => [r.id, `${r.id} · ${r.filmStock || (r.labNumber ? `lab ${r.labNumber}` : 'new roll')}`]);
  return {
    rolls,
    cameras: withCurrent([...data.cameras, ...extra.cameras].map((c) => [c.id, c.name]), extra.values.cameraId),
    lenses: withCurrent([...data.lenses, ...extra.lenses].map((l) => [l.id, l.name]), extra.values.lensId),
    films: withCurrent([...data.films, ...extra.films].map((f) => [f.name, f.name]), extra.values.filmStock),
    yourStocks: [...data.films, ...extra.films], // for the film picker
  };
}

export function toFields(v, files) {
  return {
    rollId: v.rollId,
    strip: v.strip ? Number(v.strip) : undefined,
    ...parseFrame(v.frameLabel),
    dateTaken: v.dateTaken,
    category: v.category,
    subject: v.subject,
    location: v.location,
    cameraId: v.cameraId,
    lensId: v.lensId,
    filmStock: v.filmStock,
    digitized: v.digitized,
    scanSize: v.scanSize,
    scanFile: v.scanFile,
    focus: v.focus,
    exposure: v.exposure,
    aperture: v.aperture && !v.aperture.startsWith('f/') ? `f/${v.aperture}` : v.aperture,
    shutter: v.shutter,
    ev: v.ev === undefined ? undefined : Math.round(Number(v.ev.replace(',', '.')) * 10) / 10,
    meterMode: v.meterMode,
    notes: v.notes,
    action: v.action || 'None',
    actionComplete: v.action === 'Edit' && v.actionComplete,
    editedFile: v.editedFile,
    rating: v.rating ? Number(v.rating) : undefined,
    social: v.social || 'No',
    print: v.print || 'No',
    printed: v.printed,
    storageLocation: v.storageLocation,
    status: 'catalogued', // saving a draft from Shoot in the form catalogues it
    ...files,
  };
}

export function validate(v) {
  if (!v.rollId) return ['rollId', 'Choose a roll.'];
  if (!v.subject) return ['subject', 'Add a subject or description.'];
  if (v.dateTaken && !DATE_PATTERN.test(v.dateTaken)) return ['dateTaken', 'Write the date as 2026-08 or 2026-08-15.'];
  if (v.strip && !/^\d+$/.test(v.strip)) return ['strip', 'Strip is a number.'];
  if (v.ev && !/^-?\d+([.,]\d+)?$/.test(v.ev)) return ['ev', 'EV is a number, e.g. 12.3.'];
  return null;
}
