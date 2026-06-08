/** Успішна відповідь у форматі ТЗ §10. */
export function ok(res, data = {}, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, data, message });
}

export function created(res, data = {}, message = 'Створено') {
  return ok(res, data, message, 201);
}

/** Обгортка для async-контролерів — щоб не писати try/catch скрізь. */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
