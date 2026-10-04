// Run in the browser console on Airtable (a rich text field, cursor in it) or
// Slack (cursor in the message box). Both edit with Quill 1. Converts a payload
// with the page's own Quill clipboard, exactly as a paste would, and prints an
// outline. Nothing is inserted unless you call it with insert = true.
//   pasteintoQuill(payload['text/html'])
// eslint-disable-next-line no-unused-vars
function pasteintoQuill(html, insert = false) {
  const container = document.activeElement.closest('.ql-container');
  const quill = container && container.__quill;
  if (!quill) throw new Error('Click into a Quill editor first');
  const delta = quill.clipboard.convert(html);
  if (insert) quill.setContents(delta, 'user');
  // One line per paragraph: its block format, then its text with inline formats.
  const lines = [];
  let line = '';
  for (const op of delta.ops) {
    const parts = String(op.insert).split('\n');
    const marks = op.attributes ? Object.keys(op.attributes).filter((k) => ['bold', 'italic', 'link'].includes(k)) : [];
    parts.forEach((part, i) => {
      if (part) line += marks.length ? `[${marks.join('+')}:${part}]` : part;
      if (i < parts.length - 1) {
        const a = op.attributes || {};
        const block = [a.header && `h${a.header}`, a.list, a.indent && `indent ${a.indent}`, a.blockquote && 'quote']
          .filter(Boolean)
          .join(', ');
        line = line.replace(/\u00A0/g, ' '); // prints like a space
        lines.push(block ? `${block} | ${line}` : line);
        line = '';
      }
    });
  }
  return lines.join('\n');
}
