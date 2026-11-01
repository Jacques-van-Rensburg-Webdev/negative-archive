// Registers the service worker (sw.js) so the app installs and opens offline, asks the browser
// to keep the data (persistent storage), and shows "New version ready · Reload" after an update.

/** True when running as an installed app (Home Screen), not in a browser tab. */
export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** { persisted, usage } — whether the browser promises to keep the data, and bytes used. */
export async function storageState() {
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
  const { usage } = navigator.storage?.estimate ? await navigator.storage.estimate() : {};
  return { persisted, usage };
}

function showUpdateBanner() {
  if (document.querySelector('.update-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.className = 'text-sm';
  text.textContent = 'New version ready';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.className = 'button button-sm';
  reload.textContent = 'Reload';
  reload.addEventListener('click', () => window.location.reload());
  banner.append(text, reload);
  // Just before the tab bar, so it sits above it (sticky)
  document.querySelector('.app')?.insertBefore(banner, document.querySelector('.app-tabbar'));
}

export function initPwa() {
  // Installed apps are kept by iOS; this also asks other browsers not to clear the data.
  navigator.storage?.persist?.().catch(() => {});

  if (!('serviceWorker' in navigator)) return;
  // The first worker taking over (first visit) is not an update; any change after that is
  // a newly published version.
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) showUpdateBanner();
    hadController = true;
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((registration) => {
      // Check for a new version when the app comes back to the front
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      });
    }).catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
}
