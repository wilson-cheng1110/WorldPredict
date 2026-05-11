# Draft post for koala73/worldmonitor

Where to post (in order of preference):
1. **Discussions → Show and tell** if Discussions are enabled
2. Issue with label `discussion` if not
3. Reddit r/selfhosted cross-link only after one of the above

---

## Title

Built a self-hosted bridge that turns WorldMonitor events into agent-based predictions + tracks confirmations

## Body

Hey folks — I've been using WorldMonitor as my daily situational-awareness dashboard for a while, and I wanted to share something I built on top of it.

**Worldcast** is a small Node.js bridge that lets you click any event on the WM globe and ask: "what happens next?" It then:

1. Formats the WM event into a structured seed
2. Sends it to [MiroFish](https://github.com/666ghj/MiroFish) (multi-agent simulation engine) to run a downstream-effects sim
3. Summarizes the raw simulation report into Markets / Geopolitics / Supply Chain bullets
4. Extracts 3-5 specific, time-bound watch signals (e.g. "TSMC drops >3% within 5 days")
5. **Re-polls WM every 60s and fires a browser notification when reality matches a signal**

That last loop is the part I think WM users might find interesting — it turns the dashboard from "what is happening now" into "what did I predict that just came true."

**Worldcast does not modify WM in any way.** It runs as a separate container in docker-compose and only consumes the public `/api/...` endpoints. Update WM with `docker compose pull` like any other service.

Tech: tiny Express + WebSocket bridge (~250 lines across 7 modules), single-file vanilla-JS UI, configurable LLM (default qwen-plus, works with Ollama / OpenAI). AGPL-3.0, same as WM.

**Repo:** https://github.com/wilson-cheng1110/WorldPredict

Couple of questions for the WM community if anyone has thoughts:

- The matcher currently aggregates `GET /api/events`. I noticed the real WM has 30+ specialized endpoints (`/api/news/v1/list-feed-digest`, `/api/intelligence/v1/list-cross-source-signals`, etc.). Which would you prioritize for cross-source confirmation? Right now I'm leaning toward the cross-source signals endpoint since it's already deduplicated.
- Anyone tried the new MCP tools (Tier-1+2 coverage looks great) for this kind of use case? Curious whether I should swap the polling loop for MCP tool calls.

Happy to take feedback, PRs, or "actually you should just put this in WM as a plugin." Whatever's most useful.

Thanks for building such a great dashboard.
