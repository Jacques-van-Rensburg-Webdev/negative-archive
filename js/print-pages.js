// print.html: renders the PDF pages planned in pdf-plan.js as fixed-size sheets, waits for the
// thumbnails, then opens the print dialog (Save as PDF). ?preview=1 skips the automatic dialog.

import { countNegatives, loadArchive, monthRange, places } from './archive-data.js';
import { getDb } from './db.js';
import { previewUrls } from './files.js';
import { optionsFromQuery, optionsToQuery, planPdf, spillLastRow } from './pdf-plan.js';
import { contactSheetHtml, esc, frameIndexHtml } from './print-tables.js';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const listText = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0] || '');

function coverTitle(plan) {
  const processes = new Set(plan.rolls.map((r) => r.roll.process || 'bw'));
  const kind = processes.size > 1 ? '' : processes.has('colour') ? 'colour ' : 'B&W ';
  const years = [...new Set(plan.rolls.flatMap((r) => r.negatives.map((n) => (n.dateTaken || '').slice(0, 4)).filter(Boolean)))].sort();
  return `35mm ${kind}negatives${years.length ? `, ${years.join('–')}` : ''}`;
}

function coverHtml(plan, names) {
  const all = plan.rolls.flatMap((r) => r.negatives);
  const totals = countNegatives(all);
  const months = [...new Set(all.map((n) => (n.dateTaken || '').slice(5, 7)).filter((m) => /^\d\d$/.test(m) && m !== '00'))].sort();
  const monthText = months.length ? (months.length === 1 ? MONTH_NAMES[months[0] - 1] : `${MONTH_NAMES[months[0] - 1]}–${MONTH_NAMES[months.at(-1) - 1]}`) : '';
  const gear = [...new Set(all.map((n) => names.cameras.get(n.cameraId)).filter(Boolean)), ...new Set(all.map((n) => names.lenses.get(n.lensId)).filter(Boolean))];
  const sub = [...gear, listText(places(all)), monthText].filter(Boolean).join(' · ');
  const films = new Map();
  all.forEach((n) => { const f = n.filmStock || 'Unknown'; films.set(f, (films.get(f) || 0) + 1); });
  const most = Math.max(...films.values());
  const ids = (list) => { const s = list.map((n) => n.id).sort(); return `${s[0].slice(5)}–${s.at(-1).slice(5)}`; };
  const unfiled = plan.rolls.filter((r) => !r.roll.storageLocation).map((r) => r.roll.id);
  const exported = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  return `
    <div class="cover-top p-label"><span>Negative Archive</span><span>Exported ${esc(exported)}</span></div>
    <h1 class="cover-title">${esc(coverTitle(plan))}</h1>
    <p class="cover-sub">${esc(sub)}</p>
    <div class="cover-totals">
      ${[[totals.frames, 'negatives'], [plan.rolls.length, 'rolls'], [totals.scanned, 'scanned'], [totals.toEdit, 'still to edit']].map(([v, l]) => `<div class="cover-total"><div class="cover-total-value">${v}</div><div class="p-muted">${l}</div></div>`).join('')}
    </div>
    <h2 class="p-h2">Roll index</h2>
    <table class="p-table">
      <thead><tr><th>Roll</th><th>Film</th><th>Date</th><th>Location</th><th>Negative IDs</th><th>Frames</th><th>To edit</th><th>Page</th></tr></thead>
      <tbody>${plan.rolls.map((r) => `<tr><td class="p-mono p-bold">${esc(r.roll.id)}</td><td>${esc(r.roll.filmStock)}</td><td>${esc(monthRange(r.negatives))}</td><td>${esc(places(r.negatives).join(', '))}</td><td class="p-mono p-small">${esc(ids(r.negatives))}</td><td>${r.negatives.length}</td><td>${countNegatives(r.negatives).toEdit}</td><td>${r.startPage}</td></tr>`).join('')}</tbody>
    </table>
    <p class="p-small p-muted p-gap-2">Lab numbers: ${esc(plan.rolls.map((r) => `${r.roll.id} ${r.roll.labNumber || '—'}`).join(' · '))}</p>
    <div class="cover-columns">
      <div>
        <h2 class="p-h2">Film stocks</h2>
        <div class="bar-list">${[...films].sort((a, b) => b[1] - a[1]).map(([f, c]) => `<div><div class="bar-head"><span>${esc(f)}</span><span>${c}</span></div><div class="bar"><span style="--bar: ${Math.round((c / most) * 100)}%"></span></div></div>`).join('')}</div>
      </div>
      ${plan.options.include.storage ? `<div>
        <h2 class="p-h2">Storage</h2>
        <p>Each roll's sleeve location prints on its contact sheet page.${unfiled.length ? ` Not filed yet: ${esc(unfiled.join(', '))}.` : ' Every roll is filed.'}</p>
      </div>` : ''}
    </div>`;
}

