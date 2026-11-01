// Markup for the Meter screen: settings, metering photo, estimate, result, equivalents, zones,
// calibration and the Use / reference buttons. State comes from js/meter-screen.js.

import { LIGHT_EV } from './exposure.js';

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const CAMERA_ICON = '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';

export const signed = (stops) => `${stops < 0 ? '−' : '+'}${Math.abs(stops).toFixed(1)}`;
const thirds = (stops) => {
  const n = Math.round(stops * 3);
  if (!n) return '0';
  const whole = Math.trunc(Math.abs(n) / 3);
  const third = ['', '⅓', '⅔'][Math.abs(n) % 3];
  return `${n < 0 ? '−' : '+'}${whole || !third ? whole : ''}${third}`;
};
const ordinal = (n) => `${n}${(n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;

const stepper = (name, value, label) => `
  <span class="stepper">
    <button class="round-button" type="button" data-step-${name}="-1" aria-label="${label} down">−</button>
    <span class="stepper-value text-mono">${esc(value)}</span>
    <button class="round-button" type="button" data-step-${name}="1" aria-label="${label} up">+</button>
  </span>`;

/** ISO and filter, each with − / +. */
export function settingsHtml({ iso, isoNote, filter, filterStops }) {
  return `
    <section class="span-4 field-group">
      <div class="field-row">
        <span class="stack-0-5"><span>ISO</span><span class="text-xs text-muted">${esc(isoNote)}</span></span>
        ${stepper('iso', iso, 'ISO')}
      </div>
      <div class="field-row">
        <span class="stack-0-5"><span>Filter</span><span class="text-xs text-muted">${esc(filter === 'None' ? 'None on the shot' : `${filter} on the shot`)}</span></span>
        ${stepper('filter', thirds(filterStops), 'Filter stops')}
      </div>
    </section>`;
}

/** Take / Choose buttons, or the photo with the spot ring and readout, plus Average / Spot. */
export function photoHtml({ photo, mode, spot, readout }) {
  const input = `<input type="file" accept="image/*" capture="environment" hidden data-photo-input>
    <input type="file" accept="image/*" hidden data-photo-input data-library>`;
  if (!photo) {
    return `
      <section class="span-4 stack-1">
        ${input}
        <button class="ref-photo-button" type="button" data-take-photo>
          ${CAMERA_ICON}<span class="text-bold">Take metering photo</span>
          <span class="text-xs text-muted">The phone's exposure gives the reading · not saved unless you add it</span>
        </button>
        <button class="button button-secondary button-block" type="button" data-choose-photo>Choose from Photos</button>
      </section>`;
  }
  return `
    <section class="span-4 stack-2">
      ${input}
      <div>
        <button class="meter-photo" type="button" data-photo aria-label="Metering photo. Tap to place the spot.">
          <img class="meter-photo-image" src="${photo.url}" alt="">
          ${mode === 'spot' && spot ? `<span class="meter-spot" style="left: ${spot.x * 100}%; top: ${spot.y * 100}%" aria-hidden="true"></span>` : ''}
        </button>
        <div class="meter-readout text-mono text-sm"><span>${esc(readout.left)}</span><span class="text-edge">${esc(readout.right)}</span></div>
      </div>
      ${photo.exif ? '' : '<p class="text-sm text-edge">This photo has no exposure data. Spots are measured against the estimate below.</p>'}
      <div class="grid grid-inner">
        <div class="span-3 segmented" role="radiogroup" aria-label="Metering" data-mode>
          <button class="segment" type="button" role="radio" data-value="average" aria-checked="${mode === 'average'}" tabindex="${mode === 'average' ? 0 : -1}">Average</button>
          <button class="segment" type="button" role="radio" data-value="spot" aria-checked="${mode === 'spot'}" tabindex="${mode === 'spot' ? 0 : -1}">Spot</button>
        </div>
        <button class="span-1 button button-secondary" type="button" data-take-photo>Retake</button>
      </div>
    </section>`;
}

/** Light chips with their EV, and a typed EV; shown when there's no photo with exposure data. */
export function estimateHtml({ light, typedEv }) {
  return `
    <section class="span-4 stack-1">
      <h2 class="section-label" id="meter-light-label">Estimate · ISO 100</h2>
      <div class="chip-row" data-select="single" role="group" aria-labelledby="meter-light-label" data-light>
        ${Object.entries(LIGHT_EV).map(([name, ev]) => `<button class="chip" type="button" data-value="${esc(name)}" aria-pressed="${name === light && typedEv === undefined}">${esc(name)} <span class="chip-count text-mono">${ev}</span></button>`).join('')}
      </div>
      <div class="grid grid-inner">
        <div class="span-2 form-field">
          <label class="form-label" for="meter-typed">Or type EV</label>
          <input class="input input-mono" id="meter-typed" data-typed type="text" inputmode="decimal" value="${typedEv ?? ''}" placeholder="e.g. 12" autocomplete="off">
        </div>
      </div>
    </section>`;
}

/** EV, lock switch, chips for the locked value, the answer, reciprocity and range notes. */
export function resultHtml({ result, evText, modeText, lock, apertures, shutters, recip, film }) {
  if (!result) {
    return `<section class="span-4 empty-state text-sm text-muted">Take a metering photo, or choose the light below, to get a reading.</section>`;
  }
  const chosen = lock === 'aperture' ? result.aperture : result.shutter;
  const values = lock === 'aperture' ? apertures : shutters;
  return `
    <section class="span-4 card stack-2">
      <div class="results-head"><span class="meter-ev text-mono">EV ${esc(evText)}</span><span class="text-sm text-muted">${esc(modeText)}</span></div>
      <div class="segmented" role="radiogroup" aria-label="Lock" data-lock>
        <button class="segment" type="button" role="radio" data-value="aperture" aria-checked="${lock === 'aperture'}" tabindex="${lock === 'aperture' ? 0 : -1}">Lock aperture</button>
        <button class="segment" type="button" role="radio" data-value="shutter" aria-checked="${lock === 'shutter'}" tabindex="${lock === 'shutter' ? 0 : -1}">Lock shutter</button>
      </div>
      <div class="chip-row" data-select="single" role="group" aria-label="${lock === 'aperture' ? 'Aperture' : 'Shutter'}" data-locked>
        ${values.map((v) => `<button class="chip chip-mono" type="button" data-value="${esc(v)}" aria-pressed="${v === chosen}">${esc(v)}</button>`).join('')}
      </div>
      <div class="stack-0-5">
        <span class="text-xs text-muted">${lock === 'aperture' ? 'Shutter' : 'Aperture'}</span>
        <span class="meter-answer text-mono" data-answer>${esc(lock === 'aperture' ? result.shutter : result.aperture)}</span>
        ${recip ? `<span class="text-sm text-edge">Metered ${esc(recip.metered)} → expose ${esc(result.shutter)} for reciprocity (${esc(film || 'this film')}${recip.approx ? ', approximate' : ''})</span>` : ''}
        ${result.outOfRange === 'under' ? '<span class="text-sm text-edge">Too dark for this lens at that speed: choose a slower shutter.</span>' : ''}
        ${result.outOfRange === 'over' ? '<span class="text-sm text-edge">Too bright at that speed: choose a faster shutter or add ND.</span>' : ''}
      </div>
    </section>`;
}

/** Equivalent aperture · shutter pairs; tapping one locks its aperture. */
export function equivalentsHtml(pairs) {
  if (!pairs.length) return '';
  return `
    <section class="span-4 stack-1">
      <h2 class="section-label">Equivalent</h2>
      <div class="chip-row">
        ${pairs.map((p) => `<button class="chip chip-mono" type="button" data-pair="${esc(p.aperture)}">${esc(p.aperture)} · ${esc(p.shutter)}</button>`).join('')}
      </div>
    </section>`;
}

/** Zone scale with the readings on it, the reading list, Add reading and Reset. */
export function zonesHtml(readings, canAdd, evShown) {
  const base = readings[0];
  const zoneOf = (r) => 5 + (r.ev100 - base.ev100);
  const onCell = (z) => readings.filter((r) => Math.max(0, Math.min(10, Math.round(zoneOf(r)))) === z).map((r) => r.n);
  const cells = ROMAN.map((label, z) => {
    const here = base ? onCell(z) : [];
    return `<span class="zone-cell zone-${z}${here.length ? ' has-reading' : ''}"><span>${label}</span>${here.length ? `<span class="zone-cell-marks">${here.join(' ')}</span>` : ''}</span>`;
  }).join('');
  const rows = readings.map((r) => {
    const z = zoneOf(r);
    const name = z < -0.5 ? 'below 0' : z > 10.5 ? 'above X' : ROMAN[Math.round(z)];
    return `<div class="field-row"><span>${ordinal(r.n)} reading${r.clipped ? ' <span class="text-xs text-edge">beyond the photo’s range</span>' : ''}</span><span class="text-mono text-sm"><span class="text-muted">EV ${evShown(r.ev100).toFixed(1)}</span> ${name} (${signed(z - 5)})</span></div>`;
  }).join('');
  return `
    <section class="span-4 stack-1">
      <h2 class="section-label">Zones · first reading on V</h2>
      <div class="zone-scale" aria-hidden="true">${cells}</div>
      ${rows ? `<div class="field-group">${rows}</div>` : '<p class="text-sm text-muted">Add readings of different parts of the scene to see where they fall.</p>'}
      <div class="grid grid-inner">
        <button class="span-2 button button-secondary" type="button" data-add-reading${canAdd ? '' : ' disabled'}>Add reading</button>
        <button class="span-2 button button-secondary" type="button" data-reset${readings.length ? '' : ' disabled'}>Reset</button>
      </div>
    </section>`;
}

/** Calibration offset in ⅓ stops (positive = more exposure). */
export function calibrationHtml(calibration) {
  return `
    <section class="span-4 field-group">
      <div class="field-row">
        <span class="stack-0-5"><span>Calibration</span><span class="text-xs text-muted">+ gives more exposure</span></span>
        ${stepper('calibration', thirds(calibration), 'Calibration')}
      </div>
    </section>`;
}

/** Add as reference photo (after a photo, with a roll), Use (with a roll). */
export function footerHtml({ hasRoll, hasPhoto, addRef, result }) {
  return `
    <section class="span-4 stack-1 mb-6">
      <p class="text-sm text-edge" role="status" data-status></p>
      ${hasRoll && hasPhoto ? `<button class="button button-secondary button-block" type="button" data-add-ref aria-pressed="${addRef}">${addRef ? 'Added as reference photo · Undo' : 'Add as reference photo'}</button>` : ''}
      ${hasRoll ? `<button class="button button-primary button-block" type="button" data-use${result ? '' : ' disabled'}>${result ? `Use ${esc(result.aperture)} · ${esc(result.shutter)}` : 'Use'}</button>` : ''}
    </section>`;
}
