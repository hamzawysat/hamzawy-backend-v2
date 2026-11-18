'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', 'admin-dist');
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff'
};

async function main() {
  if (!fs.existsSync(path.join(root, 'admin.html'))) throw new Error('admin-dist/admin.html is missing; build the artifact first');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ notifications: [], unreadCount: 0, permissions: {}, isAdmin: false }));
      return;
    }
    const relative = decodeURIComponent(url.pathname === '/' ? '/admin.html' : url.pathname).replace(/^\/+/, '');
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) && file !== path.join(root, 'admin.html')) {
      res.writeHead(403); res.end(); return;
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(4174, '127.0.0.1', resolve);
  });

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const failedAssets = [];
    const pageErrors = [];
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.origin === 'http://127.0.0.1:4174' && !url.pathname.startsWith('/api/') && response.status() >= 400) {
        failedAssets.push(response.status() + ' ' + url.pathname);
      }
    });
    page.on('pageerror', error => pageErrors.push(error.message));
    const response = await page.goto('http://127.0.0.1:4174/admin.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (!response || response.status() !== 200) throw new Error('Independent admin entrypoint did not return HTTP 200');
    await page.locator('body').waitFor();
    await page.waitForTimeout(1500);
    if (failedAssets.length) throw new Error('Independent admin artifact has missing assets: ' + failedAssets.join('; '));
    if (pageErrors.length) throw new Error('Independent admin page runtime errors: ' + pageErrors.join('; '));
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'admin-ui-manifest.json'), 'utf8'));
    if (manifest.entrypoint !== '/admin.html' || manifest.apiMode !== 'same-origin') throw new Error('Admin artifact manifest contract is invalid');
    for (const forbidden of ['editor.backup.html', 'admin-setup.html', 'js/admin-setup.js']) {
      if (manifest.files.includes(forbidden)) throw new Error('Unexpected non-release file included: ' + forbidden);
    }
    console.log('Independent admin artifact browser smoke passed:', manifest.files.length, 'files; same-origin API mock responded; no missing assets or page errors.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error('Independent admin artifact smoke failed:', error);
  process.exitCode = 1;
});
