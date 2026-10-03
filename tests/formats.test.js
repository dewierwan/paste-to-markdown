import { describe, it, expect, beforeAll } from 'vitest';
import { loadSite, fixture } from './load.js';

let w;
beforeAll(() => {
  w = loadSite();
});

const docs = () => fixture('gdocs/email-draft.html');
const NOTION_TYPES = ['text/plain', 'text/html', 'text/_notion-blocks-v3-production'];

describe('detect', () => {
  it('Google Docs', () => expect(w.detect({ html: docs(), text: 'x' })).toEqual({ source: 'gdocs', read: 'rich' }));
  it('Notion, by its clipboard type', () => expect(w.detect({ html: '<p>x</p>', text: 'x', types: NOTION_TYPES }).source).toBe('notion'));
  it('Word', () => expect(w.detect({ html: '<p class="MsoNormal">x</p>', text: 'x' }).source).toBe('word'));
  it('Markdown text', () =>
    expect(w.detect({ html: '', text: '# Title\n\nSome **bold**' })).toEqual({ source: 'markdown', read: 'markdown' }));
  it('plain text', () => expect(w.detect({ html: '', text: 'Hello there\nSecond line' })).toEqual({ source: 'text', read: 'text' }));
  it('Markdown from a code editor (coloured HTML, no formatting)', () => {
    const html = '<div style="font-family: Menlo"><span style="color:#569cd6">## Heading</span></div>';
    expect(w.detect({ html, text: '## Heading\n- a\n- b' }).read).toBe('markdown');
  });
  it('real rich text with Markdown-looking text stays rich', () => {
    expect(w.detect({ html: '<ul><li>a</li><li>b</li></ul>', text: '- a\n- b' }).read).toBe('rich');
  });
});

describe('Google Docs → email', () => {
  it('keeps formatting, drops fonts and spacing, rebuilds nested lists', () => {
    const { html } = w.convertClip({ html: docs(), text: '' }, 'rich', 'email');
    expect(html).toBe(
      [
        '<div><b>Quick update</b></div>',
        '<div>Hi Sam, here is a <b>bold</b> point, an <i>italic</i> one, and <a href="https://bluedot.org/">a link</a>. &nbsp;Two spaces.</div>',
        '<div><br></div>',
        '<div><b>Bold </b><a href="https://example.com/page?x=1"><b>bold link</b></a><u> underlined</u><s> struck</s></div>',
        '<div><br></div>',
        '<ul style="margin-top:0;margin-bottom:0"><li>First bullet<ul style="margin-top:0;margin-bottom:0"><li>Nested <b>bullet</b></li></ul></li><li>Second bullet</li></ul>',
        '<div><br></div>',
        '<ol style="margin-top:0;margin-bottom:0"><li>Step one</li><li>Step two<ol type="a" style="margin-top:0;margin-bottom:0"><li>Sub-step</li></ol></li></ol>',
        '<div><br></div>',
        '<div>Red highlighted text<sup>2</sup></div>',
        '<div><br></div>',
        '<div>Best,</div>',
        '<div>Dewi</div>',
      ].join(''),
    );
  });

  it('a partial selection inside one paragraph stays inline', () => {
    const html =
      '<b style="font-weight:normal;" id="docs-internal-guid-x"><span style="font-weight:400;">just </span><span style="font-weight:700;">this</span></b>';
    expect(w.convertClip({ html, text: '' }, 'rich', 'email').html).toBe('just <b>this</b>');
  });

  it('turns "space after paragraph" into a blank line', () => {
    const p = (t) =>
      `<p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:12pt;"><span style="font-weight:400">${t}</span></p>`;
    const html = `<b style="font-weight:normal" id="docs-internal-guid-y">${p('One')}${p('Two')}</b>`;
    expect(w.convertClip({ html, text: '' }, 'rich', 'email').html).toBe('<div>One</div><div><br></div><div>Two</div>');
  });

  it('drops unsafe links but keeps the text', () => {
    expect(w.convertClip({ html: '<p><a href="javascript:alert(1)">x</a></p>', text: '' }, 'rich', 'email').html).toBe('<div>x</div>');
  });
});

describe('Google Docs → Markdown', () => {
  it('ignores the Docs <b style="font-weight:normal"> wrapper', () => {
    const html =
      '<b style="font-weight:normal;" id="docs-internal-guid-x"><p><span style="font-weight:400">plain </span><span style="font-weight:700">bold</span></p></b>';
    expect(w.convertClip({ html, text: '' }, 'rich', 'markdown').text).toBe('plain **bold**');
  });
});

