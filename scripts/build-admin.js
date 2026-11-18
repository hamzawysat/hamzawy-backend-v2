'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'frontend');
const output = path.join(root, 'admin-dist');

// Keep the admin artifact independent from unrelated public entry pages and
// never publish the one-time bootstrap form as part of the static UI bundle.
const excludedPages = new Set([
  'index.html',
  'client.html',
  'fanni.html',
  'technicians.html',
  'customers.html',
  'admin-setup.html',
  'js/admin-setup.js'
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : entry.isFile() ? [full] : [];
  });
}

function cleanAssetPath(raw) {
  if (!raw || /^(?:[a-z]+:)?\\/\\//i.test(raw) || /^(?:data|blob|javascript):/i.test(raw)) return null;
  const value = raw.split(/[?#]/, 1)[0];
  if (!value || !/\\.(?:html?|css|js|mjs|json|webmanifest|png|jpe?g|webp|svg|gif|ico|woff2?|ttf|otf|mp4|webm)$/i.test(value)) return null;
  return value.replace(/^\\//, '');
}

// Discover assets reachable from admin.html through HTML, CSS and JS references.
// This is deliberately conservative: it validates static file references, not API routes.
function referencedAssets(file, content) {
  const found = new Set();
  const patterns = [
    /(?:src|href)\\s*=\\s*["']([^"'#]+)["']/gi,
    /url\\(\\s*["']?([^"'")]+)["']?\\s*\\)/gi,
    /(?:import\\s*\\(|import\\s+[^;]*?from\\s*)["']([^"']+)["']/gi,
    /["'`]((?:\\/(?:js|css|images|fonts|icons)\\/|\\/(?:web-push\\.js|page-visit\\.js|manifest\\.webmanifest|service-worker\\.js))[^"'`\\s]*)["'`]/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content))) {
      const raw = match[1];
      if (!raw || /^(?:[a-z]+:)?\\/\\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) continue;
      const candidate = cleanAssetPath(raw);
      if (!candidate) continue;
      const resolved = raw.startsWith('/')
        ? candidate
        : path.posix.normalize(path.posix.join(path.posix.dirname(file), candidate));
      if (!resolved.startsWith('../')) found.add(resolved);
    }
  }
  return [...found];
}

function validateDependencyClosure() {
  const queue = ['admin.html'];
  const visited = new Set();
  const missing = new Set();

  while (queue.length) {
    const relative = queue.shift();
    if (visited.has(relative)) continue;
    visited.add(relative);
    const full = path.join(output, relative);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      missing.add(relative);
      continue;
    }
    if (!/\\.(?:html?|css|js|mjs)$/i.test(relative)) continue;
    const content = fs.readFileSync(full, 'utf8');
    for (const asset of referencedAssets(relative, content)) {
      const target = path.join(output, asset);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) missing.add(asset);
      else if (/\\.(?:html?|css|js|mjs)$/i.test(asset)) queue.push(asset);
    }
  }

  // admin-setup is intentionally not part of the deployable artifact.
  if (fs.existsSync(path.join(output, 'admin-setup.html')) ||
      fs.existsSync(path.join(output, 'js/admin-setup.js'))) {
    throw new Error('One-time admin bootstrap files must not be included in the public UI artifact');
  }
  if (missing.size) {
    throw new Error('Admin UI dependency check failed; missing referenced files:\\n' +
      [...missing].sort().map(x => ' - ' + x).join('\\n'));
  }
  return [...visited].sort();
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

  const dependencies = validateDependencyClosure();
  const manifest = {
    schemaVersion: 1,
    entrypoint: '/admin.html',
    apiMode: 'same-origin',
    dependencyValidation: 'static-html-css-js-closure',
    validatedEntrypoints: dependencies,
    notes: [
      'This is a static UI artifact; it does not contain the API or database.',
      'Preserve root-relative asset paths when hosting this artifact.',
      'Route /api/* to the backend through a same-origin reverse proxy.',
      'The one-time admin bootstrap page and script are intentionally excluded.',
      'The service worker currently targets the configured production origin; do not activate this artifact on a different origin until that behavior is made origin-neutral and tested.',
      'Do not expose private admin pages or API endpoints as public static files.'
    ],
    files: walk(output).map(file => path.relative(output, file).split(path.sep).join('/')).sort()
  };
  fs.writeFileSync(path.join(output, 'admin-ui-manifest.json'), JSON.stringify(manifest, null, 2) + '\\n');

  console.log('Admin UI artifact created at admin-dist');
  console.log('Files:', manifest.files.length);
  console.log('Static dependency files validated:', dependencies.length);
  console.log('Entry point: admin.html');
  console.log('API: same-origin /api proxy required');
}

try {
  main();
} catch (error) {
  console.error('Admin UI build failed:', error.message);
  process.exitCode = 1;
}
