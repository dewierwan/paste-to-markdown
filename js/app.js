// Page wiring: paste anywhere → detect source → convert → preview → auto-copy.
// Switching the output re-converts the last paste and copies again.
(function () {
  const OUTPUTS = {
    markdown: { noun: 'Markdown', hint: 'For Claude, ChatGPT, GitHub, Obsidian and Notion' },
    rich: { noun: 'rich text', hint: 'For Gmail, Outlook, Google Docs, Slack, Notion and Airtable' },
    whatsapp: { noun: 'WhatsApp text', hint: 'For WhatsApp and Signal: *bold*, _italic_, ~strike~' },
    plain: { noun: 'plain text', hint: 'For LinkedIn, text messages and forms' },
  };
  const STORAGE_KEY = 'paste-to.output';

  const output = document.getElementById('output');
  const flash = document.getElementById('copyFlash');
  const hint = document.getElementById('outputHint');
  const noun = document.getElementById('outputNoun');
  const sourceSelect = document.getElementById('sourceSelect');
  const autoOption = sourceSelect.querySelector('option[value="auto"]');
  const pills = Array.from(document.querySelectorAll('.pill'));

  let current = load() || 'markdown';
  let clip = null; // { html, text, types }
  let detected = null; // { source, read }
  let flashTimer;

  selectOutput(current, false);

  pills.forEach((pill) => {
    pill.addEventListener('click', () => selectOutput(pill.dataset.output, true));
  });

  sourceSelect.addEventListener('change', () => render(true));

  // Global paste capture: fires whatever is focused. preventDefault stops the
  // browser also pasting into a focused control.
  document.addEventListener('paste', (event) => {
    const data = event.clipboardData;
    if (!data) return;
    const html = data.getData('text/html');
    const text = data.getData('text/plain');
    if (!html && !text) return;
    event.preventDefault();
    clip = { html, text, types: Array.from(data.types || []) };
    detected = detect(clip);
    autoOption.textContent = `From ${SOURCE_NAMES[detected.source]}`;
    sourceSelect.value = 'auto';
    sourceSelect.hidden = false;
    render(true);
  });

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
    const readAs = sourceSelect.value === 'auto' ? detected.read : sourceSelect.value;
    let result;
    try {
      result = convertClip(clip, readAs, current);
    } catch (err) {
      console.error('Error converting content:', err);
      output.className = 'output-content is-text';
      output.textContent = 'Could not convert this paste.';
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
      showFlash('Copied', false);
    } catch (err) {
      console.error('Could not copy:', err);
      showFlash('Copy failed', true);
    }
  }

  function showFlash(message, isError) {
    flash.textContent = message;
    flash.classList.toggle('is-error', isError);
    flash.style.opacity = '1';
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { flash.style.opacity = '0'; }, 3000);
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
