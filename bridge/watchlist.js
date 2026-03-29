import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const FILE = process.env.WATCHLIST_PATH || '/app/data/watchlist.json';
const DEFAULT_EXPIRY = parseInt(process.env.SIGNAL_DEFAULT_EXPIRY_DAYS || '90', 10);

function load() { try { return JSON.parse(readFileSync(FILE, 'utf8')); } catch { return []; } }
function save(list) { writeFileSync(FILE, JSON.stringify(list, null, 2)); }

export function addSignals(simId, wmEventId, wmEventTitle, signals) {
  const list = load(), now = new Date();
  for (const s of signals) {
    const days = s.timeframe_days || DEFAULT_EXPIRY;
    list.push({
      id: `sig_${randomUUID().slice(0, 8)}`, sim_id: simId,
      wm_event_id: wmEventId, wm_event_title: wmEventTitle,
      text: s.text, timeframe_days: days, category: s.category, status: 'watching',
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + days * 86400000).toISOString(),
      matched_event: null, confirmed_at: null,
    });
  }
  save(list);
  return list.filter((s) => s.sim_id === simId);
}

export function getOpen() {
  const list = load(), now = new Date();
  let changed = false;
  for (const s of list) {
    if (s.status === 'watching' && new Date(s.expires_at) < now) { s.status = 'expired'; changed = true; }
  }
  if (changed) save(list);
  return list.filter((s) => s.status === 'watching');
}

export function confirm(signalId, matchedEvent, score, reasoning) {
  const list = load(), sig = list.find((s) => s.id === signalId);
  if (!sig) return null;
  Object.assign(sig, { status: 'confirmed', matched_event: matchedEvent, confirmed_at: new Date().toISOString(), match_score: score, match_reasoning: reasoning });
  save(list);
  return sig;
}

export function getAll() { return load(); }
