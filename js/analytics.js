// Anonymous usage counts via Umami Cloud (no cookies, no personal data).
// Sends Umami's own /api/send payload with fetch instead of loading its remote
// script, which the Chrome extension would refuse. Runs on pasteinto.com and
// in the extension popup, which reports as the page /extension (Umami's free
// plan allows one website). Local files and previews send nothing. Events
// carry labels only (source app, output format), never anything pasted.
(function () {
  const WEBSITE_ID = '6a7783e5-36ef-419e-9c1f-5113e68558ac';
  const ENDPOINT = 'https://gateway.umami.is/api/send';
  const HOSTS = ['pasteinto.com', 'www.pasteinto.com'];

  const isExtension = location.protocol === 'chrome-extension:';
  const isSite = location.protocol === 'https:' && HOSTS.includes(location.hostname);
  const enabled = Boolean(WEBSITE_ID) && (isSite || isExtension);
  const hostname = isExtension ? 'pasteinto.com' : location.hostname;
  const path = isExtension ? '/extension' : location.pathname;
  let cache; // Umami's visit token, so one visit's events group together

  function send(name, data) {
    if (!enabled) return;
    const payload = {
      website: WEBSITE_ID,
      hostname,
      url: path,
      title: document.title,
      referrer: document.referrer,
      language: navigator.language,
      screen: `${screen.width}x${screen.height}`,
    };
    if (name) {
      payload.name = name;
      if (data) payload.data = data;
    }
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        keepalive: true,
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'x-umami-website-id': WEBSITE_ID,
          'x-umami-hostname': hostname,
          ...(cache && { 'x-umami-cache': cache }),
        },
        body: JSON.stringify({ type: 'event', payload }),
      })
        .then((response) => response.json())
        .then((result) => { if (result && result.cache) cache = result.cache; })
        .catch(() => {});
    } catch {
      // Analytics must never break the page.
    }
  }

  // track('paste', { source: 'gdocs' }) records an event; track() a pageview.
  globalThis.track = send;
  send();
})();