describe('inherited inline styles', () => {
  it('keeps bold when an inner tag says font-weight: inherit (Airtable)', () => {
    const html =
      '<p><strong style="font-style: inherit; font-weight: 600"><em style="font-style: italic; font-weight: inherit">both</em></strong></p>';
    expect(w.convertClip({ html, text: '' }, 'rich', 'email').html).toBe('<div><b><i>both</i></b></div>');
    expect(w.convertClip({ html, text: '' }, 'rich', 'whatsapp').text).toBe('*_both_*');
  });
});

describe('Notion and web HTML → email', () => {
  it('puts blank lines between paragraphs, headings and lists', () => {
    const html = '<h2>Notes</h2><p>First <strong>bold</strong>.</p><p>Second.</p><ul><li>a</li></ul><p>After</p>';
    expect(w.convertClip({ html, text: '', types: NOTION_TYPES }, 'rich', 'email').html).toBe(
      '<div><b>Notes</b></div><div><br></div><div>First <b>bold</b>.</div><div><br></div><div>Second.</div><div><br></div>' +
        '<ul style="margin-top:0;margin-bottom:0"><li>a</li></ul><div><br></div><div>After</div>',
    );
  });

  it('collapses runs of empty paragraphs', () => {
    expect(w.convertClip({ html: '<p>a</p><p>&nbsp;</p><p></p><p>b</p>', text: '' }, 'rich', 'email').html).toBe(
      '<div>a</div><div><br></div><div>b</div>',
    );
  });
});

describe('Markdown → other outputs', () => {
  const md =
    '# Plan\n\nShip **the program** by *15 Nov*. See [doc](https://example.com).\n\n- One\n- Two with `code`\n  - Nested\n\nThanks,\nDewi';

  it('email', () => {
    expect(w.convertClip({ html: '', text: md }, 'markdown', 'email').html).toBe(
      '<div><b>Plan</b></div><div><br></div>' +
        '<div>Ship <b>the program</b> by <i>15 Nov</i>. See <a href="https://example.com">doc</a>.</div><div><br></div>' +
        '<ul style="margin-top:0;margin-bottom:0"><li>One</li><li>Two with <font face="monospace">code</font>' +
        '<ul style="margin-top:0;margin-bottom:0"><li>Nested</li></ul></li></ul><div><br></div>' +
        '<div>Thanks,<br>Dewi</div>',
    );
  });

  it('WhatsApp', () => {
    expect(w.convertClip({ html: '', text: md }, 'markdown', 'whatsapp').text).toBe(
      '*Plan*\n\nShip *the program* by _15 Nov_. See doc (https://example.com).\n\n- One\n- Two with `code`\n    - Nested\n\nThanks,\nDewi',
    );
  });

  it('plain text', () => {
    expect(w.convertClip({ html: '', text: md }, 'markdown', 'plain').text).toBe(
      'Plan\n\nShip the program by 15 Nov. See doc (https://example.com).\n\n• One\n• Two with code\n    • Nested\n\nThanks,\nDewi',
    );
  });

  it('Markdown passes through unchanged', () => {
    expect(w.convertClip({ html: '', text: md }, 'markdown', 'markdown').text).toBe(md);
  });
});

describe('WhatsApp markers', () => {
  it('keep spaces outside the markers', () => {
    expect(w.convertClip({ html: '<p><b>bold </b>text</p>', text: '' }, 'rich', 'whatsapp').text).toBe('*bold* text');
  });
  it('show a link once when its text is the URL', () => {
    expect(w.convertClip({ html: '<p><a href="https://a.com">https://a.com</a></p>', text: '' }, 'rich', 'whatsapp').text).toBe(
      'https://a.com',
    );
  });
});

describe('Markdown writer fixes', () => {
  it('nests lists inside list items', () => {
    expect(w.convertToMarkdown('<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>')).toBe('- a\n  - b\n- c');
  });
  it('indents lists under numbered items by three spaces', () => {
    expect(w.convertToMarkdown('<ol><li>a<ol><li>b</li></ol></li></ol>')).toBe('1. a\n   1. b');
  });
  it('moves edge spaces outside bold and strikethrough', () => {
    expect(w.convertClip({ html: '<p><b>Bold </b>x<s> gone</s></p>', text: '' }, 'rich', 'markdown').text).toBe('**Bold** x ~~gone~~');
  });
});

