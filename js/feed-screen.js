// Feed tab: the roll row, then posted pictures newest first, ten at a time
// (more load as you scroll near the end). Personal and local: likes and saves stay on this phone.

import { groupByRoll, loadArchive } from './archive-data.js';
import { getDb } from './db.js';
import { feedPosts, rollRow } from './feed.js';
import { postCard } from './post-card.js';

const PAGE = 10;
const SEARCH_ICON = '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function rollStrip(items) {
  const row = el('nav', 'full-bleed flush-top story-row');
  row.setAttribute('aria-label', 'Rolls');
  items.forEach(({ roll, label, attention }) => {
    const link = el('a', 'story');
    link.href = `#/roll/${encodeURIComponent(roll.id)}`;
    link.setAttribute('aria-label', `${roll.id}, ${label}${attention ? ', needs attention' : ''}`);
    const ring = el('span', `story-ring${attention ? ' is-attention' : ''}`);
    ring.append(el('span', 'story-inner', roll.id));
    // "Sep · Berlin" as two short lines, so it fits under a 64 circle
    const caption = el('span', 'story-label');
    label.split(' · ').forEach((part) => caption.append(el('span', '', part)));
    link.append(ring, caption);
    row.append(link);
  });
  return row;
}

function render() {
  const root = el('div', 'grid');
  const list = el('div', 'full-bleed stack-4 mb-6');
  let observer;

  getDb().then(async (db) => {
    const { rolls, negatives, cameras, lenses } = await loadArchive(db);
    const byRoll = groupByRoll(negatives);
    const rollById = new Map(rolls.map((r) => [r.id, r]));
    const posts = feedPosts(negatives);
    root.replaceChildren(rollStrip(rollRow(rolls, byRoll, await db.getAll('shots'))), list);

    if (!posts.length) {
      const empty = el('div', 'empty-state stack-1 feed-empty');
      const link = el('a', 'text-sm text-bold', 'Open the Post queue →');
      link.href = '#/queue?list=post';
      empty.append(el('span', 'text-bold', 'Nothing posted yet'), el('span', 'text-sm text-muted', 'Post a negative from its page (Post to feed), or tick it off in the Post queue.'), link);
      list.append(empty);
      return;
    }

    let shown = 0;
    let loading = false;
    const sentinel = el('div', 'feed-sentinel');
    const more = async () => {
      if (loading) return;
      loading = true;
      const next = posts.slice(shown, shown + PAGE);
      shown += next.length;
      for (const n of next) {
        const names = { camera: cameras.get(n.cameraId), lens: lenses.get(n.lensId) };
        const card = await postCard(db, n, rollById.get(n.rollId), names, () => card.remove());
        list.insertBefore(card, sentinel);
      }
      loading = false;
      if (shown >= posts.length) observer?.disconnect();
    };
    list.append(sentinel);
    await more();
    observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && root.isConnected) more();
    }, { rootMargin: '600px' });
    observer.observe(sentinel);
  });
  return root;
}

function actions() {
  const link = el('a', 'icon-button');
  link.href = '#/search';
  link.setAttribute('aria-label', 'Search');
  link.innerHTML = SEARCH_ICON;
  return [link];
}

export const feedScreen = { title: 'Negatives', actions, render };
