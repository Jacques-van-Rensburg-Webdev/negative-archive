// Service worker: precaches the app shell (pages, styles, scripts, fonts, icons).
// Bump VERSION whenever a shell file changes so clients pick up the new copy.

const VERSION = 'v36';
const SHELL_CACHE = `shell-${VERSION}`;

const SHELL_FILES = [
  './',
  'index.html',
  'print.html',
  'manifest.webmanifest',
  'css/tokens.css',
  'css/styles.css',
  'css/print.css',
  'js/app.js',
  'js/archive-data.js',
  'js/archive-screen.js',
  'js/backup.js',
  'js/controls.js',
  'js/csv.js',
  'js/data-merge.js',
  'js/data-screen.js',
  'js/db.js',
  'js/deletions.js',
  'js/dev-components.js',
  'js/file-check.js',
  'js/export-screen.js',
  'js/feed-screen.js',
  'js/feed.js',
  'js/file-names.js',
  'js/files.js',
  'js/film-catalogue.js',
  'js/film-field.js',
  'js/film-picker.js',
  'js/formats.js',
  'js/gear.js',
  'js/film-strip.js',
  'js/grid-overlay.js',
  'js/ids.js',
  'js/image-kinds.js',
  'js/import-checks.js',
  'js/import-map.js',
  'js/import-preview.js',
  'js/import.js',
  'js/inline-set.js',
  'js/merge-records.js',
  'js/merge.js',
  'js/negative-attach.js',
  'js/negative-form-fields.js',
  'js/negative-form-values.js',
  'js/negative-form.js',
  'js/negative-screen.js',
  'js/negative-sections.js',
  'js/pdf-plan.js',
  'js/post-block.js',
  'js/post-card.js',
  'js/print-pages.js',
  'js/print-tables.js',
  'js/pwa.js',
  'js/queue-screen.js',
  'js/queue.js',
  'js/roll-delete.js',
  'js/roll-load-screen.js',
  'js/roll-screen.js',
  'js/router.js',
  'js/schema.js',
  'js/search-screen.js',
  'js/search.js',
  'js/shoot-controls.js',
  'js/shoot-screen.js',
  'js/shots.js',
  'js/sync-screen.js',
  'js/sync.js',
  'fonts/archivo-latin-400-normal.woff2',
  'fonts/archivo-latin-ext-400-normal.woff2',
  'fonts/archivo-latin-500-normal.woff2',
  'fonts/archivo-latin-ext-500-normal.woff2',
  'fonts/archivo-latin-600-normal.woff2',
  'fonts/archivo-latin-ext-600-normal.woff2',
  'fonts/archivo-latin-700-normal.woff2',
  'fonts/archivo-latin-ext-700-normal.woff2',
  'fonts/ibm-plex-mono-latin-400-normal.woff2',
  'fonts/ibm-plex-mono-latin-ext-400-normal.woff2',
  'fonts/ibm-plex-mono-latin-500-normal.woff2',
  'fonts/ibm-plex-mono-latin-ext-500-normal.woff2',
  'assets/images/icon.svg',
  'assets/images/icon-192.png',
  'assets/images/icon-512.png',
  'assets/images/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // cache: 'reload' skips the browser's HTTP cache (GitHub Pages allows 10 minutes), so a new
      // version never stores the previous version's files
      .then((cache) => cache.addAll(SHELL_FILES.map((file) => new Request(file, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = [SHELL_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Cache-first: serve from the cache, otherwise fetch and store a copy.
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request, { ignoreSearch: cacheName === SHELL_CACHE });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Page loads try the network, then the cached page (index.html or print.html) when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(request, { ignoreSearch: true })) || caches.match('index.html')),
    );
    return;
  }

  event.respondWith(cacheFirst(request, SHELL_CACHE));
});
