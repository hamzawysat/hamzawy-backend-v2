'use strict';

function scrollFanniRegistrationTarget(targetId) {
  const target = document.getElementById(String(targetId || ''));
  if (!target) return false;

  const scroller = document.scrollingElement || document.documentElement;
  const currentTop = Number(scroller.scrollTop) ||
    Number(document.body?.scrollTop) ||
    Number(window.scrollY || window.pageYOffset || 0);
  const viewportOffset = Math.max(72, Math.min(128, Math.round((window.innerHeight || 600) * 0.14)));
  const top = Math.max(0, target.getBoundingClientRect().top + currentTop - viewportOffset);
  const html = document.documentElement;
  const previousBehavior = html.style.scrollBehavior;

  html.style.scrollBehavior = 'auto';
  scroller.scrollTop = top;
  if (document.body) document.body.scrollTop = top;
  window.scrollTo(0, top);

  requestAnimationFrame(() => {
    html.style.scrollBehavior = previousBehavior;
  });
  return true;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scrollFanniRegistrationTarget };
}
