// Merging a backup into this device: planMerge() works out every change without writing;
// applyMerge() re-plans and writes it all in one transaction, so it either all works or nothing changes.

import { backupBlobs, copyImages } from './backup.js';
import { STORES } from './db.js';
import { DELETIONS_KEY, readDeletions } from './deletions.js';
import { idYear, nextNegativeId, parseId } from './ids.js';
import { FULL_FIELDS, THUMB_FIELDS, fullSizeIds, imageIds, withThumbs } from './image-kinds.js';
import { isSameNegative, mergeRoll, pickNegative, pickShot, withCurrentNames } from './merge-records.js';

const GEAR = [['cameras', 'id'], ['lenses', 'id'], ['filmStocks', 'name'], ['lightingItems', 'id']];
const isCounter = (entry) => entry.key.startsWith('id-counter-');
const origin = (id, createdAt) => `${id}|${createdAt}`;
const metaEntry = (meta, key) => meta.find((m) => m.key === key);

function combineDeletions(a, b) {
  const rolls = { ...a.rolls };
  Object.entries(b.rolls).forEach(([id, at]) => { if (!rolls[id] || at > rolls[id]) rolls[id] = at; });
  return { rolls, negatives: { ...a.negatives, ...b.negatives }, shots: [...new Set([...a.shots, ...b.shots])] };
}

