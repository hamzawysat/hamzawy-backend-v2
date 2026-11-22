'use strict';

const assert = require('node:assert/strict');
const { scrollFanniRegistrationTarget } = require('../../frontend/js/fanni-registration-scroll');
const fs = require('node:fs');
const path = require('node:path');

function makeViewport() {
  const state = { scrollTop: 120, bodyTop: 120, scrollTo: null, raf: null, behavior: 'smooth' };
  const target = { getBoundingClientRect: () => ({ top: 420 }) };
  const documentRef = {
    documentElement: { style: { scrollBehavior: state.behavior } },
    scrollingElement: { get scrollTop() { return state.scrollTop; }, set scrollTop(value) { state.scrollTop = value; } },
    body: { get scrollTop() { return state.bodyTop; }, set scrollTop(value) { state.bodyTop = value; } },
    getElementById: id => id === 'registrationIdCard-front' ? target : null
  };
  const windowRef = { innerHeight: 800, scrollY: 120, scrollTo: (x, y) => { state.scrollTo = [x, y]; }, requestAnimationFrame: callback => { state.raf = callback; } };
  return { state, documentRef, windowRef };
}

const { state, documentRef, windowRef } = makeViewport();
if (!scrollFanniRegistrationTarget('registrationIdCard-front', documentRef, windowRef)) {
  throw new Error('Registration card anchor was not found');
}
const expectedTop = 420 + 120 - 112;
assert.equal(state.scrollTop, expectedTop, 'document scroller should move to the requested card');
assert.equal(state.bodyTop, expectedTop, 'body fallback should stay synchronized');
assert.deepEqual(state.scrollTo, [0, expectedTop], 'window scroll should use the same anchor position');
state.raf();
assert.equal(documentRef.documentElement.style.scrollBehavior, 'smooth', 'original scroll behavior should be restored');
assert.equal(scrollFanniRegistrationTarget('missing-anchor', documentRef, windowRef), false);

const renderSource = fs.readFileSync(path.join(__dirname, '../../frontend/js/fanni-render.js'), 'utf8');
assert.match(renderSource, /function render\(options = \{\}\)/, 'render must accept a registration anchor');
assert.match(renderSource, /if \(scrollTargetId\)[\s\S]*?scrollFanniRegistrationTarget\(scrollTargetId\)/, 'explicit registration anchor must bypass old viewport restoration');

console.log('Technician registration scroll tests: passed');
