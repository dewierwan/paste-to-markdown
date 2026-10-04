// Run in the browser console on a scratch Notion page, with the cursor in an
// empty text block. Dispatches a paste event carrying the payload (Notion's own
// paste handler reads event.clipboardData, so this matches a real paste), then
// prints the blocks Notion created as an outline.
//   await pasteintoNotion(payload)
// eslint-disable-next-line no-unused-vars
async function pasteintoNotion(payload) {
  const node = getSelection().anchorNode;
  const target = node && (node.nodeType === 1 ? node : node.parentElement);
  if (!target || !target.closest('[data-block-id]')) throw new Error('Put the cursor in an empty Notion text block first');
  const before = new Set([...document.querySelectorAll('.notion-page-content [data-block-id]')].map((b) => b.dataset.blockId));
  const data = new DataTransfer();
  data.setData('text/html', payload['text/html']);
  data.setData('text/plain', payload['text/plain']);
  target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const lines = [];
  const blockType = (b) => (b.className.match(/notion-([a-z_]+)-block/) || [])[1];
  const visit = (b, depth) => {
    const type = blockType(b);
    if (!type) return;
    const editable = b.querySelector('[contenteditable="true"]');
    const own = editable && editable.closest('[data-block-id]') === b ? editable : null;
    if (own && own.innerText) {
      let box = '';
      if (type === 'to_do') box = getComputedStyle(own).textDecorationLine.includes('line-through') ? ' [x]' : ' [ ]';
      const marks = [...own.querySelectorAll('span[style], a')]
        .map((s) => {
          const style = s.getAttribute('style') || '';
          const m = [
            s.tagName === 'A' && 'link',
            /font-weight:\s*(600|700|bold)/.test(style) && 'bold',
            /italic/.test(style) && 'italic',
          ].filter(Boolean);
          return m.length ? `[${m.join('+')}:${s.innerText}]` : null;
        })
        .filter(Boolean);
      lines.push(`${'  '.repeat(depth)}${type}${box} | ${own.innerText}${marks.length ? ` ${marks.join(' ')}` : ''}`);
    }
    for (const child of b.querySelectorAll('[data-block-id]')) {
      if (child.parentElement.closest('[data-block-id]') === b) visit(child, depth + 1);
    }
  };
  const added = [...document.querySelectorAll('.notion-page-content > [data-block-id]')].filter((b) => !before.has(b.dataset.blockId));
  for (const b of added) visit(b, 0);
  return lines.join('\n');
}
