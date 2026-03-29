# TODO — Worldcast Build Order

Work through these in order. Don't skip steps — each one validates the next.

---

## Phase 1 — Environment (Day 1, ~1h)

- [ ] Install Docker Desktop, Node.js 18+
- [ ] Create Alibaba Bailian account → get `LLM_API_KEY` (free tier)
- [ ] Create Zep Cloud account → get `ZEP_API_KEY` (free tier)
- [ ] `git clone https://github.com/koala73/worldmonitor` → run it → confirm `:5173` loads
- [ ] `git clone https://github.com/666ghj/MiroFish` → run it → confirm `:3000` and `:5001` load
- [ ] Manually upload one test seed to MiroFish UI → confirm a simulation runs end to end
- [ ] Understand what MiroFish's `/api/simulate` and `/api/report/:id` look like (check their docs/source)

**Exit criteria:** Both apps run locally. You've seen a simulation complete with your own eyes.

---

## Phase 2 — Docker Compose (Day 1, ~30min)

- [ ] Create `worldcast/` repo, init git
- [ ] Write `docker-compose.yml` — pull WM + MF as images, add empty bridge + ui services
- [ ] Write `.env.example` — document every key with a comment
- [ ] `docker compose up` — confirm all services start
- [ ] Confirm WM still accessible at `:5173`, MF at `:3000` / `:5001`
- [ ] Add `X-Frame-Options` env override to WM + MF services so iframes work

**Exit criteria:** `docker compose up` from a fresh clone boots everything.

---

## Phase 3 — Bridge skeleton (Day 1–2, ~30min)

- [ ] `mkdir bridge && cd bridge && npm init -y`
- [ ] `npm install express ws node-fetch`
- [ ] Write `index.js` — bare Express server at `:4000`
- [ ] Add `POST /predict` route — log body, return `{ status: "received" }`
- [ ] Add WebSocket server — broadcast `{ type: "ping" }` every 5 seconds
- [ ] Test with curl: `curl -X POST localhost:4000/predict -d '{"test":true}'`
- [ ] Test WS with wscat or browser console

**Exit criteria:** Bridge runs, receives POST, broadcasts WS messages.

---

## Phase 4 — formatter.js (Day 2, ~1h)

> This is the most important module. Get it right.

- [ ] Call `GET /api/events` on WorldMonitor — inspect the full event object shape
- [ ] Read MiroFish docs on what a seed document should look like
- [ ] Write `formatter.js` — takes a WM event, returns a structured seed string:
  ```
  EVENT: {title}
  DATE: {published_at}
  SOURCE: {source}
  REGION: {region}
  CATEGORY: {category}
  CONTEXT: {full_description}
  KEY ENTITIES: {extracted names, countries, orgs}
  PREDICT: What are the downstream social, political, economic, and supply chain effects?
  ```
- [ ] Test formatter on 3 different event types (geopolitical, financial, disaster)
- [ ] Iterate until the seed text feels rich enough to anchor a simulation

**Exit criteria:** Any WM event object → a well-formed MF seed string.

---

## Phase 5 — jobs.js (Day 2, ~1h)

- [ ] Write `jobs.js` — calls `POST /api/simulate` with formatted seed
- [ ] Store returned `job_id`
- [ ] Poll `GET /api/report/:id` every 10 seconds
- [ ] Emit WS progress events to UI: `{ type: "progress", stage: "building world model", pct: 20 }`
- [ ] On completion, return full raw report
- [ ] Handle timeout (>20 min → mark as failed, notify UI)
- [ ] Handle MF API errors gracefully — log clearly, don't crash bridge

**Progress stages to emit:**
```
building world model    →  20%
spawning agents         →  40%
running simulation      →  60%
generating report       →  80%
summarizing             →  90%
done                    →  100%
```

**Exit criteria:** Full async loop works — POST predict → poll → WS stream → raw report returned.

---

## Phase 6 — summarizer.js (Day 2–3, ~45min)

- [ ] Write `summarizer.js` — takes raw MF report, calls LLM API
- [ ] Prompt produces three sections: markets, geopolitics, supply chain
- [ ] If report too large for context window → summarize in chunks, combine
- [ ] Add watch signals prompt:
  ```
  Finally, output exactly 3-5 specific, verifiable, time-bound signals
  the user should watch for that would confirm or deny this prediction.
  Format: JSON array of { text, timeframe_days, category }
  ```
