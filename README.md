# Vox — chat app in stile WhatsApp con un personaggio AI

App completa: frontend PWA (installabile sul telefono) + backend Node/Express
che genera le risposte di Vox tramite l'API di Claude, con la chiave API
tenuta solo lato server.

## Struttura del progetto

```
vox-app/
  server.js            → backend Express (API + serve il frontend)
  persona/vox.js        → SOLO qui vive la personalità di Vox (modifica libera)
  public/                → frontend (PWA)
    index.html
    style.css
    app.js               → logica chat, salvataggio conversazioni, invio messaggi
    manifest.json         → rende l'app installabile
    sw.js                 → service worker (funzionamento offline della shell)
  .env.example            → copia in ".env" e inserisci le tue chiavi
  package.json
```

## 1. Avvio in locale

Serve [Node.js](https://nodejs.org) versione 18 o superiore.

```bash
cd vox-app
npm install
cp .env.example .env
```

Apri `.env` e inserisci la tua chiave da https://console.anthropic.com
(`ANTHROPIC_API_KEY=...`). Poi avvia:

```bash
npm start
```

Apri http://localhost:3000 nel browser: l'app è già funzionante e Vox
risponde davvero tramite l'AI.

## 2. Metterla online (per averla su un link tuo)

Il modo più semplice è **Render.com** (piano gratuito):

1. Crea un repository GitHub con questi file (o carica lo zip).
2. Su Render: "New" → "Web Service" → collega il repository.
3. Build command: `npm install` — Start command: `npm start`.
4. In "Environment" aggiungi la variabile `ANTHROPIC_API_KEY` con la tua chiave.
5. Deploy. Otterrai un link tipo `https://vox-tuonome.onrender.com`.

Funziona allo stesso modo anche su Railway, Fly.io o un VPS qualsiasi:
l'importante è impostare la variabile d'ambiente `ANTHROPIC_API_KEY` e
lanciare `npm start`.

## 3. Installarla sul telefono

Una volta che l'app è online sul tuo link:

- **Android (Chrome)**: apri il link → menu (⋮) → "Aggiungi a schermata Home".
- **iPhone (Safari)**: apri il link → icona di condivisione → "Aggiungi a Home".

Da quel momento avrai un'icona "Vox" come una vera app, che si apre a
schermo intero, indipendente dalla chat di Claude.

## 4. Come funziona la personalità di Vox

Tutto il carattere di Vox è definito in `persona/vox.js`, separato dal
resto del codice, come richiesto. Puoi modificare lì:
- i tratti di personalità e le regole di stile;
- le tre fasi della relazione (iniziale / intermedia / avanzata) e le
  soglie numeriche a cui scattano;
- il formato con cui il modello deve rispondere (messaggi multipli, uso
  di immagini, aggiornamento della relazione e della memoria).

Ad ogni scambio, il modello restituisce anche di quanto la relazione si
è avvicinata o allontanata e cosa vale la pena ricordare: questi dati
vengono salvati per ogni singola conversazione, così Vox si comporta in
modo diverso in chat diverse.

## 5. Salvataggio delle conversazioni (stato attuale e prossimi passi)

Per questa prima versione le conversazioni sono salvate nel `localStorage`
del browser (restano anche chiudendo l'app, ma solo su quel dispositivo).
Il codice è già organizzato in modo da poter sostituire in futuro
`loadChats()` / `saveChats()` in `app.js` con vere chiamate a un database
e a un sistema di account, senza toccare il resto dell'app — la stessa
cosa vale per l'endpoint `/api/image`, già pronto per essere collegato a
un vero servizio di generazione immagini quando vorrai attivarlo (per ora
mostra un placeholder).

## 6. Cosa aggiungere in futuro (l'architettura è già pronta)

- Generazione immagini reale: implementa la chiamata dentro `/api/image`
  in `server.js` (c'è già un esempio commentato).
- Più personaggi: basta creare altri file in `persona/` e una chat che
  scelga quale persona passare a `buildSystemPrompt`.
- Account utente e sincronizzazione: sostituire lo storage locale con un
  database (es. Postgres/SQLite) dietro nuove rotte `/api/chats`.
