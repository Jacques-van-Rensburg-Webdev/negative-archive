// #/shoot/sync?roll=R007: match shots to frames, preview the entries, and create (or update)
// draft negatives in the archive.

import { getDb } from './db.js';
import { idYear, previewNextId, seriesForRoll, formatId, parseId } from './ids.js';
import { showPreview } from './previews.js';
import { shotsForRoll } from './shots.js';
import { applySync, planSync } from './sync.js';

const MAPPING = [
  ['Roll, film', 'Roll, film stock (pushed / pulled ISO in notes)'],
  ['Shot number + offset', 'Frame and strip'],
  ['Time taken', 'Date taken'],
  ['Place', 'Location'],
  ['Lens (per shot), camera', 'Lens, camera'],
  ['Type', 'Category'],
  ['Aperture, light, filter, lighting', 'Shown on the negative, searchable'],
  ['Quick note', 'Notes ("Shot note: …")'],
  ['Reference photo', 'Shown until a scan is attached'],
];

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// IDs new entries will get, in order, without taking them yet
async function upcomingIds(db, roll, rows) {
  const ids = [];
  const next = new Map();
  for (const row of rows) {
    if (row.negativeId) { ids.push(row.negativeId); continue; }
    const year = idYear(row.fields.dateTaken);
    const series = seriesForRoll(roll);
    const key = `${year}${series}`;
    if (!next.has(key)) next.set(key, parseId(await previewNextId(db, year, series)).number);
    ids.push(formatId(year, next.get(key), series));
    next.set(key, next.get(key) + 1);
  }
  return ids;
}

