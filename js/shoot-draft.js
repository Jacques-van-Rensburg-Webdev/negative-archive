// Keeps the Shoot form while the Meter screen is open, and hands the reading back.
// Held in memory only: a reload of the app clears it, like an unsaved form.

let draft = null; // { rollId, form, pendingRef, editingId }
let reading = null; // { rollId, aperture, shutter, meter, refFile? }

export const saveDraft = (value) => { draft = value; };

/** The kept form for a roll, once; null when there is none. */
export function takeDraft(rollId) {
  if (!draft || draft.rollId !== rollId) return null;
  const kept = draft;
  draft = null;
  return kept;
}

/** Shoot form values for the Meter screen (filter, aperture, light, lens) without taking the draft. */
export const peekDraft = (rollId) => (draft && draft.rollId === rollId ? draft : null);

export const setReading = (value) => { reading = value; };

export function takeReading(rollId) {
  if (!reading || reading.rollId !== rollId) return null;
  const kept = reading;
  reading = null;
  return kept;
}
