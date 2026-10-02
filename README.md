# Paste Into

Paste anything. Pick where it's going. The result is copied automatically.

Live at **[pasteinto.com](https://pasteinto.com)**. (The old paste-to.md redirects here.)

Every app puts its own clutter on the clipboard: Google Docs' span soup, Notion's wrapping divs, Word's `Mso` styles, Claude's raw Markdown asterisks. This page reads any of them and writes one of five outputs:

| Output | For |
|---|---|
| Markdown | Claude, ChatGPT, GitHub, Obsidian, Notion |
| Email & Slack | Gmail, Outlook, Slack. Headings become bold lines, since these apps have no headings |
| Docs | Google Docs, Notion, Airtable. Like Email & Slack, but keeps headings at their original level |
| WhatsApp | WhatsApp, Signal. Formatting becomes `*bold*`, `_italic_` and `~strike~` |
| Plain text | LinkedIn, text messages, forms |

## Features

- Paste anywhere on the page; the result is auto-copied. Switching output re-copies the same paste.
- Detects the source (Google Docs, Notion, Word, Gmail, Airtable, Markdown, plain text) and lets you override how it's read.
- Headings, bold, italic, strikethrough, links, nested bullet and numbered lists, checkboxes, code, quotes and tables.
- Fixes Google Docs quirks: the `<b style="font-weight:normal">` wrapper, formatting stored in inline styles, flattened nested lists, `google.com/url?q=` redirect links and "space after paragraph" spacing.
- No build step. Static HTML, CSS and JavaScript.

## Privacy

100% client-side. Nothing you paste leaves your browser.

## Run locally

```sh
git clone https://github.com/dewierwan/pasteinto
open pasteinto/index.html
```

## How it works

Every paste is read into HTML (`js/convert.js` detects the source; Markdown is parsed with the vendored [marked](https://github.com/markedjs/marked)), then written out:

- `js/clean-html.js` normalises HTML to a small, predictable subset (the Email & Slack and Docs outputs, and the input to the text writers).
- `js/to-markdown.js` writes Markdown.
- `js/to-text.js` writes WhatsApp and plain text.
- `js/app.js` wires up the page.

Adding an input or an output means writing one function, not one per pair.

## Contributing

Real-world fixtures are the most useful contribution: put a clipboard HTML sample in `tests/fixtures/<source>/<scenario>.html` with the expected Markdown in `<scenario>.expected.md`.

```sh
npm install
npm test
npm run lint:spell
npm run lint:html
```

## License

[MIT](LICENSE)