function render({ query }) {
  const root = document.createElement('div');
  root.className = 'grid grid-sections';
  const state = { first: undefined, overrides: {}, open: null, message: '' };

  getDb().then(async (db) => {
    const roll = await db.get('rolls', query.get('roll'));
    if (!roll) {
      root.innerHTML = `<p class="span-4 empty-state">Roll ${esc(query.get('roll'))} isn't in the archive.</p>`;
      return;
    }
    const lenses = new Map((await db.getAll('lenses')).map((l) => [l.id, l.name]));
    state.first = state.first ?? roll.firstFrame ?? 1;

    const paint = async () => {
      const shots = await shotsForRoll(db, roll.id);
      const negatives = await db.byIndex('negatives', 'rollId', roll.id);
      const rows = planSync(shots, roll, negatives, state);
      const ids = await upcomingIds(db, roll, rows);
      const updating = rows.filter((r) => r.negativeId).length;
      const photos = shots.filter((s) => s.refPhotoBlobId).length;
      const synced = shots.length && updating === shots.length ? 'all in the archive' : updating ? `${updating} already in the archive` : 'not synced yet';
      const label = !rows.length ? 'Nothing to sync' : updating === rows.length ? `Update ${rows.length} entries` : updating ? `Sync ${rows.length - updating} new, update ${updating}` : `Sync ${rows.length} shots to archive`;

      root.innerHTML = `
        <section class="span-4 card stack-0-5">
          <span class="text-lg text-mono">${esc(roll.id)}</span>
          <span class="text-bold">${esc(roll.filmStock)} · ISO ${esc(roll.shotIso || roll.boxIso || '–')}</span>
          <span class="text-sm text-muted">${shots.length} shot${shots.length === 1 ? '' : 's'} logged · ${photos} reference photo${photos === 1 ? '' : 's'} · ${synced}</span>
        </section>
        <section class="span-4 stack-1">
          <h2 class="section-label">Match shots to frames</h2>
          <p class="text-sm text-muted">Frame numbers on the negatives don't always start at 1. Set where shot 1 landed so each entry gets the right frame and strip.</p>
          <div class="field-group"><div class="field-row">
            <span>Shot 1 is frame</span>
            <span class="stepper">
              <button class="round-button" type="button" data-first="-1" aria-label="Earlier frame">−</button>
              <span class="stepper-value text-mono" aria-live="polite">${state.first}</span>
              <button class="round-button" type="button" data-first="1" aria-label="Later frame">+</button>
            </span>
          </div></div>
          <p class="text-xs text-muted">You can do this now or after the roll is developed. Entries update either way.</p>
        </section>
        <section class="span-4 stack-1">
          <h2 class="section-label">${updating === rows.length && rows.length ? 'Entries to update' : 'Entries to create'}</h2>
          ${rows.map((r, i) => `
            <div class="field-group">
              <div class="grid grid-inner list-row sync-row">
                <span class="span-1 thumbnail" data-ref="${i}"></span>
                <span class="span-3 stack-0-5">
                  <span class="text-xs text-mono text-muted">${esc(ids[i])}${r.negativeId ? ' · update' : ' · new'}</span>
                  <span class="text-sm text-bold">Shot ${r.shot.shotNumber} → strip ${r.position.strip}, frame ${r.position.frame}</span>
                  <span class="text-xs text-muted">${esc([lenses.get(r.fields.lensId), r.shot.aperture, r.shot.light, r.shot.category].filter(Boolean).join(' · '))}</span>
                  <button class="button button-sm align-start" type="button" data-change="${esc(r.shot.id)}" aria-expanded="${state.open === r.shot.id}">Change frame</button>
                </span>
              </div>
              ${state.open === r.shot.id ? `
                <div class="grid grid-inner field-group-media">
                  <div class="span-2 form-field"><label class="form-label" for="sy-f-${i}">Frame</label><input class="input" id="sy-f-${i}" inputmode="numeric" data-override-frame="${esc(r.shot.id)}" value="${r.position.frame}"></div>
                  <div class="span-2 form-field"><label class="form-label" for="sy-s-${i}">Strip</label><input class="input" id="sy-s-${i}" inputmode="numeric" data-override-strip="${esc(r.shot.id)}" value="${r.position.strip}"></div>
                </div>` : ''}
            </div>`).join('') || '<p class="empty-state text-sm text-muted">No shots logged on this roll yet.</p>'}
        </section>
        <section class="span-4 stack-1">
          <h2 class="section-label">What gets filled in</h2>
          <div class="field-group">${MAPPING.map(([from, to]) => `<div class="field-row"><span class="field-key">${from}</span><span class="field-value text-sm">→ ${to}</span></div>`).join('')}</div>
          <p class="text-xs text-muted">Focus, exposure, scan files and the lab number stay empty until the roll is developed and scanned. Syncing again only changes what comes from the shot.</p>
        </section>
        <section class="span-4 stack-1 mb-6">
          <p class="text-sm text-edge" role="status" data-status>${esc(state.message)}</p>
          <button class="button button-primary button-block" type="button" data-sync${rows.length ? '' : ' disabled'}>${label}</button>
          ${updating ? `<a class="button button-secondary button-block" href="#/roll/${encodeURIComponent(roll.id)}">Open ${esc(roll.id)} in the archive</a>` : ''}
        </section>`;

      root.querySelectorAll('[data-ref]').forEach((thumb) => {
        const { shot } = rows[Number(thumb.dataset.ref)];
        showPreview(thumb, shot.refThumbBlobId || shot.refPhotoBlobId);
      });
      root.querySelectorAll('[data-first]').forEach((b) => b.addEventListener('click', () => {
        state.first = Math.max(1, state.first + Number(b.dataset.first));
        state.message = '';
        paint();
      }));
      root.querySelectorAll('[data-change]').forEach((b) => b.addEventListener('click', () => {
        state.open = state.open === b.dataset.change ? null : b.dataset.change;
        paint();
      }));
      root.querySelectorAll('[data-override-frame], [data-override-strip]').forEach((input) => input.addEventListener('change', () => {
        const id = input.dataset.overrideFrame || input.dataset.overrideStrip;
        const key = input.dataset.overrideFrame ? 'frame' : 'strip';
        const value = Number(input.value);
        state.overrides[id] = { ...state.overrides[id], [key]: value > 0 ? value : undefined };
        paint();
      }));
      root.querySelector('[data-sync]').addEventListener('click', async (event) => {
        event.currentTarget.disabled = true;
        const { created, updated } = await applySync(db, await db.get('rolls', roll.id), rows, state.first);
        state.message = [created.length && `Created ${created.length} draft${created.length === 1 ? '' : 's'} (${created[0]} … ${created.at(-1)}).`, updated.length && `Updated ${updated.length}.`].filter(Boolean).join(' ');
        paint();
      });
    };
    paint();
  });
  return root;
}

export const syncScreen = { title: 'Sync to archive', pushed: true, render };
