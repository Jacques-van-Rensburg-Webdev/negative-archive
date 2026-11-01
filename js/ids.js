// Negative IDs: B&W 'YYYY-NNNN' (2026-0078), colour 'YYYY-CNNNN' (2026-C0001).
// YYYY = year taken, NNNN = next number for that year and series. A per-year, per-series
// counter in the meta store only goes up, so a deleted ID is never reused.

const ID_PATTERN = /^(\d{4})-(C?)(\d{4})$/;
export const COLOUR = 'C';

export function formatId(year, number, series = '') {
  return `${year}-${series}${String(number).padStart(4, '0')}`;
}

/** '2026-C0001' → { year: 2026, series: 'C', number: 1 }, or null if it isn't a valid ID. */
export function parseId(id) {
  const match = ID_PATTERN.exec(id || '');
  return match ? { year: Number(match[1]), series: match[2], number: Number(match[3]) } : null;
}

export const isValidId = (id) => parseId(id) !== null;

/** The ID series for a roll: 'C' for colour, '' for B&W. */
export const seriesForRoll = (roll) => (roll?.process === 'colour' ? COLOUR : '');

const counterKey = (year, series) => `id-counter-${year}${series}`;

/** The year an ID belongs to: from dateTaken ('2026-08…'), else this year. */
export function idYear(dateTaken) {
  const match = /^(\d{4})/.exec(dateTaken || '');
  return match ? Number(match[1]) : new Date().getFullYear();
}

// Reads the counter and the highest existing ID; works in a read-only transaction.
async function computeNext(t, year, series) {
  const key = counterKey(year, series);
  const counter = (await t.get('meta', key))?.value || 0;
  const range = IDBKeyRange.bound(formatId(year, 0, series), formatId(year, 9999, series));
  const keys = await t.getAllKeys('negatives', range);
  const highest = keys.reduce((max, id) => Math.max(max, parseId(id)?.number || 0), 0);
  const next = Math.max(counter, highest) + 1;
  if (next > 9999) throw new Error(`No IDs left for ${year}${series ? ' (colour)' : ''}.`);
  return { key, next };
}

/**
 * Next free ID for a year and series. Call inside a transaction over ['meta', 'negatives'].
 * Uses the higher of the stored counter and the highest existing ID, then stores it.
 */
export async function nextNegativeId(t, year, series = '') {
  const { key, next } = await computeNext(t, year, series);
  await t.put('meta', { key, value: next });
  return formatId(year, next, series);
}

/** The ID the next new negative would get, without taking it (for showing in a form). */
export function previewNextId(db, year, series = '') {
  return db.transaction(['meta', 'negatives'], 'readonly', async (t) => formatId(year, (await computeNext(t, year, series)).next, series));
}

/** Raises the counter for this ID's year and series to at least its number (after importing). */
export async function reserveId(t, id) {
  const parsed = parseId(id);
  if (!parsed) return;
  const key = counterKey(parsed.year, parsed.series);
  const counter = (await t.get('meta', key))?.value || 0;
  if (parsed.number > counter) await t.put('meta', { key, value: parsed.number });
}

/** Saves a new negative under the next free ID for its roll's series. Resolves with the ID. */
export function addNegative(db, negative) {
  return db.transaction(['meta', 'negatives', 'rolls'], 'readwrite', async (t) => {
    const roll = negative.rollId ? await t.get('rolls', negative.rollId) : undefined;
    const id = await nextNegativeId(t, idYear(negative.dateTaken), seriesForRoll(roll));
    await t.add('negatives', { ...negative, id });
    return id;
  });
}
