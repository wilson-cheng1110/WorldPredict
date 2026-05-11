# Roadmap

## v1 — Mock mode (current)

What works today, end-to-end, with one `npm run quickstart`:

- Bridge boots, exposes `POST /predict`, `GET /history`, `GET /signals`, and a WS.
- UI renders the feed, predict flow, progress bar, report panel with watch signals, and history tab.
- Mock WorldMonitor (3 sample events) and mock MiroFish API (returns a fixed semiconductor-tariff report after 8 s) make the full loop run without Docker.
- Matcher polls every 60 s, scores incoming events against open signals via the configured LLM, fires WS notifications when score ≥ 0.8.
- Test suite: unit (formatter, parsers, watchlist), MF-direct (mock-MF contract), and integration (live bridge + mocks + LLM).

Limitations of mock mode:

- The mock MF returns the same hard-coded report regardless of input seed — fine for validating the bridge, not for actually predicting anything.
- The Globe and Simulation iframes are blank because the mocks have no UI.
- Watch-signal matches use the real LLM, so the matcher results are meaningful even on mock data.

## v2 — Real-stack support (not yet a one-command experience)

The Docker images referenced in `docker-compose.yml` are not published on a public registry:

- `koala73/worldmonitor:latest` — does not exist on Docker Hub
- `666ghj/mirofish-api:latest` — does not exist on Docker Hub
- `666ghj/mirofish-ui:latest` — does not exist on Docker Hub

Until that changes, anyone running `docker compose up` from a fresh clone gets "image not found." Options to fix:

- Wait for the upstream projects to publish images
- Push images of our own (requires AGPL compliance for redistributing upstream code, plus CI)
- Switch `docker-compose.yml` to `build: ../worldmonitor` etc., with documentation telling users to clone both upstreams as siblings

The third is the most likely v2 path.

### Real WorldMonitor API surface

WorldMonitor in practice does not expose a single `GET /api/events`. It has 30+ specialized services under `/api/news/v1/...`, `/api/conflict/v1/...`, `/api/intelligence/v1/...`. The matcher and feed loader will need to either:

- Aggregate `/api/news/v1/list-feed-digest` + `/api/intelligence/v1/list-cross-source-signals`, or
- Use the MCP tools WorldMonitor now exposes (Tier-1+2 coverage, 38 tools as of May 2026) and let the bridge talk to WM over MCP rather than REST

Both options are open questions for the WM community.

### Real MiroFish workflow

MiroFish in practice is not a single `POST /api/simulate`. It's a 7-step async pipeline:

1. Generate ontology
2. Build graph
3. Create simulation
4. Prepare agents
5. Start simulation
6. Generate report
7. Get report

Ontology generation runs against any LLM (Ollama tested working). Everything from step 2 onward requires a Zep Cloud API key.

Files in the bridge that will need updating for the real workflow: `jobs.js` (multi-step orchestration), `formatter.js` (richer seed for ontology step), and probably a new `mf-client.js` to keep the steps tidy. Files that should survive untouched: `watchlist.js`, `notifier.js`, `llm.js`, `summarizer.js`.

## v3 — Ideas

Stretch goals from the original TODO that are still open:

- Email / Telegram notification alternative to browser push
- Scheduled predictions: auto-predict top N events every morning
- Prediction accuracy dashboard: hit rate over time across all signals
- Multi-event simulation: seed MF with 2–3 simultaneous events
- Exportable report (PDF / Markdown)
