// Normalises pasted HTML into a small, predictable subset: lines and
// paragraphs, <b>/<i>/<u>/<s>, links, lists, tables, quotes and code.
// Fonts, sizes, colours, line height and margins are dropped.
//
// target "rich": the markup Gmail's compose box writes itself (<div> lines).
//   headings "bold" (email: Gmail, Outlook and Slack have no headings) turns
//   headings into bold lines; headings "keep" (Docs, Notion, Airtable) keeps
//   <h1>–<h6> at their original level.
// target "markdown": semantic tags (<p>, <h1>, <pre>, <input type="checkbox">)
//   for the Markdown writer.
//
// spacing "tags" (most apps): <p> and headings are spaced paragraphs, <div>s are
// lines. spacing "margins" (Google Docs): every paragraph is a <p> line, with a
// blank line where a paragraph has space above or below it, or is empty.
// js/sources.js says which an app uses, and rewrites app quirks before this runs.
(function (root) {
  const SKIP_TAGS = new Set(['STYLE', 'SCRIPT', 'META', 'TITLE', 'HEAD', 'LINK', 'COLGROUP', 'COL']);
  const BLOCK_TAGS = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV', 'FIGURE', 'FIGCAPTION',
  ]);
  const STRUCTURE_TAGS = new Set(['UL', 'OL', 'TABLE', 'HR', 'PRE', 'BLOCKQUOTE', ...BLOCK_TAGS]);
  const MERGEABLE_TAGS = new Set(['B', 'I', 'U', 'S', 'SUB', 'SUP', 'A', 'CODE', 'FONT']);
  const OL_TYPES = { 'lower-alpha': 'a', 'upper-alpha': 'A', 'lower-roman': 'i', 'upper-roman': 'I' };
  const LIST_STYLE = ' style="margin-top:0;margin-bottom:0"'; // as on lists Gmail creates
  const QUOTE_STYLE = ' style="margin:0 0 0 0.8ex;border-left:1px solid #ccc;padding-left:1ex"'; // Gmail's quote
  const EMPTY_LINE = '<div><br></div>';

  function cleanHtml(html, options = {}) {
    const opts = {
      target: options.target || 'rich',
      headings: options.headings || 'bold',
      margins: options.spacing === 'margins',
    };
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const start = { b: false, i: false, u: false, s: false, sup: false, sub: false, code: false, mark: false, heading: false, href: null };
    const out = convertChildren(doc.body, start, 'block', opts);
    return finish(out, opts);
  }

  function convertChildren(el, fmt, mode, opts) {
    return convertNodes(el.childNodes, fmt, mode, opts);
  }

  function convertNodes(nodes, fmt, mode, opts) {
    let html = '';
    let prevWasBlock = false;
    for (const child of nodes) {
      const isBlock = child.nodeType === 1 && BLOCK_TAGS.has(child.tagName);
      // Inside a list item or table cell, separate paragraphs with line breaks.
      if (mode === 'inline' && isBlock && prevWasBlock) html += '<br>';
      html += convertNode(child, fmt, mode, opts);
      if (child.nodeType === 1 || child.textContent.trim()) prevWasBlock = isBlock;
    }
    return html;
  }

  function convertNode(node, fmt, mode, opts) {
    if (node.nodeType === 3) return renderText(node.textContent, fmt, opts);
    if (node.nodeType !== 1) return '';

    const tag = node.tagName;
    const rich = opts.target === 'rich';
    if (SKIP_TAGS.has(tag)) return '';
    if (tag === 'BR') return mode === 'block' ? (rich ? EMPTY_LINE : '') : '<br>';
    if (tag === 'HR') return '<hr>';
    if (tag === 'IMG') return renderImage(node);
    if (tag === 'INPUT') {
      if (node.type !== 'checkbox') return '';
      if (!rich) return node.checked ? '<input type="checkbox" checked>' : '<input type="checkbox">';
      return node.checked ? '☑ ' : '☐ ';
    }
    if (tag === 'PRE') return renderCodeBlock(node, opts);

    const f = nextFormat(node, fmt);
    if (tag === 'UL' || tag === 'OL') return renderList(node, f, opts);
    if (tag === 'TABLE') return renderTable(node, f, opts);
    if (tag === 'BLOCKQUOTE') {
      const inner = convertChildren(node, f, 'block', opts);
      return rich ? `<blockquote${QUOTE_STYLE} data-p>${inner}</blockquote>` : `<blockquote>${inner}</blockquote>`;
    }

    if (BLOCK_TAGS.has(tag)) {
      // A wrapper (e.g. the div around a Docs table) is transparent.
      if (hasStructureChild(node)) return convertChildren(node, f, mode, opts);
      const inner = convertChildren(node, f, 'inline', opts);
      return mode === 'block' ? wrapBlock(node, inner, opts) : inner;
    }
    // Inline wrappers (span, b, a, ...) pass the mode through: Docs wraps whole
    // documents in <b style="font-weight:normal">.
    return convertChildren(node, f, mode, opts);
  }

  function wrapBlock(node, inner, opts) {
    const tag = node.tagName;
    const heading = /^H[1-6]$/.test(tag);
    const empty = !inner.replace(/<br>|&nbsp;|\s/g, ''); // includes Word's <p>&nbsp;</p>
    if (opts.target === 'markdown') {
      if (empty) return '';
      return heading ? `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>` : `<p>${inner}</p>`;
    }
    if (empty) return EMPTY_LINE;
    // Real headings carry their own spacing, so no blank lines around them.
    if (heading && opts.headings === 'keep') return `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>`;
    // Spaced by tags: <p> and headings are spaced paragraphs; <div>s are lines.
    const spaced = !opts.margins && (tag === 'P' || heading);
    // Spaced by margins: a paragraph is a line unless it has space after (or before) it.
    const gapAfter = opts.margins && tag === 'P' && hasSpacing(node.style.marginBottom);
    const gapBefore = opts.margins && tag === 'P' && hasSpacing(node.style.marginTop);
    const attrs = (spaced ? ' data-p' : '') + (gapAfter ? ' data-gap-after' : '') + (gapBefore ? ' data-gap-before' : '');
    return `<div${attrs}>${inner}</div>`;
  }

  function hasSpacing(margin) {
    return parseFloat(margin) >= 6; // pt or px; Docs writes pt
  }

  function hasStructureChild(el) {
    return Array.from(el.children).some((c) => STRUCTURE_TAGS.has(c.tagName));
  }

  function nextFormat(el, fmt) {
    const f = { ...fmt };
    const tag = el.tagName;
    if (tag === 'B' || tag === 'STRONG') f.b = true;
    if (tag === 'I' || tag === 'EM') f.i = true;
    if (tag === 'U' || tag === 'INS') f.u = true;
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') f.s = true;
    if (tag === 'SUP') f.sup = true;
    if (tag === 'SUB') f.sub = true;
    if (tag === 'CODE' || tag === 'KBD' || tag === 'SAMP' || tag === 'TT') f.code = true;
    if (tag === 'MARK') f.mark = true;
    if (/^H[1-6]$/.test(tag)) f.heading = true;
    if (tag === 'A') {
      const href = cleanHref(el.getAttribute('href'));
      if (href) f.href = href;
    }

    // Docs (and others) put the real formatting in inline styles; these override tags.
    const st = el.style;
    if (st.fontWeight) f.b = st.fontWeight === 'bold' || st.fontWeight === 'bolder' || parseInt(st.fontWeight, 10) >= 600;
    if (st.fontStyle) f.i = st.fontStyle === 'italic' || st.fontStyle === 'oblique';
    const deco = st.textDecorationLine || st.textDecoration;
    if (deco) {
      f.u = deco.includes('underline');
      f.s = deco.includes('line-through');
    }
    if (st.verticalAlign) {
      f.sup = st.verticalAlign === 'super';
      f.sub = st.verticalAlign === 'sub';
    }
    return f;
  }

  function cleanHref(href) {
    if (!href) return null;
    href = href.trim();
    // Unwrap Google redirect links: https://www.google.com/url?q=<real>&sa=D...
    const redirect = href.match(/^https?:\/\/(www\.)?google\.com\/url\?(.*)$/);
    if (redirect) {
      const q = new URLSearchParams(redirect[2]).get('q');
      if (q) href = q;
    }
    return /^(https?:|mailto:|tel:)/i.test(href) ? href : null;
  }

  function renderText(text, fmt, opts) {
    // Ignore source-code whitespace between tags (newlines plus indentation).
    if (/^\s*$/.test(text) && text.includes('\n')) return '';
    let t = escapeHtml(text)
      .replace(/\t/g, '    ')
      .replace(/ {2}/g, '  ') // Docs keeps runs of spaces; HTML would collapse them.
      .replace(/\r?\n/g, '<br>');
    if (!t) return '';
    const rich = opts.target === 'rich';
    if (fmt.code) t = rich ? `<font face="monospace">${t}</font>` : `<code>${t}</code>`;
    if (fmt.mark && !rich) t = `<mark>${t}</mark>`;
    if (fmt.sub) t = `<sub>${t}</sub>`;
    if (fmt.sup) t = `<sup>${t}</sup>`;
    if (fmt.s) t = `<s>${t}</s>`;
    if (fmt.u && !fmt.href) t = `<u>${t}</u>`; // links are underlined already
    if (fmt.i) t = `<i>${t}</i>`;
    if (fmt.b || (fmt.heading && rich && opts.headings === 'bold')) t = `<b>${t}</b>`;
    if (fmt.href) t = `<a href="${escapeAttr(fmt.href)}">${t}</a>`;
    return t;
  }

  function renderImage(img) {
    const src = img.getAttribute('src') || '';
    if (!/^https?:/i.test(src)) return '';
    const width = parseInt(img.getAttribute('width') || img.style.width, 10);
    const widthAttr = width > 0 ? ` width="${width}"` : '';
    return `<img src="${escapeAttr(src)}" alt="${escapeAttr(img.getAttribute('alt') || '')}"${widthAttr}>`;
  }

  function renderCodeBlock(pre, opts) {
    const code = escapeHtml(pre.textContent.replace(/\n$/, ''));
    if (opts.target === 'markdown') {
      const codeEl = pre.querySelector('code');
      const langClass = Array.from((codeEl || pre).classList).find((c) => c.startsWith('language-'));
      const lang = pre.getAttribute('data-language') || (langClass ? langClass.slice(9) : '');
      return `<pre${lang ? ` data-language="${escapeAttr(lang)}"` : ''}>${code}</pre>`;
    }
    return `<div data-p><font face="monospace">${code.replace(/\n/g, '<br>').replace(/ {2}/g, '  ')}</font></div>`;
  }

  // Some apps (Google Docs, Quill, Word once fixed) write nested lists flat, with
  // aria-level on each <li>; others nest properly. Flatten to (level, type,
  // content), then rebuild.
  function renderList(listEl, fmt, opts) {
    const items = [];
    collectListItems(listEl, 0, fmt, opts, items);
    let html = '';
    const stack = [];
    for (const item of items) {
      const level = Math.min(item.level, stack.length);
      while (stack.length > level + 1) html += `</li></${stack.pop().tag}>`;
      if (stack.length === level + 1) {
        if (stack[level].open !== item.open) {
          html += `</li></${stack.pop().tag}>${item.open}`;
          stack.push(item);
        } else {
          html += '</li>';
        }
      } else {
        html += item.open;
        stack.push(item);
      }
      html += `<li>${item.html}`;
    }
    while (stack.length) html += `</li></${stack.pop().tag}>`;
    // Mark the outer list as a spaced block (the first open tag).
    return opts.target === 'rich' && !opts.margins ? html.replace(/^<(ul|ol)/, '<$1 data-p') : html;
  }

  function collectListItems(listEl, depth, fmt, opts, items) {
    for (const child of listEl.children) {
      if (child.tagName === 'UL' || child.tagName === 'OL') {
        collectListItems(child, depth + 1, fmt, opts, items);
      } else if (child.tagName === 'LI') {
        const ariaLevel = parseInt(child.getAttribute('aria-level'), 10);
        const listType = child.getAttribute('data-list-type');
        const tag = listType === 'ul' || listType === 'ol' ? listType : listEl.tagName.toLowerCase();
        const type = tag === 'ol' && OL_TYPES[child.style.listStyleType];
        const isList = (node) => node.nodeType === 1 && (node.tagName === 'UL' || node.tagName === 'OL');
        const nested = Array.from(child.childNodes).filter(isList);
        const html = convertNodes(Array.from(child.childNodes).filter((node) => !isList(node)), nextFormat(child, fmt), 'inline', opts);
        const style = opts.target === 'rich' ? LIST_STYLE : '';
        items.push({
          level: ariaLevel > 0 ? ariaLevel - 1 : depth,
          tag,
          open: `<${tag}${type ? ` type="${type}"` : ''}${style}>`,
          html: html || '<br>',
        });
        for (const list of nested) collectListItems(list, depth + 1, fmt, opts, items);
      }
    }
  }

  function renderTable(table, fmt, opts) {
    const rich = opts.target === 'rich';
    let html = rich ? '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse" data-p>' : '<table>';
    for (const row of table.rows) {
      html += '<tr>';
      for (const cell of row.cells) {
        const tag = cell.tagName.toLowerCase();
        const span = ['colspan', 'rowspan']
          .filter((a) => parseInt(cell.getAttribute(a), 10) > 1)
          .map((a) => ` ${a}="${parseInt(cell.getAttribute(a), 10)}"`)
          .join('');
        html += `<${tag}${span}>${convertChildren(cell, nextFormat(cell, fmt), 'inline', opts) || (rich ? '<br>' : '')}</${tag}>`;
      }
      html += '</tr>';
    }
    return `${html}</table>`;
  }

  // Joins <b>Hello </b><b>world</b>, puts a blank line between spaced
  // paragraphs, collapses repeated blank lines, and trims blank lines at the ends.
  function finish(html, opts) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    mergeChildren(doc.body);
    if (opts.target === 'rich') {
      spaceParagraphs(doc.body, opts);
      for (const el of doc.body.querySelectorAll('[data-p], [data-gap-after], [data-gap-before]')) {
        el.removeAttribute('data-p');
        el.removeAttribute('data-gap-after');
        el.removeAttribute('data-gap-before');
      }
      trimEmptyLines(doc.body);
    }
    return doc.body.innerHTML;
  }

  function mergeChildren(el) {
    let child = el.firstChild;
    while (child) {
      const next = child.nextSibling;
      if (
        next && child.nodeType === 1 && next.nodeType === 1 &&
        MERGEABLE_TAGS.has(child.tagName) && child.tagName === next.tagName &&
        child.getAttribute('href') === next.getAttribute('href') &&
        child.getAttribute('face') === next.getAttribute('face')
      ) {
        while (next.firstChild) child.appendChild(next.firstChild);
        next.remove();
        continue;
      }
      child = next;
    }
    for (const c of el.children) mergeChildren(c);
  }

  function isEmptyLine(el) {
    return el && el.tagName === 'DIV' && el.childNodes.length === 1 && el.firstChild.nodeName === 'BR';
  }

  function spaceParagraphs(container, opts) {
    for (const quote of container.querySelectorAll('blockquote')) spaceParagraphs(quote, opts);
    const children = Array.from(container.children);
    children.forEach((el, i) => {
      const prev = children[i - 1];
      const spaced = prev && el.hasAttribute('data-p') && prev.hasAttribute('data-p');
      const marginGap = prev && !isEmptyLine(el) && !isEmptyLine(prev) &&
        (prev.hasAttribute('data-gap-after') || el.hasAttribute('data-gap-before'));
      if (spaced || marginGap) {
        el.insertAdjacentHTML('beforebegin', EMPTY_LINE);
      }
    });
    if (!opts.margins) {
      // Word and web pages often pad with empty paragraphs; keep one blank line.
      for (const el of Array.from(container.children)) {
        if (isEmptyLine(el) && isEmptyLine(el.previousElementSibling)) el.remove();
      }
    }
  }

  function trimEmptyLines(body) {
    while (isEmptyLine(body.firstChild)) body.firstChild.remove();
    while (isEmptyLine(body.lastChild)) body.lastChild.remove();
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  root.cleanHtml = cleanHtml;
})(globalThis);
