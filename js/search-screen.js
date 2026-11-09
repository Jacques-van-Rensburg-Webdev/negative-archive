// #/search: keyword as you type, filter chips with live counts, results newest first.
// State lives in the URL (?q=…&process=colour&film=…&open=film), so Back returns to the same results.

import { formatMonth, loadArchive, watch } from './archive-data.js';
import { getDb } from './db.js';
import { previewUrls } from './files.js';
import { replaceQuery } from './router.js';
import {
  FACETS, applySearch, buildEntries, facetOptions, hasLightingData, isEmptyState, valueLabel,
} from './search.js';

const FACET_NAMES = { process: 'Type', film: 'Film', date: 'Date', camera: 'Camera', lens: 'Lens', lighting: 'Lighting' };
const PANEL_TITLES = { process: 'Black & white or colour', film: 'Film stock', date: 'Date taken', camera: 'Camera', lens: 'Lens', lighting: 'Lighting' };
const SEARCH_ICON = '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text) {
  const node = el('button', className, text);
  node.type = 'button';
  return node;
}

function optionChip({ label, count }, isSet, onPick) {
  const chip = button(`chip${isSet ? ' is-set' : ''}`, label);
  chip.append(el('span', 'chip-count', `· ${count}`));
  chip.disabled = count === 0 && !isSet;
  chip.addEventListener('click', onPick);
  return chip;
}

function resultRow(entry, url) {
  const n = entry.negative;
  const row = el('a', 'grid grid-inner list-row');
  row.href = `#/negative/${encodeURIComponent(n.id)}`;
  const thumb = el('span', 'span-1 thumbnail');
  if (url) thumb.style.backgroundImage = `url("${url}")`;
  const text = el('span', 'span-3 stack-0-5');
  const meta = [entry.film, formatMonth(entry.month) || n.dateTaken, (n.location || '').split(',')[0]].filter(Boolean).join(' · ');
  text.append(
    el('span', 'list-row-title text-bold', n.subject || 'No subject'),
    el('span', 'text-sm text-muted list-row-note', meta),
    el('span', 'text-xs text-muted text-mono', `${n.id} · ${n.rollId} · fr ${n.frameLabel || n.frame || '–'}`),
  );
  row.append(thumb, text);
  return row;
}

