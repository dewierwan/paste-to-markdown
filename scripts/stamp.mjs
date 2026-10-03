// Adds ?v=<content hash> to local CSS/JS references in index.html, so browsers
// fetch new files after a deploy instead of mixing them with cached old ones
// (GitHub Pages serves everything with a 10-minute cache).
// Usage: node scripts/stamp.mjs [--check]
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = resolve(root, 'index.html');

export function stamp(html) {
  return html.replace(/(href|src)="((?:css|js)\/[^"?]+\.(?:css|js))(?:\?v=[0-9a-f]*)?"/g, (_, attr, path) => {
    const hash = createHash('sha256')
      .update(readFileSync(resolve(root, path)))
      .digest('hex')
      .slice(0, 8);
    return `${attr}="${path}?v=${hash}"`;
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = readFileSync(indexPath, 'utf-8');
  const stamped = stamp(html);
  if (process.argv.includes('--check')) {
    if (stamped !== html) {
      console.error('index.html asset versions are stale: run npm run stamp');
      process.exit(1);
    }
  } else {
    writeFileSync(indexPath, stamped);
  }
}
