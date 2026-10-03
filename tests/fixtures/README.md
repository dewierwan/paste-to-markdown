# Fixtures

Each fixture is a paste, saved the way the browser received it.
`tests/fixtures.test.js` runs every fixture through detection and all five outputs and compares the results with the expected files next to it.

| File | What it is |
|---|---|
| `<name>.html` | The clipboard's HTML |
| `<name>.txt` | The clipboard's plain text (detection uses it) |
| `<name>.types` | The clipboard's types, one per line, when the app adds its own (Notion, Airtable) |
| `<name>.detected.txt` | The detected source and how it is read |
| `<name>.expected.md` | Markdown output |
| `<name>.expected.email.html` | Email & Slack output |
| `<name>.expected.docs.html` | Docs output |
| `<name>.expected.whatsapp.txt` | WhatsApp output |
| `<name>.expected.plain.txt` | Plain text output |

PDF fixtures in `pdf/` are plain text instead: `<name>.txt`, plus `<name>-clipboard.html` when the viewer also wrote HTML. `tests/pdf.test.js` checks them in more detail.

## Adding a fixture

1. Run `npm run capture`. A local page opens.
2. Copy something in the app you want to test, paste it on that page, give it a name and save. The files land in `tests/fixtures/<folder>/`.
3. Run `npm run test:update`. It writes the expected files for the new fixture.
4. Read the expected files. If an output is wrong, fix the code, run `npm run test:update` again, and check the diff.

After any intended change to the output, `npm run test:update` rewrites the expected files; review the diff before committing. CI never writes them, so a fixture without its expected files fails there.

## Where the fixtures came from

Real captures are better than hand-written ones, because apps change their clipboard HTML without notice. Replace the hand-built ones with real captures when you can.

| Folder | Source |
|---|---|
| `gdocs/`, `airtable/` | Added with the original test suite |
| `pdf/` | Real viewer copies (see `tests/pdf.test.js`) |
| `notion/`, `word/`, `gmail/`, `vscode/`, `claude/` | Hand-built from each app's known clipboard format (October 2026), not yet real captures |