/** local: { stores without blobs, blobKeys }. incoming: the backup's stores. imageSizes: [{ id, size }]. */
export function planMerge(local, incoming, imageSizes) {
  const deleted = combineDeletions(readDeletions(metaEntry(local.meta, DELETIONS_KEY)), readDeletions(metaEntry(incoming.meta, DELETIONS_KEY)));
  const rollIsDeleted = (r) => deleted.rolls[r.id] && !(r.loadedAt && r.loadedAt > deleted.rolls[r.id]);
  // A note only covers what existed when the roll was deleted. Anything created later (the roll
  // imported again) means the roll is back in use, on both devices, so its note no longer applies.
  [...local.negatives, ...incoming.negatives].forEach((n) => {
    const at = deleted.rolls[n.rollId];
    if (at && (n.createdAt || '') > at) delete deleted.rolls[n.rollId];
  });
  const negativeIsDeleted = (n) => deleted.negatives[n.id] === n.rollId && Boolean(deleted.rolls[n.rollId]);
  const shotIsDeleted = (s) => deleted.shots.includes(s.id);
  const summary = { added: 0, updated: 0, kept: 0, same: 0, clashes: 0, rollsAdded: 0, rollsDiffer: 0, removed: 0 };

  // Negatives. A clash renumbered on the other device is renumbered here too, so both end up alike.
  const negatives = new Map(local.negatives.filter((n) => !negativeIsDeleted(n)).map((n) => [n.id, n]));
  const removedNegatives = local.negatives.filter(negativeIsDeleted);
  const negativeRemoves = removedNegatives.map((n) => n.id);
  const negativePuts = new Map();
  const renames = new Map();
  const arriving = incoming.negatives.map(withCurrentNames).filter((n) => !negativeIsDeleted(n));
  arriving.filter((n) => n.mergedFrom).forEach((n) => {
    const here = negatives.get(n.mergedFrom.id);
    if (!here || here.mergedFrom || here.createdAt !== n.mergedFrom.createdAt || negatives.has(n.id)) return;
    const renamed = { ...here, id: n.id, mergedFrom: n.mergedFrom };
    negatives.delete(here.id);
    negatives.set(n.id, renamed);
    negativeRemoves.push(here.id);
    negativePuts.set(n.id, renamed);
    renames.set(here.id, n.id);
  });
  const byOrigin = new Map([...negatives.values()].filter((n) => n.mergedFrom).map((n) => [origin(n.mergedFrom.id, n.mergedFrom.createdAt), n]));
  const clashes = [];
  arriving.forEach((n) => {
    const sameId = negatives.get(n.id);
    const counterpart = sameId && isSameNegative(sameId, n) ? sameId : byOrigin.get(origin(n.id, n.createdAt));
    if (counterpart) {
      const { record, outcome } = pickNegative(counterpart, n);
      summary[outcome] += 1;
      if (outcome === 'updated') { negatives.set(record.id, record); negativePuts.set(record.id, record); }
    } else if (!sameId) {
      negatives.set(n.id, n);
      negativePuts.set(n.id, n);
      summary.added += 1;
    } else {
      clashes.push({ ...n, mergedFrom: { id: n.id, createdAt: n.createdAt } });
      summary.clashes += 1;
    }
  });

  // Shots
  const shots = new Map(local.shots.filter((s) => !shotIsDeleted(s)).map((s) => [s.id, s]));
  const removedShots = local.shots.filter(shotIsDeleted);
  const shotPuts = new Map();
  const incomingShotIds = new Set();
  shots.forEach((s) => {
    if (!renames.has(s.syncedNegativeId)) return;
    const moved = { ...s, syncedNegativeId: renames.get(s.syncedNegativeId) };
    shots.set(s.id, moved);
    shotPuts.set(s.id, moved);
  });
  incoming.shots.filter((s) => !shotIsDeleted(s)).forEach((s) => {
    const here = shots.get(s.id);
    const record = here ? pickShot(here, s) : { record: s, outcome: 'updated' };
    if (record.outcome !== 'updated') return;
    shots.set(s.id, record.record);
    shotPuts.set(s.id, record.record);
    incomingShotIds.add(s.id);
  });

  // Rolls
  const rolls = new Map(local.rolls.filter((r) => !rollIsDeleted(r)).map((r) => [r.id, r]));
  const rollRemoves = local.rolls.filter(rollIsDeleted).map((r) => r.id);
  const rollPuts = [];
  incoming.rolls.filter((r) => !rollIsDeleted(r)).forEach((r) => {
    const here = rolls.get(r.id);
    if (!here) { rolls.set(r.id, r); rollPuts.push(r); summary.rollsAdded += 1; return; }
    const { roll, changed, differs } = mergeRoll(here, r);
    if (differs) summary.rollsDiffer += 1;
    if (changed) { rolls.set(r.id, roll); rollPuts.push(roll); }
  });
  rolls.forEach((_, id) => { delete deleted.rolls[id]; });
  summary.removed = removedNegatives.length + removedShots.length + rollRemoves.length;
  summary.removedRolls = rollRemoves.map((id) => ({
    id,
    items: 1 + removedNegatives.filter((n) => n.rollId === id).length + removedShots.filter((s) => s.rollId === id).length,
  }));

  // Gear and ID counters
  const gearPuts = GEAR.flatMap(([store, key]) => {
    const have = new Set(local[store].map((item) => item[key]));
    return incoming[store].filter((item) => !have.has(item[key])).map((item) => [store, item]);
  });
  // Darkroom bottles: the latest change wins, and the roll count is the higher of the two.
  const bottles = new Map(local.chemicals.map((b) => [b.id, b]));
  (incoming.chemicals || []).forEach((b) => {
    const here = bottles.get(b.id);
    const merged = { ...(here && (here.updatedAt || '') >= (b.updatedAt || '') ? here : b), rolls: Math.max(here?.rolls || 0, b.rolls || 0) };
    if (!here || JSON.stringify(merged) !== JSON.stringify(here)) gearPuts.push(['chemicals', merged]);
  });
  const counters = incoming.meta.filter(isCounter).filter((entry) => entry.value > (metaEntry(local.meta, entry.key)?.value || 0));

  // Images: copy what the final records use and this device lacks; drop what only deleted records used.
  const finalRecords = [...negatives.values(), ...clashes, ...shots.values()];
  const used = imageIds(finalRecords, [...THUMB_FIELDS, ...FULL_FIELDS]);
  const full = fullSizeIds(finalRecords);
  const have = new Set(local.blobKeys);
  const images = imageSizes.filter((b) => used.has(b.id) && !have.has(b.id)).map((b) => ({ ...b, full: full.has(b.id) }));
  const imageRemoves = withThumbs([...imageIds([...removedNegatives, ...removedShots], [...THUMB_FIELDS, ...FULL_FIELDS])].filter((id) => !used.has(id)));
  summary.fullImages = images.filter((b) => b.full).length;
  summary.fullSize = images.filter((b) => b.full).reduce((sum, b) => sum + b.size, 0);
  summary.images = images.length;
  summary.nothing = !(negativePuts.size || negativeRemoves.length || clashes.length || shotPuts.size || removedShots.length
    || rollPuts.length || rollRemoves.length || gearPuts.length || counters.length || images.length);

  return {
    negativePuts: [...negativePuts.values()], negativeRemoves, clashes, shotPuts: [...shotPuts.values()], incomingShotIds,
    shotRemoves: removedShots.map((s) => s.id), rollPuts, rollRemoves, gearPuts, counters, deleted, images, imageRemoves, summary,
  };
}

