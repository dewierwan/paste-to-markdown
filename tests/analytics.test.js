import { describe, it, expect } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'js/analytics.js'), 'utf-8').replace(/WEBSITE_ID = '[^']*'/, "WEBSITE_ID = 'test-id'");

// Runs js/analytics.js at a given URL and returns the requests it sent.
function run(url) {
  const dom = new JSDOM('<!DOCTYPE html><title>Paste Into</title>', { url, runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  const sent = [];
  dom.window.fetch = (endpoint, options) => {
    sent.push({ endpoint, headers: options.headers, body: JSON.parse(options.body) });
    return Promise.resolve({ json: () => Promise.resolve({ cache: 'visit-token' }) });
  };
  dom.window.eval(source);
  return { window: dom.window, sent };
}

describe('analytics', () => {
  it('sends a pageview and labelled events on pasteinto.com', async () => {
    const { window, sent } = run('https://pasteinto.com/');
    await new Promise((done) => setTimeout(done));
    window.track('paste', { source: 'gdocs', format: 'markdown' });
    expect(sent).toHaveLength(2);
    expect(sent[0].endpoint).toBe('https://gateway.umami.is/api/send');
    expect(sent[0].body.payload).toMatchObject({ website: 'test-id', hostname: 'pasteinto.com', url: '/' });
    expect(sent[0].body.payload.name).toBeUndefined();
    expect(sent[1].headers['x-umami-cache']).toBe('visit-token');
    expect(sent[1].body.payload).toMatchObject({ name: 'paste', data: { source: 'gdocs', format: 'markdown' } });
  });

  it('sends nothing from the extension popup, local files or other hosts', () => {
    for (const url of ['chrome-extension://abc/index.html', 'file:///index.html', 'http://localhost:8000/', 'https://dewierwan.github.io/pasteinto/']) {
      const { window, sent } = run(url);
      window.track('paste', { source: 'gdocs' });
      expect(sent).toEqual([]);
    }
  });
});
