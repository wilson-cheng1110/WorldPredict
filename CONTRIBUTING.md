# Contributing to Worldcast

Worldcast is a small, focused bridge between two larger upstream projects: [WorldMonitor](https://github.com/koala73/worldmonitor) and [MiroFish](https://github.com/666ghj/MiroFish). Most useful contributions are small.

## Where to file what

- **Bug in `bridge/`, `ui/`, `docker-compose.yml`, or this repo's docs** — open an issue here.
- **Bug in WorldMonitor (globe, feeds, `/api/...` endpoints)** — file upstream at [koala73/worldmonitor/issues](https://github.com/koala73/worldmonitor/issues). The bridge treats WM as a black box.
- **Bug in MiroFish (simulation engine, agent memory, report generation)** — file upstream at [666ghj/MiroFish/issues](https://github.com/666ghj/MiroFish/issues).
- **Something works in WM/MF but the bridge handles it wrong** — that's us.

If you're unsure, file it here and we'll redirect.

## Dev setup

```bash
git clone https://github.com/wilson-cheng1110/WorldPredict
cd WorldPredict
cp .env.example .env          # LLM_API_KEY required; Zep optional for mock-only dev
cd bridge && npm install
cd ../test && npm install     # mocks + node:test runner
```

### Mock-only dev (no Docker, no Zep, no real WM/MF)

Three terminals, from the repo root:

```bash
node test/mock-services.js               # mock WM :5173, mock MF :5001
cd bridge && npm start                   # bridge :4000
cd ui && python -m http.server 3333      # UI :3333
```

Open <http://localhost:3333>. This covers 90% of the bridge + UI surface. The full `docker compose up` path additionally needs Docker Desktop and a Zep Cloud API key.

### Tests

```bash
node --test test/unit.test.js           # pure functions, no network
node --test test/mf-direct.test.js      # hits mock MF on :5001
node --test test/integration.test.js    # hits bridge + mocks + LLM (Ollama by default)
```

Integration tests need the mock stack and `LLM_BASE_URL` reachable.

## Code style and constraints

`CLAUDE.md` is the source of truth. The short version:

- **Never modify upstream code** — WM and MF run as Docker images.
- **Keep the bridge small** — each file has a target / hard limit in `CLAUDE.md`. If you're crossing the limit, split or simplify.
- **UI is one file.** `ui/index.html`. No bundler, no framework.
- **No new npm dependencies** without a clear reason.
- **Don't cache WM events.** Always fetch fresh in the matcher.
- **Matcher poll interval ≥ 60s.**
- **All state in the bridge.** UI is stateless beyond UI-only prefs.
- **Never log API keys.**

## Submitting a change

1. Fork, branch from `master`.
2. Keep the diff focused.
3. Run `node --test test/*.test.js` against the mock stack.
4. UI changes: walk through the affected flow in a browser.
5. Open a PR. The PR template prompts you for a test plan and scope check.

Small, surgical PRs land fast.

## Security

Don't open public issues for security problems. Open a private security advisory on this repo, or contact the maintainer via GitHub.

## Code of Conduct

[Contributor Covenant 2.1](CODE_OF_CONDUCT.md). Be kind, especially with people from the WorldMonitor and MiroFish communities who are new here.
