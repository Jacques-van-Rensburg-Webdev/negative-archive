// Queue tab: Edit / Print / Post lists, grouped by roll. ✓ ticks an item off, with Undo.
// The chosen list is kept in the URL (#/queue?list=print).

import { loadArchive, watch } from './archive-data.js';
import { getDb } from './db.js';
import { previewId } from './files.js';
import { showPreview } from './previews.js';
import { LISTS, markDone, queueCounts, queueGroups, undoDone } from './queue.js';
import { replaceQuery } from './router.js';

const UNDO_MS = 6000;
const CHECK_ICON = '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function switcher(list, counts) {
  const group = el('div', 'segmented');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', 'List');
  Object.entries(LISTS).forEach(([key, { label }]) => {
    const button = el('button', 'segment', `${label} · ${counts[key]}`);
    button.type = 'button';
    button.dataset.list = key;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(key === list));
    button.tabIndex = key === list ? 0 : -1;
    group.append(button);
  });
  return group;
}

// Row: thumbnail + text link (columns 1–3), ✓ button (column 4)
function row(n, list, onDone) {
  const item = el('div', 'grid grid-inner list-row');
  const link = el('a', 'span-3 grid-3');
  link.href = `#/negative/${encodeURIComponent(n.id)}`;
  const thumb = el('span', 'span-1 thumbnail');
  showPreview(thumb, previewId(n));
  const text = el('span', 'span-2 stack-0-5');
  text.append(el('span', 'text-xs text-muted text-mono', `${n.id} · fr ${n.frameLabel || n.frame || '–'}`), el('span', 'text-sm text-bold list-row-title', n.subject || 'No subject'));
  if (n.notes) text.append(el('span', 'text-sm text-edge list-row-note', n.notes));
  link.append(thumb, text);
  const done = el('button', 'span-1 round-button');
  done.type = 'button';
  done.innerHTML = CHECK_ICON;
  done.setAttribute('aria-label', list === 'post' ? `Post ${n.id} to the feed` : `Mark ${n.id} ${LISTS[list].done}`);
  done.addEventListener('click', () => onDone(n, done));
  item.append(link, done);
  return item;
}

function render({ query }) {
  const state = { list: LISTS[query.get('list')] ? query.get('list') : 'edit' };
  const root = el('div', 'grid');
  const top = el('div', 'span-4');
  const status = el('div', 'span-4 undo-line');
  status.setAttribute('role', 'status');
  // Lists space-3 below the switch (grid gap space-2 + space-1), rolls space-4 apart
  const body = el('div', 'span-4 stack-4 mt-1 mb-6');
  root.append(top, status, body);
  let db;
  let timer;

  const showUndo = (text, undo) => {
    clearTimeout(timer);
    const button = el('button', 'button button-sm', 'Undo');
    button.type = 'button';
    button.addEventListener('click', async () => {
      clearTimeout(timer);
      status.replaceChildren();
      await undo();
    });
    status.replaceChildren(el('span', 'text-sm', text), button);
    timer = setTimeout(() => status.replaceChildren(), UNDO_MS);
  };

  const onDone = async (n, button) => {
    button.disabled = true;
    const { previous } = await markDone(db, n, state.list);
    showUndo(`${state.list === 'post' ? 'Posted' : 'Marked'} ${n.id} ${state.list === 'post' ? 'to the feed' : LISTS[state.list].done}.`, () => undoDone(db, n, previous));
  };

  const paint = async () => {
    const { rolls, negatives } = await loadArchive(db);
    top.replaceChildren(switcher(state.list, queueCounts(negatives)));
    const groups = queueGroups(negatives, rolls, state.list);
    if (!groups.length) {
      body.replaceChildren(el('p', 'empty-state text-sm text-muted', LISTS[state.list].empty));
      return;
    }
    body.replaceChildren(...groups.map(({ roll, negatives: items }) => {
      const block = el('section', 'stack-1');
      const head = el('div', 'results-head');
      head.append(el('h2', 'section-label', `${roll.id} · ${roll.filmStock || ''}`), el('span', 'text-xs text-muted', `${items.length} left`));
      const list = el('div');
      items.forEach((n) => list.append(row(n, state.list, onDone)));
      block.append(head, list);
      return block;
    }));
  };

  top.addEventListener('change', (event) => {
    state.list = event.target.dataset.list;
    replaceQuery({ list: state.list === 'edit' ? null : state.list });
    paint();
  });

  getDb().then((opened) => {
    db = opened;
    paint();
    watch(root, db, paint);
  });
  return root;
}

export const queueScreen = { title: 'Queue', render };
