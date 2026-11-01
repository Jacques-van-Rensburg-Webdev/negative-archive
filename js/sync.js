// Sync: turn a roll's shot log into draft negatives (docs/DATA.md, "Shoot → archive mapping").
// planSync is pure; applySync writes everything in one transaction. Re-syncing updates the
// negatives made before (shot.syncedNegativeId) and only touches the fields that come from the shot.

import { idYear, nextNegativeId, seriesForRoll } from './ids.js';
import { frameLayout } from './formats.js';
import { newNegative } from './schema.js';

const SHOT_LINE = /^(Shot note: |Shot at ISO )/;

/** frame = shot + (first − 1); strip = ceil(frame ÷ frames per strip: 6 on 35mm, 2–4 on 120). An override sets frame and / or strip. */
export function framePosition(shotNumber, first, override = {}, perStrip = 6) {
  const frame = override.frame ?? shotNumber + first - 1;
  const strip = override.strip ?? Math.max(1, Math.ceil(frame / perStrip));
  return { frame, strip };
}

/** Lines the shot adds to the negative's notes. */
export function shotNoteLines(shot, roll) {
  const lines = [];
  if (roll.shotIso && roll.boxIso && roll.shotIso !== roll.boxIso) lines.push(`Shot at ISO ${roll.shotIso} (box ${roll.boxIso})`);
  if (shot.note) lines.push(`Shot note: ${shot.note}`);
  return lines;
}

/** Replaces the shot's lines in existing notes, keeping anything else written there. */
export function mergeNotes(existing, lines) {
  const kept = (existing || '').split('\n').filter((line) => line && !SHOT_LINE.test(line));
  return [...kept, ...lines].join('\n') || undefined;
}

/** The fields of a negative that come from the shot (and are refreshed on re-sync). */
export function shotFields(shot, roll, position) {
  return {
    rollId: roll.id,
    frame: position.frame,
    frameLabel: String(position.frame),
    strip: position.strip,
    dateTaken: (shot.takenAt || '').slice(0, 10) || undefined,
    location: shot.placeName || undefined,
    cameraId: roll.cameraId,
    lensId: shot.lensId || roll.defaultLensId,
    filmStock: roll.filmStock || undefined,
    category: shot.category || undefined,
    shotId: shot.id,
    refThumbBlobId: shot.refThumbBlobId || shot.refPhotoBlobId, // shown until a scan is attached
  };
}

/**
 * Rows to show and write: [{ shot, position, negativeId, fields, notes }].
 * negativeId is set when the shot was synced before and that negative still exists.
 */
export function planSync(shots, roll, negatives, { first = 1, overrides = {} } = {}) {
  const byId = new Map(negatives.map((n) => [n.id, n]));
  const { perStrip } = frameLayout(roll);
  return [...shots].sort((a, b) => a.shotNumber - b.shotNumber).map((shot) => {
    const position = framePosition(shot.shotNumber, first, overrides[shot.id], perStrip);
    const existing = shot.syncedNegativeId ? byId.get(shot.syncedNegativeId) : undefined;
    return {
      shot,
      position,
      negativeId: existing?.id,
      fields: shotFields(shot, roll, position),
      notes: mergeNotes(existing?.notes, shotNoteLines(shot, roll)),
    };
  });
}

/** Writes the plan. Resolves with { created: [ids], updated: [ids] }. */
export function applySync(db, roll, rows, first) {
  return db.transaction(['negatives', 'meta', 'shots', 'rolls'], 'readwrite', async (t) => {
    const created = [];
    const updated = [];
    const now = new Date().toISOString();
    for (const row of rows) {
      const existing = row.negativeId ? await t.get('negatives', row.negativeId) : undefined;
      let id;
      if (existing) {
        id = existing.id;
        await t.put('negatives', { ...existing, ...row.fields, notes: row.notes, updatedAt: now });
        updated.push(id);
      } else {
        id = await nextNegativeId(t, idYear(row.fields.dateTaken), seriesForRoll(roll));
        // Placeholder subject, set once; rename it in the edit form (that also makes it catalogued)
        await t.add('negatives', newNegative({ ...row.fields, id, notes: row.notes, subject: `Shot ${row.shot.shotNumber}`, status: 'draft' }));
        created.push(id);
      }
      await t.put('shots', { ...row.shot, syncedNegativeId: id, syncedAt: now });
    }
    await t.put('rolls', { ...roll, firstFrame: first, syncedAt: now });
    return { created, updated };
  });
}

/** Shots not synced yet, or changed since they were synced. */
export const unsyncedShots = (shots) => shots.filter((s) => !s.syncedNegativeId || (s.updatedAt && s.updatedAt > (s.syncedAt || '')));
