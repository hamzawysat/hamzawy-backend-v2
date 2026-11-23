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
assert.match(source, /params\.get\('ref'\)/, 'download page must read the client referral code from its URL');
const clientAccount = fs.readFileSync(path.join(root, 'frontend/js/client-account.js'), 'utf8');
const clientPage = fs.readFileSync(path.join(root, 'frontend/client.html'), 'utf8');
assert.match(clientAccount, /function clientDownloadUrl\(\)[\s\S]*?searchParams\.set\('ref',code\)/, 'client page download URL must preserve a valid referral code from the current page URL');
assert.match(clientAccount, /href=\"'\+escAttr\(clientDownloadUrl\(\)\)\+'/,'client download button must use the referral-aware URL');
assert.match(clientPage, /client-account\.js\\?v=20261123-client-download-referral1/, 'client account script cache key must be bumped for referral-link fix');
assert.match(source, /HAMZAWY_CLIENT_REFERRAL:/, 'download page must copy the client referral marker understood by the Android app');
assert.match(source, /clientCode/);
assert.match(built, /HAMZAWY_CLIENT_REFERRAL:/, 'built production download page must include client referral handoff');
assert.match(source, /HAMZAWY_FANNI_CLAIM:/, 'download page must copy the exact marker understood by the Android app');
assert.match(source, /navigator\.clipboard\.writeText\(clipboardValue\)/, 'download click must copy the claim before starting the APK download');
assert.match(source, /data-continue-download/, 'clipboard-denied browsers must have a manual copy and continue fallback');
assert.match(built, /HAMZAWY_FANNI_CLAIM:/, 'built production download page must include referral handoff');
assert.doesNotMatch(source, /\\\\n<div class="referral-notice"/, 'HTML must not contain literal escaped newline sequences');

console.log('Technician referral APK download handoff checks passed.');
