# Paste to Markdown Project Guidelines

## Build & Development Commands
- **Run development server:** Open `index.html` directly in a browser
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
- Keep HTML, CSS, and JavaScript in single `index.html` file
- Store image assets in root directory
- Use descriptive filenames for all assets