// Builds one film strip (up to 6 frames) from frame data.
// frames: [{ frame: '6', id: '2026-0078', status: 'to-edit' | 'edited' | null, flags: ['U'], image?: url }]
// options.selected: id of the frame to outline. options.href(frame): link for each frame.
// options.interactive = false: frames are plain pictures (for a strip inside a link, e.g. a roll card).
// options.layout = { perStrip, aspect }: frames per strip and frame shape (from formats.js; 35mm by default).

const STATUS_TEXT = { 'to-edit': 'to edit', edited: 'edited' };
const FLAG_TEXT = { U: 'underexposed', O: 'overexposed', S: 'soft' };

function frameLabel({ frame, id, status, flags = [], draft }) {
  const parts = [`Frame ${frame}`, id];
  if (draft) parts.push('draft');
  if (status) parts.push(STATUS_TEXT[status]);
  flags.forEach((flag) => parts.push(FLAG_TEXT[flag]));
  return parts.join(', ');
}

function renderFrame(data, { selected, href, interactive = true }) {
  const item = document.createElement('li');

  const link = document.createElement(interactive ? 'a' : 'span');
  link.className = 'film-frame';
  if (interactive) {
    link.href = href ? href(data) : `#/negative/${encodeURIComponent(data.id)}`;
    link.setAttribute('aria-label', frameLabel(data));
  }
  if (data.id === selected) link.setAttribute('aria-current', 'true');

  const image = document.createElement('span');
  image.className = `film-frame-image${data.draft ? ' is-draft' : ''}`;
  if (data.image) image.style.backgroundImage = `url("${data.image}")`;
  if (data.status) {
    const dot = document.createElement('span');
    dot.className = `film-frame-dot is-${data.status}`;
    image.append(dot);
  }

  // Edge print under the frame: ▸N, plus U / O / S flags
  const edge = document.createElement('span');
  edge.className = 'film-frame-edge';
  edge.setAttribute('aria-hidden', 'true');
  const number = document.createElement('span');
  number.textContent = `▸${data.frame}`;
  const flags = document.createElement('span');
  flags.className = 'film-frame-flag';
  flags.textContent = (data.flags || []).join('');
  edge.append(number, flags);

  link.append(image, edge);
  item.append(link);
  return item;
}

export function renderFilmStrip(frames, options = {}) {
  const strip = document.createElement('ol');
  strip.className = 'film-strip';
  if (options.label) strip.setAttribute('aria-label', options.label);
  if (options.interactive === false) strip.setAttribute('aria-hidden', 'true');
  if (options.layout) {
    strip.style.setProperty('--frames-per-strip', options.layout.perStrip);
    strip.style.setProperty('--frame-aspect', options.layout.aspect);
  }
  frames.forEach((data) => strip.append(renderFrame(data, options)));
  return strip;
}
