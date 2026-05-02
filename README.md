# Paste to Markdown

Paste rich text. Get clean Markdown. Copied automatically.

Live at **[paste-to.md](https://paste-to.md)**.

Most rich-text editors export Markdown full of artefacts: Notion's wrapping divs, Google Docs' span soup, Airtable's nested formatting. This single-page app strips all of it and gives you something you can drop into a README, a PR description, or a Slack post.

## Features

- No install, no build, one HTML file
- Auto-copies output to your clipboard
- Headings (h1–h6), bold, italic, strikethrough, highlight, sub/superscript, inline code, code blocks (with language hints), blockquotes, links, images
- Ordered, unordered, and nested lists; checkboxes (Notion to-dos, Google Docs checklists)
- Tables (GitHub-flavoured Markdown)
- Horizontal rules
- Escapes Markdown-significant characters in your text so "5 \* 3" stays as "5 \\* 3" instead of becoming italic

## Privacy

100% client-side. The page is static HTML and JavaScript — your pasted content never leaves your browser.

## Run locally

```sh
git clone https://github.com/dewierwan/paste-to-markdown
open paste-to-markdown/index.html
```

That is the whole setup for using the site. No `npm install` needed.

## Contributing

All conversion logic lives in `index.html`, inside `convertNodeToMarkdown`. PRs welcome, especially for:

- New element types
- Better support for a specific source (Slack, Confluence, Linear, Quip)
- Whitespace and nesting edge cases
- Real-world HTML fixtures under `tests/fixtures/<source>/<scenario>.html` paired with `<scenario>.expected.md`

Run the contributor checks before opening a PR:

```sh
npm install
npm test
npm run lint:spell
npm run lint:html
```

`npm install` is contributor-only — end users still just open `index.html`.

## License

[MIT](LICENSE)
