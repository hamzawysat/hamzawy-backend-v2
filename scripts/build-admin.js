'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'frontend');
const output = path.join(root, 'admin-dist');
const excludedPages = new Set(['index.html','client.html','fanni.html','technicians.html','customers.html','admin-setup.html','js/admin-setup.js']);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : entry.isFile() ? [full] : [];
  });
}
function cleanAssetPath(raw, allowHtml) {
  if (!raw || /^(?:[a-z]+:)?\/\//i.test(raw) || /^(?:data|blob|javascript):/i.test(raw)) return null;
  const value = raw.split(/[?#]/, 1)[0];
  const extensions = allowHtml ? /\.(?:html?|css|js|mjs|json|webmanifest|png|jpe?g|webp|svg|gif|ico|woff2?|ttf|otf|mp4|webm)$/i : /\.(?:css|js|mjs|json|webmanifest|png|jpe?g|webp|svg|gif|ico|woff2?|ttf|otf|mp4|webm)$/i;
  return value && extensions.test(value) ? value.replace(/^\//, '') : null;
}
function referencedAssets(file, content) {
  const found = new Set();
  const ext = path.extname(file).toLowerCase();
  const patterns = [];
  if (ext === '.html' || ext === '.htm') patterns.push(/(?:src|href)\s*=\s*["']([^"'#]+)["']/gi);
  if (ext === '.css') {
    patterns.push(/url\(\s*["']?([^"')]+)["']?\s*\)/gi);
    patterns.push(/@import\s+(?:url\()?["']([^"']+)["']/gi);
  }
  if (ext === '.js' || ext === '.mjs') {
    patterns.push(/(?:import\s*\(|import\s+[^;]*?from\s*)["']([^"']+)["']/gi);
    patterns.push(/["']((?:\/(?:js|css|images|fonts|icons)\/)[^"'\s]+)["']/g);
    patterns.push(/["']\/(web-push\.js|page-visit\.js|manifest\.webmanifest|service-worker\.js)["']/g);
  }
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content))) {
      const raw = match[1];
      if (!raw || /^(?:[a-z]+:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) continue;
      const candidate = cleanAssetPath(raw, ext === '.html' || ext === '.htm');
      if (!candidate) continue;
      const resolved = raw.startsWith('/') ? candidate : path.posix.normalize(path.posix.join(path.posix.dirname(file), candidate));
      if (!resolved.startsWith('../')) found.add(resolved);
    }
  }
  return [...found];
}
function copyAndValidateDependencyClosure() {
  const queue = ['admin.html'], visited = new Set(), missing = new Set();
  while (queue.length) {
    const relative = queue.shift();
    if (visited.has(relative)) continue;
    visited.add(relative);
    if (excludedPages.has(relative)) { missing.add(relative + ' (excluded)'); continue; }
    const sourceFile = path.join(source, relative);
    if (!fs.existsSync(sourceFile) || !fs.statSync(sourceFile).isFile()) { missing.add(relative); continue; }
    const destination = path.join(output, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(sourceFile, destination);
    if (!/\.(?:html?|css|js|mjs)$/i.test(relative)) continue;
    for (const asset of referencedAssets(relative, fs.readFileSync(sourceFile, 'utf8'))) {
      if (excludedPages.has(asset)) { missing.add(asset + ' (excluded)'); continue; }
      const target = path.join(source, asset);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) missing.add(asset);
      else if (/\.(?:html?|css|js|mjs)$/i.test(asset)) queue.push(asset);
      else {
        const copied = path.join(output, asset);
        fs.mkdirSync(path.dirname(copied), { recursive: true });
        fs.copyFileSync(target, copied);
      }
    }
  }
  if (fs.existsSync(path.join(output, 'admin-setup.html')) || fs.existsSync(path.join(output, 'js/admin-setup.js'))) throw new Error('One-time admin bootstrap files must not be included in the public UI artifact');
  if (missing.size) throw new Error('Admin UI dependency check failed; missing referenced files:\n' + [...missing].sort().map(x => ' - ' + x).join('\n'));
  return [...visited].sort();
}
function main() {
  if (!fs.existsSync(path.join(source, 'admin.html'))) throw new Error('frontend/admin.html is missing');
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  const dependencies = copyAndValidateDependencyClosure();
  const manifest = {
    schemaVersion: 1, entrypoint: '/admin.html', apiMode: 'same-origin',
    dependencyValidation: 'static-html-css-js-closure',
    validatedEntrypoints: dependencies,
    notes: [
      'Static UI artifact only; it does not contain the API or database.',
      'Preserve root-relative asset paths when hosting this artifact.',
      'Route /api/* to the backend through a same-origin reverse proxy.',
      'The one-time admin bootstrap page and script are intentionally excluded.',
      'The service worker resolves notification destinations against its active origin.',
      'Do not expose private admin pages or API endpoints as public static files.'
    ],
    files: walk(output).map(file => path.relative(output, file).split(path.sep).join('/')).sort()
  };
  fs.writeFileSync(path.join(output, 'admin-ui-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('Admin UI artifact created at admin-dist');
  console.log('Files:', manifest.files.length);
  console.log('Static dependency files validated:', dependencies.length);
  console.log('Entry point: admin.html');
  console.log('API: same-origin /api proxy required');
}
try { main(); } catch (error) { console.error('Admin UI build failed:', error.message); process.exitCode = 1; }
