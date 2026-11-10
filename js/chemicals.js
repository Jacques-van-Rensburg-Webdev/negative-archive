// Darkroom chemicals: the products a bottle can be, what the maker says about reuse (capacity in rolls,
// how long a working solution keeps, how the time grows with each roll), and a bottle's status. Pure functions.
// Capacities and days are datasheet figures where given, otherwise a labelled guide; every bottle can override them.

import { BATHS, DEVELOPERS } from './timer-data.js';
import { KITS } from './timer-data-kits.js';

export const KINDS = [['developer', 'Developer'], ['stop', 'Stop bath'], ['fixer', 'Fixer'], ['hypo', 'Hypo clear'], ['wetting', 'Wetting agent'], ['kit', 'Colour kit']];
const BATH_GROUP = { stop: 'Stop', fixer: 'Fixer', hypo: 'Hypo clear', wetting: 'Wetting' };
const ONE_SHOT = { oneShot: true };
const GUIDE = { fixer: 56, stop: 56, hypo: 56, developer: 180, kit: 42 }; // days, a guide when the maker gives none

// By developer key, bath label or the start of a kit name
const DEFAULTS = {
  id11: { capacity: 10, days: 180, reuse: { percent: 10 }, source: 'Ilford' },
  microphen: { capacity: 10, days: 180, reuse: { percent: 10 }, source: 'Ilford' },
  perceptol: { capacity: 10, days: 180, reuse: { percent: 10 }, source: 'Ilford' },
  df96: { capacity: 16, days: 60, reuse: { seconds: 15 }, source: 'CineStill' },
  d76h: ONE_SHOT, id11h: ONE_SHOT, xtolh: ONE_SHOT, tmax: ONE_SHOT, hc110b: ONE_SHOT, hc110h: ONE_SHOT, ilfotec: ONE_SHOT, lc29: ONE_SHOT, ddx: ONE_SHOT, ilfosol: ONE_SHOT, rod25: ONE_SHOT, rod50: ONE_SHOT, rod100: ONE_SHOT, caffenol: ONE_SHOT, custom: ONE_SHOT,
  'Ilford Ilfostop 1+19': { capacity: 15, days: 56, indicator: true, source: 'Ilford' },
  'Kodak Indicator Stop Bath 1+63': { indicator: true },
  'Running water rinse': ONE_SHOT,
  'Ilford Rapid Fixer 1+4': { capacity: 24, days: 56, source: 'Ilford' },
  'Ilford Hypam 1+4': { capacity: 24, days: 56, source: 'Ilford' },
  'Adox Adofix P II (used as mixed)': { capacity: 10, days: 42, source: 'Adox (retailer listings; no datasheet found)' },
  None: ONE_SHOT,
  'Kodak Photo-Flo 200 (1+200)': ONE_SHOT, 'Ilford Ilfotol (1+200)': ONE_SHOT, 'Adox Adoflo II (1+200)': ONE_SHOT, 'Distilled water rinse': ONE_SHOT,
  'CineStill Cs41': { capacity: 24, days: 42, reuse: { percent: 2 }, source: 'CineStill (quart kit)' },
  'Tetenal Colortec C-41': { capacity: 16, days: 42, reuse: { table: [[4, 195], [8, 210], [12, 225], [16, 240]] }, source: 'Tetenal' },
  'Tetenal Colortec E-6': { capacity: 12, days: 42, reuse: { table: [[1, 375], [2, 390], [3, 405]] }, source: 'Tetenal' },
};

const defaultsFor = (kind, key) => DEFAULTS[key] || (kind === 'kit' ? Object.entries(DEFAULTS).find(([start]) => key.startsWith(start))?.[1] : null) || {};

function product(kind, key, name, process) {
  const d = defaultsFor(kind, key);
  return { kind, key, name, process, oneShot: Boolean(d.oneShot), capacity: d.capacity ?? null, days: d.oneShot ? null : d.days ?? GUIDE[kind], daysAreGuide: !d.oneShot && d.days == null, reuse: d.reuse || null, indicator: Boolean(d.indicator), source: d.source || '' };
}

