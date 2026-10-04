// Run in the browser console on a scratch Google Doc, with the cursor on an
// empty line. Google Docs reads pastes from a hidden iframe; dispatching the
// paste there runs Docs' own HTML import. Docs draws on a canvas, so read the
// result back with the Docs API (readDocument as JSON: namedStyleType, bullet
// nestingLevel, textStyle) or by eye.
//   pasteintoGoogleDocs(payload)
// eslint-disable-next-line no-unused-vars
function pasteintoGoogleDocs(payload) {
  const frame = document.querySelector('iframe.docs-texteventtarget-iframe');
  const target = frame && frame.contentDocument.querySelector('[contenteditable="true"]');
  if (!target) throw new Error('Open a Google Doc and click into it first');
  const data = new DataTransfer();
  data.setData('text/html', payload['text/html']);
  data.setData('text/plain', payload['text/plain']);
  return !target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
}
