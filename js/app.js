import { archiveScreen } from './archive-screen.js';
import { initControls } from './controls.js';
import { dataScreen } from './data-screen.js';
import { devComponents } from './dev-components.js';
import { exportScreen } from './export-screen.js';
import { getDb } from './db.js';
import { feedScreen } from './feed-screen.js';
import { updateFileNames } from './file-names.js';
import { initGridOverlay } from './grid-overlay.js';
import { addScreen, editScreen } from './negative-form.js';
import { negativeScreen } from './negative-screen.js';
import { buildThumbnails } from './previews.js';
import { initPwa } from './pwa.js';
import { queueScreen } from './queue-screen.js';
import { rollLoadScreen } from './roll-load-screen.js';
import { rollScreen } from './roll-screen.js';
import { searchScreen } from './search-screen.js';
import { initRouter } from './router.js';
import { shootScreen } from './shoot-screen.js';
import { timerScreen } from './timer-screen.js';
import { syncScreen } from './sync-screen.js';

const THUMBNAILS_DELAY_MS = 3000;

function init() {
  initControls();
  initRouter({
    feed: feedScreen,
    archive: archiveScreen,
    add: addScreen,
    shoot: shootScreen,
    'shoot/load': rollLoadScreen,
    'shoot/sync': syncScreen,
    timer: timerScreen,
    queue: queueScreen,
    'roll/:id': rollScreen,
    'negative/:id': negativeScreen,
    'negative/:id/edit': editScreen,
    search: searchScreen,
    export: exportScreen,
    data: dataScreen,
    'dev/components': devComponents,
  });
  initPwa();
  initGridOverlay();
  getDb().then(updateFileNames).catch(() => {}); // tried again next time the app opens
  // Thumbnails for previews that arrived without them (a merge or restore), after the first screen is up
  setTimeout(() => getDb().then(buildThumbnails).catch(() => {}), THUMBNAILS_DELAY_MS);
}

init();
