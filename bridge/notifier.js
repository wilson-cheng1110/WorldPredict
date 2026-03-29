import { WebSocketServer } from 'ws';

const clients = new Set();

export function attach(server) {
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
  });
}

export function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    try { ws.send(data); } catch { clients.delete(ws); }
  }
}
