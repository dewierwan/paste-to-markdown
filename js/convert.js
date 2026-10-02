// Detects where a paste came from and converts it to the chosen output.
// Every input is read into HTML first, then each output is written from that,
// so adding an input or an output means writing one function, not one per pair.
(function (root) {
  const SOURCE_NAMES = {
    gdocs: 'Google Docs',
    notion: 'Notion',
    word: 'Word',
    gmail: 'Gmail',
    airtable: 'Airtable',
    pdf: 'PDF',
    html: 'Rich text',
    markdown: 'Markdown',
    text: 'Plain text',
  };

  // clip: { html, text, types } from the paste event's clipboardData.
  function detect(clip) {
    const html = clip.html || '';
    const types = clip.types || [];
    if (html) {
      if (/docs-internal-guid/.test(html)) return { source: 'gdocs', read: 'rich' };
      if (types.some((t) => /notion/i.test(t))) return { source: 'notion', read: 'rich' };
      if (/urn:schemas-microsoft-com:office|class="?Mso/i.test(html)) return { source: 'word', read: 'rich' };
      if (/class="?gmail_/.test(html)) return { source: 'gmail', read: 'rich' };
      if (types.some((t) => /airtable/i.test(t))) return { source: 'airtable', read: 'rich' };
      // PDF viewers (Preview among them) also put HTML on the clipboard, with
      // one paragraph per printed line, so the plain text decides. Preview's
      // HTML for a page that isn't prose (contents, cover, slides) gives itself
      // away too, and reads better as PDF text than as a paragraph per line.
      if (isPdfText(clip.text) || isLineByLineHtml(html, clip.text)) return { source: 'pdf', read: 'pdf' };
      // Code editors (VS Code, GitHub) put coloured but unformatted HTML on the
      // clipboard. If the HTML has no real formatting and the text is Markdown, use that.
      if (!hasFormatting(html) && looksLikeMarkdown(clip.text)) return { source: 'markdown', read: 'markdown' };
      return { source: 'html', read: 'rich' };
    }
    if (isPdfText(clip.text)) return { source: 'pdf', read: 'pdf' };
    if (looksLikeMarkdown(clip.text)) return { source: 'markdown', read: 'markdown' };
    return { source: 'text', read: 'text' };
  }

  // PDF text can contain numbered lines and stray asterisks that look like
  // Markdown, so it wins unless the Markdown is unmistakable.
  function isPdfText(text) {
    return looksLikePdf(text) && !hasUnmistakableMarkdown(text);
  }

  // Apple's HTML writer (used by Preview's copy) with one <p> per line, nearly
  // all short. TextEdit and Mail write the same HTML, so it also needs a sign of
  // a printed page: more than one font size (a title or heading) or contents
  // leaders ("Introduction ______ 3").
  function isLineByLineHtml(html, text) {
    if (!/Cocoa HTML Writer/.test(html)) return false;
    const lines = (text || '').split(/\r?\n/).filter((l) => l.trim());
    const paragraphs = (html.match(/<p[ >]/g) || []).length;
    if (lines.length < 5 || paragraphs < lines.length * 0.8) return false;
    if (lines.filter((l) => l.length > 150).length > lines.length * 0.05) return false;
    const sizes = new Set(html.match(/font: [\d.]+px/g) || []);
    const leaders = lines.filter((l) => /[_.·…]{4,}\s*\d{0,4}$/.test(l)).length;
    return sizes.size > 1 || leaders >= 3;
  }

  function hasFormatting(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return !!doc.querySelector('b, strong, i, em, a[href], ul, ol, h1, h2, h3, h4, h5, h6, table, blockquote');
  }

  function hasStrongMarkdown(text) {
    return !!text && STRONG_MARKDOWN.some((re) => re.test(text));
  }

  // Stricter than STRONG_MARKDOWN: bold markers hug words ("**this**", not
  // "31.1** 31.2**" footnote marks), and headings have a blank line after them,
  // which PDF text never does.
  function hasUnmistakableMarkdown(text) {
    return [
      /(^|[\s(])\*\*[^*\s][^*\n]*[^*\s]\*\*(?=[\s.,;:!?)]|$)/m,
      /^#{1,6}\s+\S[^\n]*\n[ \t]*\n/m,
      /\[[^\]\n]+\]\(https?:[^)\s]+\)/,
      /^```/m,
    ].some((re) => re.test(text));
  }

  function looksLikeMarkdown(text) {
    if (!text) return false;
    if (hasStrongMarkdown(text)) return true;
    const listLines = text.match(/^\s*([-*+]|\d+[.)])\s+\S/gm) || [];
    return listLines.length >= 2;
  }

  const STRONG_MARKDOWN = [
    /^#{1,6}\s+\S/m, // heading
    /\*\*[^*\n]+\*\*/, // bold
    /\[[^\]\n]+\]\([^)\s]+\)/, // link
    /^```/m, // code fence
    /^\s*[-*]\s+\[[ xX]\]\s/m, // task list
  ];

  // readAs: 'rich' | 'markdown' | 'text' | 'pdf'.
  // output: 'markdown' | 'email' | 'rich' | 'whatsapp' | 'plain'.
  // Returns { text, html } where html is set only for rich output.
  function convertClip(clip, readAs, output) {
    const docs = readAs === 'rich' && /docs-internal-guid/.test(clip.html || '');
    let html;
    if (readAs === 'rich') html = clip.html || textToHtml(clip.text);
    else if (readAs === 'markdown') html = marked.parse(clip.text || '', { gfm: true });
    else if (readAs === 'pdf') html = pdfToHtml(clip.text, clip.html);
    else html = textToHtml(clip.text);

    if (output === 'markdown') {
      if (readAs === 'pdf') return { text: convertToMarkdown(html) };
      if (readAs !== 'rich') return { text: (clip.text || '').replace(/\r\n/g, '\n').trim() };
      // Docs hides formatting in styles, so normalise it before writing Markdown.
      const source = docs ? cleanHtml(html, { target: 'markdown', docs: true }) : html;
      return { text: unescapeOverEscaped(stripImages(stripWrappingFence(convertToMarkdown(source)))) };
    }

    // Email markup (headings as bold lines) also feeds the text writers.
    const email = cleanHtml(html, { target: 'rich', headings: 'bold', docs });
    const plain = toText(email, 'plain');
    if (output === 'email') return { html: email, text: plain };
    if (output === 'rich') return { html: cleanHtml(html, { target: 'rich', headings: 'keep', docs }), text: plain };
    return { text: output === 'plain' ? plain : toText(email, output) };
  }

  function textToHtml(text) {
    return (text || '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => (line ? `<div>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : '<div><br></div>'))
      .join('');
  }

  root.SOURCE_NAMES = SOURCE_NAMES;
  root.detect = detect;
  root.looksLikeMarkdown = looksLikeMarkdown;
  root.convertClip = convertClip;
})(globalThis);
