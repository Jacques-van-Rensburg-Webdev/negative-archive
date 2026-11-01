// Shoot tab: the photo log used while shooting. Everything saves to the phone at once.
// Lens / aperture / light / filter / type stay set after logging; lighting stays on until
// switched off; note and photo clear. Tap a logged shot to change or delete it.

import { getDb } from './db.js';
import { blobUrl, removeImages, saveImage } from './files.js';
import { newGearItem } from './gear.js';
import { saveDraft } from './shoot-draft.js';
import { applyReading, restoreDraft } from './shoot-exposure.js';
import { emptyStateHtml, readShootForm, rollCardHtml, shootFormHtml, shotListHtml } from './shoot-controls.js';
import {
  apertureStops, deleteShot, lightingItems, logShot, nextShotNumber, position, rollsInCamera, shotsForRoll, unloadRoll, updateShot,
} from './shots.js';

const stickyKey = (rollId) => `shoot-sticky-${rollId}`;

function render({ query, setActions }) {
  const root = document.createElement('div');
  root.className = 'grid grid-sections';
  let db;
  let roll;
  let shots = [];
  let lenses = [];
  let items = [];
  let form;
  let editing = null;
  let pendingRef = null;

  const say = (text) => { const node = root.querySelector('[data-status]'); if (node) node.textContent = text; };
  const lensName = (id) => lenses.find((l) => l.id === id)?.name || 'No lens set';

  const freshForm = async (sticky) => ({
    shotNumber: nextShotNumber(shots),
    lensId: roll.defaultLensId,
    aperture: sticky.aperture,
    shutter: sticky.shutter,
    meter: undefined,
    light: sticky.light,
    filter: sticky.filter || 'None',
    category: sticky.category,
    lighting: sticky.lighting || { on: false, items: [], role: undefined, setup: undefined },
    place: sticky.place,
    note: undefined,
  });

  const paint = async (message = '') => {
    const rolls = rollsInCamera(await db.getAll('rolls'));
    if (!rolls.length) {
      root.innerHTML = emptyStateHtml();
      setActions([]);
      return;
    }
    roll = rolls.find((r) => r.id === query.get('roll')) || rolls[0];
    const cameras = new Map((await db.getAll('cameras')).map((c) => [c.id, c.name]));
    [shots, lenses, items] = await Promise.all([shotsForRoll(db, roll.id), db.getAll('lenses'), lightingItems(db)]);
    const kept = restoreDraft(roll.id, shots);
    if (kept) ({ form, pendingRef, editing } = kept);
    if (!form) form = await freshForm((await db.get('meta', stickyKey(roll.id)))?.value || {});
    const metered = applyReading(roll.id, form);
    if (metered) {
      form = metered.form;
      pendingRef = metered.refFile || pendingRef;
      message = metered.message;
    }

    const sync = document.createElement('a');
    sync.className = 'button button-sm';
    sync.href = `#/shoot/sync?roll=${encodeURIComponent(roll.id)}`;
    sync.textContent = 'Sync';
    setActions([sync]);

    const lens = lenses.find((l) => l.id === form.lensId);
    const apertures = apertureStops(lens?.maxAperture);
    const refUrl = pendingRef ? URL.createObjectURL(pendingRef) : editing ? await blobUrl(db, editing.refThumbBlobId || editing.refPhotoBlobId) : undefined;
    const switcher = rolls.length > 1 ? `<div class="span-4 chip-row">${rolls.map((r) => `<a class="chip${r.id === roll.id ? ' is-set' : ''}" href="#/shoot?roll=${r.id}">${r.id} · ${cameras.get(r.cameraId) || ''}</a>`).join('')}</div>` : '';
    root.innerHTML = switcher + rollCardHtml(roll, cameras)
      + shootFormHtml({ roll, form, lenses, lensName: lensName(form.lensId), apertures, items, editing, refUrl, done: shots.length >= roll.exposures })
      + shotListHtml(shots, new Map(lenses.map((l) => [l.id, l.name])));
    wire();
    say(message);
  };

  // Keep what's on screen in `form` before repainting (e.g. after changing lens)
  const keep = () => { form = { ...form, ...readShootForm(root), shotNumber: form.shotNumber }; };

  const wire = () => {
    root.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
      form.shotNumber = Math.max(1, form.shotNumber + Number(b.dataset.step));
      root.querySelector('[data-shot-number]').textContent = form.shotNumber;
      const log = root.querySelector('[data-log]');
      if (log) log.textContent = `Log shot ${form.shotNumber}`;
    }));
    root.querySelector('[data-lens-toggle]').addEventListener('click', (event) => {
      const panel = root.querySelector('[data-lens-panel]');
      panel.hidden = !panel.hidden;
      event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
    });
    root.querySelector('[data-field="lensId"]').addEventListener('change', () => { keep(); paint(); });
    root.querySelector('[data-meter]').addEventListener('click', () => {
      keep();
      saveDraft({ rollId: roll.id, form, pendingRef, editingId: editing?.id });
      window.location.hash = `#/shoot/meter?roll=${encodeURIComponent(roll.id)}`;
    });
    root.querySelector('[data-add-lens]').addEventListener('click', async () => {
      const name = window.prompt('Name of the new lens (e.g. Nikkor 50mm f/1.4)')?.trim();
      if (!name) return;
      const item = newGearItem('lens', name);
      await db.put('lenses', item);
      keep();
      form.lensId = item.id;
      paint();
    });
    root.querySelector('[data-make-default]').addEventListener('click', async () => {
      keep();
      await db.put('rolls', { ...roll, defaultLensId: form.lensId });
      paint(`${lensName(form.lensId)} is now the default lens for ${roll.id}.`);
    });
    root.querySelector('[data-field="lightingOn"]').addEventListener('change', (event) => {
      root.querySelector('[data-lighting]').hidden = event.target.getAttribute('aria-checked') !== 'true';
    });
    root.querySelector('[data-add-item]').addEventListener('click', async () => {
      const name = window.prompt('What did you use? (e.g. Reflector — black)')?.trim();
      if (!name) return;
      await db.put('lightingItems', { id: `light-${crypto.randomUUID()}`, name });
      keep();
      form.lighting.items = [...form.lighting.items, name];
      paint();
    });
    const refInput = root.querySelector('[data-ref-input]');
    root.querySelector('[data-ref]').addEventListener('click', () => refInput.click());
    refInput.addEventListener('change', () => {
      if (!refInput.files[0]) return;
      keep();
      pendingRef = refInput.files[0];
      paint('Reference photo ready. It is saved with the shot.');
    });
    root.querySelector('[data-log]')?.addEventListener('click', log);
    root.querySelector('[data-save-shot]')?.addEventListener('click', saveEdit);
    root.querySelector('[data-cancel-edit]')?.addEventListener('click', () => cancelEdit());
    root.querySelector('[data-delete-shot]')?.addEventListener('click', removeShot);
    root.querySelector('[data-unload]')?.addEventListener('click', async () => {
      await unloadRoll(db, roll);
      window.location.hash = `#/roll/${encodeURIComponent(roll.id)}`;
    });
    root.querySelectorAll('[data-shot]').forEach((row) => row.addEventListener('click', () => startEdit(row.dataset.shot)));
  };

  const shotFrom = async (values) => {
    const shot = {
      rollId: roll.id, shotNumber: form.shotNumber, lensId: values.lensId || roll.defaultLensId,
      aperture: values.aperture, shutter: values.shutter, meter: form.meter, light: values.light, filter: values.filter, category: values.category,
      lighting: values.lighting.on ? { items: values.lighting.items, role: values.lighting.role, setup: values.lighting.setup } : undefined,
      placeName: values.place, note: values.note,
    };
    if (pendingRef) {
      const { blobId, thumbBlobId } = await saveImage(db, pendingRef);
      Object.assign(shot, { refPhotoBlobId: blobId, refThumbBlobId: thumbBlobId });
    }
    return shot;
  };

  async function log() {
    const values = readShootForm(root);
    root.querySelector('[data-log]').disabled = true;
    const shot = await shotFrom(values);
    if (roll.locationPerShot) Object.assign(shot, await position());
    const saved = await logShot(db, shot);
    const { lensId, note, ...sticky } = values;
    await db.put('meta', { key: stickyKey(roll.id), value: sticky });
    pendingRef = null;
    form = { ...form, ...values, lensId: roll.defaultLensId, note: undefined, meter: undefined, shotNumber: saved.shotNumber + 1 };
    paint(`Logged shot ${saved.shotNumber}.`);
  }

  async function startEdit(id) {
    keep();
    editing = shots.find((s) => s.id === id);
    pendingRef = null;
    form = {
      ...form, shotNumber: editing.shotNumber, lensId: editing.lensId, aperture: editing.aperture, shutter: editing.shutter, meter: editing.meter, light: editing.light,
      filter: editing.filter, category: editing.category, place: editing.placeName, note: editing.note,
      lighting: editing.lighting ? { on: true, items: editing.lighting.items || [], role: editing.lighting.role, setup: editing.lighting.setup } : { on: false, items: [] },
    };
    await paint(`Changing shot ${editing.shotNumber}.`);
    window.scrollTo(0, 0);
  }

  async function cancelEdit(message = '') {
    editing = null;
    pendingRef = null;
    form = null;
    await paint(message);
  }

  async function saveEdit() {
    const values = readShootForm(root);
    const replacing = pendingRef ? [editing.refPhotoBlobId, editing.refThumbBlobId] : [];
    const changes = await shotFrom(values);
    await updateShot(db, { ...editing, ...changes });
    await removeImages(db, replacing);
    await cancelEdit(`Shot ${changes.shotNumber} saved.${editing?.syncedNegativeId ? ' Sync again to update the archive.' : ''}`);
  }

  async function removeShot() {
    if (!window.confirm(`Delete shot ${editing.shotNumber}? Its reference photo is deleted too.`)) return;
    await deleteShot(db, editing);
    await cancelEdit(`Shot ${editing.shotNumber} deleted.`);
  }

  getDb().then(async (opened) => {
    db = opened;
    await paint();
  });
  return root;
}

export const shootScreen = { title: 'Shoot', render };
