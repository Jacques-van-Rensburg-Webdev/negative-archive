// #/shoot/load: load a new roll into a camera. Format (35mm / 120 with frame size), film stock
// from a searchable list or a bespoke one, ISO (box and shot at), camera and default lens.
// Suggests the next free roll number. One roll per camera at a time.

import { getDb } from './db.js';
import { createFilmPicker } from './film-picker.js';
import { allStocks, stockDetails } from './film-catalogue.js';
import { FRAME_SIZES, exposureChoices } from './formats.js';
import { NEW_OPTION, promptNewGear, saveGear } from './gear.js';
import { loadRoll, nextRollId } from './shots.js';

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const options = (pairs, selected) => pairs.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(selected) ? ' selected' : ''}>${esc(t)}</option>`).join('');
const segmented = (name, label, pairs, current) => `
  <div class="segmented" role="radiogroup" aria-label="${label}" data-choice="${name}">
    ${pairs.map(([v, t]) => `<button class="segment" type="button" role="radio" data-value="${v}" aria-checked="${v === current}" tabindex="${v === current ? 0 : -1}">${t}</button>`).join('')}
  </div>`;

function formHtml(data, v) {
  const now = new Date();
  const loaded = `${now.toISOString().slice(0, 10)} · ${now.toTimeString().slice(0, 5)}`;
  const stock = data.stocks.find((s) => s.name === v.filmStock);
  return `
    <section class="span-4 stack-1">
      <h2 class="section-label">Roll</h2>
      <div class="grid grid-inner">
        <div class="span-2 form-field">
          <label class="form-label" for="rl-id">Roll number</label>
          <input class="input input-mono" id="rl-id" data-field="id" value="${esc(v.id)}" autocomplete="off">
        </div>
        <div class="span-2 form-field">
          <label class="form-label" for="rl-exposures">Exposures</label>
          <div class="select"><select class="input" id="rl-exposures" data-field="exposures">${options(exposureChoices(v.format, v.frameSize).map((n) => [n, n]), v.exposures)}</select></div>
        </div>
        <p class="span-4 text-xs text-muted">Next free number after ${esc(data.lastId || '—')}. Colour and slide rolls end in C and get colour IDs (2026-C…). The lab number is added later.</p>
      </div>
    </section>
    <section class="span-4 stack-2">
      <h2 class="section-label">Film</h2>
      ${segmented('format', 'Format', [['35mm', '35mm'], ['120', 'Medium format (120)']], v.format)}
      ${v.format === '120' ? segmented('frameSize', 'Frame size', Object.entries(FRAME_SIZES).map(([k, s]) => [k, s.label]), v.frameSize) : ''}
      <div class="field-group">
        <div class="field-row field-row-2">
          <span class="stack-0-5">
            <span class="field-key">Film stock</span>
            <span class="text-bold">${esc(v.filmStock || 'Choose a film stock')}</span>
            ${stock ? `<span class="text-xs text-muted">${esc(stockDetails(stock))}</span>` : ''}
          </span>
          <button class="button button-sm" type="button" data-toggle-picker aria-expanded="${v.pickerOpen}">${v.pickerOpen ? 'Close' : 'Change'}</button>
        </div>
      </div>
      <div data-picker${v.pickerOpen ? '' : ' hidden'}></div>
      <div class="grid grid-inner">
        <div class="span-2 form-field">
          <label class="form-label" for="rl-box">Box ISO</label>
          <input class="input" id="rl-box" data-field="boxIso" inputmode="numeric" value="${esc(v.boxIso)}">
        </div>
        <div class="span-2 form-field">
          <label class="form-label" for="rl-shot">Shot at ISO</label>
          <input class="input" id="rl-shot" data-field="shotIso" inputmode="numeric" value="${esc(v.shotIso)}">
        </div>
        <p class="span-4 text-xs text-muted">Change "Shot at" if you push or pull the roll. It goes into the notes for the lab.</p>
      </div>
      <span class="form-label">Process (sets the ID series)</span>
      ${segmented('process', 'Process', [['bw', 'B&amp;W'], ['colour', 'Colour / slide']], v.process)}
    </section>
    <section class="span-4 stack-1">
      <h2 class="section-label">Gear</h2>
      <div class="grid grid-inner">
        <div class="span-4 form-field">
          <label class="form-label" for="rl-camera">Camera</label>
          <div class="select"><select class="input" id="rl-camera" data-field="cameraId" data-kind="camera">
            <option value="">Choose…</option>${options(data.cameras.map((c) => [c.id, c.name]), v.cameraId)}<option value="${NEW_OPTION}">Add camera…</option>
          </select></div>
        </div>
        <div class="span-4 form-field">
          <label class="form-label" for="rl-lens">Default lens</label>
          <div class="select"><select class="input" id="rl-lens" data-field="defaultLensId" data-kind="lens">
            <option value="">Choose…</option>${options(data.lenses.map((l) => [l.id, l.name]), v.defaultLensId)}<option value="${NEW_OPTION}">Add lens…</option>
          </select></div>
        </div>
        <p class="span-4 text-xs text-muted">You can switch lens on any single shot.</p>
      </div>
    </section>
    <section class="span-4 stack-1">
      <h2 class="section-label">Logged automatically</h2>
      <div class="field-group">
        <div class="field-row"><span class="field-key">Date &amp; time</span><span class="field-value text-mono">${loaded}</span></div>
        <label class="field-row" for="rl-location">
          <span class="field-key">Location per shot (GPS)</span>
          <button class="switch" id="rl-location" data-field="locationPerShot" type="button" role="switch" aria-checked="${v.locationPerShot}"></button>
        </label>
      </div>
    </section>
    <section class="span-4 stack-1 mb-6">
      <p class="text-sm text-edge" role="status" data-status></p>
      <button class="button button-primary button-block" type="button" data-load>Load roll &amp; start shooting</button>
    </section>`;
}

function render() {
  const root = document.createElement('div');
  root.className = 'grid grid-sections';
  const added = [];

  getDb().then(async (db) => {
    const [rolls, cameras, lenses, films] = await Promise.all(['rolls', 'cameras', 'lenses', 'filmStocks'].map((s) => db.getAll(s)));
    const data = { cameras, lenses, stocks: allStocks(films), lastId: rolls.filter((r) => !/C$/.test(r.id)).map((r) => r.id).sort().at(-1) };
    const last = rolls.filter((r) => r.loadedAt).sort((a, b) => b.loadedAt.localeCompare(a.loadedAt))[0];
    const firstStock = data.stocks.find((s) => s.name === last?.filmStock) || data.stocks.find((s) => s.yours) || data.stocks[0];
    const isColour = (s) => s && s.process !== 'bw';
    let v = {
      id: nextRollId(rolls, isColour(firstStock)), format: last?.format || '35mm', frameSize: last?.frameSize || '6x6', exposures: 36,
      filmStock: firstStock?.name || '', boxIso: firstStock?.iso || '', shotIso: firstStock?.iso || '', process: isColour(firstStock) ? 'colour' : 'bw',
      cameraId: last?.cameraId || cameras[0]?.id, defaultLensId: last?.defaultLensId || lenses[0]?.id, locationPerShot: true, pickerOpen: false,
    };
    v.exposures = exposureChoices(v.format, v.frameSize)[0];

    // Reads what's on screen into v (so a repaint keeps typed values)
    const keep = () => {
      const value = (field) => root.querySelector(`[data-field="${field}"]`)?.value.trim();
      v = {
        ...v,
        id: value('id').toUpperCase(), exposures: Number(value('exposures')), boxIso: value('boxIso'), shotIso: value('shotIso'),
        cameraId: value('cameraId'), defaultLensId: value('defaultLensId'),
        locationPerShot: root.querySelector('[data-field="locationPerShot"]').getAttribute('aria-checked') === 'true',
      };
    };

    let picker;
    const paint = () => {
      root.innerHTML = formHtml(data, v);
      picker = createFilmPicker({
        yourStocks: films,
        format: v.format,
        onAdd: async (stock) => {
          await db.put('filmStocks', stock);
          films.unshift(stock);
          data.stocks = allStocks(films);
        },
        onPick: (stock) => {
          keep();
          const wasColour = v.process === 'colour';
          v = { ...v, filmStock: stock.name, boxIso: stock.iso || '', shotIso: stock.iso || '', process: isColour(stock) ? 'colour' : 'bw', pickerOpen: false };
          if (wasColour !== (v.process === 'colour')) v.id = nextRollId(rolls, v.process === 'colour');
          paint();
        },
      });
      root.querySelector('[data-picker]').append(picker.element);
      wire();
    };

    const wire = () => {
      root.querySelector('[data-toggle-picker]').addEventListener('click', () => {
        keep();
        v.pickerOpen = !v.pickerOpen;
        paint();
        if (v.pickerOpen) picker.focus();
      });
      root.querySelectorAll('[data-choice]').forEach((group) => group.addEventListener('change', (event) => {
        keep();
        const name = group.dataset.choice;
        v[name] = event.target.dataset.value;
        if (name === 'format' || name === 'frameSize') v.exposures = exposureChoices(v.format, v.frameSize)[0];
        if (name === 'process') v.id = nextRollId(rolls, v.process === 'colour');
        paint();
      }));
      root.querySelectorAll('select[data-kind]').forEach((select) => {
        select.dataset.previous = select.value;
        select.addEventListener('change', () => {
          if (select.value === NEW_OPTION) {
            const result = promptNewGear(select, select.dataset.kind);
            if (result) added.push(result);
          }
          select.dataset.previous = select.value;
        });
      });
      root.querySelector('[data-load]').addEventListener('click', load);
    };

    async function load() {
      keep();
      const say = (text) => { root.querySelector('[data-status]').textContent = text; };
      if (!/^R\d{3,}C?$/.test(v.id)) { say('Roll number like R007 (or R002C for colour).'); return; }
      if (!v.filmStock || !v.cameraId) { say('Choose a film stock and a camera.'); return; }
      const colour = v.process === 'colour';
      if (colour !== v.id.endsWith('C')) { say(colour ? 'Colour rolls end in C (e.g. R002C).' : 'B&W roll numbers don\'t end in C.'); return; }
      try {
        await saveGear(db, added);
        const roll = await loadRoll(db, {
          id: v.id, exposures: v.exposures, process: v.process, format: v.format, frameSize: v.format === '120' ? v.frameSize : undefined,
          filmStock: v.filmStock, boxIso: Number(v.boxIso) || undefined, shotIso: Number(v.shotIso) || Number(v.boxIso) || undefined,
          cameraId: v.cameraId, defaultLensId: v.defaultLensId, locationPerShot: v.locationPerShot,
        });
        window.location.replace(`#/shoot?roll=${encodeURIComponent(roll.id)}`);
      } catch (error) {
        say(error.message);
      }
    }

    paint();
  });
  return root;
}

export const rollLoadScreen = { title: 'Load a new roll', pushed: true, render };
