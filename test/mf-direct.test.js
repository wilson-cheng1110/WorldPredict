// MF-direct test — talks to MiroFish API directly, bypassing the bridge.
// Assumes mock-services.js is running (node test/mock-services.js).
// Also passes against the real MiroFish API if MF_API_URL points at it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const MF = process.env.MF_API_URL || 'http://localhost:5001';

async function poll(jobId, { timeoutMs = 30_000, intervalMs = 1000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${MF}/api/report/${jobId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'complete' || data.status === 'failed') return data;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`poll timeout after ${timeoutMs}ms`);
}

test('POST /api/simulate returns queued job_id', async () => {
  const res = await fetch(`${MF}/api/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed: 'EVENT: test\nPREDICT: anything', rounds: 30 }),
  });
  assert.equal(res.ok, true);
  const { job_id, status } = await res.json();
  assert.match(job_id, /^mf_/, 'job_id should be mf_*');
  assert.ok(['queued', 'running'].includes(status), `unexpected initial status: ${status}`);
});

test('GET /api/report/:id returns running then complete', { timeout: 30_000 }, async () => {
  const res = await fetch(`${MF}/api/simulate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed: 'EVENT: chip embargo\nPREDICT: ?' }),
  });
  const { job_id } = await res.json();
  // Immediate check — should be running (mock completes after 8s)
  const immediate = await (await fetch(`${MF}/api/report/${job_id}`)).json();
  assert.ok(['running', 'queued'].includes(immediate.status));
  // Wait for completion
  const done = await poll(job_id);
  assert.equal(done.status, 'complete');
  assert.equal(typeof done.report, 'string');
  assert.ok(done.report.length > 100, 'report should be substantive');
});

test('GET /api/report/:id with bogus id returns 404', async () => {
  const res = await fetch(`${MF}/api/report/mf_does_not_exist`);
  assert.equal(res.status, 404);
});
