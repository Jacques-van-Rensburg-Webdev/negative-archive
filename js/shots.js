// Shoot data: loading and unloading rolls, the shot log, aperture stops and the lighting bag.

import { removeImages } from './files.js';
import { newRoll } from './schema.js';

export const LIGHT = ['Bright sun', 'Overcast', 'Shade', 'Golden hour', 'Indoor', 'Night'];
export const FILTERS = ['None', 'Yellow', 'Orange', 'Red', 'Green', 'ND', 'Polariser'];
export const SHOT_TYPES = ['Street', 'Architecture', 'Portrait', 'Landscape'];
export const LIGHTING_ROLES = ['Key', 'Fill', 'Rim / back', 'Bounce', 'Background'];
export const DEFAULT_LIGHTING_ITEMS = [
  'Flash on camera', 'Off-camera flash', 'Continuous LED', 'Practical lamp',
  'Reflector — silver', 'Reflector — gold', 'Reflector — white', 'Diffuser', 'Flag / black card',
];
const STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];

/** Apertures for a lens: its widest, then the standard stops to f/16. */
export function apertureStops(maxAperture) {
  const widest = maxAperture || 2;
  return [widest, ...STOPS.filter((s) => s > widest + 0.01)].map((s) => `f/${s}`);
}

/** Next free roll number: 'R007' for B&W, 'R002C' for colour. */
export function nextRollId(rolls, colour = false) {
  const numbers = rolls
    .map((r) => /^R(\d+)(C?)$/.exec(r.id))
    .filter((m) => m && Boolean(m[2]) === colour)
    .map((m) => Number(m[1]));
  return `R${String(Math.max(0, ...numbers) + 1).padStart(3, '0')}${colour ? 'C' : ''}`;
}

/** Guess from a film name whether it is colour (C-41); used as the default on Load a roll. */
export const looksColour = (film) => /\b(gold|portra|ektar|ultramax|colorplus|superia|fujicolor|pro image|cinestill|lomo ?color|vision3)\b/i.test(film || '');

export const rollsInCamera = (rolls) => rolls.filter((r) => r.status === 'shooting').sort((a, b) => (b.loadedAt || '').localeCompare(a.loadedAt || ''));

/** Loads a new roll into a camera. Rejects a used roll ID, or a camera that already holds a roll. */
export function loadRoll(db, fields) {
  return db.transaction(['rolls'], 'readwrite', async (t) => {
    if (await t.get('rolls', fields.id)) throw new Error(`${fields.id} is already in the archive. Choose another roll number.`);
    const busy = (await t.getAll('rolls')).find((r) => r.status === 'shooting' && r.cameraId === fields.cameraId);
    if (busy) throw new Error(`${busy.id} is still in this camera. Unload it on the Shoot tab first.`);
    const roll = newRoll({ ...fields, status: 'shooting', loadedAt: new Date().toISOString() });
    await t.put('rolls', roll);
    return roll;
  });
}

export const unloadRoll = (db, roll) => db.put('rolls', { ...roll, status: 'at_lab', unloadedAt: new Date().toISOString() });

/** Setting the lab number marks a roll that's out of the camera as developed. */
export function setLabNumber(db, roll, labNumber) {
  const status = labNumber && roll.status !== 'archived' ? 'developed' : roll.status;
  return db.put('rolls', { ...roll, labNumber, status });
}

export async function shotsForRoll(db, rollId) {
  const shots = await db.byIndex('shots', 'rollId', rollId);
  return shots.sort((a, b) => a.shotNumber - b.shotNumber || a.takenAt.localeCompare(b.takenAt));
}

export const nextShotNumber = (shots) => Math.max(0, ...shots.map((s) => s.shotNumber)) + 1;

export async function logShot(db, shot) {
  const saved = { ...shot, id: `shot-${crypto.randomUUID()}`, takenAt: shot.takenAt || new Date().toISOString() };
  await db.add('shots', saved);
  return saved;
}

export const updateShot = (db, shot) => db.put('shots', { ...shot, updatedAt: new Date().toISOString() });

/** Deletes a shot and its reference photo. A negative already synced from it stays in the archive. */
export async function deleteShot(db, shot) {
  await db.remove('shots', shot.id);
  await removeImages(db, [shot.refPhotoBlobId, shot.refThumbBlobId]);
}

/** The lighting bag, seeded with the spec's list the first time. */
export async function lightingItems(db) {
  const items = await db.getAll('lightingItems');
  if (items.length) return items;
  const seeded = DEFAULT_LIGHTING_ITEMS.map((name, i) => ({ id: `light-${i + 1}`, name }));
  await db.transaction(['lightingItems'], 'readwrite', async (t) => {
    for (const item of seeded) await t.put('lightingItems', item);
  });
  return seeded;
}

/** One line for a shot's lighting: 'Reflector — silver, Diffuser · Fill · camera left'. */
export function lightingText(lighting) {
  if (!lighting) return '';
  return [lighting.items?.join(', '), lighting.role, lighting.setup].filter(Boolean).join(' · ');
}

// GPS position, or nothing after a few seconds (works offline; never blocks logging for long)
export function position() {
  if (!navigator.geolocation) return Promise.resolve({});
  return new Promise((resolve) => {
    const done = setTimeout(() => resolve({}), 4000);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { clearTimeout(done); resolve({ lat: coords.latitude, lng: coords.longitude }); },
      () => { clearTimeout(done); resolve({}); },
      { maximumAge: 60000, timeout: 4000 },
    );
  });
}
