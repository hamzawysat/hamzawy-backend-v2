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
assert.match(clientPage, /client-account\.js\?v=20261123-client-download-referral1/, 'client account script cache key must be bumped for referral-link fix');
assert.match(source, /HAMZAWY_CLIENT_REFERRAL:/, 'download page must copy the client referral marker understood by the Android app');
assert.match(source, /clientCode/);
assert.match(built, /HAMZAWY_CLIENT_REFERRAL:/, 'built production download page must include client referral handoff');
assert.match(source, /HAMZAWY_FANNI_CLAIM:/, 'download page must copy the exact marker understood by the Android app');
assert.match(source, /navigator\.clipboard\.writeText\(clipboardValue\)/, 'download click must copy the claim before starting the APK download');
assert.match(source, /data-continue-download/, 'clipboard-denied browsers must have a manual copy and continue fallback');
assert.match(built, /HAMZAWY_FANNI_CLAIM:/, 'built production download page must include referral handoff');
assert.doesNotMatch(source, /\\\\n<div class="referral-notice"/, 'HTML must not contain literal escaped newline sequences');


const technicianActions = fs.readFileSync(path.join(root, 'frontend/js/fanni-app-only-actions.js'), 'utf8');
const technicianPage = fs.readFileSync(path.join(root, 'frontend/fanni.html'), 'utf8');
assert.match(technicianPage, /fanni-app-only-actions\\.js/, 'technician dashboard must load the referral handoff script');
assert.match(technicianActions, /fetch\\('\/api\/referrals\/prepare-fanni'/, 'technician invite must be converted into a server-side single-use claim');
assert.match(technicianActions, /action=register&claim=/, 'technician app deep link must carry the claim token');
assert.match(technicianActions, /DOWNLOAD_URL\\+'\\?claim='/, 'APK fallback must preserve the claim token');
assert.ok(source.includes('/1.0.16/HSsat.apk'), 'download page must serve the exact current HSsat APK release');
assert.ok(source.includes('/tag/1.0.16'), 'download page release label must match the APK version');
assert.ok(built.includes('/1.0.16/HSsat.apk'), 'built production download page must serve the exact current HSsat APK');
assert.match(built, /HAMZAWY_FANNI_CLAIM:/, 'built production page must hand off technician claim tokens');

console.log('Client and technician referral APK download handoff checks passed.');

assert.ok(source.includes('getInstalledRelatedApps'), 'download page must detect installed Android apps');
assert.ok(source.includes('تحديث التطبيق'), 'download page must label outdated installations as updates');
assert.ok(source.includes('فتح التطبيق'), 'download page must open an installed current app');
assert.ok(source.includes('manifest.webmanifest'), 'download page must declare the related app manifest');
assert.ok(built.includes('getInstalledRelatedApps'), 'built production page must include app detection');
assert.ok(built.includes('/1.0.16/HSsat.apk'), 'built production page must use the exact HSsat release asset');
const appManifest = JSON.parse(fs.readFileSync(path.join(root, 'frontend/manifest.webmanifest'), 'utf8'));
assert.ok(appManifest.related_applications.some((app) => app.platform === 'play' && app.id === 'com.sonaa.app'), 'web manifest must identify the Android package');
const assetLinks = JSON.parse(fs.readFileSync(path.join(root, 'frontend/.well-known/assetlinks.json'), 'utf8'));
assert.ok(assetLinks.some((item) => item.target?.package_name === 'com.sonaa.app'), 'asset links must associate the Android package');

const serverSource = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
assert.ok(serverSource.includes("app.get('/.well-known/assetlinks.json'"), 'server must explicitly serve assetlinks because express.static ignores dotfiles');
