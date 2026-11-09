// Data screen: Merge from backup. Choose a file, see what would change, choose how to handle
// full-size scans, then merge.

import { readBackupFile, validateBackup } from './backup.js';
import { applyMerge, previewMerge } from './merge.js';

const FORMAT_DATE = { dateStyle: 'medium', timeStyle: 'short' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function row(key, value) {
  const line = el('div', 'field-row');
  line.append(el('span', 'field-key', key), el('span', 'field-value', String(value)));
  return line;
}

function summaryRows(s) {
  const rows = [['New negatives', s.added], ['Updated', s.updated], ['Kept as they are here', s.kept], ['Already the same', s.same]];
  if (s.clashes) rows.push(['Same ID, different negative', s.clashes]);
  rows.push(['New rolls', s.rollsAdded]);
  if (s.rollsDiffer) rows.push(['Rolls with different details', s.rollsDiffer]);
  if (s.removed) rows.push(['Removed, deleted on the other device', s.removed]);
  s.removedRolls.forEach((r) => rows.push([`${r.id} will be removed`, `${r.items} item${r.items === 1 ? '' : 's'}`]));
  return rows;
}

function fullSizeChoice(summary, formatSize) {
  const wrap = el('div', 'stack-1');
  wrap.append(el('span', 'form-label', `Full-size scans (${summary.fullImages})`));
  const group = el('div', 'segmented');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', 'Full-size scans');
  [['copy', `Copy · ${formatSize(summary.fullSize)}`, true], ['previews', 'Previews only', false]].forEach(([key, label, on]) => {
    const button = el('button', 'segment', label);
    button.type = 'button';
    button.dataset.value = key;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(on));
    button.tabIndex = on ? 0 : -1;
    group.append(button);
  });
  wrap.append(group);
  return wrap;
}

function actionButton(className, text, onClick) {
  const button = el('button', `span-2 button ${className}`, text);
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

/** Wires up the Merge from backup button. say(text) writes to the backup status line. */
export function initMerge(root, getDatabase, say, formatSize) {
  const input = root.querySelector('[data-merge-input]');
  const preview = root.querySelector('[data-merge-preview]');
  root.querySelector('[data-merge]').addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const [file] = input.files;
    input.value = '';
    if (!file) return;
    say('');
    preview.replaceChildren();
    try {
      const backup = await readBackupFile(file);
      const errors = validateBackup(backup);
      if (errors.length) { say(errors.join(' ')); return; }
      const db = await getDatabase();
      const summary = await previewMerge(db, backup);

      const when = new Date(backup.exportedAt).toLocaleString('en-GB', FORMAT_DATE);
      const card = el('div', 'stack-2 mt-1');
      const list = el('div', 'field-group');
      summaryRows(summary).forEach(([key, value]) => list.append(row(key, value)));
      card.append(el('h3', 'section-label', `Merge backup from ${when}`), list);
      const choice = summary.fullImages ? fullSizeChoice(summary, formatSize) : null;
      if (choice) card.append(choice);
      if (summary.nothing) card.append(el('p', 'text-sm text-muted', 'Nothing to merge. This device already has everything in that backup.'));

      const buttons = el('div', 'grid grid-inner');
      const close = actionButton('button-secondary', summary.nothing ? 'Close' : 'Cancel', () => preview.replaceChildren());
      buttons.append(close);
      if (!summary.nothing) {
        buttons.append(actionButton('button-primary', 'Merge', async (event) => {
          event.currentTarget.disabled = true;
          close.disabled = true;
          const copyFull = !choice || choice.querySelector('[aria-checked="true"]').dataset.value === 'copy';
          try {
            const done = await applyMerge(db, backup, { copyFull });
            preview.replaceChildren();
            say(`Merged: ${done.added + done.clashes} added, ${done.updated} updated${done.removed ? `, ${done.removed} removed` : ''}.`);
          } catch (error) {
            preview.replaceChildren();
            say(`Merge failed, nothing was changed: ${error.message}`);
          }
        }));
      }
      card.append(buttons);
      preview.replaceChildren(card);
    } catch (error) {
      say(`Couldn't read that backup: ${error.message}`);
    }
  });
}