describe('Quill lists (Airtable rich text)', () => {
  const html = () => fixture('airtable/nested-bullets.html');

  it('rebuilds nesting from ql-indent classes in rich text', () => {
    const out = w.convertClip({ html: html(), text: '' }, 'rich', 'email').html;
    expect(out).toContain(
      '<li>First topic<ul style="margin-top:0;margin-bottom:0"><li>detail one</li><li>detail <b>two</b></li></ul></li>',
    );
    expect(out).toContain('<li>detail three<ul style="margin-top:0;margin-bottom:0"><li>deeper still</li></ul></li>');
  });

  it('indents sub-bullets in plain text', () => {
    expect(w.convertClip({ html: html(), text: '' }, 'rich', 'plain').text).toContain(
      '• First topic\n    • detail one\n    • detail two\n• Second topic\n    • detail three\n        • deeper still',
    );
  });

  it('reads Quill 2 data-list items as bullets or numbers', () => {
    const q2 = '<ol><li data-list="bullet">a</li><li data-list="bullet" class="ql-indent-1">b</li><li data-list="ordered">c</li></ol>';
    expect(w.convertClip({ html: q2, text: '' }, 'rich', 'plain').text).toBe('• a\n    • b\n1. c');
  });
});

describe('Rich text output keeps headings (Docs, Notion, Airtable)', () => {
  it('keeps an Airtable small heading as <h3>, with no blank lines around it', () => {
    const out = w.convertClip({ html: fixture('airtable/nested-bullets.html'), text: '' }, 'rich', 'rich').html;
    expect(out.startsWith('<h3>Agenda</h3><ul style="margin-top:0;margin-bottom:0"><li>First topic')).toBe(true);
    expect(out).toContain('</ul><h3>People</h3>');
  });

  it('keeps Google Docs heading levels, without Docs styling', () => {
    const out = w.convertClip({ html: docs(), text: '' }, 'rich', 'rich').html;
    expect(out.startsWith('<h2>Quick update</h2><div>Hi Sam')).toBe(true);
  });

  it('keeps Markdown headings', () => {
    expect(w.convertClip({ html: '', text: '## Plan\n\nText' }, 'markdown', 'rich').html).toBe('<h2>Plan</h2><div>Text</div>');
  });

  it('email still turns headings into bold lines', () => {
    expect(w.convertClip({ html: '', text: '## Plan\n\nText' }, 'markdown', 'email').html).toBe(
      '<div><b>Plan</b></div><div><br></div><div>Text</div>',
    );
  });
});

describe('Word lists', () => {
  const item = (level, list, marker, text) =>
    `<p class="MsoListParagraph" style="text-indent:-.25in;mso-list:${list} level${level} lfo1"><![if !supportLists]><span><span style="mso-list:Ignore">${marker}<span style="font:7.0pt 'Times New Roman'">&nbsp;&nbsp;</span></span></span><![endif]>${text}<o:p></o:p></p>`;

  it('rebuilds bullet paragraphs as a nested list', () => {
    const html = `<p class="MsoNormal">Intro</p>${item(1, 'l0', '·', 'One')}${item(2, 'l0', 'o', 'Nested')}${item(1, 'l0', '·', 'Two')}`;
    expect(w.convertClip({ html, text: '' }, 'rich', 'markdown').text).toBe('Intro\n\n- One\n  - Nested\n- Two');
  });

  it('reads numbers and letters as numbered lists', () => {
    const html = `${item(1, 'l1', '1.', 'First')}${item(2, 'l1', 'a.', 'Sub')}${item(1, 'l1', '2.', 'Second')}`;
    expect(w.convertClip({ html, text: '' }, 'rich', 'email').html).toBe(
      '<ol style="margin-top:0;margin-bottom:0"><li>First<ol type="a" style="margin-top:0;margin-bottom:0"><li>Sub</li></ol></li><li>Second</li></ol>',
    );
  });
});

