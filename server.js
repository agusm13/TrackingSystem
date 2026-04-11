const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const app = express();

// Only allow requests from local dev origins
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ],
}));
app.use(express.json());

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL      = "gpt-4o-mini";

async function callOpenAI(messages, maxTokens = 300) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set in .env");

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "OpenAI request failed");
  return data.choices[0].message.content;
}

function validateText(req, res) {
  const { text } = req.body;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "No text provided." });
    return null;
  }
  // Limit input to avoid excessive token usage
  return text.slice(0, 4000);
}

// POST /api/summarize
app.post("/api/summarize", async (req, res) => {
  const text = validateText(req, res);
  if (!text) return;

  try {
    const result = await callOpenAI([
      { role: "system", content: "You are a legal assistant. Summarize the following case note concisely in 2-3 sentences. Be factual and professional." },
      { role: "user",   content: text },
    ], 200);
    res.json({ result });
  } catch (err) {
    console.error("[/api/summarize]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/extract-tasks
app.post("/api/extract-tasks", async (req, res) => {
  const text = validateText(req, res);
  if (!text) return;

  try {
    const raw = await callOpenAI([
      { role: "system", content: 'You are a legal assistant. Extract all actionable tasks from the following case note. Return ONLY a JSON array of short task strings. Example: ["File motion by Friday","Call client to confirm"]. No explanation, no markdown.' },
      { role: "user",   content: text },
    ], 300);

    let result;
    try {
      result = JSON.parse(raw);
      if (!Array.isArray(result)) throw new Error();
    } catch {
      // Fallback: wrap the raw text as a single item
      result = [raw.trim()];
    }
    res.json({ result });
  } catch (err) {
    console.error("[/api/extract-tasks]", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`LegalTrack AI server running at http://localhost:${PORT}`);
});
