// Backup: the whole database as one file. A short header, the records as JSON, then each image's
// original bytes one after another. Nothing is joined into one big string, so the file can be
// larger than a browser's longest string. Older .json backups (images as base64) still restore.

import { STORES } from './db.js';

const APP = 'negative-archive';
const MAGIC = 'NEGATIVE-ARCHIVE-BACKUP';
const FORMAT = 2;
const JSON_FORMAT = 1;
const HEADER_LIMIT = 64; // bytes that always hold the first two lines
const URL_LIFETIME_MS = 60 * 1000; // long enough for a large file to start saving

function base64ToBlob(data, type) {
  const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type });
}

/** Builds the backup file from every store. Resolves with { file, exportedAt, stores }. */
export async function createBackupFile(db) {
  const stores = await db.transaction(STORES, 'readonly', async (t) => {
    const all = {};
    for (const name of STORES) all[name] = await t.getAll(name);
    return all;
  });
  let offset = 0;
  const images = [];
  const blobs = stores.blobs.map(({ blob, ...rest }) => {
    const entry = { ...rest, type: blob?.type || '', offset, size: blob?.size || 0 };
    if (blob) images.push(blob);
    offset += entry.size;
    return entry;
  });
  const exportedAt = new Date().toISOString();
  const encoder = new TextEncoder();
  const manifest = encoder.encode(JSON.stringify({ app: APP, format: FORMAT, exportedAt, stores: { ...stores, blobs } }));
  const header = encoder.encode(`${MAGIC}\n${manifest.length}\n`);
  const file = new Blob([header, manifest, ...images], { type: 'application/octet-stream' });
  return { file, exportedAt, stores };
}

/** Reads a chosen file, new format or older .json. Rejects if it isn't a complete backup. */
export async function readBackupFile(file) {
  const start = await file.slice(0, HEADER_LIMIT).text();
  if (start.startsWith(`${MAGIC}\n`)) {
    const [magic, length] = start.split('\n');
    const manifestStart = magic.length + length.length + 2;
    const dataStart = manifestStart + Number(length);
    const backup = JSON.parse(await file.slice(manifestStart, dataStart).text());
    const end = dataStart + (backup.stores?.blobs || []).reduce((sum, b) => sum + b.size, 0);
    if (file.size < end) throw new Error('This backup file is incomplete.');
    backup.stores.blobs = backup.stores.blobs.map(({ offset, size, type, ...rest }) => (
      { ...rest, blob: file.slice(dataStart + offset, dataStart + offset + size, type) }
    ));
    return backup;
  }
  if (!start.trimStart().startsWith('{')) throw new Error('This is not a Negative Archive backup.');
  return JSON.parse(await file.text());
}

/** Checks a backup. Returns a list of errors (empty when it can be restored). */
export function validateBackup(backup) {
  if (!backup || backup.app !== APP) return ['This is not a Negative Archive backup.'];
  if (backup.format !== FORMAT && backup.format !== JSON_FORMAT) return [`Backup format ${backup.format} is not supported.`];
  const missing = STORES.filter((name) => !Array.isArray(backup.stores?.[name]));
  return missing.length ? [`Backup is missing: ${missing.join(', ')}.`] : [];
}

/** A backup's images as store entries ({ id, blob, … }), whichever format it is. */
export const backupBlobs = (backup) => (backup.format === JSON_FORMAT
  ? backup.stores.blobs.map(({ data, type, ...rest }) => ({ ...rest, blob: base64ToBlob(data, type) }))
  : backup.stores.blobs);

/** Replaces the whole database with the backup. Resolves with item counts per store. */
export async function restoreBackup(db, backup) {
  const errors = validateBackup(backup);
  if (errors.length) throw new Error(errors.join(' '));
  const blobs = backupBlobs(backup);
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

/** Saves the backup as a file download, and records when. Resolves with its counts and size. */
export async function downloadBackup(db) {
  const { file, exportedAt, stores } = await createBackupFile(db);
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `negative-archive-backup-${exportedAt.slice(0, 10)}.nabackup`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), URL_LIFETIME_MS);
  await db.put('meta', { key: 'last-backup', value: { at: exportedAt } });
  return { negatives: stores.negatives.length, rolls: stores.rolls.length, size: file.size };
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
