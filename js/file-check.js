// Classic (non-module) script, because modules don't load from file://.
// If the page was opened as a file, show the "Can't start" card in <main>.

(() => {
  if (window.location.protocol !== 'file:') return;
  const warning = document.querySelector('[data-file-warning]');
  if (warning) warning.hidden = false;
})();
