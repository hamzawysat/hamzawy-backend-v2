'use strict';

(function () {
  const script = document.currentScript;
  if (script && script.dataset.sonaaPage === 'admin') {
    // Admin uses a private URL without an /admin path segment. Preserve the
    // role hint used by Web Push without retaining any visual-editor preview code.
    window.__SONAA_PAGE_ROLE__ = 'admin';
  }
})();
