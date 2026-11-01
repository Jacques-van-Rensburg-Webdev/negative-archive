// Building blocks for Negative detail: status pills and the key / value sections.

import { formatMonth, isEdited, isToEdit } from './archive-data.js';

const CHECK_ICON = '<svg class="status-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function pill(text, kind = '') {
  const node = el('span', `status-pill${kind ? ` is-${kind}` : ''}`);
  if (kind === 'done') node.innerHTML = CHECK_ICON;
  node.append(document.createTextNode(text));
  return node;
}

/** Digitized, Edited / To edit, Social, Print, Printed. Done = filled, attention = red outline. */
export function statusPills(n) {
  const row = el('div', 'chip-row');
  if (n.status === 'draft') row.append(pill('Draft · from Shoot', 'attention'));
  row.append(n.digitized ? pill('Digitized', 'done') : pill('Not digitized'));
  if (isEdited(n)) row.append(pill('Edited', 'done'));
  else if (isToEdit(n)) row.append(pill('To edit', 'attention'));
  row.append(pill(`Social · ${n.social}`, n.social === 'Yes' ? 'done' : ''));
  row.append(pill(`Print · ${n.print}`, n.print === 'Yes' ? 'done' : ''));
  row.append(n.printed ? pill('Printed', 'done') : pill('Not printed'));
  return row;
}

/** Category tag, subject, location · month. */
export function heading(n) {
  const block = el('div', 'stack-1');
  if (n.category) block.append(el('span', 'tag', n.category));
  block.append(el('h2', 'negative-subject', n.subject || 'No subject'));
  const where = [n.location, formatMonth(n.dateTaken) || n.dateTaken].filter(Boolean).join(' · ');
  if (where) block.append(el('p', 'text-sm text-muted', where));
  return block;
}

function fieldRow(key, value, mono = false) {
  const row = el('div', 'field-row');
  const shown = value === undefined || value === null || value === '' ? '—' : String(value);
  row.append(el('span', 'field-key', key), el('span', `field-value${mono && shown !== '—' ? ' field-value-mono' : ''}`, shown));
  return row;
}

function section(title, rows) {
  const block = el('section', 'span-4 stack-1');
  const group = el('div', 'field-group');
  rows.forEach(([key, value, mono]) => group.append(fieldRow(key, value, mono)));
  block.append(el('h3', 'section-label', title), group);
  return block;
}

const yesNo = (value) => (value ? 'Yes' : 'No');

/** "Shot log" section for a negative synced from Shoot. lensName: name of the shot's lens. */
export function shotSection(shot, lensName, lightingLine) {
  const taken = shot.takenAt ? new Date(shot.takenAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const gps = shot.lat !== undefined ? `${shot.lat.toFixed(4)}, ${shot.lng.toFixed(4)}` : '';
  return section('Shot log', [
    ['Shot', `${shot.shotNumber}`, true],
    ['Taken', taken],
    ['Lens', lensName],
    ['Aperture', shot.aperture, true],
    ['Light', shot.light],
    ['Filter', shot.filter],
    ['Lighting', lightingLine || 'Natural light'],
    ['Place', shot.placeName],
    ['GPS', gps, true],
  ]);
}

function actionText(n) {
  if (n.action !== 'Edit') return 'None';
  return n.actionComplete ? 'Edit · done' : 'Edit · to do';
}

// Aperture and shutter; nothing when neither was recorded
function exposureSection(n) {
  if (!n.aperture && !n.shutter) return [];
  return [section('Exposure settings', [
    ['Aperture', n.aperture, true],
    ['Shutter', n.shutter, true],
  ])];
}

/** Gear, Exposure settings, Review, Files, Output and Notes sections. names: { camera, lens }. */
export function detailSections(n, roll, names) {
  const notes = el('section', 'span-4 stack-1');
  notes.append(el('h3', 'section-label', 'Notes'), el('p', `card${n.notes ? '' : ' text-muted'}`, n.notes || 'No notes'));
  return [
    section('Gear', [
      ['Camera', names.camera],
      ['Lens', names.lens],
      ['Film', n.filmStock || roll?.filmStock],
      ['Lab no.', roll?.labNumber, true],
    ]),
    ...exposureSection(n),
    section('Review', [
      ['Focus', n.focus],
      ['Exposure', n.exposure],
      ['Action', actionText(n)],
      ['Rating', n.rating ? `${n.rating} / 5` : 'Not rated'],
    ]),
    section('Files', [
      ['Scan', n.scanFile, true],
      ['Scan size', { L: 'Large', S: 'Small' }[n.scanSize]],
      ['Edit', n.editedFile, true],
    ]),
    section('Output', [
      ['Social', n.social],
      ['Print', n.print],
      ['Printed', yesNo(n.printed)],
    ]),
    notes,
  ];
}
