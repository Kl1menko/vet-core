import { getToken } from './api.js';

// WebSocket-клієнт (ТЗ §17). Авто-перепідключення з backoff.
// Події віддаються через document CustomEvent('rt:<event>') і загальний 'rt:any'.
let ws = null;
let reconnectTimer = null;
let attempts = 0;

export function connectRealtime() {
  const token = getToken();
  if (!token) return;
  disconnectRealtime();

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`);

  ws.addEventListener('open', () => { attempts = 0; });

  ws.addEventListener('message', (m) => {
    let msg;
    try { msg = JSON.parse(m.data); } catch { return; }
    if (!msg.event) return;
    document.dispatchEvent(new CustomEvent(`rt:${msg.event}`, { detail: msg.data }));
    document.dispatchEvent(new CustomEvent('rt:any', { detail: msg }));
  });

  ws.addEventListener('close', (e) => {
    ws = null;
    if (e.code === 4001) return; // unauthorized — не перепідключаємось
    scheduleReconnect();
  });
  ws.addEventListener('error', () => { try { ws.close(); } catch { /* ignore */ } });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const delay = Math.min(30_000, 1000 * 2 ** attempts);
  attempts++;
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connectRealtime(); }, delay);
}

export function disconnectRealtime() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { try { ws.close(); } catch { /* ignore */ } ws = null; }
}

export function onRealtime(event, handler) {
  const fn = (e) => handler(e.detail);
  document.addEventListener(`rt:${event}`, fn);
  return () => document.removeEventListener(`rt:${event}`, fn);
}
