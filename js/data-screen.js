// #/data: what's in the database, spreadsheet import, and backup / restore.
// A pushed screen (no tab bar), reached from the gear button in the Archive header.

import {
  backupAgeText, backupOverdue, backupSizes, backupStatus, downloadBackup, readBackupFile, restoreBackup, validateBackup,
} from './backup.js';
import { initMerge } from './data-merge.js';
import { getDb, onChange } from './db.js';
import { applyImport, planImport } from './import.js';
import { renderImportPreview } from './import-preview.js';
import { isInstalled, storageState } from './pwa.js';
import { APP_VERSION } from './version.js';

const TEMPLATE = `
  <!-- Content, columns 1–4, at 24 -->
  <section class="span-4 stack-1">
    <h2 class="section-label">In the archive</h2>
    <div class="field-group">
      <div class="field-row"><span class="field-key">Negatives</span><span class="field-value" data-stat="negatives">–</span></div>
      <div class="field-row"><span class="field-key">Rolls</span><span class="field-value" data-stat="rolls">–</span></div>
      <div class="field-row"><span class="field-key">Last import</span><span class="field-value" data-stat="last-import">Never</span></div>
      <div class="field-row"><span class="field-key">Last backup</span><span class="field-value" data-stat="last-backup">Never</span></div>
      <div class="field-row"><span class="field-key">Storage</span><span class="field-value" data-stat="storage">–</span></div>
      <div class="field-row"><span class="field-key">Version</span><span class="field-value" data-stat="version">–</span></div>
    </div>
  </section>

  <section class="span-4 stack-1">
    <h2 class="section-label">Import spreadsheet</h2>
    <p class="text-sm text-muted">Export the catalogue from Numbers as CSV, then choose the file. You'll see a preview and a report before anything is saved. Negatives already in the app are left as they are.</p>
    <button class="button button-secondary button-block" type="button" data-choose-csv>Choose CSV file</button>
    <input type="file" accept=".csv,text/csv" multiple hidden data-csv-input>
    <p class="text-sm" role="status" data-status="import"></p>
    <div class="mt-1" data-preview></div>
  </section>

  <section class="span-4 stack-1 mb-6">
    <h2 class="section-label">Backup</h2>
    <p class="text-sm text-muted">Everything is stored on this phone only. Export a backup now and then, and keep it somewhere safe.</p>
    <div class="stack-1">
      <span class="form-label" id="backup-include-label">Include</span>
      <div class="segmented" role="radiogroup" aria-labelledby="backup-include-label" data-backup-include>
        <button class="segment" type="button" role="radio" aria-checked="true" tabindex="0" data-value="everything">Everything</button>
        <button class="segment" type="button" role="radio" aria-checked="false" tabindex="-1" data-value="previews">Previews only</button>
      </div>
    </div>
    <button class="button button-secondary button-block" type="button" data-export>Export backup</button>
    <button class="button button-secondary button-block" type="button" data-restore>Restore from backup</button>
    <button class="button button-secondary button-block" type="button" data-merge>Merge from backup</button>
    <input type="file" hidden data-restore-input>
    <input type="file" hidden data-merge-input>
    <p class="text-xs text-muted" data-install-hint hidden>Install to the Home Screen (Share → Add to Home Screen) so iPhone keeps your data.</p>
    <p class="text-sm" role="status" data-status="backup"></p>
    <div data-merge-preview></div>
  </section>
`;

const MB = 1024 * 1024;
const formatSize = (bytes) => (bytes >= 1024 * MB ? `${(bytes / (1024 * MB)).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / MB))} MB`);
const formatDate = (iso) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

