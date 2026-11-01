// Gear bag helpers shared by forms: make a new camera / lens / film / lighting item from a
// typed name, and the "Add new…" option in gear selects.

import { slug } from './schema.js';

export const NEW_OPTION = '__new';

/** A store item for a new piece of gear. kind: 'camera' | 'lens' | 'film' | 'lighting'. */
export function newGearItem(kind, name) {
  if (kind === 'film') return { name, iso: Number((/(\d{2,4})/.exec(name) || [])[1]) || undefined };
  if (kind === 'lens') return { id: slug(name), name, maxAperture: Number((/f\/?(\d+(?:\.\d+)?)/.exec(name) || [])[1]) || undefined };
  return { id: slug(name), name };
}

export const STORE_FOR = { camera: 'cameras', lens: 'lenses', film: 'filmStocks', lighting: 'lightingItems' };

/**
 * Asks for a name and adds it as the selected option before "Add new…".
 * Resolves with { kind, item } or null when cancelled (the select goes back to its previous value).
 */
export function promptNewGear(select, kind) {
  const name = window.prompt(`Name of the new ${kind}`)?.trim();
  if (!name) {
    select.value = select.dataset.previous || '';
    return null;
  }
  const item = newGearItem(kind, name);
  const value = kind === 'film' ? item.name : item.id;
  select.add(new Option(name, value, true, true), select.querySelector(`option[value="${NEW_OPTION}"]`));
  select.dataset.previous = value;
  return { kind, item };
}

/** Saves gear items ([{ kind, item }]) in one transaction. */
export function saveGear(db, items) {
  if (!items.length) return Promise.resolve();
  return db.transaction(['cameras', 'lenses', 'filmStocks', 'lightingItems'], 'readwrite', async (t) => {
    for (const { kind, item } of items) await t.put(STORE_FOR[kind], item);
  });
}
