// Renders an import plan: stat tiles, rows per roll, the problems list and the Import button.

const PROBLEM_LABELS = {
  fixed: 'Fixed',
  check: 'Check',
  duplicate: 'Duplicate',
  skipped: 'Skipped',
  file: 'File',
};
const ATTENTION = ['check', 'duplicate', 'file'];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statTile(value, label, attention = false) {
  const tile = el('div', 'span-1 stat-tile');
  tile.append(el('span', `stat-tile-value${attention ? ' is-attention' : ''}`, String(value)), el('span', 'stat-tile-label', label));
  return tile;
}

function rollRow({ rollId, filmStock, count, skipped }) {
  const row = el('div', 'field-row');
  const key = el('span', 'field-key');
  key.append(el('span', 'text-mono', rollId), document.createTextNode(filmStock ? ` · ${filmStock}` : ''));
  const value = el('span', 'field-value', skipped ? `0 (${skipped} skipped)` : String(count));
  row.append(key, value);
  return row;
}

function problemRow({ type, id, detail, count = 1 }) {
  const row = el('div', 'field-row field-row-2');
  const text = el('div', 'stack-0-5');
  const label = el('span', `text-sm text-bold${ATTENTION.includes(type) ? ' text-edge' : ''}`, PROBLEM_LABELS[type] || type);
  if (count > 1) label.append(document.createTextNode(` · ${count} rows`));
  else if (id) label.append(document.createTextNode(' · '), el('span', 'text-mono', id));
  text.append(label, el('span', 'text-sm text-muted', detail));
  row.append(text);
  return row;
}

// The same fix on many rows (e.g. 'Lens: "Nikkor 24mm f2" → …') is shown once, with a count.
function groupFixes(problems) {
  const groups = new Map();
  problems.filter((p) => p.type === 'fixed').forEach((p) => {
    const group = groups.get(p.detail);
    if (group) group.count += 1;
    else groups.set(p.detail, { ...p, count: 1 });
  });
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

/** Returns the preview element. onImport is called when the Import button is pressed. */
export function renderImportPreview(plan, onImport) {
  const wrap = el('div', 'stack-2');

  const tiles = el('div', 'grid grid-inner');
  const fixes = plan.problems.filter((p) => p.type === 'fixed').length;
  const issues = plan.problems.length - fixes;
  tiles.append(
    statTile(plan.rolls.length, 'rolls'),
    statTile(plan.negatives.length, 'negatives'),
    statTile(issues, 'issues', issues > 0),
    statTile(plan.skipped, 'skipped'),
  );

  const rolls = el('div', 'field-group');
  plan.perRoll.forEach((roll) => rolls.append(rollRow(roll)));

  // Things to check first, then the automatic fixes, grouped.
  const sorted = [...plan.problems.filter((p) => p.type !== 'fixed'), ...groupFixes(plan.problems)];
  const problemsLabel = el('h3', 'section-label', `Report · ${issues} issues · ${fixes} fixes`);
  const problems = el('div', 'field-group');
  sorted.forEach((problem) => problems.append(problemRow(problem)));

  const button = el('button', 'button button-primary button-block mt-1', `Import ${plan.negatives.length} negatives`);
  button.type = 'button';
  button.disabled = plan.negatives.length === 0;
  button.addEventListener('click', () => onImport(button));

  wrap.append(tiles, rolls);
  if (sorted.length) wrap.append(problemsLabel, problems);
  wrap.append(button);
  return wrap;
}
