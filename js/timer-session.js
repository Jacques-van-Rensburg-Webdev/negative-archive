// Darkroom timer: the one running session. Lives outside the screen, so the timer keeps
// going when you open another part of the app. Screens subscribe to changes.
// Bottles (chemicals in use) come from the database; a step that finishes counts a roll on its bottle.

import { countRoll, liveBottles } from './chemicals-store.js';
import { getDb, onChange } from './db.js';
import { createEngine } from './timer-engine.js';
import { keepAwake, playCue, unlockSound } from './timer-sound.js';
import { bottleFor, bottleKey, buildPlan, defaultSettings, normalise, productFor } from './timer-steps.js';

const STORAGE_KEY = 'darkroom-timer';
const HIDDEN_CHECK_MS = 500;
const PRODUCT_KEYS = ['developer', 'stop', 'fixer', 'hypo', 'wetting'];

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

const saved = readSaved();
const settings = { ...defaultSettings(), ...saved.settings };
settings.bottles = settings.bottles || {};
const prefs = { sound: true, auto: false, safelight: false, ...saved.prefs };

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, prefs }));
  } catch {
    // Storage unavailable: the timer still works for this visit.
  }
}

const listeners = new Set();
const notify = (kind) => listeners.forEach((fn) => fn(kind));

let bottles = new Map();

// A finished step counts one roll on its bottle, once (a redone step isn't counted again).
function countStep() {
  const step = engine.step();
  if (!step?.kind || step.counted) return;
  step.counted = true;
  const id = settings.bottles[bottleKey(settings, step.kind)];
  if (bottles.has(id)) getDb().then((db) => countRoll(db, id)).catch(() => {});
}

const engine = createEngine((kind) => { if (kind === 'end') countStep(); if (prefs.sound) playCue(kind); notifySoon(); });
let stateChanged = false;
function notifySoon() { stateChanged = true; }

let plan;
let frame = null;
let hiddenCheck = null;
let last = 0;
let phaseSeen = '';

const isRunning = () => engine.state.phase === 'run' && !engine.state.paused;

function advance() {
  const now = performance.now();
  engine.tick((now - last) / 1000);
  last = now;
  const key = `${engine.state.phase}|${engine.state.index}|${engine.state.paused}`;
  if (key !== phaseSeen || stateChanged) { phaseSeen = key; stateChanged = false; notify('state'); }
  notify('frame');
  keepAwake(isRunning());
}

function onFrame() {
  frame = null;
  advance();
  if (isRunning()) frame = requestAnimationFrame(onFrame);
  else stopLoop();
}

function stopLoop() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  clearInterval(hiddenCheck);
  hiddenCheck = null;
}

function startLoop() {
  if (!isRunning() || frame !== null) return;
  last = performance.now();
  frame = requestAnimationFrame(onFrame);
  // Browsers stop animation frames in the background; this keeps alarms on time.
  hiddenCheck = setInterval(() => { if (document.hidden && isRunning()) advance(); }, HIDDEN_CHECK_MS);
}

function changed() {
  phaseSeen = '';
  notify('state');
  notify('frame');
  keepAwake(isRunning());
  if (isRunning()) startLoop();
  else stopLoop();
}

function rebuild() {
  plan = buildPlan(settings, bottles);
  engine.state.auto = prefs.auto;
  engine.load(plan.steps);
  notify('plan');
  changed();
}

// A chosen bottle only counts while it matches the chosen product
function syncBottles() {
  Object.entries(settings.bottles).forEach(([key, id]) => {
    const bottle = bottles.get(id);
    const kind = PRODUCT_KEYS.includes(key) ? key : 'kit';
    if (bottle && (bottle.retiredAt || bottle.product !== productFor({ ...settings, process: kind === 'kit' ? key : settings.process }, kind))) delete settings.bottles[key];
  });
}

async function loadBottles() {
  const db = await getDb();
  bottles = new Map((await liveBottles(db)).map((b) => [b.id, b]));
  syncBottles();
  save();
  // A fresh timer takes the new counts into its times; a run in progress or just finished is left alone.
  if (engine.state.phase === 'idle' && !engine.state.started) rebuild();
  notify('bottles');
}

rebuild();
loadBottles().catch(() => {});
onChange(({ stores }) => { if (stores.includes('chemicals')) loadBottles().catch(() => {}); });

export const session = {
  engine,
  settings,
  prefs,
  plan: () => plan,
  bottles: () => bottles,
  bottleFor: (kind) => bottleFor(settings, bottles, kind),
  /** True once settings can't change without losing the run. */
  busy: () => ['run', 'drain'].includes(engine.state.phase),

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /** Applies setting changes and rebuilds the steps. Choosing a product from the catalogue drops the bottle for it. */
  change(patch) {
    Object.assign(settings, patch);
    if (patch.process) settings.push = 'box';
    PRODUCT_KEYS.filter((key) => key in patch).forEach((key) => delete settings.bottles[key]);
    if ('kit' in patch) delete settings.bottles[settings.process];
    normalise(settings, 'film' in patch || 'process' in patch);
    syncBottles();
    save();
    rebuild();
  },

  /** Uses one of my bottles for this kind: its product is chosen with it. */
  pickBottle(kind, id) {
    const bottle = bottles.get(id);
    if (!bottle) return;
    if (kind === 'kit') settings.kit = { ...settings.kit, [bottle.process]: bottle.product };
    else settings[kind] = bottle.product;
    settings.bottles[bottleKey(settings, kind)] = id;
    normalise(settings, false);
    syncBottles();
    save();
    rebuild();
  },

  setPref(name, on) {
    prefs[name] = on;
    if (name === 'auto') engine.state.auto = on;
    save();
    notify('prefs');
  },

  primary() { unlockSound(); engine.primary(); changed(); },
  next() { engine.next(); changed(); },
  back() { engine.back(); changed(); },
  reset() { rebuild(); },

  editStep(index, seconds) {
    const target = engine.state.steps[index];
    engine.edit(index, seconds);
    if (target.userTime) {
      settings.customSeconds = seconds;
      save();
    }
    changed();
  },

  toggleSkip(index) { engine.toggleSkip(index); changed(); },
};
