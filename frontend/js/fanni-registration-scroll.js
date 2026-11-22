'use strict';

function scrollFanniRegistrationTarget(targetId, documentRef = document, windowRef = window) {
  const target = documentRef.getElementById(String(targetId || ''));
  if (!target) return false;

  const scroller = documentRef.scrollingElement || documentRef.documentElement;
  const currentTop = Number(scroller.scrollTop) ||
    Number(documentRef.body?.scrollTop) ||
    Number(windowRef.scrollY || windowRef.pageYOffset || 0);
  const viewportOffset = Math.max(72, Math.min(128, Math.round((windowRef.innerHeight || 600) * 0.14)));
  const top = Math.max(0, target.getBoundingClientRect().top + currentTop - viewportOffset);
  const html = documentRef.documentElement;
  const previousBehavior = html.style.scrollBehavior;

  html.style.scrollBehavior = 'auto';
  scroller.scrollTop = top;
  if (documentRef.body) documentRef.body.scrollTop = top;
  windowRef.scrollTo(0, top);

  const schedule = windowRef.requestAnimationFrame || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : callback => callback());
  schedule(() => {
    html.style.scrollBehavior = previousBehavior;
  });
  return true;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scrollFanniRegistrationTarget };
}
