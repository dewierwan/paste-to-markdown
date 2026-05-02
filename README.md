# Paste to Markdown

Paste rich text. Get clean Markdown. Copied automatically.

Live at **[paste-to.md](https://paste-to.md)**.

Most rich-text editors export Markdown full of artefacts: Notion's wrapping divs, Google Docs' span soup, Airtable's nested formatting. This single-page app strips all of it and gives you something you can drop into a README, a PR description, or a Slack post.

## Features

- No install, no build, one HTML file
- Auto-copies output to your clipboard
- Headings, bold, italic, strikethrough, inline code, code blocks, blockquotes, links
- Ordered, unordered, and nested lists
- Checkboxes (Notion to-dos, Google Docs checklists)

## Run locally

```sh
git clone https://github.com/dewierwan/paste-to-markdown
open paste-to-markdown/index.html
```

That is the whole setup. No `npm install`.

## Contributing

All conversion logic lives in `index.html`, inside `convertNodeToMarkdown`. PRs welcome, especially for:

- New element types
- Better support for a specific source (Slack, Confluence, Linear, Quip)
- Whitespace and nesting edge cases

Before opening a PR:

```sh
npx cspell "**/*.{html,js,md,json}"
npx html-validate index.html
```

## License

[MIT](LICENSE)
