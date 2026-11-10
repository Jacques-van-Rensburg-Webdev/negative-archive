// Archive tab: All / B&W / Colour, totals, then a card per roll (newest first). Rolls with no negatives yet
// show as dashed "not logged" cards that open the Add form for that roll.

import {
  countNegatives, groupByRoll, loadArchive, monthRange, places, sortFrames, sortRollsNewestFirst, toFrame, watch,
} from './archive-data.js';
import { backupAgeText, backupOverdue, backupStatus } from './backup.js';
import { getDb } from './db.js';
import { renderFilmStrip } from './film-strip.js';
import { frameLayout, formatText } from './formats.js';
import { replaceQuery } from './router.js';

const SEARCH_ICON = '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
const SEARCH_FACETS = [['film', 'Film'], ['date', 'Date'], ['camera', 'Camera'], ['lens', 'Lens']];
const PROCESS_TABS = [['all', 'All'], ['bw', 'B&W'], ['colour', 'Colour']];
const GEAR_ICON = '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>';

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

// Search entry: a link styled as the search field, and chips that open Search with a filter panel open
function searchBlock(process) {
  const type = process === 'all' ? '' : `process=${process}`;
  const block = el('section', 'span-4 stack-2');
  const field = el('a', 'search-field');
  field.href = `#/search${type ? `?${type}` : ''}`;
  field.innerHTML = SEARCH_ICON;
  field.append(el('span', 'text-muted', 'Search by keyword, film, date, gear…'));
  const chips = el('div', 'chip-row');
  SEARCH_FACETS.forEach(([facet, label]) => {
    const chip = el('a', 'chip', label);
    chip.href = `#/search?open=${facet}${type ? `&${type}` : ''}`;
    chips.append(chip);
  });
  block.append(field, chips);
  return block;
}

// A roll with no negatives yet, by where it is: in the camera, at the lab, or back
function notLoggedCard(roll, shotCount) {
  const shots = `${shotCount} shot${shotCount === 1 ? '' : 's'} logged`;
  const title = { shooting: `In the camera · ${shots}`, at_lab: `At the lab · ${shots}` }[roll.status] || 'Back from the lab · not logged';
  const action = 'Open →';
  const card = el('a', 'roll-card is-empty');
  card.href = `#/roll/${encodeURIComponent(roll.id)}`;
  const head = el('span', 'roll-card-head');
  const text = el('span', 'roll-card-text');
  text.append(el('span', 'text-bold', title));
  const meta = [roll.filmStock, roll.labNumber && `lab no. ${roll.labNumber}`].filter(Boolean).join(' · ');
  if (meta) text.append(el('span', 'text-xs text-muted', meta));
  head.append(el('span', 'roll-card-id', roll.id), text, el('span', 'text-sm text-bold', action));
  card.append(head);
  return card;
}

function rollCard(roll, negatives) {
  const counts = countNegatives(negatives);
  const card = el('a', 'roll-card');
  card.href = `#/roll/${encodeURIComponent(roll.id)}`;

  const head = el('span', 'roll-card-head');
  const text = el('span', 'roll-card-text');
  const meta = [formatText(roll), monthRange(negatives), places(negatives).join(', '), roll.labNumber && `lab no. ${roll.labNumber}`].filter(Boolean).join(' · ');
  text.append(el('span', 'text-bold', roll.filmStock || 'Unknown film'), el('span', 'text-xs text-muted', meta));
  head.append(el('span', 'roll-card-id', roll.id), text, el('span', 'text-xs text-muted', `${counts.frames} fr`));

  const layout = frameLayout(roll);
  const strip = renderFilmStrip(sortFrames(negatives).slice(0, layout.perStrip).map(toFrame), { interactive: false, layout });

  const foot = el('span', 'roll-card-foot');
  const progress = el('span', 'progress');
  const share = counts.markedEdit ? Math.round((counts.edited / counts.markedEdit) * 100) : 0;
  progress.style.setProperty('--progress', `${share}%`);
  progress.setAttribute('role', 'img');
  progress.setAttribute('aria-label', `${counts.edited} of ${counts.markedEdit} edits done`);
  foot.append(progress, el('span', 'text-xs text-muted', `${counts.toEdit} to edit · ${counts.printMaybe} print maybe`));

  card.append(head, strip, foot);
  return card;
}

