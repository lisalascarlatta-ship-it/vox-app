require('dotenv').config();
const express = require('express');
const path = require('path');
const { buildSystemPrompt } = require('./persona/vox');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

// --- Helper: strip accidental code fences and parse JSON safely ---
function safeParseModelJson(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Fallback: treat the raw text as a single message bubble
    return {
      bubbles: [{ type: 'text', content: cleaned || '...' }],
      relationship_delta: 0,
      memory_add: [],
    };
  }
}

// --- POST /api/chat ---
// body: { messages: [{role:'user'|'assistant', content:string}], relationship: {level:number}, memory: string[] }
app.post('/api/chat', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY non configurata sul server. Vedi il file .env.example.',
      });
    }

    const { messages = [], relationship = { level: 0 }, memory = [] } = req.body;

    const system = buildSystemPrompt(relationship, memory);

    // Keep only the last 24 turns to control context size
    const trimmed = messages.slice(-24).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 700,
        system,
        messages: trimmed,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return res.status(502).json({ error: 'Errore nella chiamata al modello AI.' });
    }

    const data = await response.json();
    const rawText = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const parsed = safeParseModelJson(rawText);

    // Basic shape safety
    if (!Array.isArray(parsed.bubbles) || parsed.bubbles.length === 0) {
      parsed.bubbles = [{ type: 'text', content: rawText || '...' }];
    }
    if (typeof parsed.relationship_delta !== 'number') parsed.relationship_delta = 0;
    if (!Array.isArray(parsed.memory_add)) parsed.memory_add = [];

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore interno del server.' });
  }
});

// --- POST /api/image ---
// Stub pronto per un provider di image generation a scelta.
// Se non è configurata nessuna chiave, risponde con placeholder=true
// così il frontend puo' mostrare un fumetto "immagine non disponibile"
// invece di rompersi. Collega qui la tua API preferita (es. OpenAI Images,
// Stability, ecc.) quando vorrai attivarla davvero.
app.post('/api/image', async (req, res) => {
  const { prompt } = req.body;
  const IMAGE_API_KEY = process.env.IMAGE_API_KEY;

  if (!IMAGE_API_KEY) {
    return res.json({ placeholder: true, prompt });
  }

  // --- Esempio di integrazione (da adattare al provider scelto) ---
  // const r = await fetch('https://api.tuoprovider.com/images', {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${IMAGE_API_KEY}` },
  //   body: JSON.stringify({ prompt }),
  // });
  // const data = await r.json();
  // return res.json({ placeholder: false, url: data.url });

  return res.json({ placeholder: true, prompt });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Vox app in ascolto su http://localhost:${PORT}`));
