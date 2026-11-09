// #/negative/2026-0078: one negative. Image with a Negative / Scan / Edit switch,
// status, where it's filed, all details, and Edit details. Previous / next run across the roll.

import { groupStrips, loadArchive, sortFrames, toFrame, watch } from './archive-data.js';
import { getDb } from './db.js';
import { renderFilmStrip } from './film-strip.js';
import { blobUrl, previewUrls } from './files.js';
import { inlineSetRow } from './inline-set.js';
import { attachControls, noPreview } from './negative-attach.js';
import { detailSections, el, heading, shotSection, statusPills } from './negative-sections.js';
import { postBlock } from './post-block.js';
import { frameLayout } from './formats.js';
import { lightingText } from './shots.js';

const VERSIONS = [['negative', 'Negative'], ['scan', 'Scan'], ['edit', 'Edit']];
const ARROW_LEFT = '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
const ARROW_RIGHT = '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

function stepButton(label, icon, targetId) {
  const button = el('button', 'icon-button');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.innerHTML = icon;
  button.disabled = !targetId;
  // Replace, so Back returns to where the negative was opened from, not through every frame.
  button.addEventListener('click', () => window.location.replace(`#/negative/${encodeURIComponent(targetId)}`));
  return button;
}

// Image area (full-bleed): the chosen version, or a button to attach the file.
async function imageArea(db, n, version, state, report) {
  const area = el('div', 'full-bleed flush-top negative-image');
  const isEdit = version === 'edit';
  const scanUrl = await blobUrl(db, n.thumbBlobId || n.scanBlobId);
  // Until a scan is attached, Scan / Negative show the Shoot reference photo
  const refUrl = !isEdit && !scanUrl ? await blobUrl(db, n.refThumbBlobId) : undefined;
  const url = isEdit ? await blobUrl(db, n.editThumbBlobId || n.editBlobId) : scanUrl || refUrl;
  const fileName = isEdit ? n.editedFile : n.scanFile;
  const kind = isEdit ? 'edit' : 'scan';
  const hasFile = Boolean(isEdit ? n.editBlobId : n.scanBlobId);
  const fallback = () => (hasFile ? [noPreview(kind, fileName)] : attachControls(db, n, kind, fileName, state.busy, report));
  if (refUrl) area.append(el('span', 'negative-image-note text-xs', 'Reference photo from Shoot'));
  if (url) {
    const img = el('img', `negative-image-img${version === 'negative' ? ' is-inverted-image' : ''}`);
    img.alt = `${n.subject || n.id}, ${version}`;
    img.src = url;
    img.addEventListener('error', () => img.replaceWith(...fallback()));
    area.append(img);
  } else {
    area.append(...fallback());
  }
  const edge = el('span', 'negative-edge');
  edge.append(el('span', '', (n.filmStock || '').toUpperCase()), el('span', '', `▸ ${n.frameLabel || n.frame || ''}`));
  area.append(edge);
  return area;
}

function versionSwitch(current) {
  const group = el('div', 'segmented');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', 'Image version');
  VERSIONS.forEach(([key, label]) => {
    const button = el('button', 'segment', label);
    button.type = 'button';
    button.dataset.version = key;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(key === current));
    button.tabIndex = key === current ? 0 : -1;
    group.append(button);
  });
  return group;
}

function whereFiled(db, n, roll, rollNegatives, urls) {
  const layout = frameLayout(roll);
  const strips = groupStrips(rollNegatives, layout.perStrip);
  const index = strips.findIndex((s) => s.negatives.some((x) => x.id === n.id));
  const group = el('div', 'field-group');
  const stripBlock = el('div', 'field-group-media');
  if (index >= 0) {
    stripBlock.append(renderFilmStrip(strips[index].negatives.map((x) => toFrame(x, urls)), { selected: n.id, label: `Strip ${strips[index].strip}`, layout }));
  }
  const rollRow = el('a', 'field-row field-row-link');
  rollRow.href = `#/roll/${encodeURIComponent(n.rollId)}`;
  rollRow.append(el('span', 'field-key', 'Roll'), el('span', 'field-value field-value-mono', `${n.rollId} →`));
  const stripRow = el('div', 'field-row');
  stripRow.append(el('span', 'field-key', 'Strip'), el('span', 'field-value', index >= 0 ? `${strips[index].strip} of ${strips.length}` : '—'));
  const frameRow = el('div', 'field-row');
  frameRow.append(el('span', 'field-key', 'Frame'), el('span', 'field-value field-value-mono', n.frameLabel || String(n.frame ?? '—')));
  const storage = inlineSetRow({
    label: 'Storage',
    value: n.storageLocation,
    placeholder: roll?.storageLocation ? `From roll: ${roll.storageLocation}` : 'Box / binder / sleeve page',
    onSave: (value) => db.put('negatives', { ...n, storageLocation: value, updatedAt: new Date().toISOString() }),
  });
  group.append(stripBlock, rollRow, stripRow, frameRow, storage);
  const block = el('section', 'span-4 stack-1');
  block.append(el('h3', 'section-label', "Where it's filed"), group);
  return block;
}

