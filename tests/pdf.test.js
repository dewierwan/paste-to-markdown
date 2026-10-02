// cspell:ignore lowship nlowship nçais français salariés télétravail recours Hackathon textedit
import { describe, it, expect, beforeAll } from 'vitest';
import { loadSite, fixture } from './load.js';

// Fixtures are real clipboard text, extracted the way each viewer copies it:
// *.preview.txt with macOS PDFKit (Preview), *.chrome.txt with PDFium (Chrome).
// article, letter, report, twocol and mac are test PDFs made for this; the rest
// are pages from public-domain US government documents.
let w;
beforeAll(() => { w = loadSite(); });

const pdf = (name) => fixture(`pdf/${name}.txt`);
const paragraphs = (text) => {
  const div = w.document.createElement('div');
  div.innerHTML = w.pdfToHtml(text).replace(/<br>/g, '\n');
  return Array.from(div.children).map((el) => el.textContent);
};

describe('detecting PDF text', () => {
  for (const name of ['article.preview', 'article.chrome', 'letter.preview', 'mac.chrome', 'twocol.preview', 'supreme-court.preview', 'federal-register.chrome', 'nist.chrome', 'irs.preview']) {
    it(name, () => expect(w.detect({ html: '', text: pdf(name) })).toEqual({ source: 'pdf', read: 'pdf' }));
  }

  const notPdf = {
    'an AI answer, one paragraph per line': 'Here is a summary of the main points from the report.\nThe program grew by forty percent last year, mostly from new partnerships.\nCosts fell because logistics improved and volunteers helped.\nThe biggest risk is funding stability over the next two years.',
    'a plain email': 'Hi Sam,\n\nThanks for sending this over. I had a look and it seems fine to me, though we should check the dates with Lucas before we confirm anything.\n\nCould you send the final version by Friday?\n\nBest,\nDewi',
    'a Slack message': 'quick q: are we still on for tomorrow?\nalso can someone grab the slides from the drive\nthanks!',
    'code': 'function add(a, b) {\n  return a + b;\n}\n\nconst total = add(1, 2);\nconsole.log(total);',
    'a poem': 'so much depends\nupon\n\na red wheel\nbarrow\n\nglazed with rain\nwater',
    'a shopping list': 'eggs\nmilk\nbread\nbutter\napples\noat milk',
    'CSV': 'name,email,role\nJane,jane@example.com,lead\nAlex,alex@example.com,member',
  };
  for (const [name, text] of Object.entries(notPdf)) {
    it(`not ${name}`, () => expect(w.detect({ html: '', text }).read).not.toBe('pdf'));
  }

  it('Markdown with headings stays Markdown', () => {
    expect(w.detect({ html: '', text: '# Plan\n\nSome text that wraps across a\nline in the middle of a sentence\nand carries on here.' }).read).toBe('markdown');
  });
});

describe('a real Preview copy (HTML and text on the clipboard)', () => {
  // *.preview-clipboard.html is the HTML macOS PDFKit writes when you copy in
  // Preview: one <p> per printed line. The text half is the matching *.preview.txt.
  for (const name of ['article', 'letter', 'report']) {
    it(`reads ${name} as PDF, not as rich text or Markdown`, () => {
      const clip = { html: fixture(`pdf/${name}.preview-clipboard.html`), text: pdf(`${name}.preview`) };
      expect(w.detect(clip)).toEqual({ source: 'pdf', read: 'pdf' });
    });
  }

  it('a contents page in Preview HTML reads as PDF', () => {
    const lines = ['Contents', 'Introduction ______________ 3', 'What is frontier AI? ______ 4', 'How it works ______________ 6', 'Risks _____________________ 9', 'Conclusion ________________ 12'];
    const html = `<meta name="Generator" content="Cocoa HTML Writer"><style>p.p1 {font: 12.0px Arial}</style>${lines.map((l) => `<p class="p1">${l}</p>`).join('')}`;
    expect(w.detect({ html, text: lines.join('\n') }).read).toBe('pdf');
  });

  for (const name of ['notes', 'list']) {
    it(`TextEdit ${name} (same HTML writer, one font) stays rich text`, () => {
      const html = fixture(`pdf/textedit-${name}.html`);
      const text = new w.DOMParser().parseFromString(html, 'text/html').body.innerText
        ?? Array.from(new w.DOMParser().parseFromString(html, 'text/html').querySelectorAll('p')).map((p) => p.textContent).join('\n');
      expect(w.detect({ html, text }).read).toBe('rich');
    });
  }
});

