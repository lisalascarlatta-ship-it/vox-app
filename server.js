require('dotenv').config();
const express = require('express');
const path = require('path');
const { buildSystemPrompt } = require('./persona/vox');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

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
    if (!GROQ_API_KEY) {
      return res.status(500).json({
        error: 'GROQ_API_KEY non configurata sul server. Vedi il file .env.example.',
      });
    }

    const { messages = [], relationship = { level: 0 }, memory = [], scenario = '' } = req.body;
    const system = buildSystemPrompt(relationship, memory, scenario);

    const trimmed = messages.slice(-24).map((m) => ({
      role: m.role === 'assistant' || m.role === 'vox' ? 'assistant' : 'user',
      content: m.content,
    }));

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: system }, ...trimmed],
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API error:', errText);

      if (response.status === 429) {
        const retryHeader = response.headers.get('retry-after');
        const retrySeconds = retryHeader ? parseInt(retryHeader, 10) : 20;
        return res.status(429).json({
          error: 'rate_limit',
          retryAfterSeconds: Number.isFinite(retrySeconds) && retrySeconds > 0 ? retrySeconds : 20,
        });
      }
      return res.status(502).json({ error: 'Errore nella chiamata al modello AI.' });
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';

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
