# CLAUDE.md — AI Coding Assistant Instructions

This file tells AI coding assistants (Claude, Cursor, Copilot, etc.) everything they need to know to work on this codebase effectively.

---

## What this project is

**Worldcast** is a lightweight bridge + UI that connects two independent open-source projects:

- **WorldMonitor** (`:5173`) — real-time global news/event dashboard. Treat it as a black box. You never modify its code. It exposes a REST API.
- **MiroFish** (`:5001` API, `:3000` UI) — multi-agent social simulation engine. Treat it as a black box. You never modify its code. It exposes a REST API.
- **Bridge** (`:4000`) — your code. Node.js Express + WebSocket server. Orchestrates WM → MF → summarize → notify.
- **UI** (`:3333`) — your code. Single HTML file. 4 tabs, report panel, watch signals, notification system.

---

## Hard rules — never break these

1. **Never modify WorldMonitor or MiroFish source code.** They run as Docker images. If you need different behavior from them, find a workaround in the bridge.
2. **The bridge must stay small.** Each module should do one thing. If a file exceeds ~80 lines, split it.
3. **The UI is one file.** `ui/index.html` only. No build step, no framework, no bundler. Vanilla JS.
4. **All state is in the bridge.** The UI is stateless — it gets everything from the bridge via REST or WebSocket. No localStorage for application state (localStorage only for UI preferences like dark mode).
5. **Users provide their own API keys.** Never hardcode keys. Never log keys. All keys come from `.env`.
6. **The notification loop must not hammer APIs.** `matcher.js` polls every 60 seconds minimum. Never less. The LLM match call is cheap but not free.

---

## Architecture at a glance

```
ui/index.html
    │
    ├── POST /predict          → bridge/index.js
    ├── WS ws://localhost:4000 → bridge/notifier.js
    └── GET /history           → bridge/watchlist.js

bridge/index.js (entry point)
    ├── formatter.js    WM event object → MF seed string
    ├── jobs.js         POST to MF, poll status, emit WS progress
    ├── summarizer.js   raw MF report → bullets + signals JSON
    ├── watchlist.js    read/write watchlist.json
    ├── matcher.js      poll WM every 60s, score signals vs events
    └── notifier.js     broadcast WS messages to UI clients
```

---

## Key data shapes

### WM event object (from `GET /api/events`)
```json
{
  "id": "wm_abc123",
  "title": "US imposes new tariffs on semiconductor exports",
  "description": "Full article text here...",
  "source": "Reuters",
  "published_at": "2025-03-27T04:20:00Z",
  "region": "US/ASIA",
  "category": "geopolitics",
  "url": "https://..."
}
```

### MF seed (what formatter.js produces)
```
EVENT: US imposes new tariffs on semiconductor exports
DATE: 2025-03-27
SOURCE: Reuters
REGION: US/ASIA
CATEGORY: geopolitics
CONTEXT: {full description text}
KEY ENTITIES: United States, China, Taiwan, TSMC, semiconductors
PREDICT: What are the downstream social, political, economic, and supply chain effects of this event over the next 6-18 months?
```

### MF simulation job (from `POST /api/simulate`)
```json
{ "job_id": "mf_a3f2", "status": "queued" }
```

### MF report (from `GET /api/report/:id`)
```json
{
  "job_id": "mf_a3f2",
  "status": "complete",
  "report": "Raw narrative text, potentially very long..."
}
```

### Summarizer output (what summarizer.js returns)
```json
{
  "markets": ["TSMC likely drops 4-7%...", "..."],
  "geopolitics": ["China counter-tariffs probable...", "..."],
  "supply_chain": ["Vietnam FDI acceleration...", "..."],
  "signals": [
    { "text": "TSMC stock drops >3%", "timeframe_days": 5, "category": "markets" },
    { "text": "China announces agricultural counter-tariffs", "timeframe_days": 90, "category": "geopolitics" }
  ]
}
```

### Watch signal record (in watchlist.json)
```json
{
  "id": "sig_uuid",
  "sim_id": "mf_a3f2",
  "wm_event_id": "wm_abc123",
  "wm_event_title": "US imposes new tariffs...",
  "text": "TSMC stock drops >3%",
  "timeframe_days": 5,
  "category": "markets",
  "status": "watching",
  "created_at": "2025-03-27T04:30:00Z",
  "expires_at": "2025-04-01T04:30:00Z",
  "matched_event": null,
  "confirmed_at": null
}
```

### WS messages (bridge → UI)

All WS messages follow: `{ "type": string, ...payload }`

