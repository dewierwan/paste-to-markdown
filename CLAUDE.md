# Paste to Markdown Project Guidelines

## Build & Development Commands
- **Run development server:** Open `index.html` directly in a browser
- **Tests:** `npm test` (vitest + jsdom; `tests/load.js` loads the scripts in `index.html` order)
- **Spell check:** `npx cspell "**/*.{html,js,md,json}"`
- **Validate HTML:** `npx html-validate index.html`

## Code Style Guidelines

### HTML/CSS/JavaScript
- Use 2-space indentation
- Prefer double quotes for HTML attributes and JavaScript strings
- Add comments for complex logic sections
- Use semantic HTML elements where appropriate
- Maintain consistent class/ID naming conventions (camelCase)
- Follow BEM methodology for CSS class naming when applicable

### Error Handling
- Use try/catch blocks for error-prone operations
- Display user-friendly error messages
- Log errors to console for debugging

### Markdown Generation
- Follow GitHub Flavored Markdown spec
- Maintain proper spacing between elements
- Handle special characters and formatting correctly

## Project Structure
- No build step: `index.html`, `css/app.css`, and classic scripts in `js/` that attach functions to `globalThis`
- Pipeline: `js/convert.js` detects the source and reads every paste into HTML (`js/from-pdf.js` for PDF text); `js/clean-html.js`, `js/to-markdown.js` and `js/to-text.js` write the outputs; `js/app.js` is the page wiring
- Third-party code lives in `js/vendor/` unmodified (currently marked, MIT)
- When adding a script, add it to both `index.html` and `tests/load.js`
- After changing any file in `css/` or `js/`, run `npm run stamp` (updates the `?v=` content hashes in `index.html` so browsers don't mix new and cached files; a test fails if you forget)
- Store image assets in root directory