function processTabs(current) {
  const group = el('div', 'segmented span-4 desktop-half');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', 'Film type');
  PROCESS_TABS.forEach(([key, label]) => {
    const button = el('button', 'segment', label);
    button.type = 'button';
    button.dataset.process = key;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(key === current));
    button.tabIndex = key === current ? 0 : -1;
    group.append(button);
  });
  return group;
}

async function fill(root, db, state) {
  state.run += 1;
  const { run, process } = state;
  const archive = await loadArchive(db);
  const inTab = (roll) => process === 'all' || (roll.process || 'bw') === process;
  const rolls = archive.rolls.filter(inTab);
  const rollIds = new Set(rolls.map((r) => r.id));
  const negatives = process === 'all' ? archive.negatives : archive.negatives.filter((n) => rollIds.has(n.rollId));
  const shotCounts = new Map();
  (await db.getAll('shots')).forEach((s) => shotCounts.set(s.rollId, (shotCounts.get(s.rollId) || 0) + 1));
  const byRoll = groupByRoll(negatives);
  const totals = countNegatives(negatives);
  const ordered = sortRollsNewestFirst(rolls, byRoll);

  const tiles = [
    statTile(totals.frames, 'negatives'),
    statTile(rolls.length, 'rolls'),
    statTile(totals.scanned, 'scanned'),
    statTile(totals.toEdit, 'to edit', totals.toEdit > 0),
  ];

  const list = el('section', 'span-4 stack-1 mb-6 roll-list');
  list.append(el('h2', 'section-label', 'Rolls'));
  const empty = ordered.filter((roll) => !byRoll.has(roll.id));
  const logged = ordered.filter((roll) => byRoll.has(roll.id));
  empty.forEach((roll) => list.append(notLoggedCard(roll, shotCounts.get(roll.id) || 0)));
  logged.forEach((roll) => list.append(rollCard(roll, byRoll.get(roll.id))));
  if (!rolls.length) {
    const tabName = PROCESS_TABS.find(([key]) => key === process)[1];
    const note = el('p', 'empty-state text-sm text-muted', process === 'all' ? 'No rolls yet. Import the spreadsheet or restore a backup from Data (the gear, top right).' : `No ${tabName} rolls yet.`);
    list.append(note);
  }

  // Backup reminder (data present and no backup for 7 days, or never)
  const backup = await backupStatus(db);
  const reminder = [];
  if (backupOverdue(backup, negatives.length)) {
    const link = el('a', 'span-4 backup-reminder text-sm');
    link.href = '#/data';
    link.textContent = backup.days === null ? 'Not backed up yet · Back up now →' : `Last backup ${backupAgeText(backup).toLowerCase()} · Back up now →`;
    reminder.push(link);
  }

  if (run !== state.run) return; // the tab changed while this was loading
  root.replaceChildren(...reminder, state.tabs, searchBlock(process), ...tiles, list);
}

function render({ query }) {
  // Content, columns 1–4: tabs at 24, search space-4 below, stat tiles space-4 below, then the rolls list space-4 below
  const root = el('div', 'grid grid-sections');
  const asked = query.get('process');
  const state = { process: PROCESS_TABS.some(([key]) => key === asked) ? asked : 'all', run: 0 };
  state.tabs = processTabs(state.process);
  getDb().then((db) => {
    state.tabs.addEventListener('change', (event) => {
      state.process = event.target.dataset.process;
      replaceQuery({ process: state.process === 'all' ? null : state.process });
      fill(root, db, state);
    });
    fill(root, db, state);
    watch(root, db, () => fill(root, db, state));
  });
  return root;
}

function actions() {
  const pdf = el('a', 'button button-sm', 'PDF');
  pdf.href = '#/export';
  const link = el('a', 'icon-button');
  link.href = '#/data';
  link.setAttribute('aria-label', 'Data and backup');
  link.innerHTML = GEAR_ICON;
  return [pdf, link];
}

export const archiveScreen = { title: 'Archive', wide: true, actions, render };
