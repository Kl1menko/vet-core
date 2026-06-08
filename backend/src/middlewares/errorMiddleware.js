import { ApiError } from '../utils/ApiError.js';
import { isProd } from '../config/env.js';

export function notFoundMiddleware(_req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Маршрут не знайдено' },
  });
}

// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, fields: err.fields || undefined },
    });
  }

  // Постгрес: унікальність
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'Запис із такими даними вже існує' },
    });
  }
  // Постгрес: порушення FK
  if (err.code === '23503') {
    return res.status(409).json({
      success: false,
      error: { code: 'FK_VIOLATION', message: "Порушено зв'язок із пов'язаним записом" },
    });
  }

  console.error('[error]', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Внутрішня помилка сервера',
      ...(isProd ? {} : { detail: err.message }),
    },
  });
}
