import { WebSocketServer } from 'ws';
import { verifyToken } from '../config/auth.js';

/**
 * Real-time через WebSocket (ТЗ §17). Клієнт під'єднується на /ws?token=<jwt>.
 * Розсилання обмежене межами клініки.
 */
let wss = null;

export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      const payload = verifyToken(token);
      ws.clinicId = payload.clinicId;
      ws.userId = payload.sub;
      ws.isAlive = true;
      ws.send(JSON.stringify({ event: 'connected', data: { ts: Date.now() } }));
    } catch {
      ws.close(4001, 'unauthorized');
      return;
    }
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', () => { /* клієнт нічого не шле у MVP */ });
  });

  // heartbeat — прибирати «мертві» з'єднання
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);
  wss.on('close', () => clearInterval(interval));

  console.log('[vetcore] WebSocket на ws://…/ws');
  return wss;
}

/**
 * Розіслати подію всім клієнтам клініки.
 * event: 'appointment.created' | 'invoice.paid' | 'stock.low' | ...
 */
export function broadcast(clinicId, event, data = {}) {
  if (!wss) return;
  const msg = JSON.stringify({ event, data, ts: Date.now() });
  wss.clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN && ws.clinicId === clinicId) ws.send(msg);
  });
}
