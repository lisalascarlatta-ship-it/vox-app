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
const offlineChats = new Set();
const activeRequests = new Set();

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
const chatMetaEl = document.getElementById('chat-meta');
const sheetOverlay = document.getElementById('sheet-overlay');
const scenarioOverlay = document.getElementById('scenario-overlay');
const moodOverlay = document.getElementById('mood-overlay');
const timeOverlay = document.getElementById('time-overlay');
const timeInput = document.getElementById('time-input');

const SCENARIO_PRESETS = {
  default: '',
  'capo-assistente': 'Tu sei il capo/titolare di un\'attività, l\'utente è la sua nuova assistente o collaboratrice. Il rapporto parte professionale, ma può evolvere nel tempo.',
  'angelo-demone': 'Tu sei un demone (o un\'entità infernale), l\'utente un angelo — o viceversa a seconda di come si presenta. Siete legati da un patto, o da un fantomatico "matrimonio riparatore" tra Paradiso e Inferno. Tono scherzoso e leggermente fantasy.',
  ex: 'Tu e l\'utente siete stati insieme in passato, e vi siete ritrovati a scrivervi dopo tempo.',
  vicini: 'Tu e l\'utente siete vicini di casa.',
  colleghi: 'Tu e l\'utente siete colleghi di lavoro nello stesso ufficio.',
  fidanzata: 'Tu e l\'utente state insieme da tempo: è la tua fidanzata. Vi conoscete già bene e avete una storia condivisa alle spalle — NON comportarti come con una sconosciuta al primo contatto. Sei affettuoso, protettivo, ti accerti che stia bene, ti apri con lei molto più facilmente rispetto a chi non conosci. Resti comunque te stesso: puoi essere anche possessivo, geloso, o punzecchiarla con sarcasmo, ma la premura di fondo verso di lei è reale e sincera.',
  moglie: 'Tu e l\'utente siete sposati da tempo: è tua moglie. Vi conoscete a fondo e avete una vita condivisa alle spalle — NON comportarti come con una sconosciuta al primo contatto. Sei affettuoso, protettivo, ti accerti che stia bene, ti apri con lei molto più facilmente rispetto a chi non conosci. Resti comunque te stesso: puoi essere anche possessivo, geloso, o punzecchiarla con sarcasmo, ma la premura di fondo verso di lei è reale e sincera.',
};

const ESTABLISHED_RELATIONSHIP_SCENARIOS = new Set(['fidanzata', 'moglie']);
const ESTABLISHED_RELATIONSHIP_LEVEL = 65;

const MOOD_PRESETS = {
  neutro: '',
  arrabbiato: 'Oggi sei arrabbiato e frustrato per una giornata pesante di lavoro: hai poca pazienza, sei più scostante e diretto del solito.',
  pensieroso: 'Stavi pensando all\'utente proprio in questo momento, prima ancora che scrivesse: questo ti mette in una disposizione più aperta e presente, anche se magari non lo ammetti subito.',
  demoralizzato: 'Oggi ti senti giù di morale, demotivato, meno sicuro di te del solito: parli con meno energia e in modo più sincero.',
  felice: 'Oggi sei di ottimo umore, più leggero e disponibile del solito, ti va di scherzare.',
  geloso: 'In questo momento sei particolarmente geloso e possessivo, magari senza un motivo concreto: lascia che questo trapeli nel tono.',
  stanco: 'Oggi sei stanco e con poca voglia di parlare: le tue risposte sono più brevi e meno elaborate del solito.',
  arrapato: 'In questo momento sei particolarmente su di giri: lascialo trasparire con doppi sensi e allusioni, restando comunque nel personaggio.',
};

const MONTHS_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

document.getElementById('btn-new-chat').addEventListener('click', createChat);
document.getElementById('btn-back').addEventListener('click', () => showView('list'));
document.getElementById('btn-menu').addEventListener('click', () => sheetOverlay.classList.remove('hidden'));
sheetOverlay.addEventListener('click', (e) => { if (e.target === sheetOverlay) sheetOverlay.classList.add('hidden'); });
scenarioOverlay.addEventListener('click', (e) => { if (e.target === scenarioOverlay) scenarioOverlay.classList.add('hidden'); });
moodOverlay.addEventListener('click', (e) => { if (e.target === moodOverlay) moodOverlay.classList.add('hidden'); });
timeOverlay.addEventListener('click', (e) => { if (e.target === timeOverlay) timeOverlay.classList.add('hidden'); });
composer.addEventListener('submit', onSend);
document.getElementById('btn-time').addEventListener('click', openTimeSheet);
document.getElementById('btn-time-cancel').addEventListener('click', () => timeOverlay.classList.add('hidden'));
document.getElementById('btn-time-apply').addEventListener('click', applyTimeChoice);

