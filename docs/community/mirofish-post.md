# Draft post for 666ghj/MiroFish

Where to post (in order of preference):
1. **Discussions → Show and tell** if Discussions are enabled
2. Issue with label `discussion` if not
3. r/LocalLLaMA cross-link only after one of the above

Note: MiroFish's primary audience reads Chinese. Consider posting both EN and a 中文 version. A draft 中文 version follows the English one below.

---

## Title (EN)

Worldcast: feeding live WorldMonitor news events into MiroFish for "what happens next" predictions

## Body (EN)

Hi everyone — I built a small bridge tool that uses MiroFish, and wanted to share it here in case it's useful or the community has feedback.

**Worldcast** is a thin bridge that takes any live news event from [WorldMonitor](https://github.com/koala73/worldmonitor) (real-time news/intelligence globe), formats it into a structured seed document, and pipes it straight into MiroFish's simulation workflow. The resulting agent simulation gets summarized into plain-English bullets across markets, geopolitics, and supply chain — plus a checklist of specific, verifiable watch signals.

What the bridge does NOT do: modify MiroFish in any way. It calls `POST /api/simulate` and polls `GET /api/report/:id`, treating MF as a black box. Update MF with `docker compose pull`.

Example seed flow:

```
EVENT: US imposes new tariffs on semiconductor exports
DATE: 2026-05-11
SOURCE: Reuters
REGION: US/ASIA
CATEGORY: geopolitics
CONTEXT: {full article body}
KEY ENTITIES: United States, China, TSMC, Samsung, semiconductors
PREDICT: What are the downstream social, political, economic,
         and supply chain effects of this event over 6-18 months?
```

The simulation report comes back narrative-form; the bridge then asks the LLM to extract:

- 3 short bullets per domain (markets / geopolitics / supply chain)
- 3-5 verifiable, time-bound signals to watch for

Then the **real** trick: the bridge keeps polling WM for new events every 60s, scores each against the open watch signals via a cheap LLM call, and fires a browser notification when the score crosses 0.8. That closes the loop from "MiroFish predicted X" to "X actually happened."

**Repo:** https://github.com/wilson-cheng1110/WorldPredict
**Stack:** Node.js bridge (~250 lines), vanilla-JS UI, configurable LLM (qwen-plus / Ollama / OpenAI). AGPL-3.0.

Questions for the MF community if anyone has time:

- I currently target a simple `POST /api/simulate` shape. In real MF the workflow is multi-step (ontology → graph → sim create → prepare → start → report). Should I expose those stages in the progress WS, or is the abstraction fine?
- Zep is required for the post-ontology steps. Any path I'm missing to run MF fully offline for users without Zep Cloud?
- Would a "what-if follow-up" round (UI sends a perturbation question into the same sim context) make sense as a feature, or does that fight the engine's design?

Open to PRs, criticism, "this should just be a MF example app," etc.

Really impressive engine — thanks for building it.

---

## Title (ZH)

Worldcast：把 WorldMonitor 的实时新闻喂给 MiroFish，做"接下来会发生什么"的预测

## Body (ZH)

大家好——我做了一个基于 MiroFish 的小工具，发上来分享一下，看看是否对大家有用，也欢迎社区反馈。

**Worldcast** 是一个很薄的桥接层。它把 [WorldMonitor](https://github.com/koala73/worldmonitor)（实时新闻/情报地球仪）上任何一条新闻事件，格式化成结构化的 seed 文档，直接喂进 MiroFish 的仿真流程。仿真结果会被总结成市场 / 地缘政治 / 供应链三个维度的简明 bullet，再加上一份具体、可验证的观察信号清单。

桥接层**不修改** MiroFish 任何代码。只调用 `POST /api/simulate`，轮询 `GET /api/report/:id`，把 MF 当成黑盒。MF 升级直接 `docker compose pull`。

最后那个闭环是我觉得最有意思的部分：桥接层每 60 秒重新轮询 WM 的新事件，用一次轻量级 LLM 调用给每条新事件打分（与所有未确认的观察信号匹配），分数过 0.8 时浏览器弹通知。这样就把"MiroFish 预测了 X"变成"X 真的发生了"。

**仓库：** https://github.com/wilson-cheng1110/WorldPredict
**技术栈：** Node.js 桥接（约 250 行），纯 JS 单文件 UI，LLM 可配置（默认 qwen-plus，也支持 Ollama / OpenAI）。协议 AGPL-3.0。

有几个问题想请教社区：

- 目前我假设的接口是简单的 `POST /api/simulate`。真实 MF 是多步骤（ontology → graph → sim → prepare → start → report）。这些阶段应该在 progress WebSocket 里暴露给前端吗？还是保持抽象比较好？
- Zep 是 ontology 之后所有步骤的硬依赖。有没有路径让没有 Zep Cloud 的用户也能完全离线运行 MF？
- 想加一个"what-if 追问"的能力（用户在同一个 sim 上下文里追加扰动问题），这符合引擎设计哲学吗，还是会拧着用？

欢迎 PR、批评、或者"这玩意儿应该直接放进 MF 的 examples"——什么反馈都欢迎。

引擎做得很赞，感谢。
