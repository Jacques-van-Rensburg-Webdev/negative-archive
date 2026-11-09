// Darkroom timer: the SVG dial (400 × 400 viewBox). update() is cheap; it runs on every frame.

import { formatTime } from './timer-calc.js';

const NS = 'http://www.w3.org/2000/svg';
const CENTRE = 200;
const RING = 176;
const WINDOW_RING = 190;
const TICK_OUTER = 164;
const TICK_MAJOR = 150;
const TICK_MINOR = 157;
const LABEL_RING = 136;

function svg(tag, attributes = {}, className) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  if (className) node.setAttribute('class', className);
  return node;
}

const point = (radius, fraction) => {
  const angle = 2 * Math.PI * fraction - Math.PI / 2;
  return [CENTRE + radius * Math.cos(angle), CENTRE + radius * Math.sin(angle)];
};

function arc(radius, from, to) {
  const [x1, y1] = point(radius, from);
  const [x2, y2] = point(radius, Math.min(to, from + 0.9999));
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${to - from > 0.5 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Tick positions for a step: [{ at, major, label }] in seconds. */
export function tickMarks(seconds) {
  const marks = [];
  const add = (every, isMajor, labelled) => {
    for (let at = 0; at < seconds; at += every) marks.push({ at, major: isMajor(at), label: labelled(at) });
  };
  if (seconds <= 120) add(15, () => true, (at) => (at ? formatTime(at) : '0'));
  else if (seconds <= 900) add(15, (at) => at % 60 === 0, (at) => (at % 60 === 0 ? String(at / 60) : ''));
  else add(300, () => true, (at) => String(at / 60));
  return marks;
}

export function createDial() {
  const root = svg('svg', { viewBox: '0 0 400 400', role: 'img', 'aria-label': 'Timer dial' }, 'timer-dial');
  const ticks = svg('g');
  const windows = svg('g');
  const progress = svg('circle', { cx: CENTRE, cy: CENTRE, r: RING, pathLength: 1, transform: `rotate(-90 ${CENTRE} ${CENTRE})` }, 'timer-progress');
  const hand = svg('circle', { r: 9 }, 'timer-hand');
  const name = svg('text', { x: CENTRE, y: 150 }, 'timer-step-name');
  const countdown = svg('text', { x: CENTRE, y: 222 }, 'timer-countdown');
  const cue = svg('text', { x: CENTRE, y: 268 }, 'timer-cue');
  root.append(svg('circle', { cx: CENTRE, cy: CENTRE, r: RING }, 'timer-track'), ticks, windows, progress, hand, name, countdown, cue);
  let drawnFor = '';

  function drawStep(step, plan) {
    const seconds = step.seconds || 1;
    ticks.replaceChildren(...tickMarks(step.seconds).flatMap(({ at, major, label }) => {
      const fraction = at / seconds;
      const [x1, y1] = point(TICK_OUTER, fraction);
      const [x2, y2] = point(major ? TICK_MAJOR : TICK_MINOR, fraction);
      const line = svg('line', { x1, y1, x2, y2 }, major ? 'timer-tick is-major' : 'timer-tick');
      if (!label) return [line];
      const [lx, ly] = point(LABEL_RING, fraction);
      const text = svg('text', { x: lx, y: ly }, 'timer-tick-label');
      text.textContent = label;
      return [line, text];
    }));
    windows.replaceChildren(...(plan.continuous
      ? [svg('circle', { cx: CENTRE, cy: CENTRE, r: WINDOW_RING }, 'timer-window')]
      : plan.windows.map((w) => svg('path', { d: arc(WINDOW_RING, w.start / seconds, w.end / seconds) }, 'timer-window'))));
  }

  /** view: { step, plan, elapsed, remaining, cue }. */
  function update({ step, plan, elapsed, remaining, cue: line }) {
    const key = `${step.name}|${step.seconds}|${step.preset}`;
    if (key !== drawnFor) { drawnFor = key; drawStep(step, plan); name.textContent = step.name; }
    const fraction = step.seconds ? Math.min(1, elapsed / step.seconds) : 0;
    progress.setAttribute('stroke-dasharray', `${fraction} 1`);
    const [x, y] = point(RING, fraction);
    hand.setAttribute('cx', x);
    hand.setAttribute('cy', y);
    const time = formatTime(Math.ceil(remaining));
    if (countdown.textContent !== time) countdown.textContent = time;
    if (cue.textContent !== line.text) cue.textContent = line.text;
    cue.setAttribute('class', `timer-cue is-${line.kind}`);
  }

  return { root, update };
}