```json
// Progress during simulation
{ "type": "progress", "sim_id": "mf_a3f2", "stage": "running simulation", "pct": 60 }

// Simulation complete
{ "type": "complete", "sim_id": "mf_a3f2", "report": { ...summarizer output... } }

// Simulation failed
{ "type": "error", "sim_id": "mf_a3f2", "message": "MiroFish timeout after 20 min" }

// Signal confirmed by incoming news
{
  "type": "signal_confirmed",
  "signal": { ...watch signal record... },
  "matched_event": { ...WM event object... },
  "score": 0.92,
  "reasoning": "The incoming event directly describes the predicted counter-tariff announcement"
}
```

---

## Environment variables

| Key | Used in | Notes |
|-----|---------|-------|
| `LLM_API_KEY` | jobs.js, summarizer.js, matcher.js | OpenAI-compatible |
| `LLM_BASE_URL` | all LLM calls | default: Alibaba Bailian |
| `LLM_MODEL_NAME` | all LLM calls | default: qwen-plus |
| `ZEP_API_KEY` | passed through to MiroFish | not used directly in bridge |
| `BRIDGE_PORT` | index.js | default: 4000 |
| `WM_URL` | formatter.js, matcher.js | default: http://worldmonitor:5173 |
| `MF_API_URL` | jobs.js | default: http://mirofish-api:5001 |
| `MF_UI_URL` | ui/index.html | default: http://mirofish-ui:3000 |
| `MATCH_POLL_INTERVAL_MS` | matcher.js | default: 60000, never go lower |
| `MATCH_CONFIDENCE_THRESHOLD` | matcher.js | default: 0.8, range 0.0–1.0 |
| `SIGNAL_DEFAULT_EXPIRY_DAYS` | watchlist.js | default: 90 |

---

## LLM call patterns

### Summarizer prompt (summarizer.js)
```
You are a geopolitical and economic analyst. Given the following simulation report, 
produce a structured summary.

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
{report_text}
```

If report exceeds ~6000 words, split into thirds, summarize each, then combine with a second LLM call.

### Matcher prompt (matcher.js)
```
Does this incoming news event confirm the predicted signal?

Signal: "{signal_text}"
Incoming event: "{event_title}. {event_description_first_200_chars}"

Return ONLY valid JSON: { "score": 0.0-1.0, "reasoning": "one sentence" }
Rules:
- score 0.9+ = direct confirmation
- score 0.7-0.9 = strong indirect evidence  
- score below 0.7 = not confirmed
- No preamble, raw JSON only
```

---

## Common failure modes to handle

| Failure | Where | How to handle |
|---------|-------|---------------|
| MF sim takes >20 min | jobs.js | Timeout, emit `error` WS, mark job failed |
| MF API returns 500 | jobs.js | Retry 3x with exponential backoff, then fail |
| LLM returns malformed JSON | summarizer.js, matcher.js | Try parse, on failure retry once, then use fallback empty structure |
| WM API unreachable | matcher.js, formatter.js | Log warning, skip cycle, don't crash |
| Report too long for context | summarizer.js | Chunk and summarize in parts (see above) |
| Browser notifications denied | ui/index.html | Fall back to in-app banner only, never throw |
| WS client disconnects | notifier.js | Remove from client registry, don't crash on send |

---

## What NOT to do

- Do not add a database. `watchlist.json` is enough for v1.
- Do not add authentication. This is a self-hosted personal tool.
- Do not add a build step to the UI. One HTML file, period.
- Do not cache WM events — always fetch fresh for the matcher.
- Do not run the matcher more than once per minute.
- Do not modify anything in the `worldmonitor/` or `mirofish/` directories if they exist.
- Do not store or log API keys anywhere.
- Do not add npm packages without a strong reason — keep dependencies minimal.

---

## Testing approach

No test framework needed for v1. Manual testing checkpoints:

1. `curl -X POST localhost:4000/predict -H "Content-Type: application/json" -d @test/sample_event.json`
2. Watch WS output with: `npx wscat -c ws://localhost:4000`
3. Check `watchlist.json` after a completed simulation
4. Manually insert a test signal into `watchlist.json`, then POST a matching event to a test endpoint

---

## File size targets

| File | Target | Hard limit |
|------|--------|------------|
| bridge/index.js | 40 lines | 60 lines |
| bridge/formatter.js | 40 lines | 60 lines |
| bridge/jobs.js | 60 lines | 80 lines |
| bridge/summarizer.js | 50 lines | 70 lines |
| bridge/watchlist.js | 40 lines | 60 lines |
| bridge/matcher.js | 50 lines | 70 lines |
| bridge/notifier.js | 30 lines | 40 lines |
| ui/index.html | 160 lines | 200 lines |

If you're going over these, you're overcomplicating it. Split or simplify.
