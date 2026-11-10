// Bottles in the database ('chemicals' store): mix, retire, count a roll. A bottle is one mixed chemical
// or one colour kit. Nothing is deleted: a thrown-out bottle keeps its record, so a merge agrees on it.

import { findProduct } from './chemicals.js';

const now = () => new Date().toISOString();

/** Bottles still in use, newest first within each kind. */
export async function liveBottles(db) {
  return (await db.getAll('chemicals')).filter((b) => !b.retiredAt).sort((a, b) => a.kind.localeCompare(b.kind) || b.mixedAt.localeCompare(a.mixedAt));
}

/**
 * Stores a new bottle. fields: { kind, product (key), mixedAt 'YYYY-MM-DD', capacity?, useWithinDays? }.
 * Capacity and days default to the product's. Resolves with the bottle.
 */
export async function mixBottle(db, fields) {
  const p = findProduct(fields.kind, fields.product);
  if (!p) throw new Error(`Unknown ${fields.kind}: ${fields.product}`);
  if (p.oneShot) throw new Error(`${p.name} is one-shot: nothing to keep.`);
  const at = now();
  const bottle = {
    id: `chem-${crypto.randomUUID()}`,
    kind: p.kind,
    product: p.key,
    name: p.name,
    process: p.process,
    mixedAt: fields.mixedAt,
    capacity: fields.capacity === undefined ? p.capacity : fields.capacity,
    useWithinDays: fields.useWithinDays === undefined ? p.days : fields.useWithinDays,
    indicator: p.indicator,
    rolls: 0,
    lastUsedAt: null,
    retiredAt: null,
    createdAt: at,
    updatedAt: at,
  };
  await db.put('chemicals', bottle);
  return bottle;
}

function patch(db, id, change) {
  return db.transaction(['chemicals'], 'readwrite', async (t) => {
    const bottle = await t.get('chemicals', id);
    if (!bottle) return null;
    const updated = { ...bottle, ...change(bottle), updatedAt: now() };
    await t.put('chemicals', updated);
    return updated;
  });
}

/** One more roll through the bottle. Resolves with the bottle, or null if it's gone. */
export const countRoll = (db, id) => patch(db, id, (b) => ({ rolls: b.rolls + 1, lastUsedAt: now() }));

/** Throws the bottle out (kept as a record). */
export const retireBottle = (db, id) => patch(db, id, () => ({ retiredAt: now() }));

/** Changes capacity or days on a bottle. */
export const updateBottle = (db, id, fields) => patch(db, id, () => fields);
