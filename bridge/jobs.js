import { broadcast } from './notifier.js';
import { formatSeed } from './formatter.js';
import { summarize } from './summarizer.js';
import { addSignals } from './watchlist.js';

const MF_API = process.env.MF_API_URL || 'http://mirofish-api:5001';
const TIMEOUT_MS = 20 * 60 * 1000;
const POLL_MS = 10000;

const STAGES = [
  ['building world model', 20], ['spawning agents', 40],
  ['running simulation', 60], ['generating report', 80],
];

export async function runPrediction(event) {
  const seed = formatSeed(event);
  const simRes = await fetchRetry(`${MF_API}/api/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed, rounds: 30 }),
  });
  const { job_id } = await simRes.json();
  broadcast({ type: 'progress', sim_id: job_id, stage: 'queued', pct: 5 });

  const report = await pollForReport(job_id);
  broadcast({ type: 'progress', sim_id: job_id, stage: 'summarizing', pct: 90 });

  const summary = await summarize(report);
  const signals = addSignals(job_id, event.id, event.title, summary.signals || []);
  broadcast({ type: 'complete', sim_id: job_id, report: summary, signals });
  return { sim_id: job_id, report: summary, signals };
}

async function pollForReport(jobId) {
  const start = Date.now();
  let stageIdx = 0;
  while (Date.now() - start < TIMEOUT_MS) {
    await sleep(POLL_MS);
    const res = await fetch(`${MF_API}/api/report/${jobId}`);
    if (!res.ok) continue;
    const data = await res.json();
    if (stageIdx < STAGES.length) {
      broadcast({ type: 'progress', sim_id: jobId, stage: STAGES[stageIdx][0], pct: STAGES[stageIdx][1] });
      stageIdx++;
    }
    if (data.status === 'complete') return data.report;
    if (data.status === 'failed') throw new Error(`Simulation failed: ${data.error || 'unknown'}`);
  }
  throw new Error('Simulation timed out after 20 minutes');
}

async function fetchRetry(url, opts, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, opts);
    if (res.ok) return res;
    if (i < retries - 1) await sleep(2 ** i * 1000);
  }
  throw new Error(`MF API failed after ${retries} retries`);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
