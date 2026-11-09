// #/timer: the Darkroom Dev Timer. Dial and controls, setup, process sheet and sources.

import { formatTime } from './timer-calc.js';
import { SOURCES } from './timer-data.js';
import { createDial } from './timer-dial.js';
import { session } from './timer-session.js';
import { renderSetup } from './timer-setup.js';
import { createSheet } from './timer-sheet.js';

const PREFS = [['sound', 'Sound'], ['auto', 'Auto-advance'], ['safelight', 'Safelight']];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text, onClick) {
  const node = el('button', `span-2 button ${className}`, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

const applySafelight = () => document.querySelector('.app').classList.toggle('is-safelight', session.prefs.safelight);

function prefChips() {
  const row = el('div', 'span-4 chip-row');
  PREFS.forEach(([name, label]) => {
    const chip = el('button', 'chip', label);
    chip.type = 'button';
    chip.dataset.pref = name;
    chip.setAttribute('aria-pressed', String(session.prefs[name]));
    row.append(chip);
  });
  row.addEventListener('change', (event) => {
    session.setPref(event.target.dataset.pref, event.target.getAttribute('aria-pressed') === 'true');
    applySafelight();
  });
  return row;
}

function sourcesBlock() {
  const details = el('details', 'span-4 timer-panel mb-6');
  details.append(el('summary', 'timer-summary text-bold', 'Sources'));
  const list = el('div', 'stack-2');
  SOURCES.forEach(([group, links]) => {
    const block = el('div', 'stack-1');
    block.append(el('h3', 'section-label', group));
    const items = el('ul', 'timer-sources');
    links.forEach(([label, href]) => {
      const item = el('li');
      const link = el('a', 'text-sm', label);
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener';
      item.append(link);
      items.append(item);
    });
    block.append(items);
    list.append(block);
  });
  details.append(list);
  return details;
}

const PRIMARY_LABEL = (state) => {
  if (state.phase === 'drain') return 'Start next';
  if (state.phase === 'run') return state.paused ? 'Resume' : 'Pause';
  return 'Start';
};

function render() {
  applySafelight();
  const { engine } = session;
  const root = el('div', 'grid grid-sections');

  const dial = createDial();
  const position = el('p', 'text-sm text-mono timer-position');
  const backButton = button('button-secondary', 'Back', () => session.back());
  const primary = button('button-primary', 'Start', () => session.primary());
  const nextButton = button('button-secondary', 'Next', () => session.next());
  const resetButton = button('button-secondary', 'Reset', () => session.reset());
  const controls = el('div', 'grid grid-inner');
  controls.append(backButton, primary, nextButton, resetButton);
  const face = el('section', 'span-4 desktop-half timer-panel stack-2');
  face.append(dial.root, position, controls);

  const setup = el('section', 'span-4 timer-setup timer-panel stack-2');
  const sheet = createSheet(session);

  const drawSetup = () => setup.replaceChildren(...renderSetup(session));

  const drawFrame = () => {
    dial.update({ step: engine.step(), plan: engine.plan(), elapsed: engine.elapsed(), remaining: engine.state.remaining, cue: engine.cue() });
    const { position: at, count, left } = engine.progress();
    const text = engine.state.phase === 'done' ? 'Finished' : `Step ${at} of ${count} · ${formatTime(Math.ceil(left))} left in process`;
    if (position.textContent !== text) position.textContent = text;
  };

  const drawState = () => {
    const { state } = engine;
    primary.textContent = PRIMARY_LABEL(state);
    primary.disabled = state.phase === 'done' || !engine.step().seconds;
    nextButton.disabled = !engine.hasNext();
    sheet.refresh();
    const fields = setup.querySelector('fieldset');
    if (fields) fields.disabled = session.busy();
  };

  const stop = session.subscribe((kind) => {
    if (!root.isConnected) { stop(); return; }
    if (kind === 'plan') { drawSetup(); sheet.rebuild(); }
    if (kind === 'state') drawState();
    if (kind === 'frame') drawFrame();
  });

  drawSetup();
  sheet.rebuild();
  drawState();
  drawFrame();
  root.append(prefChips(), face, setup, sheet.root, sourcesBlock());
  return root;
}

export const timerScreen = { title: 'Darkroom Dev Timer', pushed: true, wide: true, timer: true, render };
