// Negative detail: Post to feed (caption, prefilled with the subject), or, once posted,
// "In the feed since …" with Edit caption and Remove from feed.

import { postNegative, setCaption, unpostNegative } from './feed.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text, onClick) {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

/** The block under Edit details. Changes are saved straight away; the screen re-renders on change. */
export function postBlock(db, n) {
  const block = el('section', 'span-4 stack-1 mb-6');

  const captionEditor = (label, onSave) => {
    const input = el('textarea', 'input textarea');
    input.value = n.caption || n.subject || '';
    input.setAttribute('aria-label', 'Caption');
    const row = el('div', 'grid grid-inner');
    row.append(
      button('span-2 button button-primary', label, () => onSave(input.value.trim() || undefined)),
      button('span-2 button button-secondary', 'Cancel', show),
    );
    block.replaceChildren(el('span', 'form-label', 'Caption'), input, row);
    input.focus();
  };

  function show() {
    if (!n.posted) {
      block.replaceChildren(button('button button-primary button-block', 'Post to feed', () => captionEditor('Post', (caption) => postNegative(db, n, caption))));
      return;
    }
    const since = new Date(n.postedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const feed = el('a', 'text-sm text-bold', 'Open the feed →');
    feed.href = '#/feed';
    const row = el('div', 'grid grid-inner');
    row.append(
      button('span-2 button button-secondary', 'Edit caption', () => captionEditor('Save', (caption) => setCaption(db, n, caption))),
      button('span-2 button button-secondary', 'Remove from feed', () => unpostNegative(db, n)),
    );
    block.replaceChildren(el('p', 'text-sm text-muted', `In the feed since ${since}.`), feed, row);
  }

  show();
  return block;
}
