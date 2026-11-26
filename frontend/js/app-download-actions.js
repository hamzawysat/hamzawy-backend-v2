(function () {
  'use strict';

  const LATEST_VERSION = '1.0.17';
  const PACKAGE_ID = 'com.sonaa.app';
  const OPEN_URL = 'hamzawy://';

  function compareVersions(installed, latest) {
    const a = String(installed).split('.').map((part) => Number.parseInt(part, 10) || 0);
    const b = String(latest).split('.').map((part) => Number.parseInt(part, 10) || 0);
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      const difference = (a[i] || 0) - (b[i] || 0);
      if (difference) return difference < 0 ? -1 : 1;
    }
    return 0;
  }

  function isAppDownloadLink(anchor) {
    try {
      const url = new URL(anchor.getAttribute('href') || '', window.location.href);
      return url.pathname.replace(/\/+$/, '') === '/download' &&
        (url.origin === window.location.origin ||
          /(^|\.)hamzawy-sat\.dynv6\.net$/i.test(url.hostname) ||
          /(^|\.)hamzawy-sat\.vercel\.app$/i.test(url.hostname));
    } catch (_) {
      return false;
    }
  }

  function hasReferral(url) {
    return url.searchParams.has('ref') ||
      url.searchParams.has('claim') ||
      url.searchParams.has('referralError');
  }

  function replaceVisibleLabel(anchor, label) {
    const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
    let node;
    let changed = false;
    const pattern = /اضغط هنا لتحميل التطبيق|تحميل تطبيق ساتڤيو|تحميل التطبيق|تحديث التطبيق|فتح التطبيق/g;
    while ((node = walker.nextNode())) {
      const next = node.nodeValue.replace(pattern, label);
      if (next !== node.nodeValue) {
        node.nodeValue = next;
        changed = true;
      }
    }
    if (!changed && !anchor.textContent.trim()) anchor.textContent = label;
    anchor.setAttribute('aria-label', label + ' - تطبيق ساتڤيو');
    anchor.dataset.appAction = label;
  }

  function applyState(installedVersion) {
    const installed = installedVersion !== null;
    const outdated = installed && installedVersion &&
      compareVersions(installedVersion, LATEST_VERSION) < 0;
    const label = !installed ? 'تحميل التطبيق' : outdated ? 'تحديث التطبيق' : 'فتح التطبيق';

    document.querySelectorAll('a[href]').forEach((anchor) => {
      if (!isAppDownloadLink(anchor)) return;
      let url;
      try {
        url = new URL(anchor.getAttribute('href'), window.location.href);
      } catch (_) {
        return;
      }
      const destination = url.pathname + url.search + url.hash;
      const keepReferralHandoff = hasReferral(url);
      replaceVisibleLabel(anchor, label);
      if (installed && !outdated && !keepReferralHandoff) {
        if (anchor.getAttribute('href') !== OPEN_URL) anchor.setAttribute('href', OPEN_URL);
      } else if (anchor.getAttribute('href') !== destination) {
        anchor.setAttribute('href', destination);
      }
    });
  }

  async function detectInstalledApp() {
    if (typeof navigator.getInstalledRelatedApps !== 'function') {
      applyState(null);
      return;
    }
    try {
      const related = await navigator.getInstalledRelatedApps();
      const installed = related.find((item) => item.platform === 'play' && item.id === PACKAGE_ID);
      applyState(installed ? String(installed.version || '').trim() : null);
    } catch (_) {
      applyState(null);
    }
  }

  function scan() {
    void detectInstalledApp();
  }

  scan();
  if (typeof MutationObserver === 'function' && document.documentElement) {
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      Promise.resolve().then(() => {
        queued = false;
        scan();
      });
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href']
    });
  }
})();