// Darkroom timer: the one running session. Lives outside the screen, so the timer keeps
// going when you open another part of the app. Screens subscribe to changes.

import { createEngine } from './timer-engine.js';
import { keepAwake, playCue, unlockSound } from './timer-sound.js';
import { buildPlan, defaultSettings, normalise } from './timer-steps.js';

const STORAGE_KEY = 'darkroom-timer';
const HIDDEN_CHECK_MS = 500;

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

const saved = readSaved();
const settings = { ...defaultSettings(), ...saved.settings };
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

const engine = createEngine((kind) => { if (prefs.sound) playCue(kind); notifySoon(); });
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
  plan = buildPlan(settings);
  engine.state.auto = prefs.auto;
  engine.load(plan.steps);
  notify('plan');
  changed();
}

rebuild();

export const session = {
  engine,
  settings,
  prefs,
  plan: () => plan,
  /** True once settings can't change without losing the run. */
  busy: () => ['run', 'drain'].includes(engine.state.phase),

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /** Applies setting changes and rebuilds the steps. */
  change(patch) {
    Object.assign(settings, patch);
    if (patch.process) settings.push = 'box';
    normalise(settings, 'film' in patch || 'process' in patch);
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
