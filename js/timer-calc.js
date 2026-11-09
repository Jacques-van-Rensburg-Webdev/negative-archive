// Darkroom timer: B&W developer time rules (docs/darkroom-timer-spec.md). Pure functions.

import { DEVELOPERS } from './timer-data.js';
import { FILM_ROWS } from './timer-data-films.js';

const TABLE = new Map();
FILM_ROWS.forEach(([film, developer, pull1, box, push1, push2, source]) => {
  if (!TABLE.has(film)) TABLE.set(film, new Map());
  TABLE.get(film).set(developer, { pull1, box, push1, push2, source });
});

export const OTHER_FILM = 'Other film';
export const BW_FILMS = [...TABLE.keys(), OTHER_FILM];
const ESTIMATE = { pull1: 0.75, box: 1, push1: 1.35, push2: 1.8 };
const FIXED = { rod100: 60, caffenol: 15 };
const EI_WORDS = { pull1: 'Pull 1', box: 'box speed', push1: 'Push 1', push2: 'Push 2' };
const label = (developer) => DEVELOPERS.find(([key]) => key === developer)?.[1] || developer;

export const isTGrain = (film) => /T-Max|Delta/.test(film);
export const roundTo5 = (seconds) => Math.round(seconds / 5) * 5;

/** 390 → '6:30'. */
export function formatTime(seconds) {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** '6:30' or decimal minutes '6.5' → 390; anything else → null. */
export function parseTime(text) {
  const value = String(text).trim();
  const clock = /^(\d+):([0-5]?\d)$/.exec(value);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  return /^\d*\.?\d+$/.test(value) ? Math.round(Number(value) * 60) : null;
}

const entry = (film, developer) => TABLE.get(film)?.get(developer);
const baseEntry = (film, developer) => entry(film, developer === 'hc110h' ? 'hc110b' : developer);

export function hasData(film, developer) {
  if (developer === 'custom') return false;
  if (developer === 'df96' || FIXED[developer]) return true;
  return baseEntry(film, developer)?.box != null;
}

/** The first developer with data for this film, or the current one if there is none. */
export const firstDeveloperWithData = (film, current) => (DEVELOPERS.find(([key]) => hasData(film, key))?.[0]) || current;

/** Developer select options: 'Kodak D-76 stock · 7:30'. */
export function developerOptions(film) {
  return DEVELOPERS.map(([value, name]) => {
    let note = 'no published time';
    if (value === 'custom') note = 'enter time';
    else if (value === 'df96') note = 'by temperature';
    else if (FIXED[value]) note = `≈ ${formatTime(FIXED[value] * 60)}`;
    else if (hasData(film, value)) {
      const minutes = baseEntry(film, value).box * (value === 'hc110h' ? 2 : 1);
      note = `${value === 'hc110h' ? '≈ ' : ''}${formatTime(minutes * 60)}`;
    }
    return { value, text: `${name} · ${note}` };
  });
}

/** Which push / pull choices this film and developer can use. */
export function pushChoices(film, developer) {
  if (developer === 'df96') return { pull1: false, box: true, push1: false, push2: false };
  const usable = hasData(film, developer) && !FIXED[developer];
  return { pull1: usable, box: true, push1: usable, push2: usable };
}

function df96(s) {
  let [seconds, preset] = [360, 'df96m'];
  if (s.temperature >= 26.5) [seconds, preset] = [180, 'rotary'];
  else if (s.temperature >= 22.5) [seconds, preset] = [240, 'df96i'];
  if (isTGrain(s.film)) seconds *= 2;
  return {
    seconds,
    preset,
    info: [`${formatTime(seconds)} at ${s.temperature} °C${isTGrain(s.film) ? ', doubled for T-Max and Delta films' : ''}. Push or pull by temperature, about 3 °C per half stop. Reused chemistry: add 15 s per roll already processed.`],
    warnings: [],
    source: 'CineStill Df96 instructions',
  };
}

/** The developer step for B&W settings: { seconds, preset, info, warnings, source, userTime? }. */
export function computeDeveloper(s) {
  if (s.developer === 'df96') return df96(s);
  if (!hasData(s.film, s.developer)) {
    const text = s.developer === 'custom' ? 'Enter your own time in the Developer row.' : 'No published time. Enter your own time in the Developer row.';
    return { seconds: s.customSeconds || 0, preset: s.agitation, info: [text], warnings: [], source: '', userTime: true };
  }

  const info = [];
  const warnings = [];
  let source = '';
  let minutes;
  if (FIXED[s.developer]) {
    minutes = FIXED[s.developer];
    if (s.developer === 'rod100') {
      info.push('≈ 60 min semi-stand. A community method, not a manufacturer time.');
      source = 'Community method';
    } else {
      info.push('≈ 15 min for about ISO 100 film. Per litre: 54 g anhydrous washing soda, 16 g vitamin C, 40 g instant coffee, about 1 g KBr optional.');
      source = 'Caffenol-C-M recipe';
    }
  } else {
    const row = baseEntry(s.film, s.developer);
    const factor = s.developer === 'hc110h' ? 2 : 1;
    source = row.source;
    if (row[s.push] != null) {
      minutes = row[s.push] * factor;
      info.push(`${factor === 2 ? '≈ ' : 'Datasheet time '}${formatTime(minutes * 60)} for this EI${factor === 2 ? '' : ` (${EI_WORDS[s.push]})`}.`);
    } else {
      minutes = row.box * factor * ESTIMATE[s.push];
      warnings.push(`Estimate: the datasheet gives no time for ${EI_WORDS[s.push]}, so this is the box-speed time × ${ESTIMATE[s.push]}. Test a roll first.`);
    }
    if (factor === 2) info.push("Kodak doesn't publish dilution H. Doubling dilution B is the common rule.");
  }

  let seconds = minutes * 60;
  if (s.temperature !== 20) {
    seconds *= Math.exp(-0.09 * (s.temperature - 20));
    info.push(`Adjusted for ${s.temperature} °C. This is an approximation.`);
  }
  const fixedAgitation = { rod100: 'stand', caffenol: 'caffenol' }[s.developer];
  if (s.agitation === 'rotary' && !fixedAgitation) {
    seconds *= 0.85;
    info.push('Reduced 15% for continuous agitation (Ilford: up to 15%).');
  }
  seconds = roundTo5(seconds);
  if (seconds < 300) warnings.push('Kodak notes times under 5 min can develop unevenly in small tanks.');
  return { seconds, preset: fixedAgitation || s.agitation, info, warnings, source, name: label(s.developer) };
}
