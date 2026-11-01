// #/export (whole archive) and #/export?roll=R003 (one roll): choose what goes into the PDF,
// see the page count, then Create PDF opens print.html with the same options.

import { loadArchive } from './archive-data.js';
import { getDb } from './db.js';
import { rollOrder } from './import-checks.js';
import { optionsFromQuery, optionsToQuery, pageLabel, planPdf } from './pdf-plan.js';
import { replaceQuery } from './router.js';

const INCLUDE = [
  ['cover', 'Cover & roll index', 'Totals, every roll with its pages, lab numbers, film stocks', true],
  ['contact', 'Contact sheets', 'Every strip with thumbnails, marks and frame numbers'],
  ['index', 'Frame index', 'A table of every frame, up to 20 per page'],
  ['notes', 'Review notes', 'Your notes in the frame index'],
  ['files', 'File names', 'Scan file of each frame in the frame index'],
  ['storage', 'Storage locations', 'Sleeve or binder page on each contact sheet'],
];

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const radios = (name, label, pairs, current) => `
  <div class="segmented" role="radiogroup" aria-label="${label}" data-option="${name}">
    ${pairs.map(([v, t]) => `<button class="segment" type="button" role="radio" data-value="${v}" aria-checked="${v === current}" tabindex="${v === current ? 0 : -1}">${t}</button>`).join('')}
  </div>`;

function formHtml(options, rolls, plan) {
  const archive = options.scope === 'archive';
  const choice = (value, title, sub) => `
    <button class="field-row field-row-2 choice-row" type="button" role="radio" data-value="${value}" aria-checked="${options.scope === value}" tabindex="${options.scope === value ? 0 : -1}">
      <span class="radio-dot" aria-hidden="true"></span>
      <span class="stack-0-5"><span class="text-bold">${title}</span><span class="text-sm text-muted">${sub}</span></span>
    </button>`;
  return `
    <section class="span-4 stack-2">
      <h2 class="section-label">What to export</h2>
      <div class="field-group" role="radiogroup" aria-label="What to export" data-option="scope">
        ${choice('archive', 'Whole archive', 'Cover, contact sheets and frame index for every roll')}
        ${choice('roll', 'One roll', 'Contact sheet and frame index')}
      </div>
      ${archive ? radios('process', 'Process', [['all', 'All'], ['bw', 'B&amp;W'], ['colour', 'Colour']], options.process) : `
        <div class="grid grid-inner" role="radiogroup" aria-label="Roll" data-option="rollId">
          ${rolls.map((r) => `<button class="span-1 roll-tile" type="button" role="radio" data-value="${esc(r.id)}" aria-checked="${r.id === options.rollId}" tabindex="${r.id === options.rollId ? 0 : -1}"><span class="text-mono">${esc(r.id)}</span><span class="text-xs text-muted">${r.count} fr</span></button>`).join('')}
        </div>`}
    </section>
    <section class="span-4 stack-1">
      <h2 class="section-label">Include</h2>
      <div class="field-group">
        ${INCLUDE.filter(([, , , archiveOnly]) => archive || !archiveOnly).map(([key, title, sub]) => `
          <label class="field-row field-row-2" for="ex-${key}">
            <span class="stack-0-5"><span>${title}</span><span class="text-xs text-muted">${sub}</span></span>
            <button class="switch" id="ex-${key}" type="button" role="switch" data-include="${key}" aria-checked="${options.include[key]}"></button>
          </label>`).join('')}
      </div>
    </section>
    <section class="span-4 stack-2">
      <h2 class="section-label">Frames</h2>
      ${radios('frames', 'Frames', [['all', 'All'], ['print', 'Print picks'], ['edited', 'Edited only']], options.frames)}
      <span class="form-label">Paper</span>
      ${radios('paper', 'Paper', [['a4', 'A4'], ['letter', 'Letter']], options.paper)}
    </section>
    <section class="span-4 stack-1">
      <div class="results-head"><h2 class="section-label">Preview</h2><span class="text-xs text-muted">${plan.pages.length} page${plan.pages.length === 1 ? '' : 's'}</span></div>
      ${plan.pages.length ? `<div class="page-tiles">${plan.pages.map((p) => `
        <div class="page-tile-item"><span class="page-tile is-${p.kind}" aria-hidden="true"><span></span><span></span><span></span></span><span class="text-xs text-muted">${esc(pageLabel(p))}</span></div>`).join('')}</div>`
        : '<p class="empty-state text-sm text-muted">Nothing to export with these choices.</p>'}
    </section>
    <section class="span-4 stack-1 mb-6">
      <a class="button button-primary button-block${plan.pages.length ? '' : ' is-disabled'}" href="print.html?${optionsToQuery(options)}" data-create>Create PDF</a>
      <p class="text-xs text-muted">Opens the print view. Choose Save as PDF (Mac), or Share → Save to Files (iPhone).</p>
    </section>`;
}

function render({ query }) {
  const root = document.createElement('div');
  root.className = 'grid grid-sections';
  const options = optionsFromQuery(query);

  getDb().then(async (db) => {
    const data = await loadArchive(db);
    const counts = new Map();
    data.negatives.filter((n) => n.status !== 'draft').forEach((n) => counts.set(n.rollId, (counts.get(n.rollId) || 0) + 1));
    const rolls = data.rolls.filter((r) => counts.has(r.id)).sort((a, b) => rollOrder(a.id, b.id)).map((r) => ({ id: r.id, count: counts.get(r.id) }));
    if (options.scope === 'roll' && !options.rollId) options.rollId = rolls[0]?.id;

    const paint = () => {
      root.innerHTML = formHtml(options, rolls, planPdf(data, options));
      const q = new URLSearchParams(optionsToQuery(options));
      replaceQuery(Object.fromEntries(['roll', 'process', 'frames', 'paper', ...Object.keys(options.include)].map((k) => [k, q.get(k)])));
    };

    root.addEventListener('change', (event) => {
      const target = event.target;
      if (target.dataset.include) {
        options.include[target.dataset.include] = target.getAttribute('aria-checked') === 'true';
      } else {
        const name = target.closest('[data-option]')?.dataset.option;
        if (!name) return;
        if (name === 'scope') {
          options.scope = target.dataset.value;
          if (options.scope === 'roll' && !options.rollId) options.rollId = rolls[0]?.id;
        } else {
          options[name] = target.dataset.value;
        }
      }
      paint();
    });
    paint();
  });
  return root;
}

export const exportScreen = { title: 'Export PDF', pushed: true, render };
