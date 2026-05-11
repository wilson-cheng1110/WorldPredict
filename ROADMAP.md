# Roadmap

## v1 — Mock mode (current, shipped)

End-to-end loop working with one `npm run quickstart`:

- Bridge: `POST /predict`, `GET /history`, `GET /signals`, WebSocket.
- UI: feed, predict flow, progress bar, report panel with watch signals, history.
- Mock WorldMonitor (3 sample events) and mock MiroFish API (3 category-keyed canned reports — disaster / finance / geopolitics — dispatched by seed keywords).
- Matcher polls WM every 60 s, scores incoming events against open signals via the configured LLM, fires WS notifications when score ≥ 0.8.
- Tests: unit (formatter, parsers, watchlist), MF-direct contract, integration (live bridge + mocks + LLM). All passing.

Honest limitations:

- The three canned MF reports are realistic but fixed. Prediction quality is bounded by the mock; the matcher and summarizer use the real LLM so their behavior is meaningful.
- Globe and Simulation iframes are blank in mock mode (the mocks have no UI).
- Real-stack mode (against actual WM + MF Docker containers) is not yet a one-command experience — see v2.

## v2 — Real-stack support

Goal: `npm run quickstart:real` runs the bridge against actual WorldMonitor and MiroFish, not mocks.

### Blockers

The Docker images referenced in `docker-compose.yml` don't exist on Docker Hub (verified May 2026): `koala73/worldmonitor:latest`, `666ghj/mirofish-api:latest`, `666ghj/mirofish-ui:latest` all return 404. So `docker compose up` from a fresh clone fails. Three resolution paths:

1. **Build from sibling clones** (most likely) — switch compose to `build: ../worldmonitor` and `build: ../MiroFish/backend`; document the clone-two-siblings step
2. **Wait for upstreams to publish images** — passive, uncertain timeline
3. **Republish under our own org** — requires AGPL compliance for redistribution and CI to keep them current

### Concrete work items

- [ ] `mf-client.js`: implement the 7-step real workflow (ontology → graph → sim create → prepare → start → report generate → fetch). Step 1 works against any LLM; steps 2-7 require Zep Cloud.
- [ ] Update `jobs.js` to drive the multi-step pipeline and emit a more granular `progress` WS (currently 4 stages; real flow has 7).
- [ ] Enrich `formatter.js` seed for ontology step — real MF wants explicit entity/relation hints, not just narrative.
- [ ] Replace WM `GET /api/events` polling. Real WM exposes 30+ specialized services; the matcher should aggregate `/api/news/v1/list-feed-digest` + `/api/intelligence/v1/list-cross-source-signals`, **or** move to the new WM MCP tools (Tier-1+2, 38 tools as of May 2026) and talk MCP instead of REST.
- [ ] Update `docker-compose.yml` to use `build:` directives instead of broken `image:` refs.
- [ ] Document the real-stack quickstart honestly: needs Docker, two sibling clones, a Zep Cloud key, and an LLM key. ~10 minutes of setup, not 2.

Files that **don't** need changes for v2: `watchlist.js`, `notifier.js`, `llm.js`, `summarizer.js`, `index.js` (interfaces stay the same).

Open questions for the WM and MF communities (drafted in `docs/community/`):

- WM: which endpoint(s) to aggregate, or jump straight to MCP?
- MF: should `progress` WS expose the 7 internal stages, or stay abstracted? Any path to run MF without Zep?

## v3 — Stretch ideas

Ranked by impact-per-effort once v2 lands:

| Idea | Effort | Impact |
|---|---|---|
| Prediction accuracy dashboard (hit rate over time, per category) | medium | high — gives the project a reason to come back daily |
| Scheduled predictions (auto-predict top N events each morning) | small | medium |
| Email or Telegram notification alternative to browser push | small | medium — browser push is unreliable in practice |
| Multi-event simulation (seed MF with 2-3 simultaneous events) | medium | medium |
| Exportable report (PDF / Markdown) | small | low |
| What-if follow-up chat (perturbation question in the same sim context) | medium-large | unknown — depends on MF's design intent |

## Done

- v1: mock-mode end-to-end loop, animated demo, full test suite, community standards (LICENSE, CODE_OF_CONDUCT, CONTRIBUTING, issue + PR templates), discovery topics on GitHub, draft posts for the two upstream communities.
