import { llmCall } from './llm.js';
import { getOpen, confirm } from './watchlist.js';
import { broadcast } from './notifier.js';

const WM_URL = process.env.WM_URL || 'http://worldmonitor:5173';
const INTERVAL = parseInt(process.env.MATCH_POLL_INTERVAL_MS || '60000', 10);
const THRESHOLD = parseFloat(process.env.MATCH_CONFIDENCE_THRESHOLD || '0.8');

const PROMPT = (signal, event) =>
  `Does this incoming news event confirm the predicted signal?\n\nSignal: "${signal}"\nIncoming event: "${event}"\n\nReturn ONLY valid JSON: { "score": 0.0-1.0, "reasoning": "one sentence" }\nRules:\n- score 0.9+ = direct confirmation\n- score 0.7-0.9 = strong indirect evidence\n- score below 0.7 = not confirmed\n- No preamble, raw JSON only`;

export function startMatcher() {
  console.log(`[matcher] polling every ${INTERVAL / 1000}s, threshold ${THRESHOLD}`);
  setInterval(matchCycle, INTERVAL);
}

async function matchCycle() {
  try {
    const signals = getOpen();
    if (!signals.length) return;
    const res = await fetch(`${WM_URL}/api/events?since=60s`);
    if (!res.ok) { console.warn(`[matcher] WM ${res.status}`); return; }
    const events = await res.json();
    if (!events.length) return;
    for (const event of events) {
      for (const signal of signals) {
        const eventText = `${event.title}. ${(event.description || '').slice(0, 200)}`;
        const result = await scoreWithRetry(signal.text, eventText);
        if (result.score >= THRESHOLD) {
          const confirmed = confirm(signal.id, event, result.score, result.reasoning);
          broadcast({ type: 'signal_confirmed', signal: confirmed, matched_event: event, score: result.score, reasoning: result.reasoning });
          console.log(`[matcher] CONFIRMED: "${signal.text}" (${result.score})`);
        }
      }
    }
  } catch (err) { console.warn('[matcher] cycle error:', err.message); }
}

async function scoreWithRetry(signalText, eventText) {
  const raw = await llmCall(PROMPT(signalText, eventText));
  const result = parseScore(raw);
  if (result) return result;
  const retry = await llmCall(PROMPT(signalText, eventText));
  return parseScore(retry) || { score: 0, reasoning: 'parse error' };
}

function parseScore(raw) {
  const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}
