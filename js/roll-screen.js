// #/roll/R003: roll details, counts, and its frames as a contact sheet, a list,
// or the contact sheet inverted ("Negative"). The view is kept in the URL (?view=list).

import {
  countNegatives, groupStrips, loadArchive, monthRange, places, sortFrames, toFrame, watch,
} from './archive-data.js';
import { getDb } from './db.js';
import { renderFilmStrip } from './film-strip.js';
import { previewId } from './files.js';
import { inlineSetRow } from './inline-set.js';
import { showPreview } from './previews.js';
import { deleteRollBlock } from './roll-delete.js';
import { replaceQuery } from './router.js';
import { frameLayout, formatText } from './formats.js';
import { setLabNumber } from './shots.js';
import { unsyncedShots } from './sync.js';

const VIEWS = [['sheet', 'Contact sheet'], ['list', 'List'], ['negative', 'Negative']];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statTile(value, label, attention = false) {
  const tile = el('div', 'span-1 stat-tile');
  tile.append(el('span', `stat-tile-value${attention ? ' is-attention' : ''}`, String(value)), el('span', 'stat-tile-label', label));
  return tile;
}

function contactSheet(negatives, inverted, layout) {
  const sheet = el('div', `stack-2${inverted ? ' is-inverted' : ''}`);
  const strips = groupStrips(negatives, layout.perStrip);
  strips.forEach(({ strip, negatives: frames }) => {
    const block = el('div', 'stack-1');
    block.append(
      el('h3', 'section-label', `Strip ${strip}`),
      renderFilmStrip(frames.map(toFrame), { label: `Strip ${strip} of ${strips.length}`, layout }),
    );
    sheet.append(block);
  });
  return sheet;
}

function listView(negatives) {
  const list = el('div', 'stack-1');
  sortFrames(negatives).forEach((n) => {
    const row = el('a', 'grid grid-inner list-row');
    row.href = `#/negative/${encodeURIComponent(n.id)}`;
    const thumb = el('span', 'span-1 thumbnail');
    showPreview(thumb, previewId(n));
    const text = el('span', 'span-3 stack-0-5');
    text.append(
      el('span', 'text-xs text-muted text-mono', `${n.id} · fr ${n.frameLabel || n.frame || '–'}${n.status === 'draft' ? ' · draft' : ''}`),
      el('span', 'list-row-title', n.subject || 'No subject'),
    );
    if (n.notes) text.append(el('span', 'text-sm text-edge list-row-note', n.notes));
    row.append(thumb, text);
    list.append(row);
  });
  return list;
}

function legend() {
  const row = el('p', 'legend text-xs text-muted');
  row.innerHTML = '<span><span class="legend-dot is-to-edit"></span>To edit</span><span><span class="legend-dot is-edited"></span>Edited</span><span>U under · O over · S soft</span>';
  return row;
}

// A roll with no negatives yet: where to carry on (Sync has its own button)
function nextStepLink(roll) {
  const id = encodeURIComponent(roll.id);
  if (roll.status === 'at_lab') return [];
  const link = el('a', 'span-4 desktop-half button button-secondary button-block', roll.status === 'shooting' ? 'Go to Shoot' : 'Log negatives');
  link.href = roll.status === 'shooting' ? `#/shoot?roll=${id}` : `#/add?roll=${id}`;
  return [link];
}

function segmented(current) {
  const group = el('div', 'segmented');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', 'View');
  VIEWS.forEach(([key, label]) => {
    const button = el('button', 'segment', label);
    button.type = 'button';
    button.dataset.view = key;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(key === current));
    button.tabIndex = key === current ? 0 : -1;
    group.append(button);
  });
  return group;
}

