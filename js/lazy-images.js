// Shows a preview only while its element is on or near the screen, and lets it go afterwards,
// so a long archive doesn't hold every decoded picture in memory (phones crash if it does).

const NEAR_SCREEN = '400px';

const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!target.isConnected) { observer.unobserve(target); return; }
      target.style.backgroundImage = isIntersecting ? `url("${target.dataset.lazyImage}")` : '';
    });
  }, { rootMargin: NEAR_SCREEN })
  : null;

/** Sets node's background to url, but only while it's near the screen. */
export function lazyBackground(node, url) {
  if (!observer) {
    node.style.backgroundImage = `url("${url}")`;
    return;
  }
  node.dataset.lazyImage = url;
  observer.observe(node);
}
