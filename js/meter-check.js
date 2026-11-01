// #/dev/meter-check: does this phone keep the camera's exposure (EXIF) on a photo taken in the app?
// Take a photo, or pick one from Photos, and the page shows what it could read. Pushed screen.

import { evFromExif } from './exposure.js';
import { readFileExposure } from './exif.js';

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const row = (key, value) => `<div class="field-row"><span class="field-key">${key}</span><span class="text-mono">${esc(value)}</span></div>`;

function result(file, exif) {
  const head = [row('File', `${file.type || 'unknown type'} · ${Math.round(file.size / 1024)} KB`)];
  if (!exif) {
    return `${head.join('')}
      <div class="field-row"><span class="field-key">EXIF</span><span class="text-bold">Not found</span></div>`;
  }
  const t = exif.exposureTime;
  return [
    ...head,
    row('Shutter', t < 1 ? `1/${Math.round(1 / t)}` : `${t} s`),
    row('Aperture', `f/${exif.fNumber.toFixed(1)}`),
    row('ISO', exif.iso),
    row('EV₁₀₀', evFromExif(exif).toFixed(1)),
    exif.brightness !== undefined ? row('Brightness + 5', (exif.brightness + 5).toFixed(1)) : '',
    exif.bias ? row('Bias', `${exif.bias.toFixed(1)} EV`) : '',
    exif.lens ? row('Lens', exif.lens) : '',
  ].join('');
}

function render() {
  const root = document.createElement('div');
  root.className = 'grid grid-sections';
  root.innerHTML = `
    <section class="span-4 stack-1">
      <h2 class="section-label">Exposure from a photo</h2>
      <p class="text-sm text-muted">Take a photo of anything. If the shutter, aperture and ISO show below, the meter can work on this phone.</p>
      <input type="file" accept="image/*" capture="environment" hidden data-camera>
      <input type="file" accept="image/*" hidden data-library>
      <button class="button button-primary button-block" type="button" data-take="camera">Take a photo</button>
      <button class="button button-secondary button-block" type="button" data-take="library">Choose from Photos</button>
    </section>
    <section class="span-4 stack-1">
      <p class="text-sm text-edge" role="status" data-status></p>
      <div class="field-group" data-result hidden></div>
    </section>`;

  root.querySelectorAll('[data-take]').forEach((button) => button.addEventListener('click', () => {
    root.querySelector(`[data-${button.dataset.take}]`).click();
  }));
  root.querySelectorAll('input[type="file"]').forEach((input) => input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    const exif = await readFileExposure(file);
    const box = root.querySelector('[data-result]');
    box.innerHTML = result(file, exif);
    box.hidden = false;
    root.querySelector('[data-status]').textContent = exif
      ? `Exposure found (${input.hasAttribute('capture') ? 'camera' : 'Photos'}). The meter can use it.`
      : 'No exposure data in this photo.';
    input.value = '';
  }));
  return root;
}

export const meterCheck = { title: 'Meter check', pushed: true, render };
