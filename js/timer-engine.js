// Darkroom timer engine: phases, agitation windows and cues. No DOM or clock: tick(dt) advances it.
// Phases: idle → run (optionally paused) → drain → (next step) run → … → done.

import { formatTime } from './timer-calc.js';
import { PRESETS } from './timer-data.js';

/** { continuous, label, windows: [{ start, end }] } in seconds from the start of a step. */
export function agitationPlan(presetKey, seconds) {
  const preset = PRESETS[presetKey];
  if (!preset) return { continuous: false, label: '', windows: [] };
  if (preset.continuous) return { continuous: true, label: preset.label, windows: [] };
  const raw = [{ start: 0, end: Math.min(preset.first, seconds) }];
  if (preset.every) {
    for (let t = preset.every; t < seconds - 3; t += preset.every) raw.push({ start: t, end: Math.min(t + preset.dur, seconds) });
  }
  if (preset.mid && seconds / 2 < seconds - 3) raw.push({ start: seconds / 2, end: Math.min(seconds / 2 + 10, seconds) });
  raw.sort((a, b) => a.start - b.start);
  const windows = [];
  raw.forEach((w) => {
    const last = windows.at(-1);
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else windows.push({ ...w });
  });
  return { continuous: false, label: preset.label, windows };
}

export function createEngine(onEvent = () => {}) {
  const s = { steps: [], index: 0, phase: 'idle', paused: false, remaining: 0, auto: false, started: false };
  let plan = agitationPlan(null, 0);
  let nextWindow = 0;

  const step = () => s.steps[s.index];
  const elapsed = () => (step() ? step().seconds - s.remaining : 0);
  const findIncluded = (from, direction) => {
    for (let i = from; i >= 0 && i < s.steps.length; i += direction) if (!s.steps[i].skipped) return i;
    return -1;
  };

  const refreshPlan = () => {
    plan = step() ? agitationPlan(step().preset, step().seconds) : agitationPlan(null, 0);
    nextWindow = plan.windows.findIndex((w) => w.start > elapsed() + 1e-6);
    if (nextWindow < 0) nextWindow = plan.windows.length;
  };

  const goIdle = (index) => {
    s.index = index;
    s.phase = 'idle';
    s.paused = false;
    s.remaining = step().seconds;
    plan = agitationPlan(step().preset, step().seconds);
    nextWindow = 0;
  };

  const fireWindows = () => {
    let fired = false;
    while (plan.windows[nextWindow] && plan.windows[nextWindow].start <= elapsed() + 1e-6) { nextWindow += 1; fired = true; }
    if (fired) onEvent('agitate');
  };

  const beginRun = () => {
    if (!step().seconds) return;
    s.phase = 'run';
    s.paused = false;
    s.started = true;
    fireWindows();
  };

  const finishStep = () => {
    onEvent('end');
    const next = findIncluded(s.index + 1, 1);
    if (next < 0) { s.phase = 'done'; s.remaining = 0; return; }
    if (s.auto) { goIdle(next); beginRun(); } else s.phase = 'drain';
  };

  return {
    state: s,
    step,
    elapsed,
    plan: () => plan,

    load(steps) {
      s.steps = steps.map((row) => ({ ...row }));
      s.started = false;
      goIdle(Math.max(0, findIncluded(0, 1)));
    },

    /** Start, Pause, Resume or Start next, whichever applies. */
    primary() {
      if (s.phase === 'idle') beginRun();
      else if (s.phase === 'run') s.paused = !s.paused;
      else if (s.phase === 'drain') { goIdle(findIncluded(s.index + 1, 1)); beginRun(); }
    },

    next() {
      const next = findIncluded(s.index + 1, 1);
      if (next >= 0) goIdle(next);
    },

    back() {
      if (s.phase === 'done') { goIdle(findIncluded(s.steps.length - 1, -1)); return; }
      if (s.phase !== 'idle' && elapsed() > 2) { goIdle(s.index); return; }
      const previous = findIncluded(s.index - 1, -1);
      goIdle(previous >= 0 ? previous : s.index);
    },

    /** Advances by dt seconds of real time. */
    tick(dt) {
      if (s.phase !== 'run' || s.paused) return;
      const before = s.remaining;
      s.remaining = Math.max(0, before - dt);
      fireWindows();
      if (s.remaining > 0 && Math.ceil(before) !== Math.ceil(s.remaining) && Math.ceil(s.remaining) <= 5) onEvent('tick');
      if (s.remaining <= 0) finishStep();
    },

    /** Changes a step's time: an idle step takes it at once, a running one is capped at it. */
    edit(index, seconds) {
      const target = s.steps[index];
      target.seconds = seconds;
      if (index !== s.index) return;
      if (s.phase === 'idle') { s.remaining = seconds; refreshPlan(); nextWindow = 0; } else if (s.phase === 'run') { s.remaining = Math.min(s.remaining, seconds); refreshPlan(); }
    },

    toggleSkip(index) {
      const target = s.steps[index];
      if (!target.optional || (index === s.index && s.phase !== 'idle')) return;
      target.skipped = !target.skipped;
      if (!s.started) goIdle(Math.max(0, findIncluded(0, 1)));
      else if (index === s.index && target.skipped) {
        const next = findIncluded(s.index + 1, 1);
        goIdle(next >= 0 ? next : findIncluded(s.index - 1, -1));
      }
    },

    hasNext: () => findIncluded(s.index + 1, 1) >= 0,

    /** Position and time left: { position, count, left }. */
    progress() {
      const included = s.steps.map((row, i) => [row, i]).filter(([row]) => !row.skipped);
      const later = included.filter(([, i]) => i > s.index).reduce((sum, [row]) => sum + row.seconds, 0);
      return { position: included.findIndex(([, i]) => i === s.index) + 1, count: included.length, left: s.remaining + later };
    },

    /** The dial's cue line: { text, kind: idle | agitate | wait | stand | drain | done }. */
    cue() {
      if (s.phase === 'done') return { text: 'Hang to dry', kind: 'done' };
      if (s.phase === 'drain') return { text: 'Drain · pour next', kind: 'drain' };
      if (s.phase === 'idle') return { text: 'Pour, then start', kind: 'idle' };
      if (!step().preset) return { text: /wash|rinse/i.test(step().name) ? 'Wash' : 'Stand', kind: 'stand' };
      if (plan.continuous) return { text: plan.label, kind: 'agitate' };
      const at = elapsed();
      if (plan.windows.some((w) => at >= w.start && at < w.end)) return { text: plan.label, kind: 'agitate' };
      const next = plan.windows.find((w) => w.start > at);
      return next ? { text: `Next agitation ${formatTime(Math.ceil(next.start - at))}`, kind: 'wait' } : { text: 'Stand', kind: 'stand' };
    },
  };
}
