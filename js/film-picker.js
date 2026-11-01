// Film stock picker: search, process chips, list (your stocks first, then common stocks made in
// the chosen format), and a form to add a bespoke stock. Used on Load a new roll.

import { PROCESS_LABELS, allStocks, searchStocks, stockDetails } from './film-catalogue.js';

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PROCESS_FILTERS = [['all', 'All'], ['bw', 'B&W'], ['colour', 'Colour'], ['slide', 'Slide']];

/**
 * Builds the picker. yourStocks: filmStocks store items. format: '35mm' | '120'.
 * onPick(stock) when one is chosen; onAdd(stock) when a bespoke stock is saved (then picked).
 */
export function createFilmPicker({ yourStocks, format, onPick, onAdd }) {
  const state = { query: '', process: 'all', otherFormats: false, adding: false, stocks: allStocks(yourStocks), format };
  const card = document.createElement('div');
  card.className = 'card stack-2 film-picker';

  const listHtml = () => {
    const inFormat = searchStocks(state.stocks, { query: state.query, format: state.format, process: state.process });
    const found = state.otherFormats ? searchStocks(state.stocks, { query: state.query, process: state.process }) : inFormat;
    const hiddenOthers = !state.otherFormats && searchStocks(state.stocks, { query: state.query, process: state.process }).length > inFormat.length;
    const rows = found.map((s) => `
      <button class="field-row field-row-2 picker-row" type="button" data-stock="${esc(s.name)}">
        <span class="stack-0-5"><span class="text-bold">${esc(s.name)}</span><span class="text-xs text-muted">${esc(stockDetails(s))}</span></span>
        ${s.yours ? '<span class="tag">Yours</span>' : ''}
      </button>`).join('');
    return `
      ${rows ? `<div class="field-group picker-list">${rows}</div>` : `<p class="text-sm text-muted">No film stock matches "${esc(state.query)}"${state.format ? ` in ${state.format === '120' ? '120' : '35mm'}` : ''}.</p>`}
      ${hiddenOthers ? '<button class="chip chip-plain align-start" type="button" data-other-formats>Show other formats</button>' : ''}
      <button class="button button-secondary button-block" type="button" data-add-bespoke>+ Add a bespoke film stock${state.query && !rows ? ` "${esc(state.query)}"` : ''}</button>`;
  };

  const formHtml = () => `
    <h3 class="section-label">Bespoke film stock</h3>
    <div class="grid grid-inner">
      <div class="span-4 form-field">
        <label class="form-label" for="fp-name">Name</label>
        <input class="input" id="fp-name" data-new="name" value="${esc(state.query)}" placeholder="e.g. Safelight XX 250" autocomplete="off">
      </div>
      <div class="span-2 form-field">
        <label class="form-label" for="fp-iso">Box ISO</label>
        <input class="input" id="fp-iso" data-new="iso" inputmode="numeric" value="${esc((/(\d{2,4})/.exec(state.query) || [])[1] || '')}">
      </div>
      <div class="span-4 form-field">
        <span class="form-label" id="fp-process-label">Process</span>
        <div class="segmented" role="radiogroup" aria-labelledby="fp-process-label" data-new="process">
          ${Object.entries(PROCESS_LABELS).map(([v, t], i) => `<button class="segment" type="button" role="radio" data-value="${v}" aria-checked="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t}</button>`).join('')}
        </div>
      </div>
      <div class="span-4 form-field">
        <span class="form-label" id="fp-formats-label">Made in</span>
        <div class="chip-row" role="group" aria-labelledby="fp-formats-label" data-new="formats">
          ${['35mm', '120'].map((f) => `<button class="chip" type="button" data-value="${f}" aria-pressed="${f === state.format}">${f}</button>`).join('')}
        </div>
      </div>
      <p class="span-4 text-sm text-edge" role="status" data-new-status></p>
      <button class="span-2 button button-primary" type="button" data-save-bespoke>Save</button>
      <button class="span-2 button button-secondary" type="button" data-cancel-bespoke>Cancel</button>
    </div>`;

  const paint = () => {
    if (state.adding) {
      card.innerHTML = formHtml();
      card.querySelector('[data-new="name"]').focus();
      return;
    }
    card.innerHTML = `
      <label class="search-field">
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
        <input class="search-input" type="search" data-film-search value="${esc(state.query)}" placeholder="Search film stocks (e.g. HP5, Portra 400)" aria-label="Search film stocks" autocomplete="off">
      </label>
      <div class="chip-row" data-select="single" role="group" aria-label="Process" data-process>
        ${PROCESS_FILTERS.map(([v, t]) => `<button class="chip" type="button" data-value="${v}" aria-pressed="${v === state.process}">${t}</button>`).join('')}
      </div>
      <div class="stack-2" data-results>${listHtml()}</div>`;
  };

  const refreshList = () => { card.querySelector('[data-results]').innerHTML = listHtml(); };

  card.addEventListener('input', (event) => {
    if (!event.target.matches('[data-film-search]')) return;
    state.query = event.target.value;
    state.otherFormats = false;
    refreshList();
  });
  card.addEventListener('change', (event) => {
    if (!event.target.closest('[data-process]')) return;
    state.process = event.target.dataset.value;
    refreshList();
  });
  card.addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.stock) onPick(state.stocks.find((s) => s.name === target.dataset.stock));
    if (target.matches('[data-other-formats]')) { state.otherFormats = true; refreshList(); }
    if (target.matches('[data-add-bespoke]')) { state.adding = true; paint(); }
    if (target.matches('[data-cancel-bespoke]')) { state.adding = false; paint(); }
    if (target.matches('[data-save-bespoke]')) {
      const name = card.querySelector('[data-new="name"]').value.trim();
      const formats = [...card.querySelectorAll('[data-new="formats"] [aria-pressed="true"]')].map((b) => b.dataset.value);
      const say = (text) => { card.querySelector('[data-new-status]').textContent = text; };
      if (!name) { say('Give the film stock a name.'); return; }
      if (!formats.length) { say('Choose 35mm, 120 or both.'); return; }
      if (state.stocks.some((s) => s.name.toLowerCase() === name.toLowerCase())) { say(`${name} is already in the list.`); return; }
      const created = {
        name,
        iso: Number(card.querySelector('[data-new="iso"]').value) || undefined,
        process: card.querySelector('[data-new="process"] [aria-checked="true"]')?.dataset.value || 'bw',
        formats,
        custom: true,
      };
      await onAdd(created);
      state.stocks = allStocks([created, ...state.stocks.filter((s) => s.yours)]);
      state.adding = false;
      state.query = '';
      onPick({ ...created, yours: true });
    }
  });

  paint();
  return {
    element: card,
    setFormat(next) { state.format = next; state.otherFormats = false; if (!state.adding) refreshList(); },
    focus() { card.querySelector('[data-film-search]')?.focus(); },
  };
}
