// Shoot ↔ Meter: shutter chips, the Exposure row, and bringing the form and a reading back
// from the Meter screen (js/shoot-draft.js keeps them while it's open).

import { takeDraft, takeReading } from './shoot-draft.js';

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const SHUTTER_CHIPS = ['1/1000', '1/500', '1/250', '1/125', '1/60', '1/30', '1/15', '1/8', '1/4', '1/2', '1"', 'B'];

/** A chip list with the current value added when it isn't one of them (e.g. f/9 from the meter). */
export const withValue = (values, value) => (value && !values.includes(value) ? [...values, value] : values);

/** "Exposure: f/8 · 1/125 · EV 12.3 spot" and the Meter button. */
export function exposureRowHtml(form) {
  const settings = [form.aperture, form.shutter].filter(Boolean).join(' · ');
  const metered = form.meter ? `EV ${form.meter.ev.toFixed(1)} · ${form.meter.mode.toLowerCase()}` : 'not metered';
  return `
    <div class="field-group">
      <div class="field-row">
        <div class="stack-0-5"><span class="field-key">Exposure</span><span class="text-bold text-mono">${esc(settings || '—')} <span class="text-xs text-muted">${esc(metered)}</span></span></div>
        <button class="button button-sm" type="button" data-meter>Meter</button>
      </div>
    </div>`;
}

/** The form as it was before opening the Meter: { form, pendingRef, editing }, or null. */
export function restoreDraft(rollId, shots) {
  const draft = takeDraft(rollId);
  if (!draft) return null;
  const editing = draft.editingId ? shots.find((s) => s.id === draft.editingId) || null : null;
  return { form: draft.form, pendingRef: draft.pendingRef, editing };
}

/** A reading from the Meter applied to the form: { form, refFile?, message }, or null. */
export function applyReading(rollId, form) {
  const reading = takeReading(rollId);
  if (!reading) return null;
  return {
    form: { ...form, aperture: reading.aperture, shutter: reading.shutter, meter: reading.meter },
    refFile: reading.refFile,
    message: `Metered: ${reading.aperture} · ${reading.shutter} (EV ${reading.meter.ev.toFixed(1)}).${reading.refFile ? ' Metering photo added as reference.' : ''}`,
  };
}
