// Runs first, in <head>. When index.html is the Chrome extension's popup, mark
// the page so css/app.css can size it, and open links in a new tab instead of
// inside the popup. On pasteinto.com this does nothing.
(function () {
  if (location.protocol !== 'chrome-extension:') return;
  document.documentElement.classList.add('is-extension');
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href^="http"]').forEach((/** @type {HTMLAnchorElement} */ link) => {
      link.target = '_blank';
      link.rel = 'noopener';
    });
  });
})();
