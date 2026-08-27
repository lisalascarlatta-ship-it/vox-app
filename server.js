require('dotenv').config();
const express = require('express');
const path = require('path');
const { buildSystemPrompt } = require('./persona/vox');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

function extractBubblesFallback(text) {
  const bubbles = [];
  const regex = /"type"\s*:\s*"(text|image)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"(?:\s*,\s*"caption_it"\s*:\s*"((?:[^"\\]|\\.)*)")?/g;
  let m;
  while ((m = regex.exec(text))) {
    const unescape = (s) => (s || '').replace(/\\n/g, '\n').replace(/\\"/g, '"');
    bubbles.push({ type: m[1], content: unescape(m[2]), caption_it: unescape(m[3]) });
  }
  return bubbles;
}

function safeParseModelJson(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const salvaged = extractBubblesFallback(cleaned);
    return {
      bubbles: salvaged.length ? salvaged : [{ type: 'text', content: 'Mh, dammi un secondo.' }],
      relationship_delta: 0,
      memory_add: [],
    };
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY non configurata sul server. Vedi il file .env.example.',
      });
    }

    const { messages = [], relationship = { level: 0 }, memory = [] } = req.body;
    const system = buildSystemPrompt(relationship, memory);

    const trimmed = messages.slice(-24).map((m) => ({
      role: m.role === 'assistant' || m.role === 'vox' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: trimmed,
        generationConfig: {
          maxOutputTokens: 1536,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API error:', errText);
      return res.status(502).json({ error: 'Errore nella chiamata al modello AI.' });
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n') || '';

    const parsed = safeParseModelJson(rawText);

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

app.post('/api/image', async (req, res) => {
  const { prompt } = req.body;
  const IMAGE_API_KEY = process.env.IMAGE_API_KEY;

  if (!IMAGE_API_KEY) {
    return res.json({ placeholder: true, prompt });
  }

  return res.json({ placeholder: true, prompt });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Vox app in ascolto su http://localhost:${PORT}`));
