// Anonymous usage counts via Umami Cloud (no cookies, no personal data).
// Sends Umami's own /api/send payload with fetch instead of loading its remote
// script, which the Chrome extension would refuse. Only runs on pasteinto.com:
// the extension popup, local files and previews send nothing. Events carry
// labels only (source app, output format), never anything pasted.
(function () {
  const WEBSITE_ID = '6a7783e5-36ef-419e-9c1f-5113e68558ac';
  const ENDPOINT = 'https://gateway.umami.is/api/send';
  const HOSTS = ['pasteinto.com', 'www.pasteinto.com'];

  let cache; // Umami's visit token, so one visit's events group together
  const enabled = Boolean(WEBSITE_ID) && location.protocol === 'https:' && HOSTS.includes(location.hostname);

  function send(name, data) {
    if (!enabled) return;
    const payload = {
      website: WEBSITE_ID,
      hostname: location.hostname,
      url: location.pathname,
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
          'x-umami-hostname': location.hostname,
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