/** The products a bottle of this kind can be. Kits carry their process ('c41', 'e6', 'ecn2'). */
export function products(kind) {
  if (kind === 'developer') return DEVELOPERS.filter(([key]) => key !== 'custom').map(([key, name]) => product(kind, key, name));
  if (kind === 'kit') return Object.entries(KITS).flatMap(([process, kits]) => kits.map((k) => product(kind, k.name, k.name, process)));
  return BATHS[BATH_GROUP[kind]].filter((b) => b.label !== 'None').map((b) => product(kind, b.label, b.label));
}

export const findProduct = (kind, key) => products(kind).find((p) => p.key === key) || null;

const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

/** The developer time for roll number rollsBefore + 1 in this bottle: { seconds, note } or null when nothing changes. */
export function adjustForReuse(seconds, productOrRule, rollsBefore) {
  const rule = productOrRule && 'reuse' in productOrRule ? productOrRule.reuse : productOrRule;
  if (!rule || !rollsBefore) return null;
  const n = rollsBefore + 1;
  if (rule.table) {
    const row = rule.table.find(([upTo]) => n <= upTo) || rule.table.at(-1);
    return { seconds: row[1], note: `${ordinal(n)} roll in this bottle: the maker's reuse table.` };
  }
  if (rule.percent) return { seconds: Math.round((seconds * (1 + (rule.percent / 100) * rollsBefore)) / 5) * 5, note: `${ordinal(n)} roll in this bottle: +${rule.percent}% per roll.` };
  return { seconds: seconds + rule.seconds * rollsBefore, note: `${ordinal(n)} roll in this bottle: +${rule.seconds} s per roll.` };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const todayText = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const dayText = (date) => `${date.getDate()} ${MONTHS[date.getMonth()]}`;
const parseDay = (text) => { const [y, m, d] = String(text).split('-').map(Number); return new Date(y, m - 1, d); };

/** { rollsLeft, useBy, daysLeft, state: ok | low | exhausted | expired | retired, text } for a bottle. */
export function bottleStatus(bottle, now = new Date()) {
  const rollsLeft = bottle.capacity == null ? null : bottle.capacity - bottle.rolls;
  const mixed = parseDay(bottle.mixedAt);
  const useBy = bottle.useWithinDays ? new Date(mixed.getTime() + bottle.useWithinDays * DAY_MS) : null;
  const daysLeft = useBy ? Math.floor((useBy - parseDay(todayText(now))) / DAY_MS) : null;
  let state = 'ok';
  if (bottle.retiredAt) state = 'retired';
  else if (rollsLeft !== null && rollsLeft <= 0) state = 'exhausted';
  else if (daysLeft !== null && daysLeft < 0) state = 'expired';
  else if ((rollsLeft !== null && rollsLeft <= 2) || (daysLeft !== null && daysLeft <= 7)) state = 'low';
  const parts = [bottle.capacity == null ? `${bottle.rolls} roll${bottle.rolls === 1 ? '' : 's'} used, capacity not set` : `${bottle.rolls} of ${bottle.capacity} rolls`, `mixed ${dayText(mixed)}`];
  if (useBy) parts.push(`use by ${dayText(useBy)}`);
  if (state === 'exhausted') parts.push('throw out: at capacity');
  if (state === 'expired') parts.push('throw out: past its date');
  if (state === 'low') parts.push('nearly done');
  if (bottle.indicator) parts.push('or when it turns purple');
  return { rollsLeft, useBy, daysLeft, state, text: parts.join(' · ') };
}

/** Short option text: 'Ilford Rapid Fixer 1+4 · bottle · 7 of 24 rolls'. */
export const bottleLabel = (bottle) => `${bottle.name} · bottle · ${bottle.capacity == null ? `${bottle.rolls} used` : `${bottle.rolls} of ${bottle.capacity} rolls`}`;
