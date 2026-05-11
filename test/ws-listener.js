import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:4000');
ws.on('open', () => console.log('[ws] connected'));
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  const preview = msg.type === 'complete' ? `(report has ${msg.report?.signals?.length || 0} signals)` : '';
  console.log(`[ws] ${msg.type}`, msg.stage || msg.message || preview || '');
});
ws.on('close', () => console.log('[ws] closed'));
ws.on('error', (e) => console.log('[ws] error', e.message));