async function fill(root, db, rollId, state) {
  const { rolls, negatives: all, cameras, lenses } = await loadArchive(db);
  const roll = rolls.find((r) => r.id === rollId);
  if (!roll) {
    root.replaceChildren(el('p', 'span-4 empty-state', `Roll ${rollId} isn't in the archive.`));
    return;
  }
  const negatives = all.filter((n) => n.rollId === rollId);
  const sorted = sortFrames(negatives);
  const counts = countNegatives(negatives);
  const ids = [...negatives.map((n) => n.id)].sort();

  // Content, columns 1–4, at 24: roll details
  const details = el('section', 'span-4 stack-0-5');
  details.append(
    el('p', 'text-lg text-bold', [roll.filmStock, places(sorted).join(', ')].filter(Boolean).join(' · ') || 'Unknown film'),
    el('p', 'text-sm text-muted', [formatText(roll), monthRange(negatives), cameras.get(roll.cameraId), lenses.get(roll.defaultLensId), roll.labNumber && `lab no. ${roll.labNumber}`].filter(Boolean).join(' · ')),
  );
  if (ids.length) details.append(el('p', 'text-xs text-muted text-mono', `${ids[0]} → ${ids.at(-1)}`));

  const storage = el('div', 'span-4 desktop-half field-group');
  storage.append(inlineSetRow({
    label: 'Lab no.',
    value: roll.labNumber,
    placeholder: roll.status === 'shooting' ? 'In the camera' : 'Not back from the lab yet',
    mono: true,
    onSave: (value) => setLabNumber(db, roll, value),
  }), inlineSetRow({
    label: 'Storage',
    value: roll.storageLocation,
    placeholder: 'Box / binder / sleeve page',
    onSave: (value) => db.put('rolls', { ...roll, storageLocation: value }),
  }));

  const tiles = [
    statTile(counts.frames, 'frames'),
    statTile(counts.scanned, 'scanned'),
    statTile(counts.toEdit, 'to edit', counts.toEdit > 0),
    statTile(counts.social, 'social'),
  ];
  tiles[0].classList.add('start-1'); // desktop: a new row, under the half-width block

  const switcher = el('div', 'span-4 desktop-half');
  switcher.append(segmented(state.view));
  const body = el('div', 'span-4');
  const showView = () => {
    body.replaceChildren(
      state.view === 'list' ? listView(negatives) : contactSheet(negatives, state.view === 'negative', frameLayout(roll)),
    );
  };
  switcher.addEventListener('change', (event) => {
    state.view = event.target.dataset.view;
    replaceQuery({ view: state.view === 'sheet' ? null : state.view });
    showView();
  });
  showView();

  const shots = await db.byIndex('shots', 'rollId', rollId);
  const pending = unsyncedShots(shots);
  const sync = el('a', 'span-4 desktop-half button button-secondary button-block', `Sync ${pending.length} shot${pending.length === 1 ? '' : 's'} from the photo log`);
  sync.href = `#/shoot/sync?roll=${encodeURIComponent(rollId)}`;

  const foot = el('div', 'span-4');
  foot.append(negatives.length ? legend() : el('p', 'empty-state text-sm text-muted', 'No negatives on this roll yet.'));

  // Content, columns 1–4, last block: Remove roll and delete data
  const remove = deleteRollBlock(db, roll, negatives.length, shots.length);

  root.replaceChildren(details, ...(negatives.length ? [] : nextStepLink(roll)), storage, ...(pending.length ? [sync] : []), ...tiles, switcher, body, foot, remove);
}

function render({ params, query }) {
  // Blocks space-3 apart, as in the layout table
  const root = el('div', 'grid grid-gap-3');
  const state = { view: VIEWS.some(([key]) => key === query.get('view')) ? query.get('view') : 'sheet' };
  getDb().then((db) => {
    fill(root, db, params.id, state);
    watch(root, db, () => fill(root, db, params.id, state));
  });
  return root;
}

function actions({ params }) {
  const pdf = el('a', 'button button-sm', 'Roll PDF');
  pdf.href = `#/export?roll=${encodeURIComponent(params.id)}`;
  return [pdf];
}

export const rollScreen = {
  wide: true,
  title: ({ params }) => params.id,
  actions,
  titleMono: true,
  pushed: true,
  render,
};
