// Darkroom timer: turns settings into a list of steps, with info lines and warnings.

import { KINDS, adjustForReuse, bottleStatus, findProduct } from './chemicals.js';
import { computeDeveloper, firstDeveloperWithData, hasData, isTGrain, pushChoices, roundTo5, formatTime } from './timer-calc.js';
import { BATHS, DEVELOPERS } from './timer-data.js';
import { COLOUR_FILMS, KITS } from './timer-data-kits.js';

export const AGITATIONS = [['ilford', 'Ilford spiral tank'], ['kodak', 'Kodak small tank'], ['foma', 'Foma'], ['rotary', 'Rotary / continuous']];
export const PUSH_LABELS = [['pull1', 'Pull 1'], ['box', 'Box speed'], ['push1', 'Push 1'], ['push2', 'Push 2']];

const E6_PUSH = { pull1: { add: -120 }, push1: { add: 120 }, push2: { add: 330 }, min: 60 };
const CS_PUSH = { push1: { times: 1.3 }, push2: { times: 1.75 } };

// Per kit, matched by the start of its name
export const KIT_DETAILS = [
  ['Kodak Flexicolor', { source: 'Kodak Z-131', push: { push1: { set: 225 }, push2: { set: 255 } }, note: 'Kodak Z-131 lists these push times for Portra 800.' }],
  ['CineStill Cs41', { source: 'CineStill Cs41', push: CS_PUSH, note: 'Reused chemistry: add 2% per roll already processed (quart kit).' }],
  ['Tetenal Colortec C-41', { source: 'Tetenal Colortec C-41', push: {}, note: 'No push or pull. Reused developer: 3:15 (films 1–4), 3:30 (5–8), 3:45 (9–12), 4:00 (13–16).' }],
  ['Flic Film C-41', { source: 'Flic Film C-41', push: {}, note: 'No push or pull.' }],
  ['Kodak E-6', { source: 'Kodak Z-119', push: E6_PUSH, note: "Same push offsets as Tetenal; Kodak's own push table was not checked." }],
  ['Tetenal Colortec E-6', { source: 'Tetenal Colortec E-6', push: E6_PUSH, note: 'Reused first developer: 6:15 → 6:30 → 6:45.' }],
  ['Kodak ECN-2', { source: 'Kodak ECN-2 kit chemicals', push: {}, note: 'No push or pull.' }],
  ['CineStill Cs2', { source: 'CineStill Cs2', push: CS_PUSH, note: 'Rem-jet film needs separate removal; CineStill films have none.' }],
  ['Flic Film ECN-2', { source: 'Flic Film ECN-2', push: {}, note: 'No push or pull.' }],
];

const kitDetails = (kit) => KIT_DETAILS.find(([start]) => kit.name.startsWith(start))[1];
const bath = (group, name) => BATHS[group].find((b) => b.label === name) || BATHS[group][0];
const isFormulary = (name) => /^Formulary TF-[45]/.test(name);
const parts = (...items) => items.filter(Boolean).join(' · ');
const step = (name, seconds, sub, preset, extra = {}) => ({ name, seconds, sub, preset, ...extra });

export const defaultSettings = () => ({
  process: 'bw',
  film: 'Ilford HP5 Plus 400',
  developer: 'id11',
  temperature: 20,
  push: 'box',
  agitation: 'ilford',
  stop: 'Ilford Ilfostop 1+19',
  fixer: 'Ilford Rapid Fixer 1+4',
  hypo: 'None',
  wetting: 'Kodak Photo-Flo 200 (1+200)',
  customSeconds: 0,
  colourFilm: {},
  kit: {},
  bottles: {}, // chosen bottle per kind ('developer', 'stop', …) or per colour process ('c41', …)
});

export const kitsFor = (process) => KITS[process];
export const currentKit = (s) => KITS[s.process].find((k) => k.name === s.kit[s.process]) || KITS[s.process][0];
export const currentColourFilm = (s) => (COLOUR_FILMS[s.process].includes(s.colourFilm[s.process]) ? s.colourFilm[s.process] : COLOUR_FILMS[s.process][0]);

/** The settings key a bottle of this kind is kept under: the kind, or the process for a colour kit. */
export const bottleKey = (s, kind) => (kind === 'kit' ? s.process : kind);
/** The product the settings currently name for this kind. */
export const productFor = (s, kind) => (kind === 'kit' ? currentKit(s).name : s[kind]);

/** The chosen bottle for this kind, if it's known and still matches the chosen product. bottles: Map id → bottle. */
export function bottleFor(s, bottles, kind) {
  const bottle = bottles?.get(s.bottles?.[bottleKey(s, kind)]);
  return bottle && !bottle.retiredAt && bottle.product === productFor(s, kind) ? bottle : null;
}

/** Warnings for chosen bottles that should go, for the kinds these steps use. */
function bottleWarnings(s, bottles, steps) {
  return KINDS.filter(([kind]) => steps.some((row) => row.kind === kind)).flatMap(([kind, label]) => {
    const bottle = bottleFor(s, bottles, kind);
    const status = bottle && bottleStatus(bottle);
    return status && ['exhausted', 'expired'].includes(status.state) ? [`${label}: ${status.text}.`] : [];
  });
}

