import { archiveScreen } from './archive-screen.js';
import { initControls } from './controls.js';
import { dataScreen } from './data-screen.js';
import { devComponents } from './dev-components.js';
import { exportScreen } from './export-screen.js';
import { feedScreen } from './feed-screen.js';
import { initGridOverlay } from './grid-overlay.js';
import { addScreen, editScreen } from './negative-form.js';
import { negativeScreen } from './negative-screen.js';
import { meterCheck } from './meter-check.js';
import { meterScreen } from './meter-screen.js';
import { initPwa } from './pwa.js';
import { queueScreen } from './queue-screen.js';
import { rollLoadScreen } from './roll-load-screen.js';
import { rollScreen } from './roll-screen.js';
import { searchScreen } from './search-screen.js';
import { initRouter } from './router.js';
import { shootScreen } from './shoot-screen.js';
import { syncScreen } from './sync-screen.js';

function init() {
  initControls();
  initRouter({
    feed: feedScreen,
    archive: archiveScreen,
    add: addScreen,
    shoot: shootScreen,
    'shoot/load': rollLoadScreen,
    'shoot/sync': syncScreen,
    'shoot/meter': meterScreen,
    queue: queueScreen,
    'roll/:id': rollScreen,
    'negative/:id': negativeScreen,
    'negative/:id/edit': editScreen,
    search: searchScreen,
    export: exportScreen,
    data: dataScreen,
    'dev/components': devComponents,
    'dev/meter-check': meterCheck,
  });
  initPwa();
  initGridOverlay();
}

init();
