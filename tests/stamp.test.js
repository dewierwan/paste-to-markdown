import { it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { stamp } from '../scripts/stamp.mjs';

it('index.html asset versions match the files (run npm run stamp)', () => {
  const html = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf-8');
  expect(stamp(html)).toBe(html);
});
