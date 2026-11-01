// Markup and value reading for the Shoot tab's logging form and shot list.

import { SHUTTER_CHIPS, exposureRowHtml, withValue } from './shoot-exposure.js';
import { LIGHT, FILTERS, LIGHTING_ROLES, SHOT_TYPES, lightingText } from './shots.js';

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CAMERA_ICON = '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';

const chipGroup = (field, label, values, selected, { multi = false, mono = false } = {}) => `
  <div class="stack-1">
    <span class="form-label" id="sh-${field}-label">${label}</span>
    <div class="chip-row" ${multi ? '' : 'data-select="single"'} role="group" aria-labelledby="sh-${field}-label" data-field="${field}"${multi ? ' data-multi' : ''}>
      ${values.map((v) => `<button class="chip${mono ? ' chip-mono' : ''}" type="button" data-value="${esc(v)}" aria-pressed="${multi ? selected.includes(v) : v === selected}">${esc(v)}</button>`).join('')}
      ${multi ? '<button class="chip chip-plain" type="button" data-add-item>+ Add item</button>' : ''}
    </div>
  </div>`;

const time = (iso) => new Date(iso).toTimeString().slice(0, 5);

/** No roll loaded: explanation and Load a new roll. */
export function emptyStateHtml() {
  return `
    <section class="span-4 stack-2">
      <div class="empty-state stack-1">
        <span class="text-bold">No roll in the camera</span>
        <span class="text-sm text-muted">Load a roll to start logging shots. Everything is saved on this phone, also offline.</span>
      </div>
      <a class="button button-primary button-block" href="#/shoot/load">Load a new roll</a>
      <a class="button button-secondary button-block" href="#/shoot/meter">Use the meter</a>
    </section>`;
}