// A picture stored without any bytes (it happens on iOS) counts as not here, so a merge brings it again.
async function readLocal(t) {
  const local = {};
  for (const name of STORES.filter((store) => store !== 'blobs')) local[name] = await t.getAll(name);
  local.chemicals = local.chemicals || [];
  local.blobKeys = (await t.getAll('blobs')).filter((b) => b.blob?.size > 0).map((b) => b.id);
  return local;
}

const sizesOf = (backup) => backupBlobs(backup).map((b) => ({ id: b.id, size: b.blob.size }));

/** What a merge would do, for the summary. Changes nothing. */
export async function previewMerge(db, backup) {
  const local = await db.transaction(STORES, 'readonly', readLocal);
  return planMerge(local, backup.stores, sizesOf(backup)).summary;
}

/**
 * Applies the merge: the records in one transaction (all or nothing), then the pictures one by one
 * (onProgress(done, total)). copyFull = false leaves full-size files behind. Resolves with the summary.
 */
export async function applyMerge(db, backup, { copyFull = true, onProgress } = {}) {
  const blobs = new Map(backupBlobs(backup).map((b) => [b.id, b]));
  const sizes = [...blobs.values()].map((b) => ({ id: b.id, size: b.blob.size }));
  const plan = await db.transaction(STORES, 'readwrite', async (t) => {
    const plan = planMerge(await readLocal(t), backup.stores, sizes);
    for (const id of plan.negativeRemoves) await t.remove('negatives', id);
    for (const id of plan.shotRemoves) await t.remove('shots', id);
    for (const id of plan.rollRemoves) await t.remove('rolls', id);
    for (const id of plan.imageRemoves) await t.remove('blobs', id);
    for (const entry of plan.counters) await t.put('meta', entry);
    for (const n of plan.negativePuts) await t.put('negatives', n);

    // Two different negatives with one ID: the incoming one takes the next free ID.
    const newIds = new Map();
    for (const n of plan.clashes) {
      const id = await nextNegativeId(t, idYear(n.dateTaken), parseId(n.id)?.series || '');
      newIds.set(n.mergedFrom.id, id);
      await t.put('negatives', { ...n, id });
    }
    for (const s of plan.shotPuts) {
      const renumbered = plan.incomingShotIds.has(s.id) && newIds.has(s.syncedNegativeId);
      await t.put('shots', renumbered ? { ...s, syncedNegativeId: newIds.get(s.syncedNegativeId) } : s);
    }
    for (const r of plan.rollPuts) await t.put('rolls', r);
    for (const [store, item] of plan.gearPuts) await t.put(store, item);
    await t.put('meta', { key: DELETIONS_KEY, value: plan.deleted });
    await t.put('meta', { key: 'last-merge', value: { at: new Date().toISOString(), from: backup.exportedAt } });
    return plan;
  });
  plan.summary.imagesCopied = await copyImages(db, plan.images.filter((image) => copyFull || !image.full).map((image) => blobs.get(image.id)), onProgress);
  return plan.summary;
}
