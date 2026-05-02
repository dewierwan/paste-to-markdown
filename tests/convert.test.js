import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(__dirname, '..', 'index.html');
const fixturesDir = resolve(__dirname, 'fixtures');

let convertToMarkdown;

beforeAll(() => {
  const html = readFileSync(indexPath, 'utf-8');
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(html, { runScripts: 'dangerously', virtualConsole });
  convertToMarkdown = dom.window.convertToMarkdown;
  if (typeof convertToMarkdown !== 'function') {
    throw new Error('convertToMarkdown not found on JSDOM window — index.html script may have failed to execute.');
  }
});

describe('headings', () => {
  it.each([
    ['<h1>X</h1>', '# X'],
    ['<h2>X</h2>', '## X'],
    ['<h3>X</h3>', '### X'],
    ['<h4>X</h4>', '#### X'],
    ['<h5>X</h5>', '##### X'],
    ['<h6>X</h6>', '###### X'],
  ])('%s → %s', (input, expected) => {
    expect(convertToMarkdown(input)).toBe(expected);
  });
});

describe('inline formatting', () => {
  it('bold via <strong>', () => {
    expect(convertToMarkdown('<p><strong>hi</strong></p>')).toBe('**hi**');
  });
  it('italic via <em>', () => {
    expect(convertToMarkdown('<p><em>hi</em></p>')).toBe('*hi*');
  });
  it('strikethrough via <s>, <strike>, <del>', () => {
    expect(convertToMarkdown('<p><s>a</s></p>')).toBe('~~a~~');
    expect(convertToMarkdown('<p><strike>a</strike></p>')).toBe('~~a~~');
    expect(convertToMarkdown('<p><del>a</del></p>')).toBe('~~a~~');
  });
  it('inline code', () => {
    expect(convertToMarkdown('<p><code>x</code></p>')).toBe('`x`');
  });
  it('mark/sub/sup pass through as HTML', () => {
    expect(convertToMarkdown('<p><mark>hi</mark></p>')).toBe('<mark>hi</mark>');
    expect(convertToMarkdown('<p>H<sub>2</sub>O</p>')).toBe('H<sub>2</sub>O');
    expect(convertToMarkdown('<p>x<sup>2</sup></p>')).toBe('x<sup>2</sup>');
  });
});

describe('escape Markdown special characters in text', () => {
  it('escapes asterisks so "5 * 3" does not become italic', () => {
    expect(convertToMarkdown('<p>5 * 3 = 15</p>')).toBe('5 \\* 3 = 15');
  });
  it('escapes underscores in identifiers', () => {
    expect(convertToMarkdown('<p>John_Smith</p>')).toBe('John\\_Smith');
  });
  it('escapes brackets to prevent fake links', () => {
    expect(convertToMarkdown('<p>[draft]</p>')).toBe('\\[draft\\]');
  });
  it('escapes backticks', () => {
    expect(convertToMarkdown('<p>use `var` carefully</p>')).toBe('use \\`var\\` carefully');
  });
  it('does NOT escape inside <code>', () => {
    expect(convertToMarkdown('<p><code>5 * 3</code></p>')).toBe('`5 * 3`');
  });
  it('does NOT escape inside <pre>', () => {
    expect(convertToMarkdown('<pre>5 * 3 = 15</pre>')).toContain('5 * 3 = 15');
  });
});

describe('images', () => {
  it('basic img → ![alt](src)', () => {
    expect(convertToMarkdown('<img src="x.png" alt="cat">')).toBe('![cat](x.png)');
  });
  it('with title', () => {
    expect(convertToMarkdown('<img src="x.png" alt="cat" title="A cat">')).toBe('![cat](x.png "A cat")');
  });
  it('empty alt is allowed', () => {
    expect(convertToMarkdown('<img src="x.png">')).toBe('![](x.png)');
  });
  it('img with no src is dropped', () => {
    expect(convertToMarkdown('<img alt="orphan">')).toBe('');
  });
});

