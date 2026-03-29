import { llmCall } from './llm.js';

const PROMPT = `You are a geopolitical and economic analyst. Given the following simulation report, produce a structured summary.

Return ONLY valid JSON in this exact shape:
{
  "markets": ["bullet 1", "bullet 2", "bullet 3"],
  "geopolitics": ["bullet 1", "bullet 2", "bullet 3"],
  "supply_chain": ["bullet 1", "bullet 2"],
  "signals": [
    { "text": "specific verifiable signal", "timeframe_days": 30, "category": "markets" }
  ]
}

Rules:
- Each bullet max 15 words
- Signals must be specific, verifiable, and time-bound
- 3-5 signals only
- No preamble, no markdown, raw JSON only

REPORT:
`;

const COMBINE = `Combine these partial summaries into one. Return ONLY valid JSON in the same shape (markets[], geopolitics[], supply_chain[], signals[]). Deduplicate. Keep 3-5 signals total.\n\n`;
const FALLBACK = { markets: [], geopolitics: [], supply_chain: [], signals: [] };

export async function summarize(reportText) {
  if (reportText.split(/\s+/).length > 6000) return summarizeChunked(reportText);
  return callAndParse(PROMPT + reportText);
}

async function summarizeChunked(text) {
  const words = text.split(/\s+/);
  const third = Math.ceil(words.length / 3);
  const chunks = [words.slice(0, third), words.slice(third, third * 2), words.slice(third * 2)];
  const partials = await Promise.all(chunks.map((c) => llmCall(PROMPT + c.join(' '))));
  return callAndParse(COMBINE + partials.join('\n---\n'));
}

async function callAndParse(prompt) {
  const raw = await llmCall(prompt);
  const result = parseJSON(raw);
  if (result) return result;
  const retry = await llmCall(prompt);
  return parseJSON(retry) || FALLBACK;
}

function parseJSON(raw) {
  try { return JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()); }
  catch { return null; }
}
