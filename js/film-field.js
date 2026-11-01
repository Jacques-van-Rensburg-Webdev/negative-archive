// Film field for forms: the chosen stock with Change, which opens the film picker.
// The value lives in a hidden data-field="filmStock" input, so form readers pick it up as usual.

import { allStocks, stockDetails } from './film-catalogue.js';
import { createFilmPicker } from './film-picker.js';

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Markup for the field. yourStocks: filmStocks store items (for the details line). */
export function filmFieldHtml(value, yourStocks, label = 'Film') {
  const stock = allStocks(yourStocks).find((s) => s.name === value);
  return `
    <div class="span-4 form-field" data-film-field>
      <span class="form-label">${label}</span>
      <div class="field-group">
        <div class="field-row field-row-2">
          <span class="stack-0-5">
            <span class="text-bold" data-film-name>${esc(value || 'Choose a film stock')}</span>
            <span class="text-xs text-muted" data-film-details>${esc(stock ? stockDetails(stock) : '')}</span>
          </span>
          <button class="button button-sm" type="button" data-film-toggle aria-expanded="false">Change</button>
        </div>
      </div>
      <input type="hidden" data-field="filmStock" value="${esc(value)}">
      <div data-film-picker hidden></div>
    </div>`;
}

/**
 * Wires the field inside root. getFormat() gives '35mm' or '120' for the picker.
 * onAdd(stock) saves a bespoke stock; yourStocks is updated by the caller.
 */
export function wireFilmField(root, { yourStocks, getFormat, onAdd }) {
  const field = root.querySelector('[data-film-field]');
  if (!field) return;
  const toggle = field.querySelector('[data-film-toggle]');
  const holder = field.querySelector('[data-film-picker]');
  const input = field.querySelector('[data-field="filmStock"]');

  const close = () => {
    holder.hidden = true;
    holder.replaceChildren();
    toggle.textContent = 'Change';
    toggle.setAttribute('aria-expanded', 'false');
  };

  toggle.addEventListener('click', () => {
    if (!holder.hidden) { close(); return; }
    const picker = createFilmPicker({
      yourStocks,
      format: getFormat(),
      onAdd,
      onPick: (stock) => {
        input.value = stock.name;
        field.querySelector('[data-film-name]').textContent = stock.name;
        field.querySelector('[data-film-details]').textContent = stockDetails(stock);
        close();
        toggle.focus();
      },
    });
    holder.append(picker.element);
    holder.hidden = false;
    toggle.textContent = 'Close';
    toggle.setAttribute('aria-expanded', 'true');
    picker.focus();
  });
}
