// Markup and value reading for the Add / edit form. Every spreadsheet column has a field.
// Controls follow js/controls.js: chips (aria-pressed), segmented (role=radio), switches.

import { CATEGORIES, EXPOSURE, FOCUS, TRI } from './schema.js';

import { filmFieldHtml } from './film-field.js';
import { NEW_OPTION } from './gear.js';

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const input = (field, label, value, { mono = false, placeholder = '', mode = 'text', span = 'span-4' } = {}) => `
  <div class="${span} form-field">
    <label class="form-label" for="nf-${field}">${label}</label>
    <input class="input${mono ? ' input-mono' : ''}" id="nf-${field}" data-field="${field}" type="text" inputmode="${mode}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off">
  </div>`;

const select = (field, label, options, value, { addNew = false, span = 'span-4' } = {}) => `
  <div class="${span} form-field">
    <label class="form-label" for="nf-${field}">${label}</label>
    <div class="select"><select class="input" id="nf-${field}" data-field="${field}">
      <option value="">Choose…</option>
      ${options.map(([v, text]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(text)}</option>`).join('')}
      ${addNew ? `<option value="${NEW_OPTION}">Add new…</option>` : ''}
    </select></div>
  </div>`;

// Nothing is checked when the value is empty; the first segment then takes keyboard focus.
const segmented = (field, label, options, value, span = 'span-4') => {
  const hasValue = options.some(([v]) => v === value);
  return `
  <div class="${span} form-field">
    <span class="form-label" id="nf-${field}-label">${label}</span>
    <div class="segmented" role="radiogroup" aria-labelledby="nf-${field}-label" data-field="${field}">
      ${options.map(([v, text], i) => {
        const checked = v === value;
        return `<button class="segment" type="button" role="radio" data-value="${esc(v)}" aria-checked="${checked}" tabindex="${checked || (!hasValue && i === 0) ? 0 : -1}">${esc(text)}</button>`;
      }).join('')}
    </div>
  </div>`;
};

const chips = (field, label, options, value, mono = false) => `
  <div class="span-4 form-field">
    <span class="form-label" id="nf-${field}-label">${label}</span>
    <div class="chip-row" data-select="single" role="group" aria-labelledby="nf-${field}-label" data-field="${field}">
      ${options.map(([v, text]) => `<button class="chip${mono ? ' chip-mono' : ''}" type="button" data-value="${esc(v)}" aria-pressed="${v === value}">${esc(text)}</button>`).join('')}
    </div>
  </div>`;

const switchRow = (field, label, checked) => `
  <div class="span-4 field-group">
    <label class="field-row" for="nf-${field}">
      <span class="field-key">${label}</span>
      <button class="switch" id="nf-${field}" data-field="${field}" type="button" role="switch" aria-checked="${Boolean(checked)}"></button>
    </label>
  </div>`;

const attach = (field, label, span) => `
  <div class="${span}">
    <button class="button button-secondary button-block" type="button" data-attach="${field}">${label}</button>
    <input type="file" accept="image/*" hidden data-file="${field}">
  </div>`;

const section = (title, body, note = '') => `
  <section class="span-4 stack-1">
    <h2 class="section-label">${title}${note ? ` <span class="form-section-note">${note}</span>` : ''}</h2>
    <div class="grid grid-inner">${body}</div>
  </section>`;

/** The whole form. v = current values; lists = { rolls, cameras, lenses, films } as [value, text] pairs. */
export function formHtml(v, lists, mode) {
  const categories = [...CATEGORIES, ...(v.category && !CATEGORIES.includes(v.category) ? [v.category] : [])];
  return `
    ${section('Roll &amp; position', `
      ${select('rollId', 'Roll', lists.rolls, v.rollId)}
      ${input('strip', 'Strip #', v.strip, { mode: 'numeric', span: 'span-2' })}
      ${input('frameLabel', 'Frame #', v.frameLabel, { mode: 'numeric', span: 'span-2', placeholder: 'e.g. 6 or 3-4' })}`)}
    ${section('Picture', `
      ${chips('category', 'Category', categories.map((c) => [c, c]), v.category)}
      ${input('subject', 'Subject / description', v.subject)}
      ${input('dateTaken', 'Date taken', v.dateTaken, { span: 'span-2', placeholder: 'e.g. 2026-08', mode: 'numeric' })}
      ${input('location', 'Location', v.location, { span: 'span-2', placeholder: 'e.g. Berlin, Germany' })}`)}
    ${section('Gear', `
      ${select('cameraId', 'Camera', lists.cameras, v.cameraId, { addNew: true })}
      ${select('lensId', 'Lens', lists.lenses, v.lensId, { addNew: true })}
      ${filmFieldHtml(v.filmStock, lists.yourStocks)}`, mode === 'add' ? 'carried over from roll' : '')}
    ${section('Scan', `
      ${switchRow('digitized', 'Digitized', v.digitized)}
      ${segmented('scanSize', 'Scan size', [['L', 'Large'], ['S', 'Small']], v.scanSize, 'span-2')}
      <div class="span-2 form-field">
        <span class="form-label" aria-hidden="true">Scan image</span>
        ${attach('scan', v.scanBlobId ? 'Replace scan' : 'Attach scan', '')}
      </div>
      ${input('scanFile', 'Scan file', v.scanFile, { mono: true, placeholder: 'e.g. R1-09401-0004.TIF' })}`)}
    ${section('Review', `
      ${segmented('focus', 'Focus', FOCUS.map((f) => [f, f]), v.focus)}
      ${segmented('exposure', 'Exposure', EXPOSURE.map((e) => [e, e]), v.exposure)}
      <div class="span-4 form-field">
        <label class="form-label" for="nf-notes">Notes</label>
        <textarea class="input textarea" id="nf-notes" data-field="notes">${esc(v.notes)}</textarea>
      </div>`)}
    ${section('Next steps', `
      ${segmented('action', 'Action', [['None', 'None'], ['Edit', 'Edit']], v.action)}
      ${switchRow('actionComplete', 'Edit done', v.actionComplete)}
      ${input('editedFile', 'Edited file', v.editedFile, { mono: true, placeholder: 'e.g. R1-00466-0004EDT01.jpg' })}
      ${attach('edit', v.editBlobId ? 'Replace edit' : 'Attach edit', 'span-4')}
      ${chips('rating', 'Rating', [['', '–'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']], v.rating ? String(v.rating) : '', true)}
      ${segmented('social', 'Social', TRI.map((t) => [t, t]), v.social)}
      ${segmented('print', 'Print', TRI.map((t) => [t, t]), v.print)}
      ${switchRow('printed', 'Printed', v.printed)}`)}
    ${section('Storage', input('storageLocation', 'Storage location', v.storageLocation, { placeholder: 'e.g. Box 2 / binder A / page 4' }))}
    <section class="span-4 stack-1 mb-6">
      <p class="text-sm text-edge" role="status" data-form-status></p>
      <button class="button button-secondary button-block" type="button" data-save>Save</button>
      ${mode === 'add' ? '<button class="button button-primary button-block" type="button" data-save-next>Save &amp; next frame →</button>' : ''}
    </section>`;
}

/** Reads every field into a plain object (strings, booleans; empty → undefined). */
export function readForm(root) {
  const values = {};
  root.querySelectorAll('input[data-field], select[data-field], textarea[data-field]').forEach((node) => {
    values[node.dataset.field] = node.value.trim() || undefined;
  });
  root.querySelectorAll('.segmented[data-field], .chip-row[data-field]').forEach((group) => {
    const on = group.querySelector('[aria-checked="true"], [aria-pressed="true"]');
    values[group.dataset.field] = on?.dataset.value || undefined;
  });
  root.querySelectorAll('.switch[data-field]').forEach((node) => {
    values[node.dataset.field] = node.getAttribute('aria-checked') === 'true';
  });
  return values;
}
