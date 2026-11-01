// #/shoot/meter?roll=R007: light meter. A metering photo's EXIF gives the scene's EV (or the
// Light estimate / a typed EV without one); tap the photo for spot readings. Lock aperture or
// shutter for the other, with filter, calibration and reciprocity. Use hands it back to Shoot.

import { getDb } from './db.js';
import { readFileExposure } from './exif.js';
import {
  APERTURES, FILTER_STOPS, FULL_SHUTTERS, LIGHT_EV, equivalents, evAtIso, evFromExif, solve,
} from './exposure.js';
import {
  calibrationHtml, equivalentsHtml, estimateHtml, footerHtml, photoHtml, resultHtml, settingsHtml, signed, zonesHtml,
} from './meter-controls.js';
import { analysePhoto, stopsFromGrey } from './meter-photo.js';
import { peekDraft, setReading } from './shoot-draft.js';
import { apertureStops } from './shots.js';

const ISOS = [25, 32, 40, 50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 6400];
const LOCK_SHUTTERS = FULL_SHUTTERS.filter((s) => s.value >= 1 / 1100 && s.value <= 1.01).map((s) => s.label);
const CALIBRATION_KEY = 'meter-calibration';
const round1 = (n) => Math.round(n * 10) / 10;

function render({ query }) {
  const root = document.createElement('div');
  root.className = 'grid grid-sections';
  let db;
  let roll = null;
  let lens = {};
  const s = {
    iso: 400, filter: 'None', filterStops: 0, light: undefined, typedEv: undefined, calibration: 0,
    photo: null, mode: 'average', spot: null, lock: 'aperture', aperture: 'f/8', shutter: '1/125',
    readings: [], count: 0, addRef: false,
  };

  /** { ev100, mode, source, clipped, spotStops } for what's on screen, or null. */
  function reading() {
    const { photo } = s;
    let base;
    let source;
    if (photo?.exif) {
      base = evFromExif(photo.exif) - s.calibration + stopsFromGrey(photo.analysis.average);
      source = 'photo';
    } else if (s.typedEv !== undefined) {
      [base, source] = [s.typedEv, 'typed'];
    } else if (s.light) {
      [base, source] = [LIGHT_EV[s.light], 'light'];
    } else return null;
    if (photo && s.mode === 'spot' && s.spot) {
      const spot = photo.analysis.spot(s.spot.x, s.spot.y);
      const spotStops = Math.log2(spot.linear / photo.analysis.average);
      return { ev100: base + spotStops, mode: 'Spot', source, clipped: spot.clipped, spotStops };
    }
    return { ev100: base, mode: { photo: 'Average', light: 'Estimate', typed: 'Typed' }[source], source };
  }

  const solveFor = (r) => solve({
    ev100: r.ev100, iso: s.iso, stops: s.filterStops, lock: s.lock, aperture: s.aperture, shutter: s.shutter, film: roll?.filmStock, lens,
  });

  const paint = () => {
    const r = reading();
    const result = r && solveFor(r);
    const apertures = [...apertureStops(lens.maxAperture), 'f/22'];
    if (!apertures.includes(s.aperture)) apertures.push(s.aperture);
    const evText = r ? evAtIso(r.ev100, s.iso).toFixed(1) : '';
    const readout = r ? {
      left: `Scene EV ${evAtIso(r.ev100 - (r.spotStops || 0), s.iso).toFixed(1)}`,
      right: r.spotStops === undefined ? 'Average' : `Spot ${signed(r.spotStops)}${r.clipped ? ' · out of range' : ''}`,
    } : { left: 'No exposure data', right: '' };
    root.innerHTML = settingsHtml({
      iso: s.iso, isoNote: roll ? `from ${roll.id}${roll.shotIso && roll.shotIso !== roll.boxIso ? ' (pushed / pulled)' : ''}` : 'no roll loaded', filter: s.filter, filterStops: s.filterStops,
    })
      + photoHtml({ photo: s.photo, mode: s.mode, spot: s.spot, readout })
      + resultHtml({
        result, evText, modeText: r ? [`ISO ${s.iso}`, r.mode, r.source === 'light' ? s.light : r.source === 'photo' ? 'photo' : ''].filter(Boolean).join(' · ') : '', lock: s.lock, apertures, shutters: LOCK_SHUTTERS, recip: result?.reciprocity, film: roll?.filmStock,
      })
      + (r ? equivalentsHtml(equivalents({ ev100: r.ev100, iso: s.iso, stops: s.filterStops, film: roll?.filmStock, lens })) : '')
      + (s.photo?.exif ? '' : estimateHtml({ light: s.light, typedEv: s.typedEv }))
      + zonesHtml(s.readings, Boolean(r), (ev100) => evAtIso(ev100, s.iso))
      + calibrationHtml(s.calibration)
      + footerHtml({ hasRoll: Boolean(roll), hasPhoto: Boolean(s.photo), addRef: s.addRef, result });
    wire(r, result);
  };

  const say = (text) => { root.querySelector('[data-status]').textContent = text; };

  async function takePhoto(file) {
    if (s.photo) URL.revokeObjectURL(s.photo.url);
    const [exif, analysis] = await Promise.all([readFileExposure(file), analysePhoto(file)]);
    s.photo = { file, exif, analysis, url: URL.createObjectURL(file) };
    s.addRef = false;
    paint();
    say(exif ? 'Reading from the photo. Tap Spot, then the photo, to meter one area.' : 'No exposure data in this photo: using the estimate.');
  }

  const step = (name, handler) => root.querySelectorAll(`[data-step-${name}]`).forEach((b) => b.addEventListener('click', () => { handler(Number(b.dataset[`step${name[0].toUpperCase()}${name.slice(1)}`])); paint(); }));

  function wire(r, result) {
    step('iso', (d) => { s.iso = ISOS[Math.max(0, Math.min(ISOS.length - 1, ISOS.indexOf(s.iso) + d))] || s.iso; });
    step('filter', (d) => { s.filterStops = Math.max(0, round1(s.filterStops + d / 3)); });
    step('calibration', async (d) => {
      s.calibration = Math.max(-2, Math.min(2, round1(s.calibration + d / 3)));
      await db.put('meta', { key: CALIBRATION_KEY, value: s.calibration });
    });
    const input = root.querySelector('[data-photo-input]');
    root.querySelectorAll('[data-take-photo]').forEach((b) => b.addEventListener('click', () => input.click()));
    input.addEventListener('change', () => { if (input.files[0]) takePhoto(input.files[0]); });
    root.querySelector('[data-photo]')?.addEventListener('click', (event) => {
      const box = event.currentTarget.getBoundingClientRect();
      const x = event.clientX ? (event.clientX - box.left) / box.width : 0.5;
      const y = event.clientY ? (event.clientY - box.top) / box.height : 0.5;
      s.spot = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
      s.mode = 'spot';
      paint();
    });
    root.querySelector('[data-mode]')?.addEventListener('change', (event) => {
      s.mode = event.target.dataset.value;
      if (s.mode === 'spot' && !s.spot) s.spot = { x: 0.5, y: 0.5 };
      paint();
    });
    root.querySelector('[data-lock]')?.addEventListener('change', (event) => {
      if (result) [s.aperture, s.shutter] = [result.aperture, result.shutter];
      if (!LOCK_SHUTTERS.includes(s.shutter)) s.shutter = '1/125';
      s.lock = event.target.dataset.value;
      paint();
    });
    root.querySelector('[data-locked]')?.addEventListener('change', (event) => {
      s[s.lock] = event.target.dataset.value;
      paint();
    });
    root.querySelectorAll('[data-pair]').forEach((b) => b.addEventListener('click', () => {
      [s.lock, s.aperture] = ['aperture', b.dataset.pair];
      paint();
    }));
    root.querySelector('[data-light]')?.addEventListener('change', (event) => {
      [s.light, s.typedEv] = [event.target.dataset.value, undefined];
      paint();
    });
    root.querySelector('[data-typed]')?.addEventListener('change', (event) => {
      const value = Number(event.target.value.replace(',', '.'));
      s.typedEv = event.target.value.trim() && Number.isFinite(value) ? value : undefined;
      paint();
    });
    root.querySelector('[data-add-reading]')?.addEventListener('click', () => {
      s.count += 1;
      s.readings = [...s.readings, { n: s.count, ev100: r.ev100, clipped: r.clipped }];
      if (s.readings.length > 6) s.readings.splice(1, 1); // keep the first (Zone V)
      paint();
    });
    root.querySelector('[data-reset]')?.addEventListener('click', () => { [s.readings, s.count] = [[], 0]; paint(); });
    root.querySelector('[data-add-ref]')?.addEventListener('click', () => { s.addRef = !s.addRef; paint(); });
    root.querySelector('[data-use]')?.addEventListener('click', () => {
      setReading({
        rollId: roll.id,
        aperture: result.aperture,
        shutter: result.shutter,
        meter: { ev: round1(evAtIso(r.ev100, s.iso)), iso: s.iso, mode: r.mode, source: r.source },
        refFile: s.addRef ? s.photo.file : undefined,
      });
      if (peekDraft(roll.id)) window.history.back();
      else window.location.hash = `#/shoot?roll=${encodeURIComponent(roll.id)}`;
    });
  }

  getDb().then(async (opened) => {
    db = opened;
    roll = query.get('roll') ? await db.get('rolls', query.get('roll')) : null;
    s.calibration = (await db.get('meta', CALIBRATION_KEY))?.value || 0;
    const form = roll ? peekDraft(roll.id)?.form : null;
    if (roll) {
      const iso = roll.shotIso || roll.boxIso;
      s.iso = ISOS.reduce((best, v) => (Math.abs(Math.log2(v / iso)) < Math.abs(Math.log2(best / iso)) ? v : best), 400);
      lens = (await db.get('lenses', form?.lensId || roll.defaultLensId)) || {};
    }
    s.filter = form?.filter || 'None';
    s.filterStops = round1(FILTER_STOPS[s.filter] ?? 3); // ND: 3 stops until changed
    s.light = form?.light;
    if (form?.aperture && APERTURES.some((a) => a.label === form.aperture)) s.aperture = form.aperture;
    if (form?.shutter && LOCK_SHUTTERS.includes(form.shutter)) s.shutter = form.shutter;
    paint();
  });
  return root;
}

export const meterScreen = { title: 'Meter', pushed: true, render };