function footer(page, total) {
  const left = page.kind === 'cover' ? 'Negative Archive' : `Negative Archive · ${page.roll.id} · ${page.roll.filmStock || ''}`;
  return `<footer class="sheet-foot"><span>${esc(left)}</span><span>${page.number} / ${total}</span></footer>`;
}

async function main() {
  const query = new URLSearchParams(window.location.search);
  const options = optionsFromQuery(query);
  const status = document.querySelector('[data-print-status]');
  const printButton = document.querySelector('[data-print]');
  document.querySelector('[data-back]').href = `index.html#/export?${optionsToQuery(options)}`;
  document.body.classList.toggle('paper-letter', options.paper === 'letter');
  if (options.paper === 'letter') {
    const size = document.createElement('style');
    size.textContent = '@page { size: letter; margin: 0; }';
    document.head.append(size);
  }

  const db = await getDb();
  const data = await loadArchive(db);
  const plan = planPdf(data, options);
  const names = { cameras: data.cameras, lenses: data.lenses };
  const urls = await previewUrls(db, plan.rolls.flatMap((r) => r.negatives));
  const byRoll = new Map(plan.rolls.map((r) => [r.roll.id, r]));
  const rollNames = (roll) => ({ camera: data.cameras.get(roll.cameraId), lens: data.lenses.get(roll.defaultLensId) });

  const sheets = document.querySelector('[data-sheets]');
  const renderSheets = () => {
    plan.rolls.forEach((r) => { r.startPage = plan.pages.find((p) => p.roll?.id === r.roll.id)?.number; });
    sheets.innerHTML = plan.pages.map((page) => {
      let body = '';
      if (page.kind === 'cover') body = coverHtml(plan, names);
      if (page.kind === 'contact') body = contactSheetHtml(page, byRoll.get(page.roll.id), rollNames(page.roll), urls, options);
      if (page.kind === 'index') body = frameIndexHtml(page, byRoll.get(page.roll.id), rollNames(page.roll), options);
      return `<section class="sheet" data-page="${page.number}">${body}${footer(page, plan.pages.length)}</section>`;
    }).join('') || '<p class="print-bar-status">Nothing to export with these choices.</p>';
  };

  // Long subjects or notes can make an index page too tall: move rows on until every sheet fits
  await document.fonts?.ready;
  renderSheets();
  for (let guard = 0; guard < 500; guard += 1) {
    const over = [...sheets.querySelectorAll('.sheet')].findIndex((s, i) => plan.pages[i].kind === 'index' && s.scrollHeight > s.clientHeight + 1);
    if (over === -1) break;
    spillLastRow(plan.pages, over);
    renderSheets();
  }

  // Wait for every thumbnail, so the dialog prints complete pages
  await Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))));
  document.body.dataset.ready = String(plan.pages.length);
  status.textContent = `${plan.pages.length} page${plan.pages.length === 1 ? '' : 's'} · ${options.paper === 'letter' ? 'Letter' : 'A4'}. Choose Save as PDF in the print dialog.`;
  printButton.disabled = !plan.pages.length;
  printButton.addEventListener('click', () => window.print());
  if (plan.pages.length && !query.has('preview')) window.print();
}

main().catch((error) => {
  document.querySelector('[data-print-status]').textContent = `Couldn't build the pages: ${error.message}`;
});