// Reused chemistry: the maker's rule for this roll number, applied to the developer step
function applyReuse(developer, label, s, bottles, kind, info) {
  const bottle = bottleFor(s, bottles, kind);
  const product = bottle && findProduct(kind, bottle.product);
  const adjusted = product && adjustForReuse(developer.seconds, product, bottle.rolls);
  if (!adjusted) return;
  developer.seconds = adjusted.seconds;
  info.push(`${adjusted.note} ${label}: ${formatTime(adjusted.seconds)}.`);
}

/** Which push / pull choices the current settings can use. */
export function availablePush(s) {
  if (s.process === 'bw') return pushChoices(s.film, s.developer);
  const { push } = kitDetails(currentKit(s));
  return { pull1: Boolean(push.pull1), box: true, push1: Boolean(push.push1), push2: Boolean(push.push2) };
}

/** Keeps settings consistent after a change; changedFilm applies the "switch developer" rule. */
export function normalise(s, changedFilm) {
  if (s.process === 'bw' && changedFilm && !hasData(s.film, s.developer)) s.developer = firstDeveloperWithData(s.film, s.developer);
  if (!availablePush(s)[s.push]) s.push = 'box';
  return s;
}

function washNote(s, isDf96) {
  if (isDf96) return '5 min running, or fill-and-invert 5 / 10 / 20 (CineStill)';
  if (s.hypo !== 'None') return '5 min running water (Kodak)';
  if (isFormulary(s.fixer)) return '5 min running water (Formulary)';
  return 'Ilford: 5–10 min running, or fill-and-invert 5 / 10 / 20. Kodak without hypo clear: 20–30 min';
}

function bwPlan(s, bottles) {
  const isDf96 = s.developer === 'df96';
  const developer = computeDeveloper(s);
  const devLabel = DEVELOPERS.find(([key]) => key === s.developer)?.[1];
  const timeFor = (b) => (isTGrain(s.film) ? b.tgrain : b.normal);
  const info = [...developer.info];
  const product = findProduct('developer', s.developer);
  if (product?.oneShot) info.push(`${devLabel} is one-shot: discard after use.`);
  applyReuse(developer, devLabel, s, bottles, 'developer', info);
  const steps = [step('Pre-wash', 60, 'Water at developer temperature', 'rotary', { optional: true, skipped: true })];
  steps.push(step(isDf96 ? 'Monobath' : 'Developer', developer.seconds, parts(devLabel, `${s.temperature} °C`), developer.preset, { isDeveloper: true, userTime: developer.userTime, kind: 'developer' }));
  const warnings = [...developer.warnings];
  if (!isDf96) {
    const stop = bath('Stop', s.stop);
    const fixer = bath('Fixer', s.fixer);
    steps.push(step('Stop bath', timeFor(stop), parts(stop.label, stop.note), 'rotary', { kind: 'stop' }));
    steps.push(step('Fixer', timeFor(fixer), parts(fixer.label, fixer.note), 'fix', { kind: 'fixer' }));
    if (isFormulary(s.fixer) && s.stop !== 'Running water rinse') warnings.push('Formulary recommends a 1 min water rinse instead of an acid stop.');
    if (s.hypo !== 'None') {
      const hypo = bath('Hypo clear', s.hypo);
      steps.push(step('Hypo clear', timeFor(hypo), parts(hypo.label, hypo.note), 'fix', { kind: 'hypo' }));
    }
  }
  steps.push(step('Wash', 300, washNote(s, isDf96), null));
  if (s.wetting !== 'None') {
    const wetting = bath('Wetting', s.wetting);
    steps.push(step('Wetting agent', timeFor(wetting), parts(wetting.label, wetting.note), 'once', { kind: 'wetting' }));
  }
  warnings.push(...bottleWarnings(s, bottles, steps));
  return { steps, info, warnings, source: developer.source };
}

function pushedSeconds(seconds, rule, min = 0) {
  if (rule.set !== undefined) return rule.set;
  if (rule.add !== undefined) return Math.max(min, seconds + rule.add);
  return roundTo5(seconds * rule.times);
}

function colourPlan(s, bottles) {
  const kit = currentKit(s);
  const details = kitDetails(kit);
  const steps = kit.steps.map((row) => step(row.name, row.seconds, row.note, row.preset, { optional: row.optional, skipped: row.skipped }));
  const developer = steps.find((row) => /developer/i.test(row.name));
  developer.isDeveloper = true;
  developer.kind = 'kit'; // the kit is counted once, when its developer step finishes
  const info = [`${developer.name}: ${developer.sub}.`];
  const rule = details.push[s.push];
  if (s.push !== 'box' && rule) {
    developer.seconds = pushedSeconds(developer.seconds, rule, details.push.min);
    info.push(`${PUSH_LABELS.find(([key]) => key === s.push)[1]}: ${developer.name.toLowerCase()} ${formatTime(developer.seconds)}.`);
  }
  applyReuse(developer, developer.name, s, bottles, 'kit', info);
  info.push(details.note);
  const film = currentColourFilm(s);
  if (/^CineStill/.test(film) && s.process === 'c41') info.push('CineStill films run in standard C-41.');
  if (/XP2/.test(film)) info.push('XP2 Super is chromogenic B&W and runs in C-41.');
  return { steps, info, warnings: bottleWarnings(s, bottles, steps), source: details.source };
}

/** Steps and notes for the current settings. bottles: Map id → bottle, for reuse times and warnings. */
export const buildPlan = (s, bottles = new Map()) => (s.process === 'bw' ? bwPlan(s, bottles) : colourPlan(s, bottles));
