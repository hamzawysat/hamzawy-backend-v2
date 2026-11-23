'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const sourcePath = path.join(root, 'frontend/download.html');
const builtPath = path.join(root, 'frontend-dist/download.html');
const source = fs.readFileSync(sourcePath, 'utf8');
const built = fs.readFileSync(builtPath, 'utf8');

assert.match(source, /id="referralNotice"/, 'download page must render the referral handoff notice');
assert.match(source, /params\.get\('claim'\)/, 'download page must read the saved claim token from its URL');
assert.match(source, /HAMZAWY_FANNI_CLAIM:/, 'download page must copy the exact marker understood by the Android app');
assert.match(source, /navigator\.clipboard\.writeText\(clipboardValue\)/, 'download click must copy the claim before starting the APK download');
assert.match(source, /data-continue-download/, 'clipboard-denied browsers must have a manual copy and continue fallback');
assert.match(built, /HAMZAWY_FANNI_CLAIM:/, 'built production download page must include referral handoff');
assert.match(built, /params\.get\(['"]claim['"]\)/, 'built production page must preserve the claim URL handling');
assert.doesNotMatch(source, /\\\\n<div class="referral-notice"/, 'HTML must not contain literal escaped newline sequences');

console.log('Technician referral APK download handoff checks passed.');
