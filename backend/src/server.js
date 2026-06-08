import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool, closePool } from './config/database.js';
import { initWebSocket } from './realtime/ws.js';

const app = createApp();

const server = app.listen(env.port, async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`[vetcore] API на http://localhost:${env.port} (db: ok, env: ${env.nodeEnv})`);
  } catch (err) {
    console.error('[vetcore] УВАГА: немає підключення до БД —', err.message);
    console.error('         Запусти `npm run db:migrate && npm run db:seed`');
  }
});

initWebSocket(server);

async function shutdown(signal) {
  console.log(`\n[vetcore] ${signal} — зупинка...`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