sheetOverlay.querySelectorAll('.sheet-item').forEach((btn) => {
  btn.addEventListener('click', () => handleSheetAction(btn.dataset.action));
});
scenarioOverlay.querySelectorAll('.sheet-item').forEach((btn) => {
  btn.addEventListener('click', () => handleScenarioChoice(btn.dataset.scenario));
});
moodOverlay.querySelectorAll('.sheet-item').forEach((btn) => {
  btn.addEventListener('click', () => handleMoodChoice(btn.dataset.mood));
});

function showView(name) {
  viewList.classList.toggle('hidden', name !== 'list');
  viewChat.classList.toggle('hidden', name !== 'chat');
  if (name === 'list') renderChatList();
}

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
    title: 'Vox',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    relationship: { level: 0 },
    memory: [],
    scenario: '',
    currentMood: 'neutro',
    virtualClockOffset: 0,
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

function getVirtualNow(chat) {
  return Date.now() + (chat.virtualClockOffset || 0);
}

function relationshipLabel(level) {
  if (level < 20) return 'vi conoscete appena';
  if (level < 55) return 'vi conoscete';
  return 'vi conoscete bene';
}

function updateStatusLabel() {
  const chat = getChat();
  if (offlineChats.has(chat.id)) {
    chatStatusEl.textContent = 'offline';
    chatStatusEl.classList.add('dim');
    chatMetaEl.textContent = '';
    return;
  }
  chatStatusEl.classList.remove('dim');
  chatStatusEl.textContent = 'online';

  const parts = [];
  const mood = (chat.currentMood || '').trim();
  if (mood && mood.toLowerCase() !== 'neutro') parts.push(`umore: ${mood}`);
  parts.push(relationshipLabel(chat.relationship.level));
  chatMetaEl.textContent = parts.join(' · ');
}

function formatDayLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const label = `${d.getDate()} ${MONTHS_IT[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? label : `${label} ${d.getFullYear()}`;
}

function renderDayDivider(ts) {
  const div = document.createElement('div');
  div.className = 'day-divider';
  const span = document.createElement('span');
  span.textContent = formatDayLabel(ts);
  div.appendChild(span);
  return div;
}

function renderMessages() {
  const chat = getChat();
  messagesEl.innerHTML = '';
  let lastDateKey = null;
  chat.messages.forEach((m) => {
    const dateKey = new Date(m.timestamp).toDateString();
    if (dateKey !== lastDateKey) {
      messagesEl.appendChild(renderDayDivider(m.timestamp));
      lastDateKey = dateKey;
    }
    messagesEl.appendChild(renderBubble(m));
  });
  scrollToBottom();
}

function renderBubble(m) {
  const wrap = document.createElement('div');
  wrap.className = `bubble-row ${m.role}`;
  const col = document.createElement('div');
  col.className = 'bubble-col';
  const bubble = document.createElement('div');

  if (m.type === 'image') {
    if (m.url) {
      bubble.className = `bubble ${m.role}`;
      bubble.innerHTML = `<img src="${m.url}" alt="immagine">`;
    } else {
      bubble.className = `bubble ${m.role} image-placeholder`;
      bubble.textContent = `📷 ${m.caption_it || 'Vox ha condiviso un\'immagine (generazione non ancora attiva).'}`;
    }
  } else if (m.type === 'wait') {
    bubble.className = `bubble ${m.role} wait`;
    bubble.textContent = m.content;
  } else {
    bubble.className = `bubble ${m.role}`;
    bubble.textContent = m.content;
  }
  col.appendChild(bubble);

  const showTime = m.type !== 'wait';
  if (m.role === 'user') {
    const status = document.createElement('div');
    status.className = `msg-status ${m.status || 'sent'}`;
    const ticks = m.status === 'sent' || !m.status ? '✓' : '✓✓';
    status.textContent = showTime ? `${formatTime(m.timestamp)}  ${ticks}` : ticks;
    col.appendChild(status);
  } else if (showTime) {
    const timeLabel = document.createElement('div');
    timeLabel.className = 'msg-time-label';
    timeLabel.textContent = formatTime(m.timestamp);
    col.appendChild(timeLabel);
  }

  wrap.appendChild(col);
  return wrap;
}

function appendMessage(msg) {
  const chat = getChat();
  const prevLast = chat.messages[chat.messages.length - 1];
  chat.messages.push(msg);
  chat.updatedAt = Date.now();
  saveChats(chats);

  const prevDateKey = prevLast ? new Date(prevLast.timestamp).toDateString() : null;
  const thisDateKey = new Date(msg.timestamp).toDateString();
  if (thisDateKey !== prevDateKey) {
    messagesEl.appendChild(renderDayDivider(msg.timestamp));
  }

  messagesEl.appendChild(renderBubble(msg));
  scrollToBottom();
  return msg;
}

function updateMessageStatus(msg, status) {
  if (!msg || msg.status === status) return;
  msg.status = status;
  saveChats(chats);
  renderMessages();
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

async function onSend(e) {
  e.preventDefault();
  const text = inputText.value.trim();
  if (!text) return;
  inputText.value = '';

  const chat = getChat();
  appendMessage({ role: 'user', type: 'text', content: text, status: 'sent', timestamp: getVirtualNow(chat) });

  if (!activeRequests.has(chat.id)) {
    await requestVoxReply();
  }
}

function lastUserMessage() {
  const chat = getChat();
  for (let i = chat.messages.length - 1; i >= 0; i--) {
    if (chat.messages[i].role === 'user') return chat.messages[i];
  }
  return null;
}

async function requestVoxReply(retryCount = 0) {
  const chat = getChat();
  activeRequests.add(chat.id);

  const moodHintToSend = chat.pendingMoodHint || '';
  if (moodHintToSend) {
    delete chat.pendingMoodHint;
    saveChats(chats);
  }

  try {
    typingRow.classList.remove('hidden');
    scrollToBottom();

    let res, data, networkFailed = false;
    try {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chat.messages
            .filter((m) => m.type !== 'wait')
            .filter((m) => m.type !== 'image' || m.role === 'user')
            .map((m) => ({ role: m.role, content: m.content })),
          relationship: chat.relationship,
          memory: chat.memory,
          scenario: chat.scenario || '',
          moodHint: moodHintToSend,
          currentMood: chat.currentMood || 'neutro',
        }),
      });
      data = await res.json();
    } catch (err) {
      networkFailed = true;
    }

    if (!networkFailed) updateMessageStatus(lastUserMessage(), 'delivered');

    const isRateLimited = !networkFailed && res.status === 429 && data?.error === 'rate_limit';
    const isOtherFailure = networkFailed || (res && !res.ok && !isRateLimited);

    if (isRateLimited || isOtherFailure) {
      typingRow.classList.add('hidden');

      const justWentOffline = !offlineChats.has(chat.id);
      offlineChats.add(chat.id);
      if (activeChatId === chat.id) updateStatusLabel();

      if (justWentOffline) {
        appendMessage({
          role: 'vox',
          type: 'wait',
          content: 'Vox non risponde al momento. Prova a riscrivergli tra un po\'.',
          timestamp: getVirtualNow(chat),
        });
      }

      if (retryCount >= 4) {
        return;
      }

      const seconds = isRateLimited ? (data.retryAfterSeconds || 20) : 15;
      await delay(seconds * 1000 + 500);
      await requestVoxReply(retryCount + 1);
      return;
    }

    offlineChats.delete(chat.id);
    updateMessageStatus(lastUserMessage(), 'read');

    chat.relationship.level = Math.max(0, Math.min(100, chat.relationship.level + (data.relationship_delta || 0)));
    if (data.memory_add && data.memory_add.length) {
      chat.memory.push(...data.memory_add.filter(Boolean));
      chat.memory = chat.memory.slice(-30);
    }
    if (typeof data.mood === 'string' && data.mood.trim()) {
      chat.currentMood = data.mood.trim();
    }
    saveChats(chats);
    if (activeChatId === chat.id) updateStatusLabel();

    for (const bubble of data.bubbles) {
      await delay(typingDelayFor(bubble.content));
      if (bubble.type === 'image') {
        await handleImageBubble(bubble);
      } else {
        appendMessage({ role: 'vox', type: 'text', content: bubble.content, timestamp: getVirtualNow(chat) });
      }
    }

    typingRow.classList.add('hidden');
  } finally {
    activeRequests.delete(chat.id);
  }
}

async function handleImageBubble(bubble) {
  const chat = getChat();
  appendMessage({ role: 'vox', type: 'image', content: bubble.content, caption_it: bubble.caption_it, url: null, timestamp: getVirtualNow(chat) });
  try {
    const res = await fetch('/api/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: bubble.content }),
    });
    const data = await res.json();
    if (data.url) {
      const c = getChat();
      const last = c.messages[c.messages.length - 1];
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

function handleSheetAction(action) {
  sheetOverlay.classList.add('hidden');
  const chat = getChat();
  if (!chat) return;

  if (action === 'scenario') {
    openScenarioSheet();
  } else if (action === 'mood') {
    moodOverlay.classList.remove('hidden');
  } else if (action === 'rename') {
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

function openScenarioSheet() {
  const chat = getChat();
  scenarioOverlay.querySelectorAll('.sheet-item[data-scenario]').forEach((btn) => {
    const key = btn.dataset.scenario;
    if (key === 'cancel' || key === 'custom') {
      btn.classList.remove('active');
      return;
    }
    const preset = SCENARIO_PRESETS[key] ?? '';
    const isActive = key === 'default' ? !chat.scenario : chat.scenario === preset;
    btn.classList.toggle('active', isActive);
  });
  scenarioOverlay.classList.remove('hidden');
}

function handleScenarioChoice(key) {
  scenarioOverlay.classList.add('hidden');
  if (!key || key === 'cancel') return;

  const chat = getChat();
  if (!chat) return;

  if (key === 'custom') {
    const text = prompt('Descrivi il tipo di rapporto tra te e Vox in questa chat:', chat.scenario || '');
    if (text !== null) {
      chat.scenario = text.trim();
      saveChats(chats);
    }
    return;
  }

  chat.scenario = SCENARIO_PRESETS[key] ?? '';

  if (ESTABLISHED_RELATIONSHIP_SCENARIOS.has(key)) {
    chat.relationship.level = Math.max(chat.relationship.level, ESTABLISHED_RELATIONSHIP_LEVEL);
  }

  saveChats(chats);
  if (activeChatId === chat.id) updateStatusLabel();
}

function handleMoodChoice(key) {
  moodOverlay.classList.add('hidden');
  if (!key || key === 'cancel') return;

  const chat = getChat();
  if (!chat) return;

  const hint = MOOD_PRESETS[key] ?? '';
  if (hint) {
    chat.pendingMoodHint = hint;
  } else {
    delete chat.pendingMoodHint;
  }
  saveChats(chats);
}

function openTimeSheet() {
  const chat = getChat();
  if (!chat) return;
  const now = new Date(getVirtualNow(chat));
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  timeInput.value = `${hh}:${mm}`;
  timeOverlay.classList.remove('hidden');
}

function applyTimeChoice() {
  const chat = getChat();
  if (!chat) { timeOverlay.classList.add('hidden'); return; }

  const val = timeInput.value;
  if (!val) {
    timeOverlay.classList.add('hidden');
    return;
  }
  const [h, m] = val.split(':').map(Number);

  const currentVirtual = new Date(getVirtualNow(chat));
  const currentMinutes = currentVirtual.getHours() * 60 + currentVirtual.getMinutes();
  const chosenMinutes = h * 60 + m;

  const newVirtual = new Date(currentVirtual);
  newVirtual.setHours(h, m, 0, 0);
  if (chosenMinutes <= currentMinutes) {
    newVirtual.setDate(newVirtual.getDate() + 1);
  }

  chat.virtualClockOffset = newVirtual.getTime() - Date.now();
  saveChats(chats);
  timeOverlay.classList.add('hidden');
}

renderChatList();
showView('list');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
