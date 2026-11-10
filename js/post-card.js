// One post in the Feed: roll badge, place and type, the image at its own shape with the
// film-edge band, like / share / save, caption (editable from the … menu), gear tags, link.

import { formatMonth } from './archive-data.js';
import { setCaption, toggleLike, toggleSave, unpostNegative } from './feed.js';
import { showPreview } from './previews.js';

const ICONS = {
  heart: '<svg class="tab-icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  share: '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M22 3L11 14M22 3l-7 18-4-7-7-4 18-7z"/></svg>',
  save: '<svg class="tab-icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  more: '<svg class="tab-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconButton(icon, label, pressed) {
  const button = el('button', 'icon-button post-action');
  button.type = 'button';
  button.innerHTML = ICONS[icon];
  button.setAttribute('aria-label', label);
  if (pressed !== undefined) button.setAttribute('aria-pressed', String(pressed));
  return button;
}

/** The preview blob to show and share: edit, else scan, else Shoot reference photo. */
const imageBlobId = (n) => n.editThumbBlobId || n.editBlobId || n.thumbBlobId || n.refThumbBlobId;

async function shareFile(db, n) {
  const id = imageBlobId(n);
  const blob = id ? (await db.get('blobs', id))?.blob : undefined;
  return blob ? new File([blob], `${n.id}.jpg`, { type: blob.type || 'image/jpeg' }) : undefined;
}

/** Builds the card. names: { camera, lens }. onRemoved() is called after Remove from feed. */
export async function postCard(db, initial, roll, names, onRemoved) {
  let n = initial;
  const card = el('article', 'post-card');

  // Head: badge, place / type · month, … menu
  const head = el('div', 'post-head');
  head.append(el('span', 'post-badge', n.rollId));
  const where = el('div', 'post-head-text');
  where.append(el('span', 'text-sm text-bold', n.location || 'Unknown place'), el('span', 'text-xs text-muted', [n.category, formatMonth(n.dateTaken)].filter(Boolean).join(' · ')));
  const more = iconButton('more', `Options for ${n.id}`);
  more.setAttribute('aria-expanded', 'false');
  head.append(where, more);
  const menu = el('div', 'post-menu card stack-1');
  menu.hidden = true;
  const editCaption = el('button', 'button button-secondary button-block', 'Edit caption');
  const remove = el('button', 'button button-secondary button-block', 'Remove from feed');
  [editCaption, remove].forEach((b) => { b.type = 'button'; });
  menu.append(editCaption, remove);
  more.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    more.setAttribute('aria-expanded', String(!menu.hidden));
  });

  // Image at its own shape; 3:2 placeholder when nothing is attached
  const figure = el('div', 'post-image');
  if (imageBlobId(n)) {
    const img = el('img');
    img.alt = n.caption || n.subject || n.id;
    showPreview(img, imageBlobId(n), { full: true }); // loads when the card scrolls near
    figure.append(img);
  } else {
    figure.append(el('span', 'post-image-placeholder text-sm text-muted', 'No image attached'));
  }
  const edge = el('span', 'negative-edge');
  edge.append(el('span', '', (n.filmStock || roll?.filmStock || '').toUpperCase()), el('span', '', `▸ ${n.frameLabel || n.frame || ''}`));
  figure.append(edge);

  // Actions
  const actions = el('div', 'post-actions');
  const like = iconButton('heart', 'Like', Boolean(n.liked));
  const save = iconButton('save', 'Save', Boolean(n.saved));
  like.addEventListener('click', async () => { n = await toggleLike(db, n); like.setAttribute('aria-pressed', String(Boolean(n.liked))); });
  save.addEventListener('click', async () => { n = await toggleSave(db, n); save.setAttribute('aria-pressed', String(Boolean(n.saved))); });
  actions.append(like);
  const file = navigator.canShare ? await shareFile(db, n) : undefined;
  if (file && navigator.canShare({ files: [file] })) {
    const share = iconButton('share', 'Share');
    share.addEventListener('click', () => navigator.share({ files: [file], text: n.caption || n.subject }).catch(() => {}));
    actions.append(share);
  }
  actions.append(el('span', 'post-actions-gap'), save);

  // Caption, gear tags, link
  const text = el('div', 'post-text stack-1');
  const caption = el('p', 'text-sm', n.caption || n.subject);
  const tags = el('div', 'tag-row');
  [names.camera, names.lens, n.filmStock || roll?.filmStock].filter(Boolean).forEach((t) => tags.append(el('span', 'tag', t)));
  const link = el('a', 'text-xs text-mono text-muted', `${n.id} · ${n.rollId}${n.strip ? ` · strip ${n.strip}` : ''} · fr ${n.frameLabel || n.frame || '–'} →`);
  link.href = `#/negative/${encodeURIComponent(n.id)}`;
  text.append(caption, tags, link);

  editCaption.addEventListener('click', () => {
    menu.hidden = true;
    const box = el('div', 'stack-1');
    const input = el('textarea', 'input textarea');
    input.value = n.caption || n.subject || '';
    input.setAttribute('aria-label', 'Caption');
    const buttons = el('div', 'grid grid-inner');
    const ok = el('button', 'span-2 button button-primary', 'Save');
    const cancel = el('button', 'span-2 button button-secondary', 'Cancel');
    [ok, cancel].forEach((b) => { b.type = 'button'; });
    buttons.append(ok, cancel);
    box.append(input, buttons);
    caption.replaceWith(box);
    input.focus();
    cancel.addEventListener('click', () => box.replaceWith(caption));
    ok.addEventListener('click', async () => {
      n = await setCaption(db, n, input.value.trim() || undefined);
      caption.textContent = n.caption || n.subject;
      box.replaceWith(caption);
    });
  });
  remove.addEventListener('click', async () => {
    await unpostNegative(db, n);
    onRemoved(n);
  });

  card.append(head, menu, figure, actions, text);
  return card;
}
