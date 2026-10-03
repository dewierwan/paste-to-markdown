// Saves a real paste as a test fixture. Opens a local page; copy something in
// the app you want to test, paste it there, name it, and it writes
// tests/fixtures/<folder>/<name>.html, .txt and (if the app adds its own
// clipboard types) .types. Then run `npm run test:update` and review the
// expected outputs it writes next to the fixture.
// Usage: npm run capture
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { execFile } from 'child_process';
import { resolve, dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAFE_NAME = /^[a-z0-9][a-z0-9.-]*$/;
const STANDARD_TYPES = new Set(['text/plain', 'text/html', 'text/rtf', 'text/uri-list', 'Files']);
const TYPES = { '.js': 'text/javascript', '.html': 'text/html' };

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Capture a fixture</title>
<style>body{font:16px system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem}input{font:inherit;padding:.3rem}pre{white-space:pre-wrap;background:#f4f4f4;padding:1rem}</style></head>
<body>
<h1>Capture a fixture</h1>
<p>Copy something in the app you want to test, then paste anywhere on this page.</p>
<p><label>Folder <input id="folder" placeholder="detected after paste"></label>
<label>Name <input id="name" placeholder="e.g. meeting-notes"></label>
<button id="save" disabled>Save</button></p>
<pre id="status">Waiting for a paste…</pre>
<script src="/js/vendor/marked.umd.js"></script>
<script src="/js/util.js"></script>
<script src="/js/sources.js"></script>
<script src="/js/from-pdf.js"></script>
<script src="/js/convert.js"></script>
<script>
let clip;
const status = document.getElementById('status');
document.addEventListener('paste', (event) => {
  if (event.target.tagName === 'INPUT') return;
  event.preventDefault();
  const data = event.clipboardData;
  clip = { html: data.getData('text/html'), text: data.getData('text/plain'), types: Array.from(data.types) };
  const detected = detect(clip);
  if (!document.getElementById('folder').value) document.getElementById('folder').value = detected.source === 'html' ? '' : detected.source;
  document.getElementById('save').disabled = false;
  status.textContent = 'Detected ' + detected.source + ' (read as ' + detected.read + ')\\nTypes: ' + clip.types.join(', ') + '\\n\\n' + clip.html.slice(0, 2000);
});
document.getElementById('save').addEventListener('click', async () => {
  const body = JSON.stringify({ ...clip, folder: document.getElementById('folder').value.trim(), name: document.getElementById('name').value.trim() });
  const response = await fetch('/save', { method: 'POST', body });
  status.textContent = await response.text();
});
</script>
</body>
</html>`;

function save(body) {
  const { folder, name, html, text, types } = JSON.parse(body);
  if (!SAFE_NAME.test(folder || '') || !SAFE_NAME.test(name || ''))
    return [400, 'Folder and name: lowercase letters, numbers, dots and dashes only.'];
  if (!html) return [400, 'This paste has no HTML. Plain-text pastes are tested in tests/convert.test.js and tests/pdf.test.js.'];
  const dir = join(root, 'tests', 'fixtures', folder);
  const base = join(dir, name);
  if (existsSync(`${base}.html`)) return [409, `tests/fixtures/${folder}/${name}.html already exists. Pick another name.`];
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${base}.html`, html);
  writeFileSync(`${base}.txt`, text || '');
  const ownTypes = (types || []).filter((t) => !STANDARD_TYPES.has(t));
  if (ownTypes.length) writeFileSync(`${base}.types`, `${types.join('\n')}\n`);
  return [200, `Saved tests/fixtures/${folder}/${name}.html. Next: npm run test:update, then review the expected files it writes.`];
}

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const [status, message] = save(body);
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(message);
      if (status === 200) console.log(message);
    });
    return;
  }
  const path = req.url.split('?')[0];
  if (path === '/') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(PAGE);
  // Only the page's own scripts.
  if (/^\/js\/[a-z/.-]+\.js$/.test(path) && existsSync(join(root, path))) {
    return res.writeHead(200, { 'Content-Type': TYPES[extname(path)] }).end(readFileSync(join(root, path)));
  }
  res.writeHead(404).end();
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  console.log(`Paste at ${url} (Ctrl+C to stop)`);
  execFile(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], () => {});
});
