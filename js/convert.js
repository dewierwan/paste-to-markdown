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
      // Code editors (VS Code, GitHub) put coloured but unformatted HTML on the
      // clipboard. If the HTML has no real formatting and the text is Markdown, use that.
      if (!hasFormatting(html) && looksLikeMarkdown(clip.text)) return { source: 'markdown', read: 'markdown' };
      return { source: 'html', read: 'rich' };
    }
    if (looksLikeMarkdown(clip.text)) return { source: 'markdown', read: 'markdown' };
    return { source: 'text', read: 'text' };
  }

  function hasFormatting(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return !!doc.querySelector('b, strong, i, em, a[href], ul, ol, h1, h2, h3, h4, h5, h6, table, blockquote');
  }

  function looksLikeMarkdown(text) {
    if (!text) return false;
    const strong = [
      /^#{1,6}\s+\S/m, // heading
      /\*\*[^*\n]+\*\*/, // bold
      /\[[^\]\n]+\]\([^)\s]+\)/, // link
      /^```/m, // code fence
      /^\s*[-*]\s+\[[ xX]\]\s/m, // task list
    ];
    if (strong.some((re) => re.test(text))) return true;
    const listLines = text.match(/^\s*([-*+]|\d+[.)])\s+\S/gm) || [];
    return listLines.length >= 2;
  }

  // readAs: 'rich' | 'markdown' | 'text'. output: 'markdown' | 'rich' | 'whatsapp' | 'plain'.
  // Returns { text, html } where html is set only for rich output.
  function convertClip(clip, readAs, output) {
    const docs = readAs === 'rich' && /docs-internal-guid/.test(clip.html || '');
    let html;
    if (readAs === 'rich') html = clip.html || textToHtml(clip.text);
    else if (readAs === 'markdown') html = marked.parse(clip.text || '', { gfm: true });
    else html = textToHtml(clip.text);

    if (output === 'markdown') {
      if (readAs !== 'rich') return { text: (clip.text || '').replace(/\r\n/g, '\n').trim() };
      // Docs hides formatting in styles, so normalise it before writing Markdown.
      const source = docs ? cleanHtml(html, { target: 'markdown', docs: true }) : html;
      return { text: unescapeOverEscaped(stripImages(stripWrappingFence(convertToMarkdown(source)))) };
    }

    const rich = cleanHtml(html, { target: 'rich', docs });
    if (output === 'rich') return { html: rich, text: toText(rich, 'plain') };
    return { text: toText(rich, output) };
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
