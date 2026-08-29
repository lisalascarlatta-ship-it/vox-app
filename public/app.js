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
const offlineChats = new Set(); // chat id -> Vox al momento irraggiungibile
const activeRequests = new Set(); // chat id -> c'e' gia' un ciclo di richieste/retry in corso

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
const scenarioOverlay = document.getElementById('scenario-overlay');

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

// Scenari che presuppongono un rapporto già consolidato: la chat parte
// direttamente nella fase "avanzata" della relazione (affetto, gelosia,
// protezione), invece che in quella fredda da sconosciuti.
const ESTABLISHED_RELATIONSHIP_SCENARIOS = new Set(['fidanzata', 'moglie']);
const ESTABLISHED_RELATIONSHIP_LEVEL = 65;

document.getElementById('btn-new-chat').addEventListener('click', createChat);
document.getElementById('btn-back').addEventListener('click', () => showView('list'));
document.getElementById('btn-menu').addEventListener('click', () => sheetOverlay.classList.remove('hidden'));
sheetOverlay.addEventListener('click', (e) => { if (e.target === sheetOverlay) sheetOverlay.classList.add('hidden'); });
scenarioOverlay.addEventListener('click', (e) => { if (e.target === scenarioOverlay) scenarioOverlay.classList.add('hidden'); });
composer.addEventListener('submit'