/** The roll in the camera (→ its Roll screen). */
export function rollCardHtml(roll, cameras) {
  const loaded = roll.loadedAt ? new Date(roll.loadedAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const iso = roll.shotIso && roll.shotIso !== roll.boxIso ? `ISO ${roll.shotIso} (box ${roll.boxIso})` : `ISO ${roll.boxIso || '–'}`;
  return `
    <a class="span-4 roll-card" href="#/roll/${encodeURIComponent(roll.id)}">
      <span class="roll-card-head">
        <span class="roll-card-id">${roll.id}</span>
        <span class="roll-card-text"><span class="text-bold">${roll.filmStock} · ${iso}</span><span class="text-xs text-muted">${cameras.get(roll.cameraId) || ''} · loaded ${loaded}</span></span>
        <span class="text-xs text-muted">Saved on phone</span>
      </span>
    </a>`;
}

/** The counter, lens, settings, lighting, place, note, photo and buttons. */
export function shootFormHtml({ roll, form, lenses, lensName, apertures, items, editing, refUrl, done }) {
  const isDefaultLens = form.lensId === roll.defaultLensId;
  const lit = form.lighting.on;
  return `
    <section class="span-4 grid grid-inner shot-counter" aria-label="Shot number">
      <button class="span-1 round-button" type="button" data-step="-1" aria-label="One shot back">−</button>
      <div class="span-2 shot-counter-value">
        <span class="text-xs text-muted">${editing ? 'Editing shot' : 'Shot'}</span>
        <span class="shot-number text-mono" data-shot-number>${form.shotNumber}</span>
        <span class="text-xs text-muted">of ${roll.exposures} · ${time(new Date().toISOString())}${form.place ? ` · ${esc(form.place)}` : ''}</span>
      </div>
      <button class="span-1 round-button" type="button" data-step="1" aria-label="One shot on">+</button>
    </section>

    <section class="span-4 stack-1">
      <div class="field-group">
        <div class="field-row">
          <div class="stack-0-5"><span class="field-key">Lens</span><span class="text-bold">${esc(lensName)} <span class="text-xs text-muted">${isDefaultLens ? 'default' : 'this shot only'}</span></span></div>
          <button class="button button-sm" type="button" data-lens-toggle aria-expanded="false">Change</button>
        </div>
      </div>
      <div class="card stack-2" data-lens-panel hidden>
        <div class="chip-row" data-select="single" data-field="lensId" role="group" aria-label="Lens for this shot">
          ${lenses.map((l) => `<button class="chip" type="button" data-value="${esc(l.id)}" aria-pressed="${l.id === form.lensId}">${esc(l.name)}</button>`).join('')}
        </div>
        <div class="grid grid-inner">
          <button class="span-2 button button-secondary" type="button" data-add-lens>Add a lens</button>
          <button class="span-2 button button-secondary" type="button" data-make-default${isDefaultLens ? ' disabled' : ''}>Make default</button>
        </div>
        <p class="text-xs text-muted">Applies to this shot. The next shot goes back to the default unless you make this the default.</p>
      </div>
    </section>

    <section class="span-4 stack-3">
      ${exposureRowHtml(form)}
      ${chipGroup('aperture', 'Aperture', withValue(apertures, form.aperture), form.aperture, { mono: true })}
      ${chipGroup('shutter', 'Shutter', withValue(SHUTTER_CHIPS, form.shutter), form.shutter, { mono: true })}
      ${chipGroup('light', 'Light', LIGHT, form.light)}
      ${chipGroup('filter', 'Filter', FILTERS, form.filter)}
      ${chipGroup('category', 'Type', SHOT_TYPES, form.category)}
    </section>

    <section class="span-4 stack-1">
      <h2 class="section-label">Lighting used</h2>
      <div class="field-group">
        <label class="field-row" for="sh-lit">
          <span class="stack-0-5"><span>Added lighting</span><span class="text-xs text-muted">${lit ? esc(lightingText(form.lighting) || 'Choose what you used') : 'Off: natural / available light only'}</span></span>
          <button class="switch" id="sh-lit" type="button" role="switch" data-field="lightingOn" aria-checked="${lit}"></button>
        </label>
      </div>
      <div class="card stack-3" data-lighting${lit ? '' : ' hidden'}>
        ${chipGroup('items', 'What was used · pick any', items.map((i) => i.name), form.lighting.items, { multi: true })}
        ${chipGroup('role', 'Role', LIGHTING_ROLES, form.lighting.role)}
        <div class="form-field">
          <label class="form-label" for="sh-setup">Setup</label>
          <input class="input" id="sh-setup" data-field="setup" value="${esc(form.lighting.setup)}" placeholder="e.g. silver reflector camera left, below chin">
        </div>
        <p class="text-xs text-muted">Stays on for the next shots until you switch it off.</p>
      </div>
    </section>

    <section class="span-4 stack-2">
      <div class="form-field">
        <label class="form-label" for="sh-place">Place</label>
        <input class="input" id="sh-place" data-field="place" value="${esc(form.place)}" placeholder="e.g. Alexanderplatz, Berlin" autocomplete="off">
      </div>
      <div class="form-field">
        <label class="form-label" for="sh-note">Quick note</label>
        <textarea class="input textarea" id="sh-note" data-field="note">${esc(form.note)}</textarea>
      </div>
    </section>

    <section class="span-4 stack-1">
      <h2 class="section-label">Reference photo</h2>
      <input type="file" accept="image/*" capture="environment" hidden data-ref-input>
      ${refUrl ? `
        <div class="grid grid-inner">
          <span class="span-2 thumbnail" style="background-image: url('${refUrl}')" role="img" aria-label="Reference photo"></span>
          <div class="span-2 stack-1">
            <span class="text-bold">Reference attached</span>
            <button class="button button-sm" type="button" data-ref>Retake</button>
          </div>
        </div>` : `
        <button class="ref-photo-button" type="button" data-ref>
          ${CAMERA_ICON}<span class="text-bold">Take reference photo</span>
          <span class="text-xs text-muted">Uses the phone camera · stays with this shot</span>
        </button>`}
    </section>

    <section class="span-4 stack-1">
      <p class="text-sm text-edge" role="status" data-status></p>
      ${editing ? `
        <button class="button button-primary button-block" type="button" data-save-shot>Save changes to shot ${form.shotNumber}</button>
        <div class="grid grid-inner">
          <button class="span-2 button button-secondary" type="button" data-delete-shot>Delete shot</button>
          <button class="span-2 button button-secondary" type="button" data-cancel-edit>Cancel</button>
        </div>` : `<button class="button button-primary button-block" type="button" data-log>Log shot ${form.shotNumber}</button>`}
      ${done && !editing ? `
        <div class="card stack-1">
          <span class="text-bold">Roll finished — unload?</span>
          <span class="text-sm text-muted">All ${roll.exposures} exposures are logged. Unloading marks the roll as at the lab.</span>
          <button class="button button-secondary button-block" type="button" data-unload>Unload roll</button>
        </div>` : ''}
    </section>`;
}

/** "This roll" list, newest first. Each row is a button that loads the shot into the form. */
export function shotListHtml(shots, lensNames) {
  const rows = [...shots].reverse().map((s) => {
    const line1 = [lensNames.get(s.lensId), s.aperture, s.shutter, s.light, s.filter && s.filter !== 'None' ? `${s.filter} filter` : ''].filter(Boolean).join(' · ');
    const line2 = s.lighting ? lightingText(s.lighting) : 'Natural light';
    return `
      <button class="grid grid-inner list-row shot-row" type="button" data-shot="${esc(s.id)}" aria-label="Shot ${s.shotNumber}, change">
        <span class="span-1 shot-row-number text-mono">${s.shotNumber}</span>
        <span class="span-3 stack-0-5">
          <span class="text-sm text-bold">${esc(line1 || '—')}</span>
          <span class="text-xs text-muted">${esc(line2)}</span>
          ${s.note ? `<span class="text-sm text-edge list-row-note">${esc(s.note)}</span>` : ''}
          <span class="text-xs text-muted">${time(s.takenAt)}${s.placeName ? ` · ${esc(s.placeName)}` : ''}${s.refPhotoBlobId ? ' · ref photo' : ''}${s.syncedNegativeId ? ` · in archive as ${esc(s.syncedNegativeId)}` : ''}</span>
        </span>
      </button>`;
  });
  return `
    <section class="span-4 stack-1 mb-6">
      <h2 class="section-label">This roll · ${shots.length} logged</h2>
      ${rows.length ? `<div>${rows.join('')}</div>` : '<p class="empty-state text-sm text-muted">No shots logged yet.</p>'}
    </section>`;
}

/** Reads the form: single chips → value, multi chips → list, switches → boolean. */
export function readShootForm(root) {
  const value = (field) => root.querySelector(`[data-field="${field}"]`)?.value.trim() || undefined;
  const single = (field) => root.querySelector(`[data-field="${field}"] [aria-pressed="true"]`)?.dataset.value;
  const items = [...root.querySelectorAll('[data-field="items"] [aria-pressed="true"]')].map((b) => b.dataset.value);
  const on = root.querySelector('[data-field="lightingOn"]').getAttribute('aria-checked') === 'true';
  return {
    lensId: single('lensId'),
    aperture: single('aperture'),
    shutter: single('shutter'),
    light: single('light'),
    filter: single('filter'),
    category: single('category'),
    lighting: { on, items, role: single('role'), setup: value('setup') },
    place: value('place'),
    note: value('note'),
  };
}