function render({ query }) {
  const state = { q: query.get('q') || '', open: query.get('open') || null };
  FACETS.forEach((facet) => { state[facet] = query.get(facet) || undefined; });

  // Search bar zone: sticky under the header, kept across updates so typing keeps focus
  const root = el('div', 'grid');
  const bar = el('div', 'full-bleed flush-top search-bar');
  const field = el('label', 'search-field');
  const input = el('input', 'search-input');
  input.type = 'search';
  input.value = state.q;
  input.placeholder = 'Keyword, ID, file name, place…';
  input.setAttribute('aria-label', 'Search');
  input.autocomplete = 'off';
  field.innerHTML = SEARCH_ICON;
  field.append(input);
  bar.append(field);

  const chips = el('div', 'span-4 chip-row');
  const panel = el('div', 'span-4');
  const results = el('section', 'span-4 stack-1 mb-6');
  root.append(bar, chips, panel, results);

  let entries = [];
  let db;

  const syncUrl = () => {
    const changes = { q: state.q || null, open: state.open || null };
    FACETS.forEach((facet) => { changes[facet] = state[facet] || null; });
    replaceQuery(changes);
  };

  const choose = (facet, value) => {
    state[facet] = value || undefined;
    state.open = null;
    update();
  };

  const renderChips = () => {
    const facets = FACETS.filter((f) => f !== 'lighting' || hasLightingData(entries));
    chips.replaceChildren(...facets.map((facet) => {
      const value = state[facet];
      const chip = button(`chip${value ? ' is-set' : ''}`, value ? `${FACET_NAMES[facet]} · ${valueLabel(entries, facet, value)}` : FACET_NAMES[facet]);
      chip.setAttribute('aria-expanded', String(state.open === facet));
      chip.addEventListener('click', () => { state.open = state.open === facet ? null : facet; update(); });
      return chip;
    }));
    if (!isEmptyState(state)) {
      const clear = button('chip chip-plain', 'Clear');
      clear.addEventListener('click', () => {
        FACETS.forEach((facet) => { state[facet] = undefined; });
        Object.assign(state, { q: '', open: null });
        input.value = '';
        update();
        input.focus();
      });
      chips.append(clear);
    }
  };

  const renderPanel = () => {
    const facet = state.open;
    if (!facet) { panel.replaceChildren(); return; }
    const card = el('div', 'card stack-2');
    card.append(el('h2', 'section-label', PANEL_TITLES[facet]));
    const row = (options) => {
      const list = el('div', 'chip-row');
      options.forEach((o) => list.append(optionChip(o, state[facet] === o.value, () => choose(facet, o.value))));
      return list;
    };
    const any = button('chip chip-plain', 'Any');
    any.addEventListener('click', () => choose(facet, undefined));

    if (facet === 'date') {
      const { months, years } = facetOptions(entries, state, 'date');
      card.append(el('span', 'form-label', 'Year'), row(years), el('span', 'form-label', 'Month'), row(months));
      const range = el('div', 'grid grid-inner');
      const [from, to] = (state.date || '').includes('..') ? state.date.split('..') : [months[0]?.value, months.at(-1)?.value];
      const pick = (label, selected) => {
        const wrap = el('div', 'span-2 form-field');
        const select = el('select', 'input');
        select.setAttribute('aria-label', label);
        months.forEach((m) => select.add(new Option(m.label, m.value, false, m.value === selected)));
        const box = el('div', 'select');
        box.append(select);
        wrap.append(el('span', 'form-label', label), box);
        return [wrap, select];
      };
      const [fromWrap, fromSelect] = pick('From', from);
      const [toWrap, toSelect] = pick('To', to);
      const apply = button('span-4 button button-secondary button-block', 'Apply range');
      apply.addEventListener('click', () => {
        const [a, b] = [fromSelect.value, toSelect.value].sort();
        choose('date', a === b ? a : `${a}..${b}`);
      });
      range.append(fromWrap, toWrap, apply);
      card.append(range);
    } else {
      card.append(row(facetOptions(entries, state, facet)));
    }
    card.append(any);
    panel.replaceChildren(card);
  };

  const renderResults = async () => {
    const found = applySearch(entries, state);
    // Results line space-3 below the chips / panel (grid gap space-2 + space-1)
    const head = el('div', 'results-head mt-1');
    head.append(el('span', 'text-bold', `${found.length} negative${found.length === 1 ? '' : 's'}`), el('span', 'text-xs text-muted', 'Newest first'));
    if (!found.length) {
      results.replaceChildren(head, el('p', 'empty-state text-sm text-muted', 'No negatives match. Try fewer filters or another keyword.'));
      return;
    }
    const urls = db ? await previewUrls(db, found.map((e) => e.negative)) : new Map();
    const list = el('div');
    found.forEach((entry) => list.append(resultRow(entry, urls.get(entry.negative.id))));
    results.replaceChildren(head, list);
  };

  const update = () => {
    syncUrl();
    renderChips();
    renderPanel();
    renderResults();
  };

  input.addEventListener('input', () => {
    state.q = input.value;
    update();
  });

  const load = async () => {
    const data = await loadArchive(db);
    entries = buildEntries({ ...data, shots: await db.getAll('shots') });
    update();
  };

  getDb().then((opened) => {
    db = opened;
    load();
    watch(root, db, load);
  });
  if (!state.open) setTimeout(() => input.focus(), 0);
  return root;
}

export const searchScreen = { title: 'Search', pushed: true, render };
