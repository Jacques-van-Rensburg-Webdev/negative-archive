// Add tab (#/add, #/add?roll=R005) and edit (#/negative/ID/edit): one form for every column.
// Add carries gear, date and location over from the roll; Save & next frame keeps them,
// moves the frame (and the strip after 6 frames) on, and opens the next ID.

import { getDb } from './db.js';
import { removeImages, saveImage } from './files.js';
import { wireFilmField } from './film-field.js';
import { addNegative, idYear, previewNextId, seriesForRoll } from './ids.js';
import { NEW_OPTION, promptNewGear } from './gear.js';
import { formHtml, readForm } from './negative-form-fields.js';
import { buildLists, carryOver, loadForm, toFields, validate } from './negative-form-values.js';
import { newNegative } from './schema.js';

function render(ctx) {
  const mode = ctx.params.id ? 'edit' : 'add';
  const root = document.createElement('div');
  root.className = 'grid grid-sections';
  let db;
  let data;
  let existing;
  let pending = {};
  const extra = { cameras: [], lenses: [], films: [], values: {} };

  const field = (name) => root.querySelector(`[data-field="${name}"]`);
  const say = (text) => { root.querySelector('[data-form-status]').textContent = text; };

  const showId = async () => {
    const label = document.createElement('span');
    label.className = 'text-sm text-mono text-muted';
    if (mode === 'edit') {
      label.textContent = existing.id;
    } else {
      const roll = data.rolls.find((r) => r.id === field('rollId').value);
      label.textContent = roll ? await previewNextId(db, idYear(field('dateTaken').value), seriesForRoll(roll)) : '';
    }
    ctx.setActions([label]);
  };

  const fill = (values, message = '') => {
    extra.values = values;
    root.innerHTML = formHtml(values, buildLists(data, extra), mode);
    wire();
    say(message);
    showId();
  };

  const addGear = (select) => {
    const kind = { cameraId: 'camera', lensId: 'lens', filmStock: 'film' }[select.dataset.field];
    const added = promptNewGear(select, kind);
    if (added) extra[{ camera: 'cameras', lens: 'lenses', film: 'films' }[kind]].push(added.item);
  };

  const wire = () => {
    wireFilmField(root, {
      yourStocks: data.films,
      // The picker lists stocks made in the chosen roll's format
      getFormat: () => data.rolls.find((r) => r.id === field('rollId').value)?.format || '35mm',
      onAdd: async (stock) => {
        await db.put('filmStocks', stock);
        data.films.unshift(stock);
      },
    });
    ['cameraId', 'lensId'].forEach((name) => {
      const select = field(name);
      select.dataset.previous = select.value;
      select.addEventListener('change', () => {
        if (select.value === NEW_OPTION) addGear(select);
        select.dataset.previous = select.value;
      });
    });
    field('rollId').addEventListener('change', () => {
      const roll = data.rolls.find((r) => r.id === field('rollId').value);
      if (mode === 'add' && roll) fill({ ...readForm(root), ...carryOver(roll, data.negatives), subject: readForm(root).subject });
      else showId();
    });
    field('dateTaken').addEventListener('change', showId);
    root.querySelectorAll('[data-attach]').forEach((button) => {
      const kind = button.dataset.attach;
      const fileInput = root.querySelector(`[data-file="${kind}"]`);
      button.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const [file] = fileInput.files;
        if (!file) return;
        pending[kind] = file;
        button.textContent = `✓ ${file.name}`;
        const nameField = field(kind === 'scan' ? 'scanFile' : 'editedFile');
        if (!nameField.value) nameField.value = file.name;
        if (kind === 'scan') field('digitized').setAttribute('aria-checked', 'true');
      });
    });
    root.querySelector('[data-save]').addEventListener('click', () => save(false));
    root.querySelector('[data-save-next]')?.addEventListener('click', () => save(true));
  };

  const save = async (next) => {
    const v = readForm(root);
    const problem = validate(v);
    if (problem) {
      say(problem[1]);
      field(problem[0])?.focus();
      return;
    }
    const buttons = root.querySelectorAll('[data-save], [data-save-next]');
    buttons.forEach((b) => { b.disabled = true; });
    const stored = [];
    let id;
    try {
      const files = {};
      if (pending.scan) {
        const { blobId, thumbBlobId } = await saveImage(db, pending.scan);
        stored.push(blobId, thumbBlobId);
        Object.assign(files, { scanBlobId: blobId, thumbBlobId });
      }
      if (pending.edit) {
        const { blobId, thumbBlobId } = await saveImage(db, pending.edit);
        stored.push(blobId, thumbBlobId);
        Object.assign(files, { editBlobId: blobId, editThumbBlobId: thumbBlobId });
      }
      await db.transaction(['cameras', 'lenses', 'filmStocks'], 'readwrite', async (t) => {
        for (const c of extra.cameras) await t.put('cameras', c);
        for (const l of extra.lenses) await t.put('lenses', l);
        for (const f of extra.films) await t.put('filmStocks', f);
      });
      const fields = toFields(v, files);
      if (mode === 'edit') {
        id = existing.id;
        await db.put('negatives', { ...existing, ...fields, updatedAt: new Date().toISOString() });
      } else {
        id = await addNegative(db, newNegative(fields));
      }
    } catch (error) {
      await removeImages(db, stored);
      say(`Not saved: ${error.message}`);
      buttons.forEach((b) => { b.disabled = false; });
      return;
    }

    if (mode === 'edit') {
      if (window.history.length > 1) window.history.back();
      else window.location.replace(`#/negative/${encodeURIComponent(id)}`);
    } else if (!next) {
      window.location.hash = `#/negative/${encodeURIComponent(id)}`;
    } else {
      data = await loadForm(db);
      pending = {};
      const roll = data.rolls.find((r) => r.id === v.rollId);
      const nextValues = {
        ...carryOver(roll, data.negatives),
        cameraId: v.cameraId, lensId: v.lensId, filmStock: v.filmStock,
        dateTaken: v.dateTaken, location: v.location, category: v.category,
        digitized: v.digitized, scanSize: v.scanSize,
      };
      fill(nextValues, `Saved ${id} (frame ${v.frameLabel || '–'}). Next: frame ${nextValues.frameLabel}.`);
      window.scrollTo(0, 0);
      field('subject').focus();
    }
  };

  getDb().then(async (opened) => {
    db = opened;
    data = await loadForm(db);
    if (mode === 'edit') {
      existing = data.negatives.find((n) => n.id === ctx.params.id);
      if (!existing) {
        root.innerHTML = `<p class="span-4 empty-state">Negative ${ctx.params.id} isn't in the archive.</p>`;
        return;
      }
      fill(existing);
      return;
    }
    // Add: the roll from ?roll=, else the roll of the most recently changed negative
    const recent = [...data.negatives].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
    const roll = data.rolls.find((r) => r.id === (ctx.query.get('roll') || recent?.rollId));
    fill(roll ? carryOver(roll, data.negatives) : {});
  });
  return root;
}

export const addScreen = { title: 'Add to archive', render };
export const editScreen = { title: 'Edit', pushed: true, render };