async function fill(root, db, id, state, ctx) {
  const { rolls, negatives, cameras, lenses } = await loadArchive(db);
  const n = negatives.find((x) => x.id === id);
  if (!n) {
    root.replaceChildren(el('p', 'span-4 empty-state', `Negative ${id} isn't in the archive.`));
    ctx.setActions([]);
    return;
  }
  const roll = rolls.find((r) => r.id === n.rollId);
  const rollNegatives = sortFrames(negatives.filter((x) => x.rollId === n.rollId));
  const at = rollNegatives.findIndex((x) => x.id === id);
  ctx.setActions([
    stepButton('Previous frame', ARROW_LEFT, rollNegatives[at - 1]?.id),
    stepButton('Next frame', ARROW_RIGHT, rollNegatives[at + 1]?.id),
  ]);

  if (!state.version) state.version = (n.editThumbBlobId || n.editBlobId) ? 'edit' : 'scan';
  const report = (text, busy = false) => {
    Object.assign(state, { message: text, busy });
    const line = root.querySelector('[data-attach-status]');
    if (line) { line.textContent = text; line.hidden = !text; }
    root.querySelectorAll('.negative-image-attach').forEach((button) => { button.disabled = busy; });
  };
  const image = await imageArea(db, n, state.version, state, report);
  const switcher = el('div', 'mt-2');
  switcher.append(versionSwitch(state.version));
  switcher.addEventListener('change', async (event) => {
    state.version = event.target.dataset.version;
    report('', state.busy);
    root.querySelector('.negative-image').replaceWith(await imageArea(db, n, state.version, state, report));
  });

  // Image at 0, switch space-2 below, heading space-3 below that, pills space-2 below.
  // Desktop: image and switch in columns 1–2, everything else in columns 3–4.
  const media = el('section', 'span-4 negative-media');
  const status = el('p', 'text-sm text-muted mt-1', state.message);
  status.dataset.attachStatus = '';
  status.setAttribute('role', 'status');
  status.hidden = !state.message;
  media.append(image, switcher, status);
  const pills = statusPills(n);
  pills.classList.add('mt-2');
  const head = el('section', 'span-4 negative-head');
  head.append(heading(n), pills);
  const edit = el('a', 'span-4 button button-secondary button-block', 'Edit details');
  edit.href = `#/negative/${encodeURIComponent(n.id)}/edit`;

  const names = { camera: cameras.get(n.cameraId), lens: lenses.get(n.lensId) };
  const urls = await previewUrls(db, rollNegatives.filter((x) => x.strip === n.strip));
  const shot = n.shotId ? await db.get('shots', n.shotId) : undefined;
  const shotBlock = shot ? [shotSection(shot, lenses.get(shot.lensId), lightingText(shot.lighting))] : [];
  const info = el('div', 'negative-info');
  info.append(head, whereFiled(db, n, roll, rollNegatives, urls), ...shotBlock, ...detailSections(n, roll, names), edit, postBlock(db, n));
  root.replaceChildren(media, info);
}

function render(ctx) {
  // Content: image block first, then sections space-4 apart
  const root = el('div', 'grid grid-sections');
  const state = { version: null, message: '', busy: false };
  getDb().then((db) => {
    fill(root, db, ctx.params.id, state, ctx);
    watch(root, db, () => fill(root, db, ctx.params.id, state, ctx));
  });
  return root;
}

export const negativeScreen = {
  wide: true,
  title: ({ params }) => params.id,
  titleMono: true,
  pushed: true,
  render,
};