describe('contents pages', () => {
  it('keeps each entry on its own line and drops the leaders', () => {
    const text = 'Contents\nIntroduction ______________________ 3\nWhat is the current state of frontier AI capabilities? __________ 4\nHow frontier AI works\n______________________________ 5\nLimitations of frontier AI _______ 9';
    expect(paragraphs(text)).toEqual(['Contents\nIntroduction 3\nWhat is the current state of frontier AI capabilities? 4\nHow frontier AI works\nLimitations of frontier AI 9']);
  });
});

describe('magazine layouts', () => {
  it('joins a drop cap to its word', () => {
    expect(paragraphs('Les impacts du télétravail\nE\nn 2023, 19 % des salariés français ont eu recours au télétravail.')).toEqual(['Les impacts du télétravail', 'En 2023, 19 % des salariés français ont eu recours au télétravail.']);
  });
});

describe('rebuilding paragraphs', () => {
  for (const engine of ['preview', 'chrome']) {
    it(`joins wrapped lines and removes line-break hyphens (${engine})`, () => {
      const p = paragraphs(pdf(`article.${engine}`));
      expect(p[1]).toBe('Over the past eighteen months we have run four cohorts of the fellowship, each with roughly forty participants drawn from government, industry and academia. The program was designed to give mid-career professionals a structured way into AI governance work, and the results have been encouraging, if not uniformly so. This report summarises what we learned, what we would do differently, and where the fellowship should go next. It draws on participant surveys, interviews with hiring organisations, and our own records of placements and follow-on projects.');
      expect(p).toContain('Key findings');
      expect(p).toContain('1. Make the capstone mandatory and give every participant a mentor from a hiring organisation.');
    });

    it(`drops page numbers (${engine})`, () => {
      expect(paragraphs(pdf(`article.${engine}`)).join('\n')).not.toMatch(/Page \d of \d/);
    });

    it(`keeps short lines of an address and sign-off (${engine})`, () => {
      const p = paragraphs(pdf(`letter.${engine}`));
      expect(p[0]).toBe('Jane Smith\nHead of Partnerships\nExample Foundation\n123 Market Street\nSan Francisco, CA 94105\n1 October 2026\nDear Jane,');
      expect(p[p.length - 1]).toBe('Best wishes,\nAlex Jones\nDirector of Programs');
    });

    it(`keeps a heading off the paragraph before it, and code lines apart (${engine})`, () => {
      const p = paragraphs(pdf(`report.${engine}`));
      expect(p[2]).toBe('1.1 Scope');
      expect(p.join('\n')).toMatch(/3\. Code sample\nfunction score\(applicant\) \{\n\s?return applicant/);
    });

    it(`keeps a title over two columns separate (${engine})`, () => {
      expect(paragraphs(pdf(`twocol.${engine}`))[0]).toBe('Measuring Talent Pipelines in Emerging Fields');
    });
  }

  it('handles the hyphens Chrome marks with U+FFFE, joined mid-line', () => {
    expect(paragraphs(pdf('mac.chrome'))[1]).toMatch(/^Over the past eighteen months .* drawn from government, industry and academia\. The program was designed to give mid-career professionals/);
  });

  it('narrow columns next to a wide table still join', () => {
    expect(paragraphs(pdf('irs.preview'))).toContain('You may have to file a tax return even if your gross income is less than the amount shown in Table 1 or Table 2 for your filing status. See Table 3 for those other situations when you must file.');
  });

  it('starts form labels on a new line', () => {
    const p = paragraphs(pdf('federal-register.chrome'));
    expect(p.join('\n').split('\n')).toContain('Dated: March 8, 2024.');
    expect(p.join('\n')).toMatch(/Secretary and sent to: ftz@trade\.gov/);
  });
});

describe('copying several pages', () => {
  // Eight pages of a report (about 18 lines each) with a running header and
  // footer, and one sentence repeated word for word in the text.
  const OPENERS = ['Here begins', 'Next comes', 'Then follows', 'Further on in', 'Later still in', 'Deeper into', 'Near the end of', 'Finally, in'];
  const body = (n) => [
    `${OPENERS[n - 1]} the report, and its text runs on in long lines across`,
    `the column so that it wraps the way a real PDF page wraps. Example. Your`,
    `spouse was born on February 1, 1961, and is considered age 65 at the time`,
    `of death. The sentence then carries on for a while before the page ends and`,
  ];
  const pages = Array.from({ length: 8 }, (_, i) => [
    'Annual Report on Programs', ...[1, 2, 3, 4].flatMap(() => body(i + 1)), `Annual Report | ${i + 1}`,
  ].join('\n')).join('\n');
  const text = pages;

  it('drops the running header and footer', () => {
    const out = paragraphs(text).join('\n');
    expect(out).not.toMatch(/Annual Report \| \d/);
    expect(out.match(/Annual Report on Programs/g) || []).toHaveLength(0);
  });

  it('joins a sentence across a page break', () => {
    expect(paragraphs(text).join('\n')).toContain('before the page ends and Next comes the report');
  });

  it('keeps repeated wording in the text', () => {
    expect(paragraphs(text).join('\n').match(/considered age 65 at the time/g)).toHaveLength(32);
  });

  it('keeps a header that appears only twice', () => {
    const two = text.split('Annual Report | 3')[0];
    expect(paragraphs(two).join('\n')).toMatch(/Annual Report \| 1/);
  });
});

describe('line-end hyphens', () => {
  const join = (text) => paragraphs(text)[0];
  const long = 'This line is long enough to count as a full line of text in a column';
  it('removes a hyphen added to break a word', () => expect(join(`${long} fel-\nlowship and more words here to fill`)).toContain('fellowship'));
  it('keeps a hyphen in a chain', () => expect(join(`${long} ever-more-\ncapable models and more words here`)).toContain('ever-more-capable'));
  it('keeps a hyphen before a capital', () => expect(join(`${long} English-\nto-German and more words here`)).toContain('English-to-German'));
  it('keeps a common compound ending', () => expect(join(`${long} evidence-\nbased policy and more words here`)).toContain('evidence-based'));
  it('follows how the paste spells the word elsewhere', () => {
    expect(join(`We value self-attention. ${long} self-\nattention again`)).toContain('again');
    expect(join(`We value self-attention. ${long} self-\nattention again`)).toMatch(/self-attention again/);
  });
  it('ignores ligature characters', () => expect(join('The ﬁrst ﬂoor is ﬁne.')).toBe('The first floor is fine.'));
  it('shows soft hyphens inside a line as real hyphens or dashes', () => {
    expect(join('A high\u00ADimpact role, Sep. 2023 \u00AD Mar. 2024.')).toBe('A high-impact role, Sep. 2023 – Mar. 2024.');
  });
  it('rejoins words split before an accented letter', () => {
    expect(join(`${long} 19 % des salariés fran\u2010\nçais ont eu recours au télétravail`)).toContain('français ont');
  });
});

describe('Word bullets', () => {
  it('reads private-use Symbol bullets as a list', () => {
    expect(w.pdfToHtml('Events this year:\n\uF0A7 Hackathon\n\uF0A7 Open Data Meetup')).toBe('<p>Events this year:</p><ul><li>Hackathon</li><li>Open Data Meetup</li></ul>');
  });
});

describe('PDF → outputs', () => {
  const text = pdf('article.preview');
  it('email keeps paragraphs as spaced lines', () => {
    const { html } = w.convertClip({ html: '', text }, 'pdf', 'email');
    expect(html).toMatch(/^<div>Building a Better Fellowship<br>Program<\/div><div><br><\/div><div>Over the past eighteen months/);
  });
  it('Markdown has one line per paragraph', () => {
    const { text: md } = w.convertClip({ html: '', text }, 'pdf', 'markdown');
    expect(md.split('\n\n')[1].includes('\n')).toBe(false);
  });
  it('plain text', () => {
    const { text: plain } = w.convertClip({ html: '', text }, 'pdf', 'plain');
    expect(plain).toContain('\n\nKey findings\n\nParticipants who completed a capstone project were twice as likely to change roles within six months.\n\n');
  });
});
