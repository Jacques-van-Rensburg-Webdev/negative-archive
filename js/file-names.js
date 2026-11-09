// The scans were renamed on the computer ('R1-09400-0003.TIF' → 'R001_Fomapan-400_2026-08_0003.TIF').
// This brings stored file names in line when the app starts, also after restoring an older backup.
// Only names still in the old 'R1-' style, or with the 'Formapan-400' misspelling, change, on the rolls listed here.

const RENAMED_ROLLS = {
  R001: 'Fomapan-400_2026-08',
  R002: 'Fomapan-400_2026-08',
  R003: 'Safelight-XX-250_2026-08',
  R004: 'Fomapan-400_2026-09',
  R001C: 'Kodak-Gold-200_2026-09',
};
const OLD_SCAN = /^R1-\d{5}-(\d{4})\.(\w+)$/;
const OLD_EDIT = /^R1-\d{5}-(\d{4}) ?EDT(\d+)\.(\w+)$/;

/** The current name for a stored file name; anything else comes back as it is. */
export function currentFileName(rollId, name) {
  const suffix = RENAMED_ROLLS[rollId];
  if (!suffix || !name) return name;
  if (name.includes('Formapan-400')) return name.replace('Formapan-400', 'Fomapan-400');
  const trimmed = name.trim();
  const scan = OLD_SCAN.exec(trimmed);
  if (scan) return `${rollId}_${suffix}_${scan[1]}.${scan[2]}`;
  const edit = OLD_EDIT.exec(trimmed);
  if (edit) return `${rollId}_${suffix}_${edit[1]}_EDT${edit[2]}.${edit[3]}`;
  return name;
}

const isOutOfDate = (n) => currentFileName(n.rollId, n.scanFile) !== n.scanFile || currentFileName(n.rollId, n.editedFile) !== n.editedFile;

/** Updates every negative with an old-style file name. Resolves with how many changed. */
export async function updateFileNames(db) {
  if (!(await db.getAll('negatives')).some(isOutOfDate)) return 0; // nothing to write, so screens don't redraw
  return db.transaction(['negatives'], 'readwrite', async (t) => {
    let changed = 0;
    for (const n of await t.getAll('negatives')) {
      if (isOutOfDate(n)) {
        await t.put('negatives', { ...n, scanFile: currentFileName(n.rollId, n.scanFile), editedFile: currentFileName(n.rollId, n.editedFile) });
        changed += 1;
      }
    }
    return changed;
  });
}