describe('horizontal rule', () => {
  it('hr → ---', () => {
    expect(convertToMarkdown('<p>before</p><hr><p>after</p>')).toBe('before\n\n---\n\nafter');
  });
});

describe('code blocks', () => {
  it('plain pre → fenced code with no lang', () => {
    expect(convertToMarkdown('<pre>const x = 1;</pre>')).toBe('```\nconst x = 1;\n```');
  });
  it('pre with data-language → fenced with lang hint', () => {
    expect(convertToMarkdown('<pre data-language="js">const x = 1;</pre>')).toBe('```js\nconst x = 1;\n```');
  });
  it('pre wrapping <code class="language-py"> picks up python', () => {
    expect(convertToMarkdown('<pre><code class="language-py">x = 1</code></pre>')).toBe('```py\nx = 1\n```');
  });
});

describe('tables (GFM)', () => {
  it('simple table with thead', () => {
    const html = '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>';
    expect(convertToMarkdown(html)).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
  });
  it('table without thead treats first row as header', () => {
    const html = '<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>';
    expect(convertToMarkdown(html)).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |');
  });
  it('escapes pipes inside cells', () => {
    const html = '<table><tr><td>a|b</td><td>c</td></tr></table>';
    expect(convertToMarkdown(html)).toContain('a\\|b');
  });
  it('preserves inline formatting in cells', () => {
    const html = '<table><tr><th>x</th></tr><tr><td><strong>bold</strong></td></tr></table>';
    expect(convertToMarkdown(html)).toContain('| **bold** |');
  });
});

describe('whitespace cleanup', () => {
  it('collapses 3+ blank lines down to 2', () => {
    const html = '<div><p>a</p></div><div></div><div></div><div><p>b</p></div>';
    const out = convertToMarkdown(html);
    expect(out).not.toMatch(/\n{3,}/);
  });
});

describe('lists', () => {
  it('unordered', () => {
    expect(convertToMarkdown('<ul><li>a</li><li>b</li></ul>')).toBe('- a\n- b');
  });
  it('ordered', () => {
    const out = convertToMarkdown('<ol><li>a</li><li>b</li></ol>');
    expect(out).toContain('1. a');
    expect(out).toContain('2. b');
  });
  it('checkboxes', () => {
    const html = '<ul data-checked="true"><li>done</li></ul><ul data-checked="false"><li>todo</li></ul>';
    const out = convertToMarkdown(html);
    expect(out).toContain('- [x] done');
    expect(out).toContain('- [ ] todo');
  });
});

describe('links', () => {
  it('basic link', () => {
    expect(convertToMarkdown('<a href="https://x.com">x</a>')).toBe('[x](https://x.com)');
  });
});

// Real-world fixture corpus. Drop pairs of {scenario}.html and {scenario}.expected.md
// into tests/fixtures/<source>/ to grow regression coverage.
describe('fixtures', () => {
  if (!existsSync(fixturesDir)) {
    it.skip('no fixtures directory yet', () => {});
    return;
  }
  const sources = readdirSync(fixturesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  if (sources.length === 0) {
    it.skip('no source fixtures yet', () => {});
    return;
  }
  for (const source of sources) {
    const sourceDir = join(fixturesDir, source);
    const cases = readdirSync(sourceDir)
      .filter(f => f.endsWith('.html'))
      .map(f => f.replace(/\.html$/, ''));
    for (const name of cases) {
      const htmlPath = join(sourceDir, name + '.html');
      const expectedPath = join(sourceDir, name + '.expected.md');
      if (!existsSync(expectedPath)) continue;
      it(`${source}/${name}`, () => {
        const input = readFileSync(htmlPath, 'utf-8');
        const expected = readFileSync(expectedPath, 'utf-8').replace(/\n+$/, '');
        expect(convertToMarkdown(input)).toBe(expected);
      });
    }
  }
});
