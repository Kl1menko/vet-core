import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { apiRouter } from './routes.js';
import { authMiddleware } from './middlewares/authMiddleware.js';
import { notFoundMiddleware, errorMiddleware } from './middlewares/errorMiddleware.js';
import { ok } from './utils/response.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, '../../frontend');
const uploadsDir = path.resolve(__dirname, '../../uploads');

export function createApp() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health
  app.get('/api/health', (_req, res) => ok(res, { status: 'up', ts: new Date().toISOString() }));

  // API
  app.use('/api', apiRouter);

  // Завантажені файли
  app.use('/uploads', express.static(uploadsDir));

  // Статика frontend
  app.use(express.static(frontendDir));

  // SPA-fallback: усе, що не /api і не файл — на index.html
  app.get(/^(?!\/api).*/, (req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(frontendDir, 'index.html'));
  });

  app.use('/api', notFoundMiddleware);
  app.use(errorMiddleware);

  // Експортуємо для модулів, яким треба захищений підроутер
  app.locals.authMiddleware = authMiddleware;
  return app;
}