- [ ] Parse and validate the signals array
- [ ] Test on 3 different raw reports — check output quality

**Exit criteria:** Raw report → clean bullets + validated signals JSON array.

---

## Phase 7 — watchlist.js (Day 3, ~30min)

- [ ] Write `watchlist.js` — simple JSON file store (`watchlist.json`)
- [ ] Functions: `addSignals(simId, signals[])`, `getOpen()`, `confirm(signalId)`, `expire(signalId)`
- [ ] Each signal record:
  ```json
  {
    "id": "uuid",
    "sim_id": "a3f2",
    "text": "TSMC stock drops >3%",
    "timeframe_days": 5,
    "category": "markets",
    "status": "watching",
    "created_at": "...",
    "expires_at": "...",
    "matched_event": null
  }
  ```
- [ ] Auto-expire signals past their timeframe on read

**Exit criteria:** Signals persist across bridge restarts, expire correctly.

---

## Phase 8 — matcher.js + notifier.js (Day 3, ~1h)

> The feature that makes this worth coming back to.

- [ ] Write `matcher.js`:
  - Poll `GET /api/events` on WM every 60 seconds (use `MATCH_POLL_INTERVAL_MS`)
  - For each new event × each open signal → call LLM with match prompt:
    ```
    Signal: "{signal_text}"
    Incoming event: "{event_title} — {event_description}"
    Score 0.0–1.0: does this event confirm the signal?
    Return JSON: { score: float, reasoning: string }
    ```
  - If `score >= MATCH_CONFIDENCE_THRESHOLD` → confirm signal, store matched event
- [ ] Write `notifier.js`:
  - Maintain a registry of connected WS clients
  - `notify(signalId)` → broadcast to all clients:
    ```json
    {
      "type": "signal_confirmed",
      "signal": { ...signal object... },
      "matched_event": { ...WM event object... }
    }
    ```
- [ ] Connect matcher → notifier → WS clients in `index.js`
- [ ] Test: manually insert a signal, mock a matching WM event, confirm notification fires

**Exit criteria:** When a new WM event matches an open signal, all connected UI clients receive a WS notification within 60 seconds.

---

## Phase 9 — ui/index.html (Day 3–4, ~1h)

- [ ] Single HTML file — 4 tabs: Feed, Globe, Simulation, History
- [ ] Feed tab:
  - Fetch events from WM API on load
  - Render event cards with category badge, source, time
  - "Predict this event" button → POST to bridge, subscribe to WS
  - Progress bar driven by WS `progress` events
  - Report panel appears on completion
- [ ] Report panel:
  - Sections: markets, geopolitics, supply chain
  - Watch signals checklist with timeframes
  - "Open simulation ↗" deep link to MF at `/sim/:id`
  - Follow-up chat input → POST to bridge as what-if
- [ ] Globe tab — iframe `WM_UI_URL`, predict button overlaid
- [ ] Simulation tab — iframe `MF_UI_URL/sim/:id`, open-in-MF link
- [ ] History tab — list past predictions, hit/miss status, reopen links
- [ ] Notification system:
  - On load: `Notification.requestPermission()`
  - On WS `signal_confirmed`:
    - Browser push notification: "🔔 Prediction confirmed: {signal_text}"
    - In-app banner at top of UI
    - Mark signal checkbox green in report panel
    - Add to history with confirmed status

**Exit criteria:** Full loop works end to end in the browser.

---

## Phase 10 — Polish + Launch (Day 4, ~1h)

- [ ] Test full loop on 3 real events from different categories
- [ ] Write clean error states in UI (sim failed, WM unreachable, etc.)
- [ ] Record 90-second demo video: open WM globe → pick event → predict → watch report → get notification
- [ ] Write `docs/index.html` GitHub Pages landing page:
  - One-liner, demo video embed, "Get started" → GitHub repo link
- [ ] Final README pass — add screenshot, architecture diagram, demo GIF
- [ ] Push to GitHub, enable GitHub Pages on `docs/` folder
- [ ] Post to Reddit r/selfhosted, r/LocalLLaMA, HackerNews Show HN

---

## Stretch goals (after v1 ships)

- [ ] Email/Telegram notification option (alternative to browser push)
- [ ] Scheduled predictions — auto-predict top 3 events every morning
- [ ] Prediction accuracy dashboard — track hit rate over time across all signals
- [ ] Multi-event simulation — seed MF with 2–3 simultaneous events
- [ ] Exportable report as PDF/markdown
