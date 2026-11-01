// Grid overlay that matches docs/grid-reference.svg.
// Toggle with the G key, or open the page with ?grid in the URL.

const STORAGE_KEY = 'grid-overlay-visible';

function buildOverlay() {
  const header = document.querySelector('.app-header');
  const tabbar = document.querySelector('.app-tabbar');

  const overlay = document.createElement('div');
  overlay.className = 'grid-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const frame = document.createElement('div');
  frame.className = 'grid-overlay-frame';

  const rows = document.createElement('div');
  rows.className = 'grid-overlay-rows';

  const columns = document.createElement('div');
  columns.className = 'grid-overlay-columns';
  for (let i = 1; i <= 4; i += 1) {
    const col = document.createElement('div');
    col.textContent = String(i);
    columns.append(col);
  }

  frame.append(rows, columns);

  const addZone = (label, top, height, isBottom = false) => {
    const zone = document.createElement('div');
    zone.className = isBottom ? 'grid-overlay-zone is-bottom' : 'grid-overlay-zone';
    zone.style.top = `${top}px`;
    zone.style.height = `${height}px`;
    const tag = document.createElement('span');
    tag.className = 'grid-overlay-label';
    tag.textContent = label;
    zone.append(tag);
    frame.append(zone);
  };

  const update = () => {
    frame.querySelectorAll('.grid-overlay-zone').forEach((z) => z.remove());
    if (header) {
      const h = header.getBoundingClientRect();
      addZone(`Header · ${Math.round(h.height)}`, h.top, h.height);
      frame.style.setProperty('--overlay-numbers-top', `${Math.max(h.bottom, 0)}px`);
    }
    if (tabbar) {
      const t = tabbar.getBoundingClientRect();
      addZone(`Tab bar · ${Math.round(t.height)}`, t.top, t.height, true);
    }
  };

  overlay.append(frame);
  document.body.append(overlay);
  return { overlay, update };
}

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function store(visible) {
  try {
    localStorage.setItem(STORAGE_KEY, visible ? '1' : '0');
  } catch {
    // Storage unavailable: overlay still works for this page view.
  }
}

export function initGridOverlay() {
  const { overlay, update } = buildOverlay();
  const params = new URLSearchParams(window.location.search);
  let visible = params.has('grid') || readStored();

  const render = () => {
    overlay.classList.toggle('is-visible', visible);
    if (visible) update();
  };

  document.addEventListener('keydown', (event) => {
    const typing = event.target.closest('input, textarea, select, [contenteditable]');
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'g' || event.key === 'G') {
      visible = !visible;
      store(visible);
      render();
    }
  });

  window.addEventListener('resize', () => visible && update());
  window.addEventListener('scroll', () => visible && update(), { passive: true });

  render();
}