async function refreshStats(root, db) {
  const [negatives, rolls, lastImport, backup, storage, sizes] = await Promise.all([
    db.count('negatives'),
    db.count('rolls'),
    db.get('meta', 'last-import'),
    backupStatus(db),
    storageState(),
    backupSizes(db),
  ]);
  const include = (choice, label, bytes) => {
    root.querySelector(`[data-backup-include] [data-value="${choice}"]`).textContent = bytes ? `${label} · ${formatSize(bytes)}` : label;
  };
  include('everything', 'Everything', sizes.everything);
  include('previews', 'Previews only', sizes.previews);
  const set = (key, text) => {
    const node = root.querySelector(`[data-stat="${key}"]`);
    node.textContent = text;
    return node;
  };
  set('negatives', String(negatives));
  set('rolls', String(rolls));
  set('version', `${APP_VERSION} · ${isInstalled() ? 'installed app' : 'browser'}`);
  set('last-import', lastImport ? formatDate(lastImport.value.at) : 'Never');
  set('last-backup', backupAgeText(backup)).classList.toggle('text-edge', backupOverdue(backup, negatives));
  const used = storage.usage ? ` · ${(storage.usage / 1024 / 1024).toFixed(1)} MB` : '';
  // Installed Home Screen apps are kept by iOS even when the browser doesn't report it
  const kept = storage.persisted || isInstalled();
  set('storage', `${kept ? 'Kept' : 'May be cleared'}${used}`).classList.toggle('text-edge', !kept);
  root.querySelector('[data-install-hint]').hidden = isInstalled();
}

function renderPage() {
  const root = document.createElement('div');
  root.className = 'grid grid-sections';
  root.innerHTML = TEMPLATE;

  const preview = root.querySelector('[data-preview]');
  const csvInput = root.querySelector('[data-csv-input]');
  const restoreInput = root.querySelector('[data-restore-input]');
  const say = (text, where = 'import') => { root.querySelector(`[data-status="${where}"]`).textContent = text; };

  getDb().then((db) => {
    refreshStats(root, db);
    const stop = onChange(({ name }) => {
      if (!root.isConnected) { stop(); return; }
      if (name === db.name) refreshStats(root, db);
    });
  }).catch((error) => say(`Couldn't open the database: ${error.message}`));

  root.querySelector('[data-choose-csv]').addEventListener('click', () => csvInput.click());
  csvInput.addEventListener('change', async () => {
    const files = [...csvInput.files];
    csvInput.value = '';
    if (!files.length) return;
    const texts = await Promise.all(files.map(async (file) => ({ name: file.name, text: await file.text() })));
    const plan = planImport(texts);
    const source = files.map((file) => file.name).join(', ');
    say('');
    preview.replaceChildren(renderImportPreview(plan, async (button) => {
      button.disabled = true;
      try {
        const { added, alreadyThere } = await applyImport(await getDb(), plan, source);
        preview.replaceChildren();
        say(`Imported ${added} negatives.${alreadyThere ? ` ${alreadyThere} were already in the app and were left as they are.` : ''}`);
      } catch (error) {
        button.disabled = false;
        say(`Import failed, nothing was saved: ${error.message}`);
      }
    }));
  });

  root.querySelector('[data-export]').addEventListener('click', async () => {
    try {
      const previewsOnly = root.querySelector('[data-backup-include] [aria-checked="true"]').dataset.value === 'previews';
      const { negatives, rolls, size } = await downloadBackup(await getDb(), { previewsOnly });
      say(`Backup saved: ${negatives} negatives, ${rolls} rolls, ${previewsOnly ? 'previews only, ' : ''}${formatSize(size)}.`, 'backup');
    } catch (error) {
      say(`Backup failed: ${error.message}`, 'backup');
    }
  });

  initMerge(root, getDb, (text) => say(text, 'backup'), formatSize);

  root.querySelector('[data-restore]').addEventListener('click', () => restoreInput.click());
  restoreInput.addEventListener('change', async () => {
    const [file] = restoreInput.files;
    restoreInput.value = '';
    if (!file) return;
    try {
      const backup = await readBackupFile(file);
      const errors = validateBackup(backup);
      if (errors.length) { say(errors.join(' '), 'backup'); return; }
      const when = formatDate(backup.exportedAt);
      const ok = window.confirm(`Replace everything in the app with the backup from ${when} (${backup.stores.negatives.length} negatives)? This can't be undone. Export a backup first if you want to keep what's here.${backup.previewsOnly ? '\n\nThis backup has previews only: full-size scans and edits on this device will be deleted. To keep them, use Merge from backup instead.' : ''}`);
      if (!ok) return;
      const counts = await restoreBackup(await getDb(), backup);
      say(`Restored ${counts.negatives} negatives and ${counts.rolls} rolls from ${when}.`, 'backup');
    } catch (error) {
      say(`Restore failed, nothing was changed: ${error.message}`, 'backup');
    }
  });

  return root;
}

export const dataScreen = {
  title: 'Data',
  pushed: true,
  render: renderPage,
};
