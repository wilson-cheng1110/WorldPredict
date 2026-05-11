import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const tmp = mkdtempSync(join(tmpdir(), 'wc-unit-'));
const WL = join(tmp, 'watchlist.json');
process.env.WATCHLIST_PATH = WL;
process.env.SIGNAL_DEFAULT_EXPIRY_DAYS = '7';
writeFileSync(WL, '[]');

const { formatSeed } = await import('../bridge/formatter.js');
const { parseJSON } = await import('../bridge/summarizer.js');
const { parseScore } = await import('../bridge/matcher.js');
const watchlist = await import('../bridge/watchlist.js');

test('formatter: produces all required seed lines', () => {
  const seed = formatSeed({
    title: 'US tariffs',
    description: 'United States imposes tariffs on TSMC chips from China',
    source: 'Reuters', region: 'US/ASIA', category: 'geopolitics',
    published_at: '2025-03-27T04:20:00Z',
  });
  for (const k of ['EVENT:', 'DATE:', 'SOURCE:', 'REGION:', 'CATEGORY:', 'CONTEXT:', 'KEY ENTITIES:', 'PREDICT:']) {
    assert.match(seed, new RegExp(`^${k}`, 'm'));
  }
  assert.match(seed, /TSMC|United States|China/);
});

test('formatter: tolerates missing optional fields', () => {
  const seed = formatSeed({ title: 'Bare event' });
  assert.match(seed, /SOURCE: Unknown/);
  assert.match(seed, /REGION: Global/);
  assert.match(seed, /CATEGORY: general/);
});

test('summarizer parseJSON: strict JSON', () => {
  const r = parseJSON('{"markets":["a"],"signals":[]}');
  assert.deepEqual(r.markets, ['a']);
});

test('summarizer parseJSON: tolerates preamble', () => {
  const r = parseJSON('Here is the summary:\n{"markets":["a"],"geopolitics":[]}');
  assert.deepEqual(r.markets, ['a']);
});

test('summarizer parseJSON: strips ```json fences', () => {
  const r = parseJSON('```json\n{"markets":["x"]}\n```');
  assert.deepEqual(r.markets, ['x']);
});

test('summarizer parseJSON: returns null on garbage', () => {
  assert.equal(parseJSON('no json at all'), null);
  assert.equal(parseJSON('{ broken'), null);
});

test('matcher parseScore: strict JSON', () => {
  const r = parseScore('{"score":0.9,"reasoning":"direct"}');
  assert.equal(r.score, 0.9);
});

test('matcher parseScore: tolerates preamble + fences', () => {
  const r = parseScore('Sure!\n```json\n{"score":0.7,"reasoning":"meh"}\n```');
  assert.equal(r.score, 0.7);
});

test('matcher parseScore: null on garbage', () => {
  assert.equal(parseScore('nope'), null);
});

test('watchlist: addSignals + getOpen', () => {
  writeFileSync(WL, '[]');
  const added = watchlist.addSignals('sim1', 'wm1', 'Title', [
    { text: 'TSMC drops 3%', timeframe_days: 5, category: 'markets' },
    { text: 'China retaliates', timeframe_days: 30, category: 'geopolitics' },
  ]);
  assert.equal(added.length, 2);
  assert.equal(added[0].status, 'watching');
  assert.match(added[0].id, /^sig_/);
  assert.equal(watchlist.getOpen().length, 2);
});

test('watchlist: confirm transitions status + records match', () => {
  writeFileSync(WL, '[]');
  const [sig] = watchlist.addSignals('sim2', 'wm2', 'T', [{ text: 'x', timeframe_days: 5, category: 'markets' }]);
  const confirmed = watchlist.confirm(sig.id, { id: 'wm_match', title: 'matched' }, 0.95, 'because');
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.match_score, 0.95);
  assert.equal(confirmed.matched_event.id, 'wm_match');
  assert.equal(watchlist.getOpen().length, 0);
});

test('watchlist: confirm on missing id returns null', () => {
  assert.equal(watchlist.confirm('sig_nope', {}, 1, 'x'), null);
});

test('watchlist: auto-expires past-deadline signals on read', () => {
  writeFileSync(WL, JSON.stringify([{
    id: 'sig_old', sim_id: 's', wm_event_id: 'w', wm_event_title: 't',
    text: 'old', timeframe_days: 1, category: 'markets', status: 'watching',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    expires_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    matched_event: null, confirmed_at: null,
  }]));
  assert.equal(watchlist.getOpen().length, 0);
  const all = JSON.parse(readFileSync(WL, 'utf8'));
  assert.equal(all[0].status, 'expired');
});
