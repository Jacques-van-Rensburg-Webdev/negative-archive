// Common film stocks, and search over them plus your own stocks (the filmStocks store).
// process: 'bw' | 'colour' | 'slide'. formats: which of '35mm' / '120' the stock is made in.

import { normalise } from './search.js';

const BOTH = ['35mm', '120'];
const SMALL = ['35mm'];
const stock = (name, iso, process, formats = BOTH, note) => ({ name, iso, process, formats, note });

export const CATALOGUE = [
  // B&W
  stock('Kodak Tri-X 400', 400, 'bw'),
  stock('Kodak T-Max 100', 100, 'bw'),
  stock('Kodak T-Max 400', 400, 'bw'),
  stock('Kodak T-Max P3200', 3200, 'bw', SMALL),
  stock('Kodak Double-X 5222', 250, 'bw', SMALL),
  stock('Ilford HP5 Plus 400', 400, 'bw'),
  stock('Ilford FP4 Plus 125', 125, 'bw'),
  stock('Ilford Delta 100', 100, 'bw'),
  stock('Ilford Delta 400', 400, 'bw'),
  stock('Ilford Delta 3200', 3200, 'bw'),
  stock('Ilford Pan F Plus 50', 50, 'bw'),
  stock('Ilford SFX 200', 200, 'bw'),
  stock('Ilford XP2 Super 400', 400, 'bw', BOTH, 'C-41'),
  stock('Kentmere Pan 100', 100, 'bw'),
  stock('Kentmere Pan 400', 400, 'bw'),
  stock('Fomapan 100', 100, 'bw'),
  stock('Fomapan 200', 200, 'bw'),
  stock('Fomapan 400', 400, 'bw'),
  stock('Rollei RPX 25', 25, 'bw'),
  stock('Rollei RPX 100', 100, 'bw'),
  stock('Rollei RPX 400', 400, 'bw'),
  stock('Rollei Retro 80S', 80, 'bw'),
  stock('Rollei Infrared 400', 400, 'bw'),
  stock('ADOX CHS 100 II', 100, 'bw'),
  stock('Bergger Pancro 400', 400, 'bw'),
  stock('CineStill BwXX 250', 250, 'bw', SMALL),
  stock('Lomography Earl Grey 100', 100, 'bw'),
  stock('Lomography Lady Grey 400', 400, 'bw'),
  stock('Ferrania P30 80', 80, 'bw', SMALL),
  // Colour negative (C-41)
  stock('Kodak Portra 160', 160, 'colour'),
  stock('Kodak Portra 400', 400, 'colour'),
  stock('Kodak Portra 800', 800, 'colour'),
  stock('Kodak Ektar 100', 100, 'colour'),
  stock('Kodak Gold 200', 200, 'colour'),
  stock('Kodak Ultramax 400', 400, 'colour', SMALL),
  stock('Kodak ColorPlus 200', 200, 'colour', SMALL),
  stock('Kodak Pro Image 100', 100, 'colour', SMALL),
  stock('Fujifilm 200', 200, 'colour', SMALL),
  stock('Fujifilm 400', 400, 'colour', SMALL),
  stock('CineStill 50D', 50, 'colour'),
  stock('CineStill 400D', 400, 'colour'),
  stock('CineStill 800T', 800, 'colour'),
  stock('Lomography Color Negative 100', 100, 'colour'),
  stock('Lomography Color Negative 400', 400, 'colour'),
  stock('Lomography Color Negative 800', 800, 'colour'),
  stock('Harman Phoenix 200', 200, 'colour'),
  // Slide (E-6)
  stock('Fujifilm Velvia 50', 50, 'slide'),
  stock('Fujifilm Velvia 100', 100, 'slide'),
  stock('Fujifilm Provia 100F', 100, 'slide'),
  stock('Kodak Ektachrome E100', 100, 'slide'),
];

export const PROCESS_LABELS = { bw: 'B&W', colour: 'Colour', slide: 'Slide' };

const COLOUR_WORDS = /\b(gold|portra|ektar|ultramax|colorplus|superia|fujicolor|pro image|cinestill \d+[dt]|color negative|phoenix|vision3)\b/i;
const SLIDE_WORDS = /\b(velvia|provia|ektachrome|e-?6|slide)\b/i;

/** Process for a stock that doesn't say (e.g. imported from the spreadsheet). */
export function guessProcess(name) {
  if (SLIDE_WORDS.test(name || '')) return 'slide';
  return COLOUR_WORDS.test(name || '') ? 'colour' : 'bw';
}

/**
 * Your stocks plus the catalogue, merged by name (a catalogue stock you've used counts as yours).
 * Yours first, then the catalogue in its order. Each: { name, iso, process, formats, note, yours, custom }.
 */
export function allStocks(yourStocks) {
  const known = new Map(CATALOGUE.map((s) => [normalise(s.name), s]));
  const yours = yourStocks.map((s) => {
    const listed = known.get(normalise(s.name));
    return {
      ...listed,
      ...s,
      iso: s.iso || listed?.iso,
      process: s.process || listed?.process || guessProcess(s.name),
      formats: s.formats || listed?.formats || BOTH,
      yours: true,
    };
  });
  const taken = new Set(yours.map((s) => normalise(s.name)));
  return [...yours, ...CATALOGUE.filter((s) => !taken.has(normalise(s.name))).map((s) => ({ ...s, yours: false }))];
}

/** Search: every word must appear (case and accents ignored; "tri x" finds Tri-X). */
export function searchStocks(stocks, { query = '', format, process } = {}) {
  const words = normalise(query).replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  return stocks.filter((s) => {
    const text = normalise(`${s.name} ${s.iso || ''} ${s.note || ''} ${PROCESS_LABELS[s.process]}`).replace(/-/g, ' ');
    return words.every((w) => text.includes(w))
      && (!format || s.formats.includes(format))
      && (!process || process === 'all' || s.process === process);
  });
}

/** 'ISO 400 · B&W · 35mm, 120' */
export const stockDetails = (s) => [s.iso && `ISO ${s.iso}`, PROCESS_LABELS[s.process], s.note, s.formats.join(', ')].filter(Boolean).join(' · ');
