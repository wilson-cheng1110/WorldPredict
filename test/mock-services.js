// Mock WorldMonitor (:5173) and MiroFish API (:5001) for local testing
import express from 'express';

// --- Mock WorldMonitor ---
const wm = express();
wm.use((_, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); });

const EVENTS = [
  {
    id: 'wm_001', title: 'US imposes new tariffs on semiconductor exports to China',
    description: 'The United States announced sweeping new tariffs targeting semiconductor exports to China, affecting chipmakers including TSMC, Intel, and Samsung. Trade tensions expected to escalate.',
    source: 'Reuters', published_at: new Date().toISOString(), region: 'US/ASIA', category: 'geopolitics',
    url: 'https://example.com/tariffs'
  },
  {
    id: 'wm_002', title: 'Major earthquake strikes central Turkey, magnitude 6.8',
    description: 'A powerful 6.8 magnitude earthquake hit central Turkey early Monday, causing widespread damage to infrastructure and displacing thousands of residents.',
    source: 'AP News', published_at: new Date().toISOString(), region: 'MENA', category: 'disaster',
    url: 'https://example.com/quake'
  },
  {
    id: 'wm_003', title: 'European Central Bank signals surprise rate cut amid recession fears',
    description: 'ECB President signaled an unexpected rate cut as eurozone manufacturing data shows continued contraction for the sixth consecutive month.',
    source: 'Bloomberg', published_at: new Date().toISOString(), region: 'EU', category: 'finance',
    url: 'https://example.com/ecb'
  },
];

// For matcher testing: after a prediction, inject a "confirming" event
let confirmingEvents = [];
export function addConfirmingEvent(ev) { confirmingEvents.push(ev); }

wm.use(express.json());
wm.post('/inject', (req, res) => { confirmingEvents.push(req.body); res.json({ ok: true, queued: confirmingEvents.length }); });

wm.get('/api/events', (req, res) => {
  console.log('[mock-wm] GET /api/events', req.query);
  if (req.query.since) {
    // Matcher polling — return confirming events if any
    const evts = confirmingEvents.splice(0);
    return res.json(evts);
  }
  res.json(EVENTS);
});

wm.listen(5173, () => console.log('[mock-wm] WorldMonitor mock on :5173'));

// --- Mock MiroFish API ---
const mf = express();
mf.use(express.json());
mf.use((_, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); });

const jobs = {};

mf.post('/api/simulate', (req, res) => {
  const job_id = 'mf_' + Math.random().toString(36).slice(2, 8);
  console.log(`[mock-mf] POST /api/simulate → ${job_id}`);
  console.log(`[mock-mf] Seed preview: ${(req.body.seed || '').slice(0, 100)}...`);
  jobs[job_id] = { status: 'running', created: Date.now() };

  // Simulate completion after 8 seconds
  setTimeout(() => {
    jobs[job_id] = {
      status: 'complete',
      report: `SIMULATION REPORT FOR JOB ${job_id}

The simulation ran 500 agents across economic, political, and social domains for 30 rounds.

ECONOMIC EFFECTS:
Semiconductor supply chains face immediate disruption. TSMC and Samsung see order cancellations from Chinese firms. Stock prices for major chip companies drop 3-7% within the first week. Chinese domestic chip production accelerates but cannot fill the gap for 18-24 months. Vietnam and India see increased foreign direct investment as companies diversify manufacturing.

GEOPOLITICAL EFFECTS:
China retaliates with counter-tariffs on US agricultural products within 30 days. EU attempts mediation but ultimately sides with US on technology restrictions. Taiwan's strategic importance increases, raising military tension in the strait. ASEAN nations face pressure to choose sides in the technology cold war.

SUPPLY CHAIN EFFECTS:
Global electronics prices rise 5-12% within 3 months. Automotive industry faces renewed chip shortage. Cloud computing expansion slows as data center builds are delayed. Consumer electronics launch timelines pushed back by major manufacturers.

SOCIAL EFFECTS:
Tech sector layoffs in China reach 50,000+ within 6 months. US consumers face higher electronics prices. Anti-American sentiment grows in Chinese social media. Tech workers in Taiwan increasingly emigrate amid uncertainty.`
    };
  }, 8000);

  res.json({ job_id, status: 'queued' });
});

mf.get('/api/report/:id', (req, res) => {
  const job = jobs[req.params.id];
  if (!job) return res.status(404).json({ error: 'not found' });
  console.log(`[mock-mf] GET /api/report/${req.params.id} → ${job.status}`);
  res.json(job);
});

mf.listen(5001, () => console.log('[mock-mf] MiroFish mock on :5001'));
