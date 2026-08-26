// ===== Persistenza locale (localStorage) =====
// Struttura pensata per poter essere sostituita in futuro da un vero
// database, senza cambiare il resto dell'app: basta riscrivere queste
// funzioni per parlare con un'API invece che con localStorage.
const STORE_KEY = 'vox_chats_v1';

function loadChats() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
}
function saveChats(chats) {
  localStorage.setItem(STORE_KEY, JSON.stringify(chats));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

let chats = loadChats();
let activeChatId = null;

// ===== Elementi DOM =====
const viewList = document.getElementById('view-list');
const viewChat = document.getElementById('view-chat');
const chatListEl = document.getElementById('chat-list');
const emptyState = document.getElementById('empty-state');
const messagesEl = document.getElementById('messages');
const typingRow = document.getElementById('typing-row');
const composer = document.getElementById('composer');
const inputText = document.getElementById('input-text');
const chatTitleEl = document.getElementById('chat-title');
const chatStatusEl = document.getElementById('chat-status');
const sheetOverlay = document.getElementById('sheet-overlay');

document.getElementById('btn-new-chat').addEventListener('click', createChat);
document.getElementById('btn-back').addEventListener('click', () => showView('list'));
document.getElementById('btn-menu').addEventListener('click', () => sheetOverlay.classList.remove('hidden'));
sheetOverlay.addEventListener('click', (e) => { if (e.target === sheetOverlay) sheetOverlay.classList.add('hidden'); });
composer.addEventListener('submit', onSend);

sheetOverlay.querySelectorAll('.sheet-item').forEach((btn) => {
  btn.addEventListener('click', () => handleSheetAction(btn.dataset.action));
});

// ===== Navigazione =====
function showView(name) {
  viewList.classList.toggle('hidden', name !== 'list');
  viewChat.classList.toggle('hidden', name !== 'chat');
  if (name === 'list') renderChatList();
}

// ===== Lista chat =====
function renderChatList() {
  chats = loadChats();
  chatListEl.innerHTML = '';
  emptyState.classList.toggle('hidden', chats.length > 0);

  [...chats]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .forEach((chat) => {
      const last = chat.messages[chat.messages.length - 1];
      const preview = last
        ? (last.type === 'image' ? '📷 Immagine' : last.content)
        : 'Nuova conversazione';
      const item = document.createElement('div');
      item.className = 'chat-item';
      item.innerHTML = `
        <div class="avatar">V</div>
        <div class="chat-item-body">
          <div class="chat-item-top">
            <div class="chat-item-title">${escapeHtml(chat.title)}</div>
            <div class="chat-item-time">${last ? formatTime(last.timestamp) : ''}</div>
          </div>
          <div class="chat-item-preview">${escapeHtml(preview)}</div>
        </div>`;
      item.addEventListener('click', () => openChat(chat.id));
      chatListEl.appendChild(item);
    });
}

function createChat() {
  const chat = {
    id: uid(),
    title: 'Vox — nuova conversazione',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    relationship: { level: 0 },
    memory: [],
  };
  chats.push(chat);
  saveChats(chats);
  openChat(chat.id);
}

function openChat(id) {
  activeChatId = id;
  const chat = getChat();
  chatTitleEl.textContent = chat.title;
  updateStatusLabel();
  renderMessages();
  showView('chat');
  inputText.focus();
}

function getChat() {
  return chats.find((c) => c.id === activeChatId);
}

function updateStatusLabel() {
  const chat = getChat();
  const level = chat.relationship.level;
  chatStatusEl.textContent = level > 55 ? 'online · vi conoscete bene' : level > 20 ? 'online' : 'online';
}

// ===== Messaggi =====
function renderMessages() {
  const chat = getChat();
  messagesEl.innerHTML = '';
  chat.messages.forEach((m) => messagesEl.appendChild(renderBubble(m)));
  scrollToBottom();
}

function renderBubble(m) {
  const wrap = document.createElement('div');
  wrap.className = `bubble-row ${m.role}`;
  const bubble = document.createElement('div');

  if (m.type === 'image') {
    if (m.url) {
      bubble.className = `bubble ${m.role}`;
      bubble.innerHTML = `<img src="${m.url}" alt="immagine">`;
    } else {
      bubble.className = `bubble ${m.role} image-placeholder`;
      bubble.textContent = `📷 ${m.content || 'immagine non disponibile (nessuna API di generazione immagini configurata)'}`;
    }
  } else {
    bubble.className = `bubble ${m.role}`;
    bubble.textContent = m.content;
  }
  wrap.appendChild(bubble);
  return wrap;
}

function appendMessage(msg) {
  const chat = getChat();
  chat.messages.push(msg);
  chat.updatedAt = Date.now();
  saveChats(chats);
  messagesEl.appendChild(renderBubble(msg));
  scrollToBottom();
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

// ===== Invio messaggio e risposta di Vox =====
async function onSend(e) {
  e.preventDefault();
  const text = inputText.value.trim();
  if (!text) return;
  inputText.value = '';

  appendMessage({ role: 'user', type: 'text', content: text, timestamp: Date.now() });

  const chat = getChat();
  // Se e' il primo messaggio, usalo per proporre un titolo automatico
  if (chat.messages.length === 1) {
    chat.title = text.length > 28 ? text.slice(0, 28) + '…' : text;
    chatTitleEl.textContent = chat.title;
    saveChats(chats);
  }

  await requestVoxReply();
}

async function requestVoxReply() {
  const chat = getChat();
  typingRow.classList.remove('hidden');
  scrollToBottom();

  let data;
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: chat.messages
          .filter((m) => m.type !== 'image' || m.role === 'user')
          .map((m) => ({ role: m.role, content: m.content })),
        relationship: chat.relationship,
        memory: chat.memory,
      }),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Errore sconosciuto');
  } catch (err) {
    typingRow.classList.add('hidden');
    appendMessage({
      role: 'vox',
      type: 'system',
      content: `⚠️ Non riesco a raggiungere il backend (${err.message}). Controlla che il server sia avviato e che ANTHROPIC_API_KEY sia configurata.`,
      timestamp: Date.now(),
    });
    renderSystemNote();
    return;
  }

  // aggiorna relazione e memoria
  chat.relationship.level = Math.max(0, Math.min(100, chat.relationship.level + (data.relationship_delta || 0)));
  if (data.memory_add && data.memory_add.length) {
    chat.memory.push(...data.memory_add.filter(Boolean));
    chat.memory = chat.memory.slice(-30); // evita crescita infinita
  }
  saveChats(chats);
  updateStatusLabel();

  // mostra i bubble in sequenza, con un piccolo ritardo realistico
  for (const bubble of data.bubbles) {
    await delay(typingDelayFor(bubble.content));
    if (bubble.type === 'image') {
      await handleImageBubble(bubble.content);
    } else {
      appendMessage({ role: 'vox', type: 'text', content: bubble.content, timestamp: Date.now() });
    }
  }

  typingRow.classList.add('hidden');
}

