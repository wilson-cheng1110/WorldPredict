// Integration test — assumes bridge + mock-services are already running
// (node test/mock-services.js && cd bridge && npm start)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

const BRIDGE = 'http://localhost:4000';
const WM = 'http://localhost:5173';

function collectWS(predicate, timeoutMs) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(BRIDGE.replace('http', 'ws'));
    const seen = [];
    const t = setTimeout(() => { ws.close(); reject(new Error(`ws timeout after ${timeoutMs}ms; saw types: ${seen.map(m => m.type).join(',')}`)); }, timeoutMs);
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      seen.push(msg);
      if (predicate(msg, seen)) { clearTimeout(t); ws.close(); resolve(seen); }
    });
    ws.on('error', (e) => { clearTimeout(t); reject(e); });
  });
}

test('bridge is reachable', async () => {
  const res = await fetch(`${BRIDGE}/history`);
  assert.equal(res.ok, true);
  const list = await res.json();
  assert.ok(Array.isArray(list));
});

test('POST /predict triggers progress → complete WS', { timeout: 120_000 }, async () => {
  const event = {
    id: `wm_int_${Date.now()}`,
    title: 'Integration test event: hypothetical chip embargo',
    description: 'Country A bans semiconductor exports to Country B; supply chains brace for shock.',
    source: 'Test', published_at: new Date().toISOString(),
    region: 'TEST', category: 'geopolitics', url: 'https://example.com/it',
  };
  const wsP = collectWS((m) => m.type === 'complete' || m.type === 'error', 110_000);
  const r = await fetch(`${BRIDGE}/predict`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  assert.equal(r.ok, true);
  const seen = await wsP;
  const terminal = seen.find((m) => m.type === 'complete' || m.type === 'error');
  assert.equal(terminal.type, 'complete', `expected complete; got error: ${terminal.message}`);
  assert.ok(seen.some((m) => m.type === 'progress'), 'expected progress events');
  assert.ok(Array.isArray(terminal.signals), 'expected signals array on complete');
});

test('inject matching event → signal_confirmed within 90s', { timeout: 100_000 }, async () => {
  // Pick first open signal; if none, skip
  const open = await (await fetch(`${BRIDGE}/signals`)).json();
  if (!open.length) return console.log('no open signals — skipped');
  const sig = open[0];
  const matchEvt = {
    id: `wm_match_${Date.now()}`,
    title: `Confirming event: ${sig.text}`,
    description: `Independent reporting confirms: ${sig.text}. Multiple sources report this happened today.`,
    source: 'Test', published_at: new Date().toISOString(),
    region: 'TEST', category: sig.category, url: 'https://example.com/match',
  };
  const wsP = collectWS((m) => m.type === 'signal_confirmed' && m.signal.id === sig.id, 90_000);
  await fetch(`${WM}/inject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(matchEvt) });
  const seen = await wsP;
  const confirmed = seen.find((m) => m.type === 'signal_confirmed');
  assert.equal(confirmed.signal.status, 'confirmed');
  assert.ok(confirmed.score >= 0.8);
});
