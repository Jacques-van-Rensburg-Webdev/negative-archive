// Darkroom timer: the process sheet. One row per step, with an editable time.

import { formatTime, parseTime } from './timer-calc.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Builds the sheet. Returns { root, rebuild, refresh }. */
export function createSheet(session) {
  const root = el('section', 'span-4 stack-1');
  const head = el('div', 'results-head');
  const title = el('h2', 'section-label', 'Process');
  const total = el('span', 'text-sm text-mono');
  head.append(title, total);
  const list = el('ol', 'timer-sheet');
  root.append(head, list);
  let rows = [];

  function rebuild() {
    const { steps } = session.engine.state;
    rows = steps.map((step, index) => {
      const row = el('li', 'timer-row');
      const number = el('span', 'timer-row-number text-mono text-sm', String(index + 1));
      const text = el('div', 'timer-row-text stack-0-5');
      text.append(el('span', 'timer-row-name text-bold', step.name));
      if (step.sub) text.append(el('span', 'text-xs text-muted', step.sub));
      let skip;
      if (step.optional) {
        skip = el('button', 'timer-skip text-sm');
        skip.type = 'button';
        skip.addEventListener('click', () => session.toggleSkip(index));
        text.append(skip);
      }
      const input = el('input', 'input input-mono timer-time');
      input.inputMode = 'decimal';
      input.setAttribute('aria-label', `${step.name} time`);
      input.addEventListener('change', () => {
        const seconds = parseTime(input.value);
        if (seconds === null) input.value = formatTime(session.engine.state.steps[index].seconds);
        else session.editStep(index, seconds);
      });
      row.append(number, text, input);
      list.append(row);
      return { row, input, skip };
    });
    list.replaceChildren(...rows.map((r) => r.row));
    refresh();
  }

  function refresh() {
    const { steps, index, phase } = session.engine.state;
    const seconds = steps.filter((s) => !s.skipped).reduce((sum, s) => sum + s.seconds, 0);
    total.textContent = formatTime(seconds);
    rows.forEach(({ row, input, skip }, i) => {
      const step = steps[i];
      const finished = phase === 'done' || i < index || (i === index && phase === 'drain');
      row.classList.toggle('is-active', i === index && phase !== 'done');
      row.classList.toggle('is-finished', finished && !step.skipped);
      row.classList.toggle('is-skipped', Boolean(step.skipped));
      if (document.activeElement !== input) input.value = formatTime(step.seconds);
      if (skip) {
        skip.textContent = step.skipped ? 'Include' : 'Skip';
        skip.disabled = i === index && phase !== 'idle';
      }
    });
  }

  return { root, rebuild, refresh };
}
