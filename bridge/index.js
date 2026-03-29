import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { attach, broadcast } from './notifier.js';
import { runPrediction } from './jobs.js';
import { getAll, getOpen } from './watchlist.js';
import { startMatcher } from './matcher.js';

const app = express();
app.use(express.json());
app.use((_, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.post('/predict', async (req, res) => {
  const event = req.body;
  if (!event?.title) return res.status(400).json({ error: 'missing event title' });
  res.json({ status: 'received', message: 'Simulation starting...' });
  runPrediction(event).catch((err) => {
    console.error('[predict] error:', err.message);
    broadcast({ type: 'error', message: err.message });
  });
});

app.get('/signals', (_, res) => res.json(getOpen()));
app.get('/history', (_, res) => res.json(getAll()));

const server = createServer(app);
attach(server);

const PORT = process.env.BRIDGE_PORT || 4000;
server.listen(PORT, () => {
  console.log(`[bridge] listening on :${PORT}`);
  startMatcher();
});
