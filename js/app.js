// Page wiring: paste anywhere → detect source → convert → preview → auto-copy.
// Switching the output re-converts the last paste and copies again.
(function () {
  const OUTPUTS = {
    markdown: { noun: 'markdown', hint: 'Claude, ChatGPT, GitHub, Obsidian and Notion' },
    email: { noun: 'email and Slack text', hint: 'Gmail, Outlook, Slack and Teams' },
    rich: { noun: 'rich text', hint: 'Google Docs, Word, Notion and Airtable' },
    whatsapp: { noun: 'WhatsApp text', hint: 'WhatsApp and Signal' },
    plain: { noun: 'plain text', hint: 'LinkedIn, X, text messages and forms' },
  };
  const STORAGE_KEY = 'paste-to.output';
  const APP_SOURCES = ['gdocs', 'notion', 'word', 'gmail', 'airtable', 'pdf'];
  // Anonymous usage counts from js/analytics.js; a no-op if it didn't load.
  const track = globalThis.track || (() => {});

  const output = document.getElementById('output');
  const actions = document.getElementById('cardActions');
  const pasteButton = document.getElementById('pasteButton');
  const copyButton = document.getElementById('copyButton');
  const status = document.getElementById('status');
  const hint = document.getElementById('outputHint');
  const noun = document.getElementById('outputNoun');
  const sourceHint = document.getElementById('sourceHint');
  const readGroup = document.getElementById('readPills');
  const readPills = Array.from(readGroup.querySelectorAll('.pill'));
  const pills = Array.from(document.querySelectorAll('[data-output]'));

  let current = load() || 'markdown';
  let clip = null; // { html, text, types }
  let detected = null; // { source, read }
  let readAs = null; // detected.read unless the user picks another "From" option
  let result = null; // the last conversion, for the Copy button
  let copyTimer;
  let pasteTimer;

  // How to paste on this device. Phones have no ⌘V and the page has no text
  // field to long-press, so there the card itself is the way in.
  const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const mac = /mac|iphone|ipad/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
  const keys = mac ? '⌘V' : 'Ctrl+V';
  showEmpty(touch ? 'Tap to paste' : `Paste anywhere · ${keys}`);

  selectOutput(current, false);

  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      selectOutput(pill.dataset.output, true);
      track('format', { format: current, pasted: Boolean(clip) });
    });
  });

  readPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      readAs = pill.dataset.read;
      showReadAs();
      render(true);
      // A changed "From" choice suggests detection got this paste wrong.
      track('read_as', { read: readAs, detected: detected ? detected.read : null });
    });
  });

  // Global paste capture: fires whatever is focused. preventDefault stops the
  // browser also pasting into a focused control.
  document.addEventListener('paste', (event) => {
    const data = event.clipboardData;
    if (!data) return;
    const html = data.getData('text/html');
    const text = data.getData('text/plain');
    if (!html && !text) return;
    event.preventDefault();
    // The card is only editable as the long-press fallback, so a paste into it came from that menu.
    takeClip({ html, text, types: Array.from(data.types || []) }, output.isContentEditable ? 'menu' : 'keys');
  });

  // The empty card, and the Paste button once there is a result, read the clipboard directly.
  output.addEventListener('click', () => {
    if (output.getAttribute('role') === 'button') pasteFromClipboard('card');
  });
  output.addEventListener('keydown', (event) => {
    if (output.getAttribute('role') !== 'button' || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    pasteFromClipboard('card');
  });
  pasteButton.addEventListener('click', () => pasteFromClipboard('button'));
  copyButton.addEventListener('click', () => {
    if (!result) return;
    copyResult(result);
    track('copy', { format: current });
  });

  function takeClip(data, via) {
    clip = data;
    detected = detect(clip);
    readAs = detected.read;
    readGroup.removeAttribute('aria-disabled');
    readPills.forEach((p) => { p.disabled = false; });
    // Name the app when we recognise one; otherwise the selected pill says it all.
    const app = APP_SOURCES.includes(detected.source) ? SOURCE_NAMES[detected.source] : null;
    sourceHint.textContent = app ? `Detected ${app}` : 'Detected automatically';
    output.removeAttribute('role');
    output.removeAttribute('aria-label');
    output.removeAttribute('contenteditable');
    output.removeAttribute('inputmode');
    actions.hidden = false;
    showReadAs();
    render(true);
    track('paste', { source: detected.source, format: current, via });
  }

  async function pasteFromClipboard(via) {
    let data;
    try {
      data = await readClipboard();
    } catch (err) {
      // Not supported, or the person said no to the browser's prompt.
      track('paste_blocked', { via });
      pasteBlocked();
      return;
    }
    if (!data.html && !data.text) {
      say('Nothing to paste');
      return;
    }
    takeClip(data, via);
  }

  // Asks for the original HTML: Chrome otherwise strips the attributes that
  // tell Google Docs pastes apart. Browsers that don't know the option ignore it.
  async function readClipboard() {
    const clipboard = navigator.clipboard;
    if (!clipboard) throw new Error('No clipboard access');
    if (!clipboard.read) return { html: '', text: await clipboard.readText(), types: ['text/plain'] };
    const items = await clipboard.read({ unsanitized: ['text/html'] });
    const data = { html: '', text: '', types: [] };
    for (const item of items) {
      for (const type of item.types) {
        if (!data.types.includes(type)) data.types.push(type);
        if (type === 'text/html' && !data.html) data.html = await (await item.getType(type)).text();
        if (type === 'text/plain' && !data.text) data.text = await (await item.getType(type)).text();
      }
    }
    return data;
  }

  // Without clipboard access, a phone can still paste from the long-press menu
  // into an editable card (inputmode="none" keeps the keyboard away); a computer
  // still has the keyboard shortcut.
  function pasteBlocked() {
    if (touch) {
      reset();
      output.setAttribute('contenteditable', 'true');
      output.setAttribute('inputmode', 'none');
      showEmpty('Press and hold here, then tap Paste');
      output.focus();
    } else if (!clip) {
      showEmpty(`Press ${keys} to paste`);
    } else {
      say(`Press ${keys}`);
    }
  }

  // Back to the empty card, for a fresh paste on a phone.
  function reset() {
    clip = null;
    result = null;
    actions.hidden = true;
    output.className = 'output-content';
    output.textContent = '';
  }

  function showEmpty(message) {
    output.dataset.placeholder = message;
    output.setAttribute('role', 'button');
    output.setAttribute('aria-label', message);
    output.tabIndex = 0;
  }

  // A short note on the Paste button, for when there is a result on screen.
  function say(message) {
    status.textContent = message;
    if (actions.hidden) {
      output.dataset.placeholder = message;
      return;
    }
    pasteButton.textContent = message;
    clearTimeout(pasteTimer);
    pasteTimer = setTimeout(() => { pasteButton.textContent = 'Paste'; }, 3000);
  }

  function showReadAs() {
    readPills.forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.read === readAs)));
  }

  function selectOutput(name, copy) {
    current = name;
    save(name);
    pills.forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.output === name)));
    hint.textContent = OUTPUTS[name].hint;
    noun.textContent = OUTPUTS[name].noun;
    render(copy);
  }

  function render(copy) {
    if (!clip) return;
    try {
      result = convertClip(clip, readAs, current);
    } catch (err) {
      console.error('Error converting content:', err);
      track('convert_failed', { format: current });
      output.className = 'output-content is-text';
      output.textContent = 'Could not convert this paste.';
      result = null;
      return;
    }
    if (result.html !== undefined) {
      output.className = 'output-content is-rich';
      output.innerHTML = result.html;
    } else {
      output.className = current === 'markdown' ? 'output-content' : 'output-content is-text';
      output.textContent = result.text;
    }
    if (copy) copyResult(result);
  }

  async function copyResult(result) {
    try {
      if (result.html !== undefined) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([result.html], { type: 'text/html' }),
            'text/plain': new Blob([result.text], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(result.text);
      }
      showCopied(true);
    } catch (err) {
      console.error('Could not copy:', err);
      track('copy_failed', { format: current });
      showCopied(false);
    }
  }

  // "Copied" for a moment after it works. When it fails (Safari refuses to
  // copy after reading the clipboard), highlight Copy so one tap finishes it.
  function showCopied(ok) {
    clearTimeout(copyTimer);
    copyButton.classList.toggle('is-done', ok);
    copyButton.classList.toggle('is-attention', !ok);
    copyButton.textContent = ok ? 'Copied' : 'Copy';
    status.textContent = ok ? 'Copied' : `Not copied yet. ${touch ? 'Tap' : 'Click'} Copy.`;
    if (ok) {
      copyTimer = setTimeout(() => {
        copyButton.classList.remove('is-done');
        copyButton.textContent = 'Copy';
      }, 2000);
    }
  }

  // A remembered output is a convenience; storage can be unavailable.
  function load() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return OUTPUTS[value] ? value : null;
    } catch {
      return null;
    }
  }

  function save(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
  }
})();
