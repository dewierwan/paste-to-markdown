// Small helpers shared by the converters.
(function (root) {
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  // Markdown and WhatsApp markers must touch the text: "*bold* " works,
  // "*bold *" does not. Moves edge whitespace outside the markers and leaves
  // whitespace-only runs unwrapped.
  function wrapMarkers(marker, text) {
    const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return match[2] ? `${match[1]}${marker}${match[2]}${marker}${match[3]}` : text;
  }

  root.escapeHtml = escapeHtml;
  root.escapeAttr = escapeAttr;
  root.wrapMarkers = wrapMarkers;
})(globalThis);
