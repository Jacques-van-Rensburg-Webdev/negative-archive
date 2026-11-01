// #/dev/components: every base component on one page, with sample data from roll R003.
// A pushed screen (no tab bar). Used to check components against the designs and the grid.

import { renderFilmStrip } from './film-strip.js';

// R003, strip 2 (frames 4–9), from design/screens/Roll.dc.html
const STRIP = [
  { frame: '4', id: '2026-0076', status: null, flags: [] },
  { frame: '5', id: '2026-0077', status: 'to-edit', flags: [] },
  { frame: '6', id: '2026-0078', status: 'edited', flags: [] },
  { frame: '7', id: '2026-0079', status: null, flags: [] },
  { frame: '8', id: '2026-0080', status: 'to-edit', flags: [] },
  { frame: '9', id: '2026-0081', status: null, flags: ['S'] },
];

const APERTURES = ['f/2', 'f/2.8', 'f/4', 'f/5.6', 'f/8', 'f/11', 'f/16'];

const CHECK_ICON = '<svg class="status-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

const TEMPLATE = `
  <!-- Content, columns 1–4, at 24 -->
  <section class="span-4 stack-1">
    <h2 class="section-label">Buttons</h2>
    <button class="button button-primary button-block" type="button">Log shot 12</button>
    <button class="button button-secondary button-block" type="button">Save &amp; next frame</button>
  </section>

  <section class="span-4 stack-1">
    <h2 class="section-label">Inputs</h2>
    <div class="grid grid-inner">
      <div class="span-4 form-field">
        <label class="form-label" for="dev-subject">Subject</label>
        <input class="input" id="dev-subject" type="text" placeholder="Tram stop, Prenzlauer Berg">
      </div>
      <div class="span-2 form-field">
        <label class="form-label" for="dev-id">Negative ID</label>
        <input class="input input-mono" id="dev-id" type="text" value="2026-0078">
      </div>
      <div class="span-2 form-field">
        <label class="form-label" for="dev-focus">Focus</label>
        <div class="select">
          <select class="input" id="dev-focus">
            <option>Clear</option>
            <option>Soft</option>
            <option>Out of focus</option>
          </select>
        </div>
      </div>
      <div class="span-4 form-field">
        <label class="form-label" for="dev-notes">Notes</label>
        <textarea class="input textarea" id="dev-notes" placeholder="Crop tighter, lift shadows"></textarea>
      </div>
    </div>
  </section>

  <section class="span-4 stack-1">
    <h2 class="section-label" id="dev-aperture-label">Aperture</h2>
    <div class="chip-row" data-select="single" role="group" aria-labelledby="dev-aperture-label">
      ${APERTURES.map((f, i) => `<button class="chip chip-mono" type="button" aria-pressed="${i === 3}">${f}</button>`).join('')}
    </div>
  </section>

  <section class="span-4 stack-1">
    <h2 class="section-label" id="dev-view-label">View</h2>
    <div class="segmented" role="radiogroup" aria-labelledby="dev-view-label">
      <button class="segment" type="button" role="radio" aria-checked="true" tabindex="0">Contact sheet</button>
      <button class="segment" type="button" role="radio" aria-checked="false" tabindex="-1">List</button>
      <button class="segment" type="button" role="radio" aria-checked="false" tabindex="-1">Negative</button>
    </div>
  </section>

  <section class="span-4 stack-1">
    <h2 class="section-label">Gear</h2>
    <div class="field-group">
      <div class="field-row"><span class="field-key">Camera</span><span class="field-value">Nikon F2A</span></div>
      <div class="field-row"><span class="field-key">Lens</span><span class="field-value">Nikkor 24mm f/2</span></div>
      <div class="field-row"><span class="field-key">Lab no.</span><span class="field-value field-value-mono">5331</span></div>
      <label class="field-row" for="dev-digitized">
        <span class="field-key">Digitized</span>
        <button class="switch" id="dev-digitized" type="button" role="switch" aria-checked="true"></button>
      </label>
    </div>
  </section>

  <section class="span-4 stack-1">
    <h2 class="section-label">Stat tiles</h2>
    <div class="grid grid-inner">
      <div class="span-1 stat-tile"><span class="stat-tile-value">37</span><span class="stat-tile-label">frames</span></div>
      <div class="span-1 stat-tile"><span class="stat-tile-value">37</span><span class="stat-tile-label">scanned</span></div>
      <div class="span-1 stat-tile"><span class="stat-tile-value is-attention">20</span><span class="stat-tile-label">to edit</span></div>
      <div class="span-1 stat-tile"><span class="stat-tile-value">2</span><span class="stat-tile-label">social</span></div>
    </div>
  </section>

  <section class="span-4 stack-1" data-film-strip>
    <h2 class="section-label">Film strip</h2>
  </section>

  <section class="span-4 stack-1">
    <h2 class="section-label">Thumbnails</h2>
    <div class="grid grid-inner">
      <div class="span-1 thumbnail" role="img" aria-label="2026-0078, not scanned"></div>
      <div class="span-1 thumbnail" role="img" aria-label="2026-0079, not scanned"></div>
    </div>
  </section>

  <section class="span-4 stack-1 mb-6">
    <h2 class="section-label">Status pills</h2>
    <div class="chip-row">
      <span class="status-pill is-done">${CHECK_ICON}Digitized</span>
      <span class="status-pill is-attention">To edit</span>
      <span class="status-pill">Social</span>
      <span class="status-pill">Print</span>
      <span class="status-pill">Printed</span>
    </div>
  </section>
`;

function renderPage() {
  const grid = document.createElement('div');
  grid.className = 'grid grid-sections';
  grid.innerHTML = TEMPLATE;

  // Frames link back to this page until the Negative screen exists (M2).
  const strip = renderFilmStrip(STRIP, {
    selected: '2026-0078',
    label: 'R003, strip 2',
    href: () => '#/dev/components',
  });
  grid.querySelector('[data-film-strip]').append(strip);
  return grid;
}

function renderActions() {
  const pdf = document.createElement('button');
  pdf.className = 'button button-sm';
  pdf.type = 'button';
  pdf.textContent = 'PDF';
  return [pdf];
}

export const devComponents = {
  title: 'Components',
  pushed: true,
  actions: renderActions,
  render: renderPage,
};