describe('task lists', () => {
  it('keeps Quill checklists in every output', () => {
    const html = '<ul data-checked="true"><li>done</li></ul><ul data-checked="false"><li>todo</li></ul>';
    expect(w.convertClip({ html, text: '' }, 'rich', 'markdown').text).toBe('- [x] done\n- [ ] todo');
    expect(w.convertClip({ html, text: '' }, 'rich', 'plain').text).toBe('☑\uFE0E done\n☐ todo');
  });

  it('starts each task line with its box instead of a bullet', () => {
    const html = '<ul data-checked="false"><li>Book venue</li><li class="ql-indent-1">Pay deposit</li></ul><p>After</p>';
    const email = w.convertClip({ html, text: '' }, 'rich', 'email');
    expect(email.html).toBe('<div>☐ Book venue</div><div>&nbsp;&nbsp;&nbsp;&nbsp;☐ Pay deposit</div><div><br></div><div>After</div>');
    expect(email.text).toBe('☐ Book venue\n    ☐ Pay deposit\n\nAfter');
    expect(w.convertClip({ html, text: '' }, 'rich', 'whatsapp').text).toBe('☐ Book venue\n    ☐ Pay deposit\n\nAfter');
  });

  it('keeps bullets on the ordinary items of a mixed list', () => {
    const html = '<ol><li data-list="unchecked">todo</li><li data-list="bullet">note</li></ol>';
    const email = w.convertClip({ html, text: '' }, 'rich', 'email');
    expect(email.html).toContain('<li style="list-style-type:none">☐ todo</li><li>note</li>');
    expect(email.text).toBe('☐ todo\n• note');
  });

  it('keeps real checkboxes in Docs, which Notion turns into to-dos', () => {
    const html = '<ul data-checked="false"><li>todo</li><li class="ql-indent-1">sub</li></ul><ul data-checked="true"><li>done</li></ul>';
    const docs = w.convertClip({ html, text: '' }, 'rich', 'rich');
    expect(docs.html).toBe(
      '<ul style="margin-top:0;margin-bottom:0"><li><input type="checkbox">todo<ul style="margin-top:0;margin-bottom:0"><li><input type="checkbox">sub</li></ul></li><li><input type="checkbox" checked="">done</li></ul>',
    );
    // Notion reads a one-line text/plain as inline text, so the lines matter.
    expect(docs.text).toBe('☐ todo\n    ☐ sub\n☑︎ done');
  });

  it('reads Quill 2 checked and unchecked items', () => {
    const html = '<ol><li data-list="checked">done</li><li data-list="unchecked">todo</li></ol>';
    expect(w.convertClip({ html, text: '' }, 'rich', 'markdown').text).toBe('- [x] done\n- [ ] todo');
  });
});

describe('list items with several paragraphs', () => {
  it('keeps the paragraphs apart, lined up under the first', () => {
    const html = '<ul><li><p>one</p><p>two</p></li></ul>';
    expect(w.convertClip({ html, text: '' }, 'rich', 'plain').text).toBe('• one\n  two');
    expect(w.convertClip({ html, text: '' }, 'rich', 'markdown').text).toBe('- one\n  two');
  });
});

describe('Markdown from rich text uses the same cleaning as the other outputs', () => {
  it('unwraps Google redirect links', () => {
    const html = '<div class="gmail_default"><a href="https://www.google.com/url?q=https://bluedot.org/&amp;sa=D">site</a></div>';
    expect(w.convertClip({ html, text: '' }, 'rich', 'markdown').text).toBe('[site](https://bluedot.org/)');
  });
  it('puts lines written as <div>s on separate lines', () => {
    expect(w.convertClip({ html: '<div>one</div><div>two</div>', text: '' }, 'rich', 'markdown').text).toBe('one\n\ntwo');
  });
  it('drops stylesheets', () => {
    expect(w.convertClip({ html: '<style>p { color: red }</style><p>text</p>', text: '' }, 'rich', 'markdown').text).toBe('text');
  });
});

describe('Notion', () => {
  it('turns to-dos written as text into task items', () => {
    const html = '<ul>\n<li>[x]  Send invites</li>\n<li>[ ]  Book <b>room</b></li>\n</ul>';
    expect(w.convertClip({ html, text: '' }, 'rich', 'markdown').text).toBe('- [x] Send invites\n- [ ] Book **room**');
    expect(w.convertClip({ html, text: '' }, 'rich', 'plain').text).toBe('☑\uFE0E Send invites\n☐ Book room');
  });

  it('reads newlines between tags as spaces, not line breaks', () => {
    const html = '<ul>\n<li>Hiring update\n<ul>\n<li>Two offers out</li>\n</ul>\n</li>\n</ul>';
    expect(w.convertClip({ html, text: '' }, 'rich', 'email').html).not.toContain('<br>');
  });

  it('keeps newlines in preformatted text', () => {
    const html = '<div style="white-space: pre">line one\nline two</div><p>after</p>';
    expect(w.convertClip({ html, text: '' }, 'rich', 'plain').text).toBe('line one\nline two\nafter');
  });
});
