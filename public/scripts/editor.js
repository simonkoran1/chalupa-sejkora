// ============================================================================
// CMS Editor Overlay — activates only when server confirms an active session
// ============================================================================
(async () => {
  // Check session — 404 (CMS off) or 401 (not logged in) → do nothing
  let schema;
  try {
    const resp = await fetch('/api/cms/session', { method: 'GET' });
    if (!resp.ok) return;
    const data = await resp.json();
    schema = data.schema || {};
  } catch { return; }

  const state = {
    selectedField: null,
    pending: {}, // { path: newValue }
    messages: [],
    chatOpen: false,
  };

  // ---------- Styles ----------
  const styles = document.createElement('style');
  styles.textContent = `
    .cms-outline { outline: 2px dashed #4a9eff !important; outline-offset: 2px; cursor: pointer !important; }
    .cms-selected { outline: 2px solid #4a9eff !important; outline-offset: 2px; background: rgba(74, 158, 255, 0.08) !important; }
    .cms-pending { outline: 2px solid #f5a623 !important; outline-offset: 2px; }
    #cms-toolbar { position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%); z-index: 999999; display: flex; gap: .5rem; background: #141b13; color: #fff; padding: .5rem; border-radius: 999px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); font-family: system-ui, -apple-system, sans-serif; font-size: .9rem; }
    #cms-toolbar button { background: transparent; color: #fff; border: 0; padding: .5rem 1rem; border-radius: 999px; cursor: pointer; font: inherit; }
    #cms-toolbar button:hover { background: rgba(255,255,255,0.12); }
    #cms-toolbar button.primary { background: #fff; color: #141b13; font-weight: 600; }
    #cms-toolbar button.primary:hover { background: #ddd; }
    #cms-toolbar .badge { background: #f5a623; color: #000; border-radius: 999px; padding: 0 .5rem; font-size: .75rem; font-weight: 600; margin-left: .25rem; }
    #cms-chat { position: fixed; bottom: 5rem; right: 1.5rem; z-index: 999998; width: 22rem; max-width: calc(100vw - 3rem); height: 30rem; max-height: calc(100vh - 8rem); background: #fff; border-radius: 1rem; box-shadow: 0 12px 48px rgba(0,0,0,0.2); display: none; flex-direction: column; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
    #cms-chat.open { display: flex; }
    #cms-chat-header { padding: 1rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
    #cms-chat-header h3 { margin: 0; font-size: 1rem; }
    #cms-chat-selected { font-size: .8rem; color: #666; margin-top: .25rem; }
    #cms-chat-messages { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: .75rem; }
    .cms-msg { max-width: 85%; padding: .6rem .9rem; border-radius: 1rem; font-size: .9rem; line-height: 1.4; word-wrap: break-word; }
    .cms-msg.user { background: #141b13; color: #fff; align-self: flex-end; }
    .cms-msg.bot { background: #f0f0f0; color: #141b13; align-self: flex-start; }
    .cms-msg.system { font-size: .8rem; color: #666; text-align: center; font-style: italic; align-self: center; }
    #cms-chat-input-wrap { border-top: 1px solid #eee; padding: .75rem; display: flex; gap: .5rem; }
    #cms-chat-input { flex: 1; border: 1px solid #ddd; border-radius: 999px; padding: .5rem 1rem; font: inherit; font-size: .9rem; outline: none; }
    #cms-chat-input:focus { border-color: #4a9eff; }
    #cms-chat-send { background: #141b13; color: #fff; border: 0; padding: .5rem 1rem; border-radius: 999px; cursor: pointer; font: inherit; font-size: .9rem; }
    #cms-chat-send:disabled { opacity: .4; cursor: not-allowed; }
    #cms-hint { position: fixed; top: 1rem; left: 50%; transform: translateX(-50%); z-index: 999997; background: #141b13; color: #fff; padding: .5rem 1rem; border-radius: 999px; font-family: system-ui, sans-serif; font-size: .85rem; box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
  `;
  document.head.appendChild(styles);

  // ---------- Toolbar ----------
  const toolbar = document.createElement('div');
  toolbar.id = 'cms-toolbar';
  toolbar.innerHTML = `
    <button id="cms-btn-chat">💬 Chat<span class="badge" id="cms-badge-pending" style="display: none;">0</span></button>
    <button id="cms-btn-publish" class="primary" style="display: none;">Publikovat</button>
    <button id="cms-btn-exit" title="Odhlásit">✕</button>
  `;
  document.body.appendChild(toolbar);

  // ---------- Hint ----------
  const hint = document.createElement('div');
  hint.id = 'cms-hint';
  hint.textContent = 'Klikněte na text pro úpravu';
  document.body.appendChild(hint);
  setTimeout(() => { hint.style.transition = 'opacity .5s'; hint.style.opacity = '0'; setTimeout(() => hint.remove(), 500); }, 5000);

  // ---------- Chat panel ----------
  const chat = document.createElement('div');
  chat.id = 'cms-chat';
  chat.innerHTML = `
    <div id="cms-chat-header">
      <div>
        <h3>Editor</h3>
        <div id="cms-chat-selected">Klikněte na text pro úpravu</div>
      </div>
      <button id="cms-chat-close" style="background:none;border:0;font-size:1.2rem;cursor:pointer;color:#666;">✕</button>
    </div>
    <div id="cms-chat-messages"></div>
    <div id="cms-chat-input-wrap">
      <input id="cms-chat-input" type="text" placeholder="Napište požadavek…" autocomplete="off" />
      <button id="cms-chat-send">➤</button>
    </div>
  `;
  document.body.appendChild(chat);

  const chatMessages = document.getElementById('cms-chat-messages');
  const chatInput = document.getElementById('cms-chat-input');
  const chatSend = document.getElementById('cms-chat-send');
  const chatSelected = document.getElementById('cms-chat-selected');
  const badgePending = document.getElementById('cms-badge-pending');
  const btnPublish = document.getElementById('cms-btn-publish');

  function openChat() { chat.classList.add('open'); state.chatOpen = true; chatInput.focus(); }
  function closeChat() { chat.classList.remove('open'); state.chatOpen = false; }
  document.getElementById('cms-btn-chat').onclick = openChat;
  document.getElementById('cms-chat-close').onclick = closeChat;

  function updateSelectedLabel() {
    if (state.selectedField) {
      const label = schema[state.selectedField]?.label || state.selectedField;
      chatSelected.textContent = `Vybráno: ${label}`;
    } else {
      chatSelected.textContent = 'Klikněte na text pro úpravu';
    }
  }

  function addMessage(role, text) {
    const el = document.createElement('div');
    el.className = 'cms-msg ' + role;
    el.textContent = text;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function updatePendingBadge() {
    const n = Object.keys(state.pending).length;
    badgePending.textContent = n;
    badgePending.style.display = n > 0 ? 'inline-block' : 'none';
    btnPublish.style.display = n > 0 ? 'inline-block' : 'none';
    btnPublish.textContent = `Publikovat (${n})`;
  }

  // ---------- Element selection ----------
  const editableEls = document.querySelectorAll('[data-cms-field]');
  editableEls.forEach(el => {
    el.addEventListener('mouseenter', () => el.classList.add('cms-outline'));
    el.addEventListener('mouseleave', () => el.classList.remove('cms-outline'));
    el.addEventListener('click', (e) => {
      // Only intercept if the element is truly a leaf editable — not a link/button etc.
      const tag = el.tagName;
      if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT') return;
      e.preventDefault();
      e.stopPropagation();
      // Deselect any previous
      document.querySelectorAll('.cms-selected').forEach(x => x.classList.remove('cms-selected'));
      const path = el.getAttribute('data-cms-field');
      if (!schema[path]) {
        addMessage('system', `Toto pole (${path}) není editovatelné.`);
        openChat();
        return;
      }
      state.selectedField = path;
      el.classList.add('cms-selected');
      updateSelectedLabel();
      openChat();
    });
  });

  // ---------- Applying preview edits ----------
  function applyPreview(path, value) {
    state.pending[path] = value;
    // Update DOM in place — replace the field's text with the new value formatted
    document.querySelectorAll(`[data-cms-field="${path}"]`).forEach(el => {
      const fmt = new Intl.NumberFormat('cs-CZ').format(value);
      // Rebuild text content preserving surrounding format hints — heuristic:
      // For numeric fields we replace the numeric portion in the element's text
      const original = el.textContent;
      const replaced = original.replace(/[\d\s]+([.,]\d+)?/, fmt);
      el.textContent = replaced;
      el.classList.add('cms-pending');
    });
    updatePendingBadge();
  }

  // ---------- Chat send ----------
  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    addMessage('user', text);
    state.messages.push({ role: 'user', content: text });
    chatInput.value = '';
    chatSend.disabled = true;
    try {
      const resp = await fetch('/api/cms/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: state.messages, selectedField: state.selectedField }),
      });
      const data = await resp.json();
      if (!data.ok) { addMessage('system', 'Chyba: ' + (data.error || 'neznámá')); return; }
      const reply = data.reply;
      state.messages.push({ role: 'assistant', content: reply.content });
      // Extract text + tool calls
      let hasText = false;
      for (const block of reply.content) {
        if (block.type === 'text' && block.text.trim()) { addMessage('bot', block.text); hasText = true; }
        if (block.type === 'tool_use' && block.name === 'updateField') {
          const { path, value } = block.input;
          if (!schema[path]) {
            addMessage('system', `Pole "${path}" nelze upravit.`);
          } else {
            applyPreview(path, value);
            addMessage('system', `Připraveno: ${schema[path].label} → ${value}. Klikněte na "Publikovat" pro nasazení.`);
          }
        }
      }
      if (!hasText && reply.stop_reason !== 'tool_use') addMessage('bot', '…');
    } catch (err) {
      addMessage('system', 'Chyba připojení: ' + err.message);
    } finally {
      chatSend.disabled = false;
      chatInput.focus();
    }
  }

  chatSend.onclick = sendMessage;
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

  // ---------- Publish ----------
  btnPublish.onclick = async () => {
    const changes = Object.entries(state.pending).map(([path, value]) => ({ path, value }));
    if (changes.length === 0) return;
    btnPublish.disabled = true;
    btnPublish.textContent = 'Publikuji…';
    try {
      const resp = await fetch('/api/cms/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'Publikování selhalo');
      addMessage('system', `Publikováno. Web se přebuduje během ~1 minuty.`);
      state.pending = {};
      document.querySelectorAll('.cms-pending').forEach(el => el.classList.remove('cms-pending'));
      updatePendingBadge();
      openChat();
    } catch (err) {
      addMessage('system', 'Chyba: ' + err.message);
      openChat();
    } finally {
      btnPublish.disabled = false;
    }
  };

  // ---------- Exit ----------
  document.getElementById('cms-btn-exit').onclick = async () => {
    if (Object.keys(state.pending).length > 0 && !confirm('Máte nepublikované změny. Opravdu se odhlásit?')) return;
    await fetch('/api/cms/logout', { method: 'POST' });
    window.location.href = '/';
  };
})();
