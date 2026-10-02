import { it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extensionFiles } from '../scripts/pack-extension.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf-8');

it('packs every file the extension popup needs', () => {
  const files = extensionFiles();
  expect(files).toEqual(expect.arrayContaining(['manifest.json', 'index.html', 'css/app.css', 'js/app.js', 'fonts/InterVariable.woff2', 'icons/icon-128.png']));
  expect(files.filter((path) => !existsSync(resolve(root, path)))).toEqual([]);
  expect(files.some((path) => path.startsWith('tests/') || path.startsWith('node_modules/'))).toBe(false);
});

// Chrome extensions refuse inline scripts, inline event handlers and remote code.
it('keeps index.html loadable as an extension page', () => {
  expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
  expect(html).not.toMatch(/\son[a-z]+="/);
  expect(html).not.toMatch(/<script[^>]+src="https?:/);
});