async function handleImageBubble(prompt) {
  appendMessage({ role: 'vox', type: 'image', content: prompt, url: null, timestamp: Date.now() });
  try {
    const res = await fetch('/api/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (data.url) {
      const chat = getChat();
      const last = chat.messages[chat.messages.length - 1];
      last.url = data.url;
      saveChats(chats);
      renderMessages();
    }
  } catch {
    // resta il placeholder, nessun crash
  }
}

function typingDelayFor(text) {
  const base = 500;
  const perChar = 16;
  return Math.min(2600, base + (text?.length || 0) * perChar);
}
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function renderSystemNote() {} // hook riservato per future notifiche UI

// ===== Menu conversazione (bottom sheet) =====
function handleSheetAction(action) {
  sheetOverlay.classList.add('hidden');
  const chat = getChat();
  if (!chat) return;

  if (action === 'rename') {
    const name = prompt('Nuovo nome della conversazione:', chat.title);
    if (name && name.trim()) {
      chat.title = name.trim();
      chatTitleEl.textContent = chat.title;
      saveChats(chats);
    }
  } else if (action === 'duplicate') {
    const copy = { ...chat, id: uid(), title: chat.title + ' (copia)', messages: JSON.parse(JSON.stringify(chat.messages)) };
    chats.push(copy);
    saveChats(chats);
    alert('Conversazione duplicata.');
  } else if (action === 'export') {
    const blob = new Blob([JSON.stringify(chat, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${chat.title.replace(/[^a-z0-9]+/gi, '_')}.json`;
    a.click();
  } else if (action === 'delete') {
    if (confirm('Eliminare questa conversazione? Non si può annullare.')) {
      chats = chats.filter((c) => c.id !== chat.id);
      saveChats(chats);
      showView('list');
    }
  }
}

// ===== Avvio =====
renderChatList();
showView('list');

// ===== PWA: registrazione service worker =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
        }
