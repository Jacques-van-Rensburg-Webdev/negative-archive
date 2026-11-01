// Spreadsheet import: parse → map → plan (preview + problems) → write in one transaction.
// planImport is pure; applyImport only adds negatives whose IDs aren't in the database yet.

import { parseCsv } from './csv.js';
import { checkFiles, checkOrder, findTemplateRolls, rollOrder } from './import-checks.js';
import { isColourRoll, mapRecord, readHeader, rowToRecord } from './import-map.js';
import { reserveId } from './ids.js';
import { newRoll, slug } from './schema.js';

const mostCommon = (values) => {
  const counts = new Map();
  values.filter(Boolean).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
};

function readRows(texts, problems) {
  const rows = [];
  texts.forEach(({ name, text }) => {
    const table = parseCsv(text);
    const header = readHeader(table);
    if (!header) {
      problems.push({ type: 'skipped', detail: `${name}: no "Negative ID" column, skipped` });
      return;
    }
    table.slice(header.index + 1).forEach((row, i) => {
      const record = rowToRecord(row, header.columns);
      if (/^negative id$/i.test(record.id || '')) return; // a repeated header row
      rows.push({ ...mapRecord(record, header.index + i + 2), record });
    });
  });
  return rows;
}

function buildRoll(rollId, rows, isTemplate) {
  const negatives = isTemplate ? [] : rows.map((r) => r.negative);
  const filmStock = mostCommon(negatives.map((n) => n.filmStock)) || '';
  const iso = Number((/(\d{2,4})/.exec(filmStock) || [])[1]) || undefined;
  return newRoll({
    id: rollId,
    process: isColourRoll(rollId) ? 'colour' : 'bw',
    labNumber: rows.map((r) => r.rollRef.labNumber).find(Boolean),
    filmStock,
    boxIso: iso,
    shotIso: iso,
    cameraId: mostCommon(negatives.map((n) => n.cameraId)),
    defaultLensId: mostCommon(negatives.map((n) => n.lensId)),
  });
}

function buildGear(rows) {
  const cameras = new Map();
  const lenses = new Map();
  const films = new Map();
  rows.forEach(({ gear }) => {
    if (gear.camera) cameras.set(slug(gear.camera), { id: slug(gear.camera), name: gear.camera });
    if (gear.lens) {
      const max = Number((/f\/(\d+(?:\.\d+)?)/.exec(gear.lens) || [])[1]) || undefined;
      lenses.set(slug(gear.lens), { id: slug(gear.lens), name: gear.lens, maxAperture: max });
    }
    if (gear.film) films.set(gear.film, { name: gear.film, iso: Number((/(\d{2,4})/.exec(gear.film) || [])[1]) || undefined });
  });
  return { cameras: [...cameras.values()], lenses: [...lenses.values()], filmStocks: [...films.values()] };
}

/** texts: [{ name, text }]. Returns the import plan; nothing is written. */
export function planImport(texts) {
  const problems = [];
  const rows = readRows(texts, problems);

  const usable = rows.filter((row) => row.negative);
  const unusable = rows.filter((row) => !row.negative && Object.values(row.record).some(Boolean));
  if (unusable.length) {
    problems.push({ type: 'skipped', detail: `${unusable.length} row${unusable.length === 1 ? '' : 's'} without a Negative ID or roll, skipped` });
  }

  const byRoll = new Map();
  usable.forEach((row) => byRoll.set(row.negative.rollId, [...(byRoll.get(row.negative.rollId) || []), row]));
  const templates = findTemplateRolls(byRoll, problems);

  const kept = [];
  const keptIds = new Set();
  const perRoll = [];
  const rolls = [];
  [...byRoll.keys()].sort(rollOrder).forEach((rollId) => {
    const rollRows = byRoll.get(rollId);
    const isTemplate = templates.has(rollId);
    const negatives = [];
    if (isTemplate) {
      problems.push({ type: 'skipped', detail: `${rollId}: ${rollRows.length} rows copy earlier rolls' subjects; roll created empty` });
    } else {
      rollRows.forEach((row) => {
        problems.push(...row.problems);
        if (keptIds.has(row.negative.id)) {
          problems.push({ type: 'duplicate', id: row.negative.id, detail: `${row.negative.id} used again in ${rollId}; the repeat is skipped` });
          return;
        }
        keptIds.add(row.negative.id);
        negatives.push(row.negative);
      });
      checkOrder(rollId, negatives, problems);
    }
    kept.push(...negatives);
    rolls.push(buildRoll(rollId, rollRows, isTemplate));
    perRoll.push({ rollId, filmStock: rolls.at(-1).filmStock, count: negatives.length, skipped: isTemplate ? rollRows.length : 0 });
  });

  // IDs that also appear in skipped rows (e.g. 2026-0147 in R004 and R005)
  // Grouped by where the skipped rows are: each template roll, and rows without a roll.
  // A few are listed one by one; a whole block (e.g. a blank table) becomes one line.
  const sources = new Map([['rows without a roll', unusable]]);
  templates.forEach((rollId) => sources.set(rollId, byRoll.get(rollId)));
  sources.forEach((sourceRows, where) => {
    const clashes = [...new Set(sourceRows
      .map((row) => row.negative?.id || (row.record.id || '').replace(/[–—]/g, '-'))
      .filter((id) => keptIds.has(id)))].sort();
    if (clashes.length > 3) {
      problems.push({ type: 'duplicate', detail: `${clashes.length} imported IDs (${clashes[0]} … ${clashes.at(-1)}) also appear in ${where}` });
    } else {
      clashes.forEach((id) => problems.push({ type: 'duplicate', id, detail: `${id} also appears in ${where}` }));
    }
  });

  // IDs used more than once among the skipped rows alone (e.g. 2026-0257 in two blank tables)
  const skippedIds = new Map();
  rows.forEach((row) => {
    const id = row.negative?.id || (row.record.id || '').replace(/[–—]/g, '-');
    if (id && !keptIds.has(id)) skippedIds.set(id, (skippedIds.get(id) || 0) + 1);
  });
  skippedIds.forEach((count, id) => {
    if (count > 1) problems.push({ type: 'duplicate', id, detail: `${id} used ${count} times in skipped rows` });
  });
  checkFiles(kept, problems);

  return {
    rolls,
    negatives: kept,
    gear: buildGear(usable.filter((r) => !templates.has(r.negative.rollId))),
    problems,
    perRoll,
    skipped: rows.length - kept.length,
  };
}

/** Writes a plan. Negatives whose IDs already exist, and existing rolls and gear, are left as they are. */
export function applyImport(db, plan, source = '') {
  const stores = ['rolls', 'negatives', 'cameras', 'lenses', 'filmStocks', 'meta'];
  return db.transaction(stores, 'readwrite', async (t) => {
    const existing = new Set(await t.getAllKeys('negatives'));
    let added = 0;
    for (const negative of plan.negatives) {
      await reserveId(t, negative.id);
      if (existing.has(negative.id)) continue;
      await t.add('negatives', negative);
      added += 1;
    }
    const putMissing = async (store, items, key = 'id') => {
      const have = new Set(await t.getAllKeys(store));
      for (const item of items) if (!have.has(item[key])) await t.put(store, item);
    };
    await putMissing('rolls', plan.rolls);
    await putMissing('cameras', plan.gear.cameras);
    await putMissing('lenses', plan.gear.lenses);
    await putMissing('filmStocks', plan.gear.filmStocks, 'name');
    const result = { added, alreadyThere: plan.negatives.length - added };
    await t.put('meta', { key: 'last-import', value: { at: new Date().toISOString(), source, ...result } });
    return result;
  });
}
