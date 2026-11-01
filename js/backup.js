// Backup: the whole database as one JSON file. Images (Blobs) are stored as base64 inside it,
// because a .zip would need a library. Restore replaces everything in one transaction.

import { STORES } from './db.js';

const APP = 'negative-archive';
const FORMAT = 1;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(data, type) {
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type });
}

/** Reads every store. Resolves with a plain object ready for JSON.stringify. */
export async function createBackup(db) {
  const stores = await db.transaction(STORES, 'readonly', async (t) => {
    const all = {};
    for (const name of STORES) all[name] = await t.getAll(name);
    return all;
  });
  // Blobs are converted after the transaction, since FileReader would let it close.
  stores.blobs = await Promise.all(stores.blobs.map(async ({ blob, ...rest }) => ({
    ...rest,
    type: blob?.type || '',
    data: blob ? await blobToBase64(blob) : '',
  })));
  return { app: APP, format: FORMAT, exportedAt: new Date().toISOString(), stores };
}

/** Checks a parsed backup file. Returns a list of errors (empty when it can be restored). */
export function validateBackup(backup) {
  if (!backup || backup.app !== APP) return ['This is not a Negative Archive backup.'];
  if (backup.format !== FORMAT) return [`Backup format ${backup.format} is not supported.`];
  const missing = STORES.filter((name) => !Array.isArray(backup.stores?.[name]));
  return missing.length ? [`Backup is missing: ${missing.join(', ')}.`] : [];
}

/** Replaces the whole database with the backup. Resolves with item counts per store. */
export async function restoreBackup(db, backup) {
  const errors = validateBackup(backup);
  if (errors.length) throw new Error(errors.join(' '));
  const blobs = backup.stores.blobs.map(({ data, type, ...rest }) => ({ ...rest, blob: base64ToBlob(data, type) }));
  return db.transaction(STORES, 'readwrite', async (t) => {
    const counts = {};
    for (const name of STORES) {
      await t.clear(name);
      const items = name === 'blobs' ? blobs : backup.stores[name];
      for (const item of items) await t.put(name, item);
      counts[name] = items.length;
    }
    await t.put('meta', { key: 'last-restore', value: { at: new Date().toISOString(), from: backup.exportedAt } });
    return counts;
  });
}

/** Saves the backup as a file download, and records when. */
export async function downloadBackup(db) {
  const backup = await createBackup(db);
  const file = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `negative-archive-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await db.put('meta', { key: 'last-backup', value: { at: backup.exportedAt } });
  return backup;
}

export const BACKUP_REMINDER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When the data was last saved to a backup file. A restore counts too: right after it, the data
 * on this device matches a backup. Resolves with { lastAt, days } (null when never).
 */
export async function backupStatus(db, now = Date.now()) {
  const [backup, restore] = await Promise.all([db.get('meta', 'last-backup'), db.get('meta', 'last-restore')]);
  const lastAt = [backup?.value.at, restore?.value.at].filter(Boolean).sort().at(-1) || null;
  return { lastAt, days: lastAt ? Math.floor((now - Date.parse(lastAt)) / DAY_MS) : null };
}

/** Remind when there is data and no backup for BACKUP_REMINDER_DAYS days (or never). */
export const backupOverdue = (status, negativeCount) => negativeCount > 0 && (status.days === null || status.days >= BACKUP_REMINDER_DAYS);

/** 'Today', 'Yesterday', '12 days ago', 'Never'. */
export function backupAgeText(status) {
  if (status.days === null) return 'Never';
  if (status.days <= 0) return 'Today';
  return status.days === 1 ? 'Yesterday' : `${status.days} days ago`;
}
