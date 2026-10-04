// Prints what each output puts on the clipboard for tests/destinations/sample.html,
// for pasting into real apps with the snippets in tests/destinations/live/.
// Usage: npm run destinations:payloads [-- email|rich]
import { loadSite, fixture } from '../tests/load.js';

const w = loadSite();
const html = fixture('../destinations/sample.html');
const outputs = process.argv[2] ? [process.argv[2]] : ['rich', 'email'];
const payloads = {};
for (const output of outputs) {
  const result = w.convertClip({ html, text: '' }, 'rich', output);
  payloads[output] = { 'text/html': result.html, 'text/plain': result.text };
}
console.log(JSON.stringify(payloads, null, 2));
