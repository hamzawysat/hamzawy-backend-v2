'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'frontend');
const output = path.join(root, 'admin-dist');

// Preserve root-relative paths and shared runtime assets. Exclude only
// unrelated public application entry pages from this standalone UI artifact.
const excludedPages = new Set([
  'index.html',
  'client.html',
  'fanni.html',
  'technicians.html',
  'customers.html'
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : entry.isFile() ? [full] : [];
  });
}

function localAssetPaths(html) {
  const found = new Set();
  const pattern = /(?:src|href)\s*=\s*["']([^"'#]+)["']/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const raw = match[1].split(/[?#]/, 1)[0];
    if (!raw || /^(?:[a-z]+:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) continue;
    if (raw.startsWith('/')) found.add(raw.replace(/^\//, ''));
  }
  return [...found];
}

function main() {
  if (!fs.existsSync(path.join(source, 'admin.html'))) {
    throw new Error('frontend/admin.html is missing');
  }

  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });

  for (const file of walk(source)) {
    const relative = path.relative(source, file).split(path.sep).join('/');
    if (excludedPages.has(relative)) continue;
    const destination = path.join(output, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(file, destination);
  }

  const adminHtml = fs.readFileSync(path.join(output, 'admin.html'), 'utf8');
  const missing = localAssetPaths(adminHtml).filter(asset => !fs.existsSync(path.join(output, asset)));
  if (missing.length) {
    throw new Error('Admin UI artifact is missing referenced assets:\n' + missing.map(x => ' - ' + x).join('\n'));
  }

  const manifest = {
    schemaVersion: 1,
    entrypoint: '/admin.html',
    apiMode: 'same-origin',
    notes: [
      'This is a static UI artifact; it does not contain the API or database.',
      'Preserve the root-relative asset paths when hosting this artifact.',
      'Route /api/* to the backend, or configure an equivalent same-origin reverse proxy.',
      'Do not expose private admin pages or API endpoints as public static files.'
    ],
    files: walk(output).map(file => path.relative(output, file).split(path.sep).join('/')).sort()
  };
  fs.writeFileSync(path.join(output, 'admin-ui-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log('Admin UI artifact created at admin-dist');
  console.log('Files:', manifest.files.length);
  console.log('Entry point: admin.html');
  console.log('API: same-origin /api proxy required');
}

try {
  main();
} catch (error) {
  console.error('Admin UI build failed:', error.message);
  process.exitCode = 1;
}
