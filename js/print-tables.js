// PDF pages for one roll: the contact sheet and the frame index table.
// Returns HTML strings; values are escaped. Marks are letters, so nothing depends on colour.

import { isEdited, isToEdit, monthRange, places } from './archive-data.js';
import { frameLayout, formatText } from './formats.js';

export const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 'E' to edit, '✓' edited, then U / O / S. */
export function frameMarks(n) {
  const marks = [];
  if (isToEdit(n)) marks.push('E');
  if (isEdited(n)) marks.push('✓');
  if (n.exposure === 'Under') marks.push('U');
  if (n.exposure === 'Over') marks.push('O');
  if (n.focus === 'Soft' || n.focus === 'Out of focus') marks.push('S');
  return marks.join(' ');
}

const idRange = (negatives) => {
  const ids = negatives.map((n) => n.id).sort();
  return ids.length ? `${ids[0]} → ${ids.at(-1)}` : '';
};

/** Roll details shared by the contact sheet and index: film · month · places, gear · lab, IDs · sleeve. */
export function rollLines(roll, negatives, names, options) {
  const first = [roll.filmStock, formatText(roll), monthRange(negatives), places(negatives).join(', ')].filter(Boolean).join(' · ');
  const second = [names.camera, names.lens, roll.labNumber && `lab no. ${roll.labNumber}`].filter(Boolean).join(' · ');
  const sleeve = options.include.storage ? ` · sleeve ${roll.storageLocation || '[not filed]'}` : '';
  return { first, second, third: `${idRange(negatives)}${sleeve}` };
}

/** Contact sheet: header, strips (strip number at left, 6 frames each), legend. urls: Map id → image URL. */
export function contactSheetHtml(page, entry, names, urls, options) {
  const lines = rollLines(page.roll, entry.negatives, names, options);
  const strips = page.strips.map(({ strip, negatives }) => `
    <div class="strip-row">
      <span class="strip-number">${strip}</span>
      <div class="strip-frames">
        ${negatives.map((n) => `
          <div class="strip-frame">
            <span class="strip-image">${urls.get(n.id) ? `<img src="${urls.get(n.id)}" alt="">` : esc(n.id.slice(5))}</span>
            <span class="strip-caption"><span>▸${esc(n.frameLabel || n.frame || '')}</span><span class="p-bold">${esc(frameMarks(n))}</span></span>
            <span class="strip-id">${esc(n.id)}</span>
          </div>`).join('')}
      </div>
    </div>`).join('');
  return `
    <header class="contact-head">
      <div>
        <div class="p-label">Contact sheet${page.parts > 1 ? ` · ${page.part} of ${page.parts}` : ''}</div>
        <div class="contact-roll">${esc(page.roll.id)}</div>
      </div>
      <div class="contact-meta">
        <div class="p-bold">${esc(lines.first)}</div>
        <div>${esc(lines.second)}</div>
        <div class="p-small p-muted p-mono">${esc(lines.third)}</div>
      </div>
    </header>
    <div class="strips" style="--frames-per-strip: ${frameLayout(page.roll).perStrip}; --frame-aspect: ${frameLayout(page.roll).aspect}">${strips}</div>
    <div class="legend-line"><span>E  to edit</span><span>✓  edited</span><span>U under · O over · S soft</span><span>Strip numbers at left</span></div>`;
}

const pair = (a, b) => [a, b].filter(Boolean).join(' / ') || '—';

/** Frame index: title, table (20 rows), summary line. */
export function frameIndexHtml(page, entry, names, options) {
  const { include } = options;
  const { start } = page;
  const rows = page.rows.map((n) => `
    <tr>
      <td class="p-mono p-nowrap">${esc(n.frameLabel || n.frame || '')}</td>
      <td class="p-nowrap">${esc(n.strip || '')}</td>
      <td class="p-mono p-nowrap">${esc(n.id)}</td>
      <td>${esc(n.subject)}</td>
      <td>${esc(pair(n.focus, n.exposure))}</td>
      <td class="p-nowrap${isToEdit(n) ? ' p-bold' : ''}">${n.action === 'Edit' ? (n.actionComplete ? 'Edit ✓' : 'Edit') : '—'}</td>
      <td class="p-nowrap">${esc(pair(n.social, n.print))}${n.printed ? ' · printed' : ''}</td>
      ${include.notes ? `<td class="p-notes">${esc(n.notes || '')}</td>` : ''}
      ${include.files ? `<td class="p-mono p-nowrap">${esc(n.scanFile || '')}</td>` : ''}
    </tr>`).join('');
  const shared = (key) => {
    const values = [...new Set(entry.negatives.map((n) => n[key]).filter(Boolean))];
    return values.length === 1 ? values[0] : '';
  };
  const summary = [names.camera, names.lens, page.roll.filmStock, shared('location'), monthRange(entry.negatives)].filter(Boolean).join(' · ');
  const firstFrame = page.rows[0]?.frame ?? '';
  const lastFrame = page.rows.at(-1)?.frame ?? '';
  return `
    <header class="index-head">
      <h1 class="index-title"><span class="p-mono">${esc(page.roll.id)}</span> · Frame index</h1>
      <span class="p-muted">Frames ${esc(firstFrame)}–${esc(lastFrame)} · rows ${start + 1}–${start + page.rows.length} of ${page.total}</span>
    </header>
    <table class="p-table is-compact${include.files ? ' has-files' : ''}">
      <thead><tr>
        <th>Fr</th><th>Strip</th><th>ID</th><th>Subject</th><th>Focus / exp.</th><th>Action</th><th class="p-nowrap">Social / print</th>
        ${include.notes ? '<th>Notes</th>' : ''}${include.files ? '<th>File</th>' : ''}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="p-small p-muted p-gap-3">${summary ? `All frames: ${esc(summary)}.` : ''}${page.part < page.parts ? ' Continued on next page.' : ''}</p>`;
}
