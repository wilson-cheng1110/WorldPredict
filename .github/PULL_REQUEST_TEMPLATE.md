## Summary

<!-- 1-3 bullets on what this changes and why. -->

## Test plan

- [ ] `node --test test/unit.test.js` passes
- [ ] `node --test test/mf-direct.test.js` passes (mocks running)
- [ ] `node --test test/integration.test.js` passes (bridge + mocks + LLM running)
- [ ] UI changes: walked through the affected flow in a browser

## Scope check

- [ ] No changes under `worldmonitor/` or `mirofish/` (upstream black boxes)
- [ ] Per-file line targets in `CLAUDE.md` still met (or justification below)
- [ ] No new npm dependencies (or justification below)
- [ ] No hardcoded or logged API keys

## Justification (if any of the above are unchecked)

<!-- Explain. -->